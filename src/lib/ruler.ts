// Ruler drop test maths. Shared by the page (server) and the calculator (client).

/** Standard gravity, m/s². */
export const G = 9.80665;
export const CM_PER_IN = 2.54;

/** Reaction time (ms) from how far a ruler fell before it was caught — free fall from rest: t = √(2d / g). */
export const rulerTimeMs = (cm: number): number => (cm <= 0 ? 0 : Math.sqrt((2 * (cm / 100)) / G) * 1000);

/** How far (cm) a ruler falls in `ms` milliseconds: d = ½gt². */
export const rulerDistanceCm = (ms: number): number => 0.5 * G * (ms / 1000) ** 2 * 100;

/**
 * Widely reproduced ruler drop test norms for 16–19-year-olds (Davis et al., Physical Education and the
 * Study of Sport, 2000). Upper bounds in centimetres.
 */
export const RULER_NORMS = [
  { maxCm: 7.5, label: 'Excellent' },
  { maxCm: 15.9, label: 'Above average' },
  { maxCm: 20.4, label: 'Average' },
  { maxCm: 28, label: 'Below average' },
  { maxCm: Infinity, label: 'Poor' },
] as const;

export const rulerRating = (cm: number): string => (RULER_NORMS.find((n) => cm < n.maxCm) ?? RULER_NORMS[RULER_NORMS.length - 1]).label;
