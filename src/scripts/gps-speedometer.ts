import {
  GAUGE,
  PRESETS,
  UNITS,
  bearing,
  buildGpx,
  compassPoint,
  defaultUnitFor,
  formatDistance,
  formatDuration,
  fromUnit,
  gaugeRange,
  gaugeTicks,
  haversine,
  initialRange,
  polar,
  toUnit,
  type SpeedPreset,
  type SpeedUnit,
  type TrackPoint,
} from '../lib/speed';
import { beep, store, vibrate } from '../lib/browser';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Below this (m/s ≈ 1.8 km/h) we treat the device as stationary — GPS jitter lives here. */
const STATIONARY_MS = 0.5;
/** Minimum speed (m/s) for time and distance to count as "moving". */
const MOVING_MS = 0.8;
const STALE_FIX_MS = 5000;
const MAX_TRACK_POINTS = 50000;

const numberFmt = new Intl.NumberFormat();

type GpsLevel = 'off' | 'good' | 'fair' | 'poor';

interface AlertSettings {
  on: boolean;
  ms: number;
}

class GpsSpeedometer extends HTMLElement {
  private preset!: SpeedPreset;
  private unit: SpeedUnit = 'kmh';
  private range = 0;

  private running = false;
  private watchId: number | null = null;
  private tickTimer = 0;
  private wakeLock: WakeLockSentinel | null = null;

  private last: { lat: number; lon: number; t: number; good: boolean } | null = null;
  private rejected = 0;
  private track: TrackPoint[] = [];
  private speedMs = 0;
  private maxMs = 0;
  private distance = 0;
  private movingMs = 0;
  private elapsedMs = 0;
  private runStartedAt = 0;
  private lastFixAt = 0;
  private altitude: number | null = null;
  private heading: number | null = null;

  private errorShown = false;
  private alert: AlertSettings = { on: false, ms: 0 };
  private over = false;
  private hudOpen = false;
  private hudMirror = true;

  private q<T extends Element = HTMLElement>(sel: string): T {
    const el = this.querySelector<T>(sel);
    if (!el) throw new Error(`gps-speedometer: missing ${sel}`);
    return el;
  }

  private qo<T extends Element = HTMLElement>(sel: string): T | null {
    return this.querySelector<T>(sel);
  }

  connectedCallback(): void {
    const id = this.dataset.preset as keyof typeof PRESETS;
    this.preset = PRESETS[id] ?? PRESETS.car;
    this.unit = this.pickUnit();
    this.alert = store.get<AlertSettings>(`sr:speed:alert:${this.preset.id}`, {
      on: false,
      ms: this.preset.defaultAlertKmh / 3.6,
    });
    this.hudMirror = store.get<boolean>('sr:speed:hud-mirror', true);
    this.range = this.fitRange();

    this.q('[data-toggle]').addEventListener('click', () => (this.running ? this.pause() : void this.start()));
    this.q('[data-reset]').addEventListener('click', () => this.reset());
    this.q('[data-export]').addEventListener('click', () => this.exportGpx());
    this.q('[data-units]').addEventListener('click', (e) => {
      const btn = (e.target as Element).closest<HTMLButtonElement>('[data-unit]');
      if (btn) this.setUnit(btn.dataset.unit as SpeedUnit);
    });

    this.bindAlert();
    this.bindHud();
    this.bindFullscreen();

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && (this.running || this.hudOpen)) void this.acquireWakeLock();
    });

    this.applyUnitUi();
    this.renderTicks();
    this.render();
    void this.checkSupport();
  }

  // ---- Setup ----------------------------------------------------------------------------------

  private pickUnit(): SpeedUnit {
    const allowed = this.preset.units;
    const fromUrl = new URLSearchParams(location.search).get('unit') as SpeedUnit | null;
    if (fromUrl && allowed.includes(fromUrl)) return fromUrl;
    const saved = store.get<SpeedUnit | null>(`sr:speed:unit:${this.preset.id}`, null);
    if (saved && allowed.includes(saved)) return saved;
    const guess = defaultUnitFor(navigator.language || 'en');
    return allowed.includes(guess) ? guess : allowed[0];
  }

  private async checkSupport(): Promise<void> {
    const toggle = this.q<HTMLButtonElement>('[data-toggle]');
    if (!window.isSecureContext) {
      toggle.disabled = true;
      this.message('The speedometer needs a secure (https://) connection to read GPS.');
      return;
    }
    if (!('geolocation' in navigator)) {
      toggle.disabled = true;
      this.message('This browser can’t read your location. Try Chrome, Safari, Edge or Firefox on a phone.');
      return;
    }
    try {
      const status = await navigator.permissions?.query({ name: 'geolocation' });
      if (status?.state === 'denied') {
        this.message('Location access is blocked for this site. Allow it in your browser’s site settings, then press Start.');
        return;
      }
    } catch {
      /* Permissions API not available (older Safari) */
    }
    const desktop = matchMedia('(pointer: fine)').matches && !matchMedia('(any-pointer: coarse)').matches;
    if (desktop) {
      this.message('Tip: most laptops and desktops have no GPS chip, so readings may stay at 0. Open this page on your phone for real speed.');
    } else {
      this.message(`Press Start and allow location access. Your position never leaves this device.`);
    }
  }

  private bindAlert(): void {
    const toggle = this.qo<HTMLButtonElement>('[data-alert-toggle]');
    const input = this.qo<HTMLInputElement>('[data-alert-value]');
    if (!toggle || !input) return;
    const save = () => store.set(`sr:speed:alert:${this.preset.id}`, this.alert);
    toggle.setAttribute('aria-checked', String(this.alert.on));
    toggle.addEventListener('click', () => {
      this.alert.on = !this.alert.on;
      toggle.setAttribute('aria-checked', String(this.alert.on));
      this.over = false;
      save();
      this.render();
    });
    input.addEventListener('change', () => {
      const v = Number.parseFloat(input.value);
      if (!Number.isFinite(v) || v <= 0) {
        input.value = String(Math.round(toUnit(this.alert.ms, this.unit)));
        return;
      }
      this.alert.ms = fromUnit(v, this.unit);
      this.over = false;
      save();
      this.render();
    });
  }

  private bindHud(): void {
    // A modal <dialog> renders in the top layer, above the sticky header and any stacking context around the tool.
    const hud = this.qo<HTMLDialogElement>('[data-hud]');
    const open = this.qo('[data-hud-open]');
    if (!hud || !open) return;
    const close = this.q<HTMLButtonElement>('[data-hud-close]');
    const mirror = this.q('[data-hud-mirror]');

    const applyMirror = () => {
      mirror.setAttribute('aria-pressed', String(this.hudMirror));
      this.q('[data-hud-body]').style.transform = this.hudMirror ? 'scaleX(-1)' : 'none';
    };
    applyMirror();

    open.addEventListener('click', () => {
      this.hudOpen = true;
      hud.showModal();
      document.documentElement.style.overflow = 'hidden';
      if (document.fullscreenEnabled) hud.requestFullscreen?.().catch(() => {});
      void this.acquireWakeLock();
      this.render();
      close.focus();
    });
    // Escape closes a modal dialog natively, so all cleanup runs on its close event.
    hud.addEventListener('close', () => {
      this.hudOpen = false;
      document.documentElement.style.overflow = '';
      if (document.fullscreenElement === hud) void document.exitFullscreen().catch(() => {});
      if (!this.running) void this.releaseWakeLock();
      open.focus();
    });
    close.addEventListener('click', () => hud.close());
    mirror.addEventListener('click', () => {
      this.hudMirror = !this.hudMirror;
      store.set('sr:speed:hud-mirror', this.hudMirror);
      applyMirror();
    });
  }

  private bindFullscreen(): void {
    const btn = this.q<HTMLButtonElement>('[data-fullscreen]');
    const tool = this.q('[data-tool]');
    if (!document.fullscreenEnabled) return;
    btn.hidden = false;
    btn.addEventListener('click', () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void tool.requestFullscreen().catch(() => {});
    });
    document.addEventListener('fullscreenchange', () => {
      btn.setAttribute('aria-label', document.fullscreenElement === tool ? 'Exit full screen' : 'Full screen');
    });
  }

  // ---- Trip lifecycle -------------------------------------------------------------------------

  private async start(): Promise<void> {
    if (this.running || !('geolocation' in navigator)) return;
    this.running = true;
    this.runStartedAt = performance.now();
    this.lastFixAt = 0;
    this.setGps('fair', 'Locating…');
    this.message('Waiting for a GPS fix. Outdoors with a clear sky view this takes a few seconds.');
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.onPosition(pos),
      (err) => this.onError(err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    this.tickTimer = window.setInterval(() => this.tick(), 1000);
    this.updateToggle();
    await this.acquireWakeLock();
  }

  private pause(): void {
    if (!this.running) return;
    this.running = false;
    this.elapsedMs += performance.now() - this.runStartedAt;
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
    clearInterval(this.tickTimer);
    this.last = null;
    this.speedMs = 0;
    this.setGps('off', 'Paused');
    this.message('Paused. Press Resume to continue this trip.');
    if (!this.hudOpen) void this.releaseWakeLock();
    this.updateToggle();
    this.render();
  }

  private reset(): void {
    if (this.track.length > 10 && !confirm('Reset this trip? Max speed, distance and the recorded track will be cleared.')) return;
    const wasRunning = this.running;
    if (wasRunning) this.pause();
    this.track = [];
    this.last = null;
    this.speedMs = 0;
    this.maxMs = 0;
    this.distance = 0;
    this.movingMs = 0;
    this.elapsedMs = 0;
    this.altitude = null;
    this.heading = null;
    this.over = false;
    this.range = this.fitRange();
    this.renderTicks();
    this.setGps('off', 'GPS off');
    this.message('Trip cleared.');
    this.updateToggle();
    this.render();
    if (wasRunning) void this.start();
  }

  private onPosition(pos: GeolocationPosition): void {
    if (!this.running) return;
    const c = pos.coords;
    const t = pos.timestamp || Date.now();
    const good = c.accuracy <= this.preset.maxAccuracyM;
    const cur = { lat: c.latitude, lon: c.longitude, t, good };
    let v: number | null = c.speed !== null && Number.isFinite(c.speed) && c.speed >= 0 ? c.speed : null;

    if (this.last) {
      const dt = (t - this.last.t) / 1000;
      if (dt <= 0) return;
      const d = haversine(this.last, cur);
      const derived = d / dt;
      const implausible = derived > this.preset.maxPlausibleMs && (v === null || v > this.preset.maxPlausibleMs);
      if (implausible && this.rejected < 3) {
        this.rejected++;
        return;
      }
      this.rejected = 0;
      if (v === null) v = d < Math.max(c.accuracy, 5) * 0.5 ? 0 : derived;
      if (good && this.last.good && v >= MOVING_MS && !implausible) {
        this.distance += d;
        this.movingMs += dt * 1000;
      }
      if (c.heading !== null && Number.isFinite(c.heading) && c.heading >= 0 && v >= MOVING_MS) this.heading = c.heading;
      else if (good && d > Math.max(c.accuracy, 10)) this.heading = bearing(this.last, cur);
    }

    if (v === null || v < STATIONARY_MS) v = 0;
    if (!this.lastFixAt || this.errorShown) this.message('');
    this.errorShown = false;
    this.lastFixAt = performance.now();
    this.speedMs = v;
    if (c.altitude !== null && Number.isFinite(c.altitude)) this.altitude = c.altitude;

    if (good) {
      if (v <= this.preset.maxPlausibleMs) this.maxMs = Math.max(this.maxMs, v);
      if (this.track.length < MAX_TRACK_POINTS) {
        this.track.push({ lat: c.latitude, lon: c.longitude, ele: this.altitude, t, speed: v });
      }
      this.last = cur;
    } else if (!this.last) {
      // Keep a reference point so derived speed works even on a weak signal, but don't log it.
      this.last = cur;
    }

    const acc = Math.round(c.accuracy);
    if (c.accuracy <= 10) this.setGps('good', `GPS ±${acc} m`);
    else if (good) this.setGps('fair', `GPS ±${acc} m`);
    else this.setGps('poor', `Weak signal ±${numberFmt.format(acc)} m`);

    const shown = toUnit(v, this.unit);
    if (shown > this.range * 0.92) {
      this.range = gaugeRange(shown / 0.8);
      this.renderTicks();
    }
    this.checkAlert(v);
    this.render();
  }

  private onError(err: GeolocationPositionError): void {
    if (err.code === err.PERMISSION_DENIED) {
      this.pause();
      this.setGps('poor', 'Permission needed');
      this.message('Location access was denied. Allow location for this site in your browser settings, then press Start.');
    } else if (err.code === err.POSITION_UNAVAILABLE) {
      this.errorShown = true;
      this.setGps('poor', 'No signal');
      this.message('No GPS signal yet. Move outdoors or next to a window — it keeps trying automatically.');
    } else if (!this.lastFixAt) {
      this.errorShown = true;
      this.message('Still waiting for a GPS fix… Make sure Location Services are on for your browser.');
    }
  }

  private tick(): void {
    if (this.running && this.lastFixAt && performance.now() - this.lastFixAt > STALE_FIX_MS) {
      const s = Math.round((performance.now() - this.lastFixAt) / 1000);
      this.setGps('poor', `No fix for ${s}s`);
      this.speedMs = 0;
    }
    this.render();
  }

  private checkAlert(v: number): void {
    if (!this.alert.on || !this.preset.speedAlert) {
      this.over = false;
      return;
    }
    const hysteresis = 2 / UNITS[this.unit].perMs;
    if (!this.over && v > this.alert.ms) {
      this.over = true;
      beep(988, 180, 0.12);
      window.setTimeout(() => beep(988, 180, 0.12), 240);
      vibrate([200, 100, 200]);
    } else if (this.over && v < this.alert.ms - hysteresis) {
      this.over = false;
    }
  }

  // ---- Units ----------------------------------------------------------------------------------

  private fitRange(): number {
    const base = initialRange(this.preset, this.unit);
    const peak = toUnit(this.maxMs, this.unit);
    return peak > base * 0.92 ? gaugeRange(peak / 0.8) : base;
  }

  private setUnit(unit: SpeedUnit): void {
    if (!this.preset.units.includes(unit) || unit === this.unit) return;
    this.unit = unit;
    store.set(`sr:speed:unit:${this.preset.id}`, unit);
    const url = new URL(location.href);
    url.searchParams.set('unit', unit);
    history.replaceState(history.state, '', url);
    this.range = this.fitRange();
    this.applyUnitUi();
    this.renderTicks();
    this.render();
  }

  private applyUnitUi(): void {
    this.querySelectorAll<HTMLButtonElement>('[data-unit]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.unit === this.unit)),
    );
    const short = UNITS[this.unit].short;
    this.q('[data-unit-label]').textContent = short;
    const hudUnit = this.qo('[data-hud-unit]');
    if (hudUnit) hudUnit.textContent = short;
    const alertUnit = this.qo('[data-alert-unit]');
    if (alertUnit) alertUnit.textContent = UNITS[this.unit].label;
    const input = this.qo<HTMLInputElement>('[data-alert-value]');
    if (input) input.value = String(Math.round(toUnit(this.alert.ms, this.unit)));
  }

  // ---- Rendering ------------------------------------------------------------------------------

  private renderTicks(): void {
    const g = this.q('[data-ticks]');
    const nodes: SVGElement[] = [];
    for (const t of gaugeTicks(this.range)) {
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', String(t.x1));
      line.setAttribute('y1', String(t.y1));
      line.setAttribute('x2', String(t.x2));
      line.setAttribute('y2', String(t.y2));
      line.setAttribute('stroke-width', t.major ? '1.5' : '1');
      line.setAttribute('class', t.major ? 'stroke-body' : 'stroke-hairline-strong');
      nodes.push(line);
      if (t.major) {
        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('x', String(t.lx));
        text.setAttribute('y', String(t.ly));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('class', 'fill-mute font-mono text-[12px]');
        text.textContent = String(t.value);
        nodes.push(text);
      }
    }
    g.replaceChildren(...nodes);
  }

  private render(): void {
    const decimals = this.unit === 'ms' ? 1 : 0;
    const shown = toUnit(this.speedMs, this.unit);
    const speedText = shown.toFixed(decimals);
    const speedEl = this.q('[data-speed]');
    speedEl.textContent = speedText;
    // 4+ characters (e.g. "250.0" m/s) get a smaller size so they stay inside the gauge's tick labels.
    speedEl.toggleAttribute('data-long', speedText.length > 3);

    const arc = this.q('[data-arc]');
    const pct = Math.min(100, (shown / this.range) * 100);
    arc.setAttribute('stroke-dashoffset', String(100 - pct));
    arc.setAttribute('opacity', pct > 0.5 ? '1' : '0');
    arc.toggleAttribute('data-over', this.over);
    this.q('[data-over-badge]').hidden = !this.over;

    const mark = this.q('[data-limit-mark]');
    if (this.alert.on && this.preset.speedAlert) {
      const deg = GAUGE.start + Math.min(1, toUnit(this.alert.ms, this.unit) / this.range) * GAUGE.sweep;
      const a = polar(deg, GAUGE.r - 9);
      const b = polar(deg, GAUGE.r + 9);
      mark.setAttribute('x1', String(a.x));
      mark.setAttribute('y1', String(a.y));
      mark.setAttribute('x2', String(b.x));
      mark.setAttribute('y2', String(b.y));
      mark.classList.remove('hidden');
    } else {
      mark.classList.add('hidden');
    }

    const elapsed = this.elapsedMs + (this.running ? performance.now() - this.runStartedAt : 0);
    const hasData = this.track.length > 0 || this.distance > 0;
    const unitLabel = UNITS[this.unit].label;
    const dist = formatDistance(this.distance, this.unit);
    const avgMs = this.movingMs > 0 ? this.distance / (this.movingMs / 1000) : 0;
    const imperial = this.unit === 'mph' || this.unit === 'kn';

    this.stat('max', hasData ? toUnit(this.maxMs, this.unit).toFixed(decimals) : '—', unitLabel);
    this.stat('avg', this.movingMs > 0 ? toUnit(avgMs, this.unit).toFixed(decimals) : '—', unitLabel);
    this.stat('distance', hasData ? dist.value : '—', dist.unit);
    this.stat('elapsed', elapsed > 0 ? formatDuration(elapsed) : '—', '');
    this.stat('moving', this.movingMs > 0 ? formatDuration(this.movingMs) : '—', '');
    this.stat('heading', this.heading === null ? '—' : `${compassPoint(this.heading)} ${Math.round(this.heading)}°`, '');
    if (this.preset.showAltitude) {
      const alt = this.altitude === null ? null : imperial ? this.altitude * 3.28084 : this.altitude;
      this.stat('altitude', alt === null ? '—' : numberFmt.format(Math.round(alt)), imperial ? 'ft' : 'm');
    }

    const exportBtn = this.q<HTMLButtonElement>('[data-export]');
    exportBtn.disabled = this.track.length < 2;
    this.q('[data-points]').textContent = this.track.length
      ? `${numberFmt.format(this.track.length)} GPS points recorded`
      : 'No points recorded yet';

    const hudSpeed = this.qo('[data-hud-speed]');
    if (hudSpeed && this.hudOpen) {
      hudSpeed.textContent = speedText;
      hudSpeed.toggleAttribute('data-over', this.over);
    }
  }

  private stat(key: string, value: string, unit: string): void {
    const v = this.qo(`[data-stat="${key}"]`);
    const u = this.qo(`[data-stat-unit="${key}"]`);
    if (v) v.textContent = value;
    if (u) u.textContent = value === '—' ? '' : unit;
  }

  private setGps(level: GpsLevel, text: string): void {
    this.q('[data-gps-dot]').dataset.level = level;
    this.q('[data-gps-text]').textContent = text;
  }

  private message(text: string): void {
    this.q('[data-message]').textContent = text;
  }

  private updateToggle(): void {
    const label = this.running ? 'Pause' : this.elapsedMs > 0 ? 'Resume' : 'Start';
    this.q('[data-toggle-label]').textContent = label;
    this.q('[data-icon-play]').classList.toggle('hidden', this.running);
    this.q('[data-icon-pause]').classList.toggle('hidden', !this.running);
  }

  // ---- Platform APIs --------------------------------------------------------------------------

  private async acquireWakeLock(): Promise<void> {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible' || this.wakeLock) return;
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.q('[data-wake]').hidden = false;
      this.wakeLock.addEventListener('release', () => {
        this.wakeLock = null;
        this.q('[data-wake]').hidden = true;
      });
    } catch {
      /* battery saver or unsupported */
    }
  }

  private async releaseWakeLock(): Promise<void> {
    try {
      await this.wakeLock?.release();
    } catch {
      /* already released */
    }
    this.wakeLock = null;
  }

  private exportGpx(): void {
    if (this.track.length < 2) return;
    const stamp = new Date(this.track[0].t);
    const pad = (n: number) => String(n).padStart(2, '0');
    const name = `speedreflex-${this.preset.id}-${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}`;
    const blob = new Blob([buildGpx(this.track, `SpeedReflex ${this.preset.noun} trip`)], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.gpx`;
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

customElements.define('gps-speedometer', GpsSpeedometer);
