// AASHTO stopping sight distance (Green Book, Chapter 3). Shared by the page (server) and the calculator (client).

export type SightUnits = 'us' | 'metric';

export const SSD_DEFAULTS = {
  /** Brake reaction time, s — long enough for about 90% of drivers. */
  reactionS: 2.5,
  us: { speed: 55, decel: 11.2 },
  metric: { speed: 90, decel: 3.4 },
} as const;

export interface SightResult {
  reaction: number;
  braking: number;
  total: number;
  /** AASHTO design value: rounded up to the next 5 ft or 5 m. */
  design: number;
}

/**
 * US customary: speed in mph, deceleration in ft/s², distances in ft. Metric: km/h, m/s², m.
 * `grade` is a percentage, positive uphill and negative downhill.
 * Level roads use AASHTO Eq. 3-2 (1.075V²/a; 0.039V²/a); grades use Eq. 3-3 (V²/(30(a/32.2 ± G)); V²/(254(a/9.81 ± G))).
 */
export const stoppingSightDistance = (
  speed: number,
  reactionS: number,
  decel: number,
  grade: number,
  units: SightUnits,
): SightResult => {
  const g = grade / 100;
  let reaction: number;
  let braking: number;
  if (units === 'us') {
    reaction = 1.47 * speed * reactionS;
    braking = g === 0 ? (1.075 * speed * speed) / decel : (speed * speed) / (30 * (decel / 32.2 + g));
  } else {
    reaction = 0.278 * speed * reactionS;
    braking = g === 0 ? (0.039 * speed * speed) / decel : (speed * speed) / (254 * (decel / 9.81 + g));
  }
  // A downgrade steeper than the vehicle can brake against means it can never stop.
  if (!Number.isFinite(braking) || braking < 0) braking = Infinity;
  const total = reaction + braking;
  return { reaction, braking, total, design: Number.isFinite(total) ? Math.ceil(total / 5 - 1e-9) * 5 : Infinity };
};
