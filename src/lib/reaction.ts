// Shared maths for the reflex tests. Imported by page content (server) and tool scripts (client).

export const ATTEMPTS_PER_SESSION = 5;

/** Anything faster than this is treated as anticipation, not a reaction to the stimulus. */
export const ANTICIPATION_MS = 100;

/**
 * Population model for simple visual reaction time: log-normal with a median of 265 ms.
 * It is an approximation fitted to published browser-test distributions, not live user data.
 */
export const POPULATION = { medianMs: 265, sigma: 0.2 } as const;

export interface Tier {
  max: number;
  label: string;
  note: string;
}

export const REACTION_TIERS: Tier[] = [
  { max: 170, label: 'Elite', note: 'Esports and sprint-start territory.' },
  { max: 210, label: 'Excellent', note: 'Faster than the large majority of people.' },
  { max: 250, label: 'Above average', note: 'Quicker than a typical adult.' },
  { max: 290, label: 'Average', note: 'Right around the typical adult range.' },
  { max: 350, label: 'Below average', note: 'Try a wired mouse, a rest, or a few more rounds.' },
  { max: Infinity, label: 'Slow', note: 'Tired, distracted, or on a laggy device?' },
];

export const F1_TIERS: Tier[] = [
  { max: 0.18, label: 'F1-grade launch', note: 'A start that would stand out on any Formula 1 grid.' },
  { max: 0.22, label: 'F1 pace', note: 'In the range usually quoted for F1 drivers.' },
  { max: 0.26, label: 'Pro racer', note: 'Sharp enough for competitive motorsport.' },
  { max: 0.3, label: 'Club racer', note: 'A solid start — the midfield is within reach.' },
  { max: 0.4, label: 'Road driver', note: 'Typical for someone who is not trained for starts.' },
  { max: Infinity, label: 'Stalled on the grid', note: 'The field is already into turn one.' },
];

export const tierFor = (value: number, tiers: Tier[]): Tier =>
  tiers.find((t) => value < t.max) ?? tiers[tiers.length - 1];

export const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

export const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export const stdDev = (xs: number[]): number => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((acc, x) => acc + (x - m) ** 2, 0) / (xs.length - 1));
};

// Abramowitz & Stegun 7.1.26 — plenty of precision for a percentile readout.
const erf = (x: number): number => {
  const sign = Math.sign(x);
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
};

const normalCdf = (z: number): number => 0.5 * (1 + erf(z / Math.SQRT2));

/** Share of the modelled population that is slower than `ms` (0–100). */
export const percentFasterThan = (ms: number): number => {
  const z = (Math.log(ms) - Math.log(POPULATION.medianMs)) / POPULATION.sigma;
  return Math.min(99.9, Math.max(0.1, (1 - normalCdf(z)) * 100));
};

/** Log-normal probability density, used to draw the distribution curve. */
export const populationPdf = (ms: number): number => {
  const { medianMs, sigma } = POPULATION;
  const z = (Math.log(ms) - Math.log(medianMs)) / sigma;
  return Math.exp(-0.5 * z * z) / (ms * sigma * Math.sqrt(2 * Math.PI));
};

/** Plot geometry for the population curve, shared by the server-rendered SVG and the client marker. */
export const DIST = { min: 120, max: 520, width: 560, padX: 12, top: 16, base: 140 } as const;

export const distX = (ms: number): number => {
  const clamped = Math.min(DIST.max, Math.max(DIST.min, ms));
  return DIST.padX + ((clamped - DIST.min) / (DIST.max - DIST.min)) * (DIST.width - 2 * DIST.padX);
};

export const distMs = (x: number): number =>
  DIST.min + ((x - DIST.padX) / (DIST.width - 2 * DIST.padX)) * (DIST.max - DIST.min);

export const distributionPaths = (): { line: string; area: string } => {
  const samples: [number, number][] = [];
  for (let ms = DIST.min; ms <= DIST.max; ms += 4) samples.push([ms, populationPdf(ms)]);
  const peak = Math.max(...samples.map(([, p]) => p));
  const pts = samples.map(([ms, p]) => `${distX(ms).toFixed(1)} ${(DIST.base - (p / peak) * (DIST.base - DIST.top)).toFixed(1)}`);
  const line = `M ${pts.join(' L ')}`;
  const area = `${line} L ${distX(DIST.max).toFixed(1)} ${DIST.base} L ${distX(DIST.min).toFixed(1)} ${DIST.base} Z`;
  return { line, area };
};

/** Random foreperiod so the stimulus can't be timed by rhythm. */
export const randomDelay = (minMs: number, maxMs: number): number => minMs + Math.random() * (maxMs - minMs);

/** Box–Muller sample from a normal distribution. */
const gaussian = (mu: number, sd: number): number => {
  const u = 1 - Math.random();
  const v = Math.random();
  return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

/**
 * Simulated 19-car field for the F1 test. Rival reactions are drawn around 0.215 s,
 * clamped to a plausible 0.15–0.34 s band. Purely for fun — not real driver data.
 */
export const simulateGridPosition = (userSeconds: number, rivals = 19): number => {
  let ahead = 0;
  for (let i = 0; i < rivals; i++) {
    const r = Math.min(0.34, Math.max(0.15, gaussian(0.215, 0.03)));
    if (r < userSeconds) ahead++;
  }
  return ahead + 1;
};
