// Tiny single-series trend chart (history of sessions) with a crosshair tooltip.
// The SVG stretches to its container; the dot, crosshair and tooltip are HTML so they never distort.

export interface TrendPoint {
  value: number;
  label: string;
}

const W = 600;
const H = 112;
const PAD = 10;
const SVG_NS = 'http://www.w3.org/2000/svg';

export const renderTrend = (root: HTMLElement, points: TrendPoint[], format: (v: number) => string): void => {
  root.replaceChildren();
  root.hidden = points.length < 2;
  if (root.hidden) return;

  const values = points.map((p) => p.value);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const span = Math.max(hi - lo, Math.abs(hi) * 0.1, 1e-6);
  lo -= span * 0.15;
  hi += span * 0.15;

  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - PAD - ((v - lo) / (hi - lo)) * (H - 2 * PAD);
  const coords = points.map((p, i) => [x(i), y(p.value)] as const);
  const line = `M ${coords.map(([a, b]) => `${a.toFixed(1)} ${b.toFixed(1)}`).join(' L ')}`;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('absolute', 'inset-0', 'h-full', 'w-full', 'overflow-visible');

  const area = document.createElementNS(SVG_NS, 'path');
  area.setAttribute('d', `${line} L ${W} ${H} L 0 ${H} Z`);
  area.setAttribute('fill', 'currentColor');
  area.setAttribute('fill-opacity', '0.08');

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', line);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.append(area, path);

  const pct = (i: number) => ({ left: `${(coords[i][0] / W) * 100}%`, top: `${(coords[i][1] / H) * 100}%` });

  const dot = document.createElement('span');
  dot.className = 'pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-2 ring-surface';
  Object.assign(dot.style, pct(points.length - 1));

  const cross = document.createElement('span');
  cross.className = 'pointer-events-none absolute inset-y-0 w-px bg-hairline-strong';
  cross.hidden = true;

  const tip = document.createElement('div');
  tip.className =
    'pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-sm border border-hairline bg-surface px-2.5 py-1.5 text-xs shadow-float';
  tip.hidden = true;
  const tipValue = document.createElement('strong');
  tipValue.className = 'block text-sm font-semibold text-ink tabular-nums';
  const tipLabel = document.createElement('span');
  tipLabel.className = 'text-mute';
  tip.append(tipValue, tipLabel);

  root.append(svg, cross, dot, tip);

  let active = points.length - 1;
  const show = (i: number) => {
    active = Math.max(0, Math.min(points.length - 1, i));
    const pos = pct(active);
    cross.style.left = pos.left;
    dot.style.left = pos.left;
    dot.style.top = pos.top;
    tip.style.left = `clamp(3rem, ${pos.left}, calc(100% - 3rem))`;
    tipValue.textContent = format(points[active].value);
    tipLabel.textContent = points[active].label;
    cross.hidden = false;
    tip.hidden = false;
  };
  const hide = () => {
    cross.hidden = true;
    tip.hidden = true;
    Object.assign(dot.style, pct(points.length - 1));
  };

  root.onpointermove = (e) => {
    const rect = root.getBoundingClientRect();
    show(Math.round(((e.clientX - rect.left) / rect.width) * (points.length - 1)));
  };
  root.onpointerleave = hide;
  root.onfocus = () => show(active);
  root.onblur = hide;
  root.onkeydown = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      show(active + (e.key === 'ArrowLeft' ? -1 : 1));
    }
  };
};
