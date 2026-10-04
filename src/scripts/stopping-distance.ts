import { CAR_LENGTH_M, M_TO_FT, MS_PER, REACTION_PRESETS, stoppingDistance, type Road, type SpeedUnitRoad } from '../lib/stopping';
import { defaultUnitFor } from '../lib/speed';
import { store } from '../lib/browser';

interface Session {
  avg: number;
}

const UNIT_KEY = 'sr:stopping:unit';
const RANGES: Record<SpeedUnitRoad, { min: number; max: number; start: number }> = {
  mph: { min: 5, max: 80, start: 30 },
  kmh: { min: 10, max: 130, start: 50 },
};

class StoppingDistance extends HTMLElement {
  private unit: SpeedUnitRoad = 'mph';
  private speed = 30;
  private reaction = 0.67;
  private road: Road = 'dry';
  private ui: any = {};

  private q<T extends Element = HTMLElement>(sel: string): T {
    const el = this.querySelector<T>(sel);
    if (!el) throw new Error(`stopping-distance: missing ${sel}`);
    return el;
  }

  connectedCallback(): void {
    try {
      this.ui = this.dataset.i18n ? JSON.parse(this.dataset.i18n) : {};
    } catch {
      this.ui = {};
    }
    const speedInput = this.q<HTMLInputElement>('[data-speed]');
    const speedRange = this.q<HTMLInputElement>('[data-speed-range]');
    const reactionInput = this.q<HTMLInputElement>('[data-reaction]');

    this.q('[data-form]').addEventListener('submit', (e) => e.preventDefault());

    speedInput.addEventListener('input', () => {
      const v = Number.parseFloat(speedInput.value);
      if (!Number.isFinite(v) || v <= 0) return;
      this.speed = Math.min(v, 250);
      speedRange.value = String(this.speed);
      this.render();
    });
    speedRange.addEventListener('input', () => {
      this.speed = Number(speedRange.value);
      speedInput.value = speedRange.value;
      this.render();
    });
    reactionInput.addEventListener('input', () => {
      const v = Number.parseFloat(reactionInput.value);
      if (!Number.isFinite(v) || v <= 0) return;
      this.reaction = Math.min(v, 5);
      this.render();
    });

    this.q('[data-presets]').addEventListener('click', (e) => {
      const btn = (e.target as Element).closest<HTMLButtonElement>('[data-preset]');
      if (!btn) return;
      this.reaction = Number(btn.dataset.preset);
      reactionInput.value = String(this.reaction);
      this.render();
    });
    this.q('[data-roads]').addEventListener('click', (e) => {
      const btn = (e.target as Element).closest<HTMLButtonElement>('[data-road]');
      if (!btn) return;
      this.road = btn.dataset.road as Road;
      this.render();
    });
    this.q('[data-units]').addEventListener('click', (e) => {
      const btn = (e.target as Element).closest<HTMLButtonElement>('[data-unit]');
      if (btn) this.setUnit(btn.dataset.unit as SpeedUnitRoad, true);
    });

    const saved = store.get<SpeedUnitRoad | null>(UNIT_KEY, null);
    const unit = saved ?? (defaultUnitFor(navigator.language || 'en') === 'mph' ? 'mph' : 'kmh');
    // Start km/h visitors on a round 50 rather than a converted 48.
    if (unit !== this.unit) {
      this.unit = unit;
      this.speed = RANGES[unit].start;
    }
    this.setUnit(unit, false);
    this.showPersonal();
  }

  /** Switching units converts the current speed to the nearest whole number in the new unit. */
  private setUnit(unit: SpeedUnitRoad, remember: boolean): void {
    if (unit !== this.unit) this.speed = Math.round((this.speed * MS_PER[this.unit]) / MS_PER[unit]);
    this.unit = unit;
    if (remember) store.set(UNIT_KEY, unit);
    const range = this.q<HTMLInputElement>('[data-speed-range]');
    range.min = String(RANGES[unit].min);
    range.max = String(RANGES[unit].max);
    range.value = String(this.speed);
    this.q<HTMLInputElement>('[data-speed]').value = String(this.speed);
    this.querySelectorAll<HTMLButtonElement>('[data-unit]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.unit === unit)),
    );
    this.render();
  }

  private render(): void {
    const speedMs = this.speed * MS_PER[this.unit];
    const r = stoppingDistance(speedMs, this.reaction, this.road);
    const m = (v: number) => `${v < 10 ? v.toFixed(1) : Math.round(v)} m`;

    this.q('[data-total]').textContent = m(r.total);
    const carLengths = Math.max(1, Math.round(r.total / CAR_LENGTH_M));
    const carLabel = this.ui?.carLengthsLabel ? `${carLengths} ${this.ui.carLengthsLabel}` : `about ${carLengths} car lengths`;
    this.q('[data-total-alt]').textContent = `${Math.round(r.total * M_TO_FT)} ft · ${carLabel}`;
    this.q('[data-thinking]').textContent = m(r.thinking);
    this.q('[data-braking]').textContent = m(r.braking);
    this.q('[data-bar-thinking]').style.width = `${(r.thinking / r.total) * 100}%`;
    const extraDist = (speedMs * 0.1).toFixed(1);
    this.q('[data-sensitivity]').textContent = this.ui?.sensitivityText
      ? this.ui.sensitivityText.replace('{dist}', extraDist)
      : `At this speed, every extra 0.1 s of reaction time adds ${extraDist} m before you even touch the brake.`;

    const preset = REACTION_PRESETS.find((p) => Math.abs(p.s - this.reaction) < 0.001);
    this.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((b) =>
      b.setAttribute('aria-pressed', String(Number(b.dataset.preset) === preset?.s)),
    );
    let note = preset?.note ?? 'Your own reaction time.';
    if (preset && this.ui?.reactionPresets) {
      const pKey = preset.s === 0.67 ? 'alert' : preset.s === 1.0 ? 'median' : preset.s === 1.5 ? 'tired' : preset.s === 2.0 ? 'distracted' : '';
      if (pKey && this.ui.reactionPresets[pKey]) {
        note = this.ui.reactionPresets[pKey];
      }
    }
    this.q('[data-preset-note]').textContent = note;
    this.querySelectorAll<HTMLButtonElement>('[data-road]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.road === this.road)));
  }

  /** Mentions the visitor's last reaction test, and why it isn't the same thing as braking reaction time. */
  private showPersonal(): void {
    const history = store.get<Session[]>('sr:reaction:history', []);
    const last = history[history.length - 1];
    if (!last || !Number.isFinite(last.avg)) return;
    this.q('[data-personal-text]').textContent = this.ui?.personalNote
      ? this.ui.personalNote.replace('{avg}', String(last.avg))
      : `Your last reaction test averaged ${last.avg} ms. That’s a simple reaction you were waiting for — on the road you also have to spot the hazard, decide to stop and move your foot to the brake, which is why real braking reactions take about 0.7 s even when you expect them.`;
    this.q('[data-personal]').hidden = false;
    this.q('[data-personal-empty]').hidden = true;
  }
}

customElements.define('stopping-distance', StoppingDistance);
