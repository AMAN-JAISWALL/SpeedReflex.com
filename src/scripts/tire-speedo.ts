import { CABLE_TURNS_PER_MILE, drivenGearTeeth, gearErrorPct, parseTire, revsPerMile, speedoErrorPct, trueSpeed, type Tire } from '../lib/tires';
import { defaultUnitFor } from '../lib/speed';
import { store } from '../lib/browser';

type Unit = 'mph' | 'kmh';
const UNIT_KEY = 'sr:tires:unit';
const SPEEDS: Record<Unit, number[]> = { mph: [20, 30, 40, 50, 60, 70, 80], kmh: [30, 50, 70, 90, 100, 120, 130] };
const KM_PER_MI = 1.609344;

const fmtIn = (v: number) => `${v.toFixed(2)} in`;

class TireSpeedo extends HTMLElement {
  private unit: Unit = 'mph';

  private q<T extends Element = HTMLElement>(sel: string): T {
    const el = this.querySelector<T>(sel);
    if (!el) throw new Error(`tire-speedo: missing ${sel}`);
    return el;
  }

  connectedCallback(): void {
    this.q('[data-form]').addEventListener('submit', (e) => e.preventDefault());
    for (const sel of ['[data-original]', '[data-fitted]', '[data-speed]']) {
      this.q<HTMLInputElement>(sel).addEventListener('input', () => this.render());
    }
    this.q('[data-units]').addEventListener('click', (e) => {
      const btn = (e.target as Element).closest<HTMLButtonElement>('[data-unit]');
      if (btn) this.setUnit(btn.dataset.unit as Unit, true);
    });
    const saved = store.get<Unit | null>(UNIT_KEY, null);
    this.setUnit(saved ?? (defaultUnitFor(navigator.language || 'en') === 'mph' ? 'mph' : 'kmh'), false);
  }

  private setUnit(unit: Unit, remember: boolean): void {
    const speedInput = this.q<HTMLInputElement>('[data-speed]');
    if (unit !== this.unit) {
      const v = Number.parseFloat(speedInput.value);
      if (Number.isFinite(v)) speedInput.value = String(Math.round(unit === 'kmh' ? v * KM_PER_MI : v / KM_PER_MI));
    }
    this.unit = unit;
    if (remember) store.set(UNIT_KEY, unit);
    this.querySelectorAll<HTMLButtonElement>('[data-unit]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.unit === unit)));
    this.render();
  }

  private render(): void {
    const origInput = this.q<HTMLInputElement>('[data-original]');
    const fitInput = this.q<HTMLInputElement>('[data-fitted]');
    const a = parseTire(origInput.value);
    const b = parseTire(fitInput.value);
    origInput.setAttribute('aria-invalid', String(!a));
    fitInput.setAttribute('aria-invalid', String(!b));
    const errorEl = this.q('[data-error]');
    if (!a || !b) {
      errorEl.textContent = `Couldn’t read the ${!a ? 'original' : 'new'} tire size. Try a format like 265/70R17 or 33x12.50R15.`;
      return;
    }
    errorEl.textContent = '';

    const label = this.unit === 'mph' ? 'mph' : 'km/h';
    const shown = Number.parseFloat(this.q<HTMLInputElement>('[data-speed]').value);
    const indicated = Number.isFinite(shown) && shown > 0 ? shown : 60;
    const actual = trueSpeed(indicated, a.diameterIn, b.diameterIn);
    const err = speedoErrorPct(a.diameterIn, b.diameterIn);

    this.q('[data-actual]').textContent = `${actual.toFixed(1)} ${label}`;
    this.q('[data-actual-sub]').textContent = `when the speedometer shows ${+indicated.toFixed(1)} ${label}`;
    const same = Math.abs(err) < 0.05;
    this.q('[data-err]').textContent = same ? 'none' : `${Math.abs(err).toFixed(1)}% ${err < 0 ? 'low' : 'high'}`;
    this.q('[data-err-note]').textContent = same
      ? ' — the tires are the same overall size.'
      : err < 0
        ? ' — you are going faster than shown.'
        : ' — you are going slower than shown.';

    const spec = (t: Tire) => [
      fmtIn(t.diameterIn),
      t.sidewallIn !== undefined ? fmtIn(t.sidewallIn) : '–',
      `${(Math.PI * t.diameterIn).toFixed(1)} in`,
      Math.round(revsPerMile(t.diameterIn)).toString(),
    ];
    const labels = ['Overall diameter', 'Sidewall height', 'Circumference', 'Revolutions per mile'];
    const sa = spec(a);
    const sb = spec(b);
    this.q('[data-specs]').replaceChildren(
      ...labels.map((l, i) => {
        const tr = document.createElement('tr');
        for (const text of [l, sa[i], sb[i]]) {
          const td = document.createElement('td');
          td.textContent = text;
          tr.append(td);
        }
        return tr;
      }),
    );

    const speeds = SPEEDS[this.unit];
    this.querySelectorAll('[data-speed-head]').forEach((th, i) => (th.textContent = String(speeds[i])));
    const row = this.q('[data-true-row]');
    row.querySelectorAll('td').forEach((td, i) => {
      if (i > 0) td.textContent = trueSpeed(speeds[i - 1], a.diameterIn, b.diameterIn).toFixed(1);
    });

    // Let the gear calculator pick up the new tire's diameter if the visitor hasn't typed their own.
    this.dispatchEvent(new CustomEvent('tire-change', { bubbles: true, detail: { diameterIn: b.diameterIn } }));
  }
}

class SpeedoGear extends HTMLElement {
  private touchedDiameter = false;

  private q<T extends Element = HTMLElement>(sel: string): T {
    const el = this.querySelector<T>(sel);
    if (!el) throw new Error(`speedo-gear: missing ${sel}`);
    return el;
  }

  connectedCallback(): void {
    this.q('[data-form]').addEventListener('submit', (e) => e.preventDefault());
    for (const sel of ['[data-axle]', '[data-drive]', '[data-current]']) {
      this.q<HTMLInputElement>(sel).addEventListener('input', () => this.render());
    }
    const dia = this.q<HTMLInputElement>('[data-diameter]');
    dia.addEventListener('input', () => {
      this.touchedDiameter = true;
      this.render();
    });
    document.addEventListener('tire-change', (e) => {
      if (this.touchedDiameter) return;
      const d = (e as CustomEvent<{ diameterIn: number }>).detail.diameterIn;
      dia.value = d.toFixed(1);
      this.render();
    });
    this.render();
  }

  private num(sel: string): number {
    return Number.parseFloat(this.q<HTMLInputElement>(sel).value);
  }

  private render(): void {
    const axle = this.num('[data-axle]');
    const dia = this.num('[data-diameter]');
    const drive = this.num('[data-drive]');
    const current = this.num('[data-current]');
    const out = this.q('[data-result]');
    if (![axle, dia, drive].every((v) => Number.isFinite(v) && v > 0)) {
      out.textContent = 'Enter the axle ratio, tire diameter and drive gear teeth.';
      return;
    }
    const exact = drivenGearTeeth(axle, drive, dia);
    const nearest = Math.max(1, Math.round(exact));
    const nearestErr = gearErrorPct(exact, nearest);
    this.q('[data-exact]').textContent = exact.toFixed(2);
    this.q('[data-nearest]').textContent = String(nearest);
    this.q('[data-rpm]').textContent = Math.round(revsPerMile(dia)).toString();
    const describe = (pct: number) =>
      Math.abs(pct) < 0.05 ? 'reads correctly' : `reads ${Math.abs(pct).toFixed(1)}% ${pct > 0 ? 'high' : 'low'} (${(60 * (1 + pct / 100)).toFixed(1)} at a true 60)`;
    let text = `A ${nearest}-tooth driven gear ${describe(nearestErr)}.`;
    if (Number.isFinite(current) && current > 0) {
      text += ` Your current ${Math.round(current)}-tooth gear ${describe(gearErrorPct(exact, Math.round(current)))}.`;
    }
    out.textContent = `${text} Based on ${CABLE_TURNS_PER_MILE} cable turns per mile.`;
  }
}

// The gear calculator listens for tire changes, so it must be upgraded first.
customElements.define('speedo-gear', SpeedoGear);
customElements.define('tire-speedo', TireSpeedo);
