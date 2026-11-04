import { CM_PER_IN, rulerRating, rulerTimeMs } from '../lib/ruler';
import { store } from '../lib/browser';

type Unit = 'cm' | 'in';
const UNIT_KEY = 'sr:ruler:unit';
const MAX_TRIALS = 10;
const RANGES: Record<Unit, { min: number; max: number; step: number }> = {
  cm: { min: 1, max: 30, step: 0.5 },
  in: { min: 0.5, max: 12, step: 0.25 },
};

class RulerDrop extends HTMLElement {
  private unit: Unit = 'cm';
  /** Current distance, always stored in centimetres. */
  private cm = 15;
  private trials: number[] = [];

  private q<T extends Element = HTMLElement>(sel: string): T {
    const el = this.querySelector<T>(sel);
    if (!el) throw new Error(`ruler-drop: missing ${sel}`);
    return el;
  }

  connectedCallback(): void {
    const input = this.q<HTMLInputElement>('[data-distance]');
    const range = this.q<HTMLInputElement>('[data-distance-range]');

    this.q('[data-form]').addEventListener('submit', (e) => {
      e.preventDefault();
      this.addTrial();
    });
    input.addEventListener('input', () => {
      const v = Number.parseFloat(input.value);
      if (!Number.isFinite(v) || v <= 0) return;
      this.cm = Math.min(this.unit === 'cm' ? v : v * CM_PER_IN, 100);
      range.value = String(this.display(this.cm));
      this.render();
    });
    range.addEventListener('input', () => {
      const v = Number(range.value);
      this.cm = this.unit === 'cm' ? v : v * CM_PER_IN;
      input.value = range.value;
      this.render();
    });
    this.q('[data-units]').addEventListener('click', (e) => {
      const btn = (e.target as Element).closest<HTMLButtonElement>('[data-unit]');
      if (btn) this.setUnit(btn.dataset.unit as Unit, true);
    });
    this.q('[data-add]').addEventListener('click', () => this.addTrial());
    this.q('[data-clear]').addEventListener('click', () => {
      this.trials = [];
      this.render();
    });
    this.q('[data-trials]').addEventListener('click', (e) => {
      const btn = (e.target as Element).closest<HTMLButtonElement>('[data-remove]');
      if (!btn) return;
      this.trials.splice(Number(btn.dataset.remove), 1);
      this.render();
    });

    const saved = store.get<Unit | null>(UNIT_KEY, null);
    // US visitors think in inches; everyone else in centimetres.
    const guess: Unit = /-(US|LR|MM)$/i.test(navigator.language || '') ? 'in' : 'cm';
    this.setUnit(saved ?? guess, false);
  }

  private display(cm: number): number {
    const v = this.unit === 'cm' ? cm : cm / CM_PER_IN;
    const step = RANGES[this.unit].step;
    return Math.round(v / step) * step;
  }

  private fmtDistance(cm: number): string {
    return this.unit === 'cm' ? `${+cm.toFixed(1)} cm` : `${+(cm / CM_PER_IN).toFixed(2)} in`;
  }

  private setUnit(unit: Unit, remember: boolean): void {
    this.unit = unit;
    if (remember) store.set(UNIT_KEY, unit);
    const r = RANGES[unit];
    const range = this.q<HTMLInputElement>('[data-distance-range]');
    range.min = String(r.min);
    range.max = String(r.max);
    range.step = String(r.step);
    const shown = this.display(this.cm);
    // Keep the calculation in step with the rounded value the visitor now sees in the box.
    this.cm = unit === 'cm' ? shown : shown * CM_PER_IN;
    range.value = String(shown);
    const input = this.q<HTMLInputElement>('[data-distance]');
    input.step = unit === 'cm' ? '0.1' : '0.05';
    input.value = String(shown);
    this.querySelectorAll<HTMLButtonElement>('[data-unit]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.unit === unit)));
    this.render();
  }

  private addTrial(): void {
    if (this.trials.length >= MAX_TRIALS) this.trials.shift();
    this.trials.push(this.cm);
    this.render();
  }

  private render(): void {
    const ms = Math.round(rulerTimeMs(this.cm));
    this.q('[data-ms]').textContent = `${ms} ms`;
    this.q('[data-seconds]').textContent = `${(ms / 1000).toFixed(3)} s`;
    this.q('[data-rating]').textContent = rulerRating(this.cm);
    const offRuler = this.cm > 30.5;
    this.q('[data-note]').textContent = offRuler
      ? `That is past the end of a 30 cm (12 in) ruler. Use a longer ruler, or the online reaction time test, for slower catches.`
      : `A ${this.fmtDistance(this.cm)} catch means the ruler fell for ${ms} ms before your fingers closed.`;

    const list = this.q('[data-trials]');
    list.replaceChildren(
      ...this.trials.map((cm, i) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.remove = String(i);
        btn.className = 'rounded-full border border-hairline bg-surface px-3 py-1 text-body transition-colors hover:border-hairline-strong hover:text-ink';
        btn.setAttribute('aria-label', `Remove drop ${i + 1}: ${this.fmtDistance(cm)}`);
        btn.textContent = `${i + 1}. ${this.fmtDistance(cm)} · ${Math.round(rulerTimeMs(cm))} ms ×`;
        li.append(btn);
        return li;
      }),
    );

    const summary = this.q('[data-summary]');
    summary.hidden = this.trials.length === 0;
    this.q<HTMLButtonElement>('[data-clear]').disabled = this.trials.length === 0;
    if (this.trials.length) {
      const times = this.trials.map(rulerTimeMs);
      const avgMs = times.reduce((a, b) => a + b, 0) / times.length;
      const avgCm = this.trials.reduce((a, b) => a + b, 0) / this.trials.length;
      this.q('[data-avg]').textContent = `${Math.round(avgMs)} ms`;
      this.q('[data-best]').textContent = `${Math.round(Math.min(...times))} ms`;
      this.q('[data-count]').textContent = String(this.trials.length);
      this.q('[data-rating]').textContent = `${rulerRating(avgCm)} (average of ${this.trials.length})`;
    }
  }
}

customElements.define('ruler-drop', RulerDrop);
