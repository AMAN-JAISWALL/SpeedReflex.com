import {
  ANTICIPATION_MS,
  DIST,
  REACTION_TIERS,
  distMs,
  distX,
  mean,
  median,
  percentFasterThan,
  randomDelay,
  stdDev,
  tierFor,
} from '../lib/reaction';
import { copyText, eventTime, formatDate, onScreen, paintStimulus, playTone, shareOrCopy, store, unlockAudio } from '../lib/browser';
import { renderTrend } from './trend-chart';

type State = 'idle' | 'waiting' | 'go' | 'result' | 'early' | 'anticipated' | 'done';

interface Session {
  t: number;
  avg: number;
  best: number;
  attempts: number[];
}

const HISTORY_KEY = 'sr:reaction:history';
const AUDIO_HISTORY_KEY = 'sr:audio:history';
const MAX_SESSIONS = 100;

class ReactionTest extends HTMLElement {
  private state: State = 'idle';
  private attempts: number[] = [];
  private total = 5;
  private timer = 0;
  private goAppliedAt = 0;
  private onset = 0;
  private lastInputAt = -Infinity;
  private challenge: number | null = null;
  private history: Session[] = [];
  private verb = 'Tap';
  private toastTimer = 0;
  /** Sound instead of colour as the signal (the audio reaction test). */
  private audio = false;
  private historyKey = HISTORY_KEY;
  private ui: any = {};

  private consistencyLabel(sd: number): string {
    const cl = this.ui?.consistencyLabels;
    if (sd < 20) return cl?.veryConsistent ?? 'Very consistent';
    if (sd < 40) return cl?.consistent ?? 'Consistent';
    if (sd < 70) return cl?.variable ?? 'Variable';
    return cl?.erratic ?? 'Erratic';
  }

  private getTierLabel(ms: number): string {
    const r = this.ui?.ratings;
    if (!r) return tierFor(ms, REACTION_TIERS).label;
    if (ms < 170) return r.elite;
    if (ms < 210) return r.excellent;
    if (ms < 250) return r.good;
    if (ms < 290) return r.average;
    if (ms < 350) return r.belowAverage;
    return r.sluggish;
  }

  private q<T extends Element = HTMLElement>(sel: string): T {
    const el = this.querySelector<T>(sel);
    if (!el) throw new Error(`reaction-test: missing ${sel}`);
    return el;
  }

  connectedCallback(): void {
    try {
      this.ui = this.dataset.i18n ? JSON.parse(this.dataset.i18n) : {};
    } catch {
      this.ui = {};
    }
    this.total = Number(this.dataset.attempts) || 5;
    this.verb = matchMedia('(pointer: coarse)').matches ? 'Tap' : 'Click';
    this.audio = this.dataset.stimulus === 'audio';
    this.historyKey = this.audio ? AUDIO_HISTORY_KEY : HISTORY_KEY;
    this.history = store.get<Session[]>(this.historyKey, []);

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
    // Activation that didn't come through pointer/keyboard (e.g. screen readers) still works.
    stage.addEventListener('click', () => {
      if (performance.now() - this.lastInputAt < 1500) return;
      this.input(performance.now());
    });
    stage.addEventListener('contextmenu', (e) => e.preventDefault());

    // Space/Enter anywhere on the page while a session is running (Safari doesn't focus clicked buttons).
    // Between sessions it only starts one while the panel is on screen, so elsewhere Space still scrolls.
    document.addEventListener('keydown', (e) => {
      if ((e.key !== ' ' && e.key !== 'Enter') || e.repeat || e.target !== document.body) return;
      if ((this.state === 'idle' || this.state === 'done') && !onScreen(stage)) return;
      e.preventDefault();
      this.lastInputAt = performance.now();
      this.input(eventTime(e));
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && (this.state === 'waiting' || this.state === 'go')) {
        clearTimeout(this.timer);
        this.setState('idle', { paused: true });
      }
    });

    this.q('[data-restart]').addEventListener('click', () => {
      this.resetSession();
      this.q<HTMLButtonElement>('[data-stage]').focus();
      this.arm();
    });
    this.q('[data-share]').addEventListener('click', () => void this.share());
    this.q('[data-copy-challenge]').addEventListener('click', async () => {
      const avg = Math.round(mean(this.attempts));
      const outcome = await copyText(this.challengeUrl(avg));
      this.toast(outcome === 'copied' ? (this.ui?.challengeCopied || 'Challenge link copied') : (this.ui?.copyFailed || 'Copy failed — select the address bar and copy manually'));
    });
    this.q('[data-clear-history]').addEventListener('click', () => {
      if (!confirm(this.ui?.clearHistoryConfirm || 'Clear all saved reaction test sessions on this device? This cannot be undone.')) return;
      this.history = [];
      store.remove(this.historyKey);
      this.renderHistory();
      this.toast(this.ui?.historyCleared || 'History cleared');
    });

    if (!this.audio) this.bindDistributionHover();
    this.readChallenge();
    this.renderHistory();
    this.setState('idle');
  }

  private readChallenge(): void {
    const raw = new URLSearchParams(location.search).get('challenge');
    const value = raw ? Number.parseInt(raw, 10) : NaN;
    if (!Number.isFinite(value) || value < 80 || value > 2000) return;
    this.challenge = value;
    const test = this.audio ? ' on the sound test' : '';
    this.q('[data-challenge-text]').textContent = `A friend averaged ${value} ms${test}. Can you beat it in ${this.total} attempts?`;
    this.q('[data-challenge]').hidden = false;
  }

  private input(t: number): void {
    switch (this.state) {
      case 'waiting':
        clearTimeout(this.timer);
        this.setState('early');
        return;
      case 'go': {
        const rt = Math.round(t - (this.onset || this.goAppliedAt));
        // A sound is scheduled a few ms ahead, so a press can land before it is audible.
        if (rt < 0) {
          this.setState('early');
          return;
        }
        if (rt < ANTICIPATION_MS) {
          this.setState('anticipated', { value: rt });
          return;
        }
        this.record(rt);
        return;
      }
      case 'done':
        this.resetSession();
        this.arm();
        return;
      default:
        this.arm();
    }
  }

  private arm(): void {
    this.onset = 0;
    // Always reached from a tap, click or key press, which is when browsers let audio start.
    if (this.audio) unlockAudio();
    this.setState('waiting');
    this.timer = window.setTimeout(() => {
      if (this.audio) {
        if (this.state !== 'waiting') return;
        this.onset = playTone();
        this.goAppliedAt = performance.now();
        this.setState('go');
        return;
      }
      paintStimulus(
        () => {
          if (this.state !== 'waiting') return;
          this.goAppliedAt = performance.now();
          this.setState('go');
        },
        (presented) => {
          if (this.state === 'go') this.onset = presented;
        },
      );
    }, randomDelay(1500, 4500));
  }

  private record(rt: number): void {
    this.attempts.push(rt);
    this.renderProgress();
    this.announce(`${rt} milliseconds`);
    if (this.attempts.length >= this.total) this.finish();
    else this.setState('result', { value: rt });
  }

  private resetSession(): void {
    clearTimeout(this.timer);
    this.attempts = [];
    this.q('[data-summary]').hidden = true;
    this.renderProgress();
  }

  private setState(state: State, opts: { value?: number; paused?: boolean } = {}): void {
    this.state = state;
    const stage = this.q('[data-stage]');
    stage.dataset.state = state;
    const n = Math.min(this.attempts.length + 1, this.total);
    const attemptLabel = `${this.ui?.attempt || 'Attempt'} ${n} / ${this.total}`;
    let kicker = '';
    let title = '';
    let sub = '';

    const isTap = this.verb === 'Tap';
    switch (state) {
      case 'idle':
        kicker = opts.paused
          ? (this.ui?.paused || 'Paused')
          : this.attempts.length
            ? attemptLabel
            : this.audio
              ? (this.ui?.audioKicker || 'Audio reaction test')
              : (this.ui?.visualKicker || 'Reaction time test');
        title = opts.paused
          ? (isTap ? this.ui?.tapToResume : this.ui?.clickToResume) || `${this.verb} to resume`
          : (isTap ? this.ui?.tapToStart : this.ui?.clickToStart) || `${this.verb} to start`;
        sub = opts.paused
          ? (this.ui?.tabSwitchedCancel || 'The attempt was cancelled because you switched tabs.')
          : (this.audio ? this.ui?.subAudioStart : this.ui?.subVisualStart) ||
            `When ${this.audio ? 'you hear the beep' : 'the panel turns blue'}, tap, click, or press Space as fast as you can.`;
        break;
      case 'waiting':
        kicker = attemptLabel;
        title = this.audio ? (this.ui?.listenWait || 'Listen…') : (this.ui?.blueWait || 'Wait for blue…');
        sub = this.audio
          ? (this.ui?.listenSub || 'React the moment you hear the beep.')
          : (this.ui?.blueSub || 'React the moment the colour changes.');
        break;
      // In the audio test the screen must not change when the beep plays, so "go" looks like "waiting".
      case 'go':
        kicker = attemptLabel;
        title = this.audio ? (this.ui?.listenWait || 'Listen…') : isTap ? (this.ui?.tapNow || 'Tap!') : (this.ui?.clickNow || 'Click!');
        sub = this.audio ? (this.ui?.listenSub || 'React the moment you hear the beep.') : '';
        break;
      case 'result': {
        kicker = `${this.ui?.attempt || 'Attempt'} ${this.attempts.length} / ${this.total}`;
        title = `${opts.value} ms`;
        const nextSub = isTap ? (this.ui?.tapNext || 'Tap for the next attempt.') : (this.ui?.clickNext || 'Click for the next attempt.');
        sub = this.audio
          ? nextSub
          : `${this.getTierLabel(opts.value ?? 0)}. ${nextSub}`;
        break;
      }
      case 'early':
        kicker = this.ui?.falseStartKicker || 'False start';
        title = this.ui?.tooSoonTitle || 'Too soon';
        sub = this.audio
          ? (this.ui?.tooSoonSubAudio || `You went before the beep. ${this.verb} to retry this attempt — it wasn’t counted.`)
          : (this.ui?.tooSoonSubVisual || `You went before the panel turned blue. ${this.verb} to retry this attempt — it wasn’t counted.`);
        break;
      case 'anticipated':
        kicker = this.ui?.notCountedKicker || 'Not counted';
        title = `${Math.max(0, opts.value ?? 0)} ms ${this.ui?.tooFastTitle || 'is too fast'}`;
        sub = this.ui?.tooFastSub || `Under ${ANTICIPATION_MS} ms is anticipation, not reaction. ${this.verb} to retry this attempt.`;
        break;
      case 'done': {
        const avg = Math.round(mean(this.attempts));
        kicker = this.ui?.sessionCompleteKicker || 'Session complete';
        title = `${avg} ms`;
        sub = (isTap ? this.ui?.sessionCompleteSubTap : this.ui?.sessionCompleteSubClick) || `Your average over ${this.total} attempts. ${this.verb} to start a new session.`;
        break;
      }
    }

    this.q('[data-stage-kicker]').textContent = kicker;
    this.q('[data-stage-title]').textContent = title;
    const subEl = this.q('[data-stage-sub]');
    subEl.textContent = sub;
    subEl.hidden = !sub;
  }

  private renderProgress(): void {
    const dots = this.q('[data-dots]').children;
    for (let i = 0; i < dots.length; i++) (dots[i] as HTMLElement).toggleAttribute('data-done', i < this.attempts.length);
    this.q('[data-attempt-label]').textContent = `${this.attempts.length} / ${this.total}`;
    this.q('[data-live-avg]').textContent = this.attempts.length ? `${Math.round(mean(this.attempts))} ms` : '—';
    this.q('[data-live-best]').textContent = this.attempts.length ? `${Math.min(...this.attempts)} ms` : '—';
  }

  private finish(): void {
    const a = this.attempts;
    const avg = Math.round(mean(a));
    const best = Math.min(...a);
    const worst = Math.max(...a);
    const sd = Math.round(stdDev(a));

    this.history.push({ t: Date.now(), avg, best, attempts: [...a] });
    if (this.history.length > MAX_SESSIONS) this.history = this.history.slice(-MAX_SESSIONS);
    store.set(this.historyKey, this.history);

    this.q('[data-sum-avg]').textContent = `${avg} ms`;
    this.q('[data-sum-best]').textContent = `${best} ms`;
    this.q('[data-sum-worst]').textContent = `Slowest ${worst} ms`;
    this.q('[data-sum-median]').textContent = `${Math.round(median(a))} ms`;
    this.q('[data-sum-sd]').textContent = `±${sd} ms`;
    this.q('[data-sum-sd-label]').textContent = this.consistencyLabel(sd);

    // The population model describes visual reactions, so the sound test compares you with yourself instead.
    let standing: string;
    if (this.audio) {
      standing = this.renderSenseComparison(avg);
    } else {
      const pct = Math.round(percentFasterThan(avg));
      const tierLabel = this.getTierLabel(avg);
      const tier = tierFor(avg, REACTION_TIERS);
      this.q('[data-sum-tier]').textContent = tierLabel;
      this.q('[data-sum-percentile]').textContent = `Faster than about ${pct}% of people · ${tier.note}`;
      standing = `faster than about ${pct} percent of people`;

      const x = distX(avg);
      this.q('[data-dist-line]').setAttribute('x1', String(x));
      this.q('[data-dist-line]').setAttribute('x2', String(x));
      this.q('[data-dist-dot]').setAttribute('cx', String(x));
      const label = this.q('[data-dist-label]');
      label.style.left = `clamp(2.5rem, ${(x / DIST.width) * 100}%, calc(100% - 2.5rem))`;
      label.textContent = `You · ${avg} ms`;
    }

    const list = this.q('[data-sum-attempts]');
    list.replaceChildren(
      ...a.map((ms, i) => {
        const li = document.createElement('li');
        li.className = 'grid grid-cols-[1.75rem_1fr_4.5rem] items-center gap-3 text-sm';
        const idx = document.createElement('span');
        idx.className = 'font-mono text-xs text-mute';
        idx.textContent = `#${i + 1}`;
        const track = document.createElement('span');
        track.className = 'h-2 overflow-hidden rounded-full bg-hairline-soft';
        const bar = document.createElement('span');
        bar.className = `block h-full rounded-full ${ms === best ? 'bg-link' : 'bg-ink'}`;
        bar.style.width = `${Math.max(6, (ms / worst) * 100)}%`;
        track.append(bar);
        const val = document.createElement('span');
        val.className = `text-right tabular-nums ${ms === best ? 'font-semibold text-ink' : 'text-body'}`;
        val.textContent = `${ms} ms`;
        li.append(idx, track, val);
        return li;
      }),
    );

    let verdict = '';
    if (this.challenge !== null) {
      const diff = this.challenge - avg;
      verdict = diff > 0 ? `You beat the challenge by ${diff} ms.` : diff === 0 ? 'Dead heat with the challenge.' : `${-diff} ms off the challenge. Go again?`;
    }
    this.q('[data-sum-verdict]').textContent = verdict;

    this.q('[data-summary]').hidden = false;
    this.setState('done');
    this.renderHistory();
    this.announce(`Session complete. Average ${avg} milliseconds, ${standing}. ${verdict}`);
  }

  /** Sound test: your audio average next to your latest visual one. Returns a sentence for screen readers. */
  private renderSenseComparison(audioAvg: number): string {
    const visual = store.get<Session[]>(HISTORY_KEY, []).at(-1)?.avg;
    const tierEl = this.q('[data-sum-tier]');
    this.q('[data-compare-audio]').textContent = `${audioAvg} ms`;
    const hasVisual = typeof visual === 'number' && Number.isFinite(visual);
    this.q('[data-compare-empty]').hidden = hasVisual;
    this.q('[data-compare-visual-row]').hidden = !hasVisual;
    if (!hasVisual) {
      tierEl.textContent = 'Your sound reaction';
      this.q('[data-compare-summary]').textContent = 'Take the visual test to see how your ears compare with your eyes.';
      this.q<HTMLElement>('[data-compare-audio-bar]').style.width = '100%';
      return 'no visual result to compare with yet';
    }
    const diff = visual - audioAvg;
    const scale = Math.max(visual, audioAvg);
    this.q('[data-compare-visual]').textContent = `${visual} ms`;
    this.q<HTMLElement>('[data-compare-visual-bar]').style.width = `${(visual / scale) * 100}%`;
    this.q<HTMLElement>('[data-compare-audio-bar]').style.width = `${(audioAvg / scale) * 100}%`;
    const summary =
      diff > 0 ? `${diff} ms faster than your eyes` : diff < 0 ? `${-diff} ms slower than your eyes` : 'Same as your visual average';
    tierEl.textContent = summary;
    this.q('[data-compare-summary]').textContent =
      diff > 0
        ? `Your ears beat your eyes by ${diff} ms — typical, because sound reaches the brain sooner.`
        : diff === 0
          ? 'A dead heat between your ears and your eyes.'
          : 'Your eyes won this time. Headphone or speaker lag can add delay — try wired headphones or the phone speaker.';
    return summary.toLowerCase();
  }

  private bindDistributionHover(): void {
    const wrap = this.q('[data-dist]');
    const svg = wrap.querySelector('svg');
    const cross = this.q('[data-dist-cross]');
    const tip = this.q('[data-dist-tip]');
    if (!svg) return;
    wrap.addEventListener('pointermove', (e) => {
      const rect = svg.getBoundingClientRect();
      const vx = ((e.clientX - rect.left) / rect.width) * DIST.width;
      const ms = Math.round(Math.min(DIST.max, Math.max(DIST.min, distMs(vx))));
      const x = distX(ms);
      cross.setAttribute('x1', String(x));
      cross.setAttribute('x2', String(x));
      cross.classList.remove('hidden');
      tip.style.left = `clamp(3.5rem, ${(x / DIST.width) * 100}%, calc(100% - 3.5rem))`;
      this.q('[data-dist-tip-value]').textContent = `${ms} ms`;
      this.q('[data-dist-tip-label]').textContent = `faster than ${Math.round(percentFasterThan(ms))}% of people`;
      tip.hidden = false;
    });
    wrap.addEventListener('pointerleave', () => {
      cross.classList.add('hidden');
      tip.hidden = true;
    });
  }

  private renderHistory(): void {
    const section = this.q('[data-history]');
    const h = this.history;
    section.hidden = h.length === 0;
    const pb = h.length ? Math.min(...h.map((s) => s.best)) : null;
    this.q('[data-pb]').textContent = pb === null ? '—' : `${pb} ms`;
    if (!h.length) return;

    this.q('[data-hist-pb]').textContent = `${pb} ms`;
    this.q('[data-hist-best-avg]').textContent = `${Math.min(...h.map((s) => s.avg))} ms`;
    this.q('[data-hist-count]').textContent = String(h.length);

    this.q('[data-hist-trend-wrap]').hidden = h.length < 2;
    renderTrend(
      this.q('[data-hist-trend]'),
      h.slice(-20).map((s) => ({ value: s.avg, label: formatDate(s.t) })),
      (v) => `${Math.round(v)} ms`,
    );

    this.q('[data-hist-rows]').replaceChildren(
      ...h
        .slice(-8)
        .reverse()
        .map((s) => {
          const tr = document.createElement('tr');
          const last = this.audio ? `±${Math.round(stdDev(s.attempts))} ms` : `${Math.round(percentFasterThan(s.avg))}%`;
          for (const text of [formatDate(s.t), `${s.avg} ms`, `${s.best} ms`, last]) {
            const td = document.createElement('td');
            td.textContent = text;
            tr.append(td);
          }
          return tr;
        }),
    );
  }

  private challengeUrl(avg: number): string {
    const url = new URL(location.pathname, location.origin);
    url.searchParams.set('challenge', String(avg));
    return url.toString();
  }

  private async share(): Promise<void> {
    const avg = Math.round(mean(this.attempts));
    const text = this.audio
      ? `I averaged ${avg} ms on the SpeedReflex audio reaction test. Can your ears beat it?`
      : `I averaged ${avg} ms on the SpeedReflex reaction time test — faster than about ${Math.round(percentFasterThan(avg))}% of people. Can you beat it?`;
    const outcome = await shareOrCopy({
      title: this.audio ? 'My audio reaction time' : 'My reaction time',
      text,
      url: this.challengeUrl(avg),
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

customElements.define('reaction-test', ReactionTest);
