import { ANTICIPATION_MS, F1_TIERS, mean, randomDelay, simulateGridPosition, tierFor } from '../lib/reaction';
import { beep, copyText, eventTime, formatDate, onScreen, paintStimulus, shareOrCopy, store } from '../lib/browser';
import { renderTrend } from './trend-chart';

type State = 'idle' | 'sequence' | 'out' | 'result' | 'jump';

interface Start {
  t: number;
  s: number;
  p: number;
}

const HISTORY_KEY = 'sr:f1:history';
const SOUND_KEY = 'sr:f1:sound';
const MAX_STARTS = 300;
const FIRST_LIGHT_MS = 800;
const LIGHT_INTERVAL_MS = 1000;

const fmt = (s: number) => `${s.toFixed(3)} s`;

class F1Start extends HTMLElement {
  private state: State = 'idle';
  private timers: number[] = [];
  private goAppliedAt = 0;
  private onset = 0;
  private lastInputAt = -Infinity;
  private session: Start[] = [];
  private history: Start[] = [];
  private sound = false;
  private challenge: number | null = null;
  private verb = 'Tap';
  private toastTimer = 0;
  private panels: HTMLElement[] = [];

  private q<T extends Element = HTMLElement>(sel: string): T {
    const el = this.querySelector<T>(sel);
    if (!el) throw new Error(`f1-start: missing ${sel}`);
    return el;
  }

  connectedCallback(): void {
    this.verb = matchMedia('(pointer: coarse)').matches ? 'Tap' : 'Click';
    this.history = store.get<Start[]>(HISTORY_KEY, []);
    this.sound = store.get<boolean>(SOUND_KEY, false);
    this.panels = [...this.querySelectorAll<HTMLElement>('[data-panel]')];

    const stage = this.q<HTMLButtonElement>('[data-stage]');
    stage.addEventListener('pointerdown', (e) => {
      if (!e.isPrimary || e.button !== 0) return;
      this.lastInputAt = performance.now();
      this.input(eventTime(e));
    });
    stage.addEventListener('keydown', (e) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      if (e.repeat) return;
      this.lastInputAt = performance.now();
      this.input(eventTime(e));
    });
    stage.addEventListener('keyup', (e) => {
      if (e.key === ' ') e.preventDefault();
    });
    stage.addEventListener('click', () => {
      if (performance.now() - this.lastInputAt < 1500) return;
      this.input(performance.now());
    });
    stage.addEventListener('contextmenu', (e) => e.preventDefault());

    // Space/Enter anywhere on the page; before the first start only while the gantry is on screen.
    document.addEventListener('keydown', (e) => {
      if ((e.key !== ' ' && e.key !== 'Enter') || e.repeat || e.target !== document.body) return;
      if (this.state === 'idle' && !onScreen(stage)) return;
      e.preventDefault();
      this.lastInputAt = performance.now();
      this.input(eventTime(e));
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && (this.state === 'sequence' || this.state === 'out')) {
        this.clearTimers();
        this.setLights(0);
        this.setState('idle', 'Start aborted — you switched tabs.');
      }
    });

    const soundBtn = this.q('[data-sound]');
    soundBtn.setAttribute('aria-pressed', String(this.sound));
    soundBtn.addEventListener('click', () => {
      this.sound = !this.sound;
      soundBtn.setAttribute('aria-pressed', String(this.sound));
      store.set(SOUND_KEY, this.sound);
      if (this.sound) beep(660, 80);
    });

    this.q('[data-share]').addEventListener('click', () => void this.share());
    this.q('[data-copy-challenge]').addEventListener('click', async () => {
      const best = this.sessionBest();
      if (best === null) return;
      const outcome = await copyText(this.challengeUrl(best));
      this.toast(outcome === 'copied' ? 'Challenge link copied' : 'Copy failed — copy the address bar instead');
    });
    this.q('[data-clear-history]').addEventListener('click', () => {
      if (!confirm('Clear all saved F1 starts on this device? This cannot be undone.')) return;
      this.history = [];
      store.remove(HISTORY_KEY);
      this.renderHistory();
      this.toast('History cleared');
    });

    this.readChallenge();
    this.renderHistory();
    this.setState('idle');
  }

  private readChallenge(): void {
    const raw = new URLSearchParams(location.search).get('challenge');
    const value = raw ? Number.parseFloat(raw) : NaN;
    if (!Number.isFinite(value) || value < 0.08 || value > 2) return;
    this.challenge = Math.round(value * 1000) / 1000;
    this.q('[data-challenge-text]').textContent = `A friend launched in ${fmt(this.challenge)}. Can you get off the line faster?`;
    this.q('[data-challenge]').hidden = false;
  }

  private input(t: number): void {
    switch (this.state) {
      case 'sequence':
        this.clearTimers();
        this.jumpStart('You moved before lights out.');
        return;
      case 'out': {
        const ms = t - (this.onset || this.goAppliedAt);
        if (ms < ANTICIPATION_MS) {
          this.jumpStart(`${Math.max(0, Math.round(ms))} ms is quicker than a human can react — that was a guess.`);
          return;
        }
        this.record(Math.round(ms) / 1000);
        return;
      }
      default:
        this.startSequence();
    }
  }

  private startSequence(): void {
    this.clearTimers();
    this.onset = 0;
    this.setLights(0);
    this.setState('sequence');
    for (let i = 1; i <= this.panels.length; i++) {
      this.timers.push(
        window.setTimeout(() => {
          this.setLights(i);
          if (this.sound) beep(520, 90);
        }, FIRST_LIGHT_MS + (i - 1) * LIGHT_INTERVAL_MS),
      );
    }
    const allOnAt = FIRST_LIGHT_MS + (this.panels.length - 1) * LIGHT_INTERVAL_MS;
    this.timers.push(
      window.setTimeout(() => {
        paintStimulus(
          () => {
            if (this.state !== 'sequence') return;
            this.goAppliedAt = performance.now();
            this.setLights(0);
            this.state = 'out';
            this.q('[data-stage]').dataset.state = 'out';
          },
          (presented) => {
            if (this.state === 'out') this.onset = presented;
          },
        );
      }, allOnAt + randomDelay(200, 3000)),
    );
  }

  private record(seconds: number): void {
    const p = simulateGridPosition(seconds);
    const start: Start = { t: Date.now(), s: seconds, p };
    this.session.push(start);
    this.history.push(start);
    if (this.history.length > MAX_STARTS) this.history = this.history.slice(-MAX_STARTS);
    store.set(HISTORY_KEY, this.history);

    const tier = tierFor(seconds, F1_TIERS);
    let verdict = '';
    if (this.challenge !== null) {
      const diff = Math.round((this.challenge - seconds) * 1000);
      verdict = diff > 0 ? ` You beat the challenge by ${diff} ms.` : diff === 0 ? ' Dead heat with the challenge.' : ` ${-diff} ms behind the challenge.`;
    }
    this.setState('result', `${tier.label}. On a simulated 20-car grid you’d launch P${p}.${verdict} ${this.verb} to line up again.`, fmt(seconds));
    this.announce(`${seconds.toFixed(3)} seconds. ${tier.label}. Grid position ${p}.${verdict}`);
    this.renderSession();
    this.renderHistory();
  }

  private jumpStart(reason: string): void {
    this.setState('jump', `${reason} In Formula 1 that earns a penalty. ${this.verb} to line up again.`);
    this.announce('Jump start.');
  }

  private setState(state: State, sub?: string, title?: string): void {
    this.state = state;
    this.q('[data-stage]').dataset.state = state;
    const copy: Record<State, [string, string, string]> = {
      idle: ['F1 start simulator', `${this.verb} to start`, 'Five red lights come on one by one. When they all go out — go.'],
      sequence: ['Lights', 'Wait for lights out', ''],
      out: ['Lights', 'Wait for lights out', ''],
      result: ['Reaction', '', ''],
      jump: ['Jump start', 'Jump start!', ''],
    };
    const [kicker, defaultTitle, defaultSub] = copy[state];
    this.q('[data-stage-kicker]').textContent = kicker;
    this.q('[data-stage-title]').textContent = title ?? defaultTitle;
    const subEl = this.q('[data-stage-sub]');
    subEl.textContent = sub ?? defaultSub;
    subEl.hidden = !subEl.textContent;
  }

  private setLights(count: number): void {
    this.panels.forEach((panel, i) => {
      panel.querySelectorAll('[data-lamp]').forEach((lamp) => lamp.toggleAttribute('data-on', i < count));
    });
  }

  private clearTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  private sessionBest(): number | null {
    return this.session.length ? Math.min(...this.session.map((s) => s.s)) : null;
  }

  private renderSession(): void {
    const best = this.sessionBest();
    const list = this.q('[data-session-list]');
    const items = this.session.slice(-12).map((s) => {
      const li = document.createElement('li');
      const isBest = s.s === best;
      li.className = `rounded-pill border px-2.5 py-0.5 text-sm tabular-nums ${
        isBest ? 'border-ink bg-ink font-medium text-canvas' : 'border-hairline bg-surface text-body'
      }`;
      li.textContent = s.s.toFixed(3);
      return li;
    });
    list.replaceChildren(...items);
    this.q('[data-actions]').hidden = this.session.length === 0;
    this.q('[data-session-avg]').textContent = this.session.length ? fmt(mean(this.session.map((s) => s.s))) : '—';
    this.q('[data-session-count]').textContent = String(this.session.length);
  }

  private renderHistory(): void {
    const h = this.history;
    const pb = h.length ? Math.min(...h.map((s) => s.s)) : null;
    this.q('[data-pb]').textContent = pb === null ? '—' : fmt(pb);
    this.q('[data-history]').hidden = h.length === 0;
    if (!h.length || pb === null) return;

    this.q('[data-hist-pb]').textContent = fmt(pb);
    this.q('[data-hist-avg]').textContent = fmt(mean(h.map((s) => s.s)));
    this.q('[data-hist-count]').textContent = String(h.length);

    this.q('[data-hist-trend-wrap]').hidden = h.length < 2;
    renderTrend(
      this.q('[data-hist-trend]'),
      h.slice(-30).map((s) => ({ value: s.s, label: formatDate(s.t) })),
      (v) => fmt(v),
    );

    this.q('[data-hist-rows]').replaceChildren(
      ...h
        .slice(-8)
        .reverse()
        .map((s) => {
          const tr = document.createElement('tr');
          for (const text of [formatDate(s.t), fmt(s.s), tierFor(s.s, F1_TIERS).label, `P${s.p}`]) {
            const td = document.createElement('td');
            td.textContent = text;
            tr.append(td);
          }
          return tr;
        }),
    );
  }

  private challengeUrl(seconds: number): string {
    const url = new URL(location.pathname, location.origin);
    url.searchParams.set('challenge', seconds.toFixed(3));
    return url.toString();
  }

  private async share(): Promise<void> {
    const best = this.sessionBest();
    if (best === null) return;
    const outcome = await shareOrCopy({
      title: 'My F1 start reaction time',
      text: `My best F1 start on SpeedReflex: ${fmt(best)} (${tierFor(best, F1_TIERS).label}). Can you beat my launch?`,
      url: this.challengeUrl(best),
    });
    if (outcome === 'copied') this.toast('Result copied to clipboard');
    else if (outcome === 'failed') this.toast('Sharing is blocked in this browser');
  }

  private announce(text: string): void {
    this.q('[data-announce]').textContent = text;
  }

  private toast(text: string): void {
    const el = this.q('[data-toast]');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (el.hidden = true), 2600);
  }
}

customElements.define('f1-start', F1Start);
