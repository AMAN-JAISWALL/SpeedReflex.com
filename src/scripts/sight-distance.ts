import { SSD_DEFAULTS, stoppingSightDistance, type SightUnits } from '../lib/sight';
import { defaultUnitFor } from '../lib/speed';
import { store } from '../lib/browser';

const UNIT_KEY = 'sr:ssd:units';
const KM_PER_MI = 1.609344;
const M_PER_FT = 0.3048;

class SightDistance extends HTMLElement {
  private units: SightUnits = 'us';

  private q<T extends Element = HTMLElement>(sel: string): T {
    const el = this.querySelector<T>(sel);
    if (!el) throw new Error(`sight-distance: missing ${sel}`);
    return el;
  }

  connectedCallback(): void {
    this.q('[data-form]').addEventListener('submit', (e) => e.preventDefault());
    for (const sel of ['[data-speed]', '[data-reaction]', '[data-decel]', '[data-grade]']) {
      this.q<HTMLInputElement>(sel).addEventListener('input', () => this.render());
    }
    this.q('[data-units]').addEventListener('click', (e) => {
      const btn = (e.target as Element).closest<HTMLButtonElement>('[data-unit]');
      if (btn) this.setUnits(btn.dataset.unit as SightUnits, true);
    });
    const saved = store.get<SightUnits | null>(UNIT_KEY, null);
    this.setUnits(saved ?? (defaultUnitFor(navigator.language || 'en') === 'mph' ? 'us' : 'metric'), false);
  }

  /** Switching units converts the speed (to a round 5) and resets deceleration to the AASHTO default for that system. */
  private setUnits(units: SightUnits, remember: boolean): void {
    if (units !== this.units) {
      const speed = this.q<HTMLInputElement>('[data-speed]');
      const v = Number.parseFloat(speed.value);
      if (Number.isFinite(v)) {
        const converted = units === 'metric' ? v * KM_PER_MI : v / KM_PER_MI;
        speed.value = String(Math.round(converted / 5) * 5);
      }
      this.q<HTMLInputElement>('[data-decel]').value = String(SSD_DEFAULTS[units].decel);
    }
    this.units = units;
    if (remember) store.set(UNIT_KEY, units);
    this.querySelectorAll<HTMLButtonElement>('[data-unit]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.unit === units)));
    this.q('[data-speed-unit]').textContent = units === 'us' ? '(mph)' : '(km/h)';
    this.q('[data-decel-unit]').textContent = units === 'us' ? '(ft/s²)' : '(m/s²)';
    this.render();
  }

  private num(sel: string, fallback: number): number {
    const v = Number.parseFloat(this.q<HTMLInputElement>(sel).value);
    return Number.isFinite(v) ? v : fallback;
  }

  private render(): void {
    const us = this.units === 'us';
    const unit = us ? 'ft' : 'm';
    const speed = this.num('[data-speed]', SSD_DEFAULTS[this.units].speed);
    const reaction = this.num('[data-reaction]', SSD_DEFAULTS.reactionS);
    const decel = this.num('[data-decel]', SSD_DEFAULTS[this.units].decel);
    const grade = this.num('[data-grade]', 0);
    if (speed <= 0 || reaction < 0 || decel <= 0) return;

    const r = stoppingSightDistance(speed, reaction, decel, grade, this.units);
    const fmt = (v: number) => (Number.isFinite(v) ? `${Math.round(v)} ${unit}` : '—');
    this.q('[data-design]').textContent = Number.isFinite(r.design) ? `${r.design} ${unit}` : 'No stop';
    this.q('[data-total]').textContent = fmt(r.total);
    this.q('[data-reaction-out]').textContent = fmt(r.reaction);
    this.q('[data-braking-out]').textContent = fmt(r.braking);
    this.q('[data-bar]').style.width = Number.isFinite(r.total) ? `${(r.reaction / r.total) * 100}%` : '0%';

    const other = us ? `${Math.round(r.design * M_PER_FT)} m` : `${Math.round(r.design / M_PER_FT)} ft`;
    this.q('[data-note]').textContent = !Number.isFinite(r.design)
      ? 'On a downgrade this steep, the deceleration you entered cannot stop the vehicle. Increase the deceleration or reduce the grade.'
      : `${grade < 0 ? `A ${Math.abs(grade)}% downgrade lengthens the braking distance. ` : grade > 0 ? `A ${grade}% upgrade shortens the braking distance. ` : ''}Design value rounded up to the next 5 ${unit} (≈ ${other}).`;
  }
}

customElements.define('sight-distance', SightDistance);
