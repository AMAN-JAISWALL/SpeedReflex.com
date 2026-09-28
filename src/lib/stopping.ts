// Stopping-distance model. Shared by the calculator's server render and its client script.

/**
 * Dry-road deceleration in m/s² (≈0.66 g). It is what the UK Highway Code's typical braking distances imply —
 * with it the model reproduces Rule 126 (e.g. 30 mph → 9 + 14 = 23 m, 70 mph → 21 + 75 = 96 m).
 */
export const DRY_DECEL = 6.5;

/** Braking-distance multipliers from the Highway Code: at least double when wet (Rule 227), up to ten times on ice (Rule 230). */
export const ROADS = {
  dry: { label: 'Dry', factor: 1 },
  wet: { label: 'Wet', factor: 2 },
  icy: { label: 'Icy', factor: 10 },
} as const;
export type Road = keyof typeof ROADS;

export interface ReactionPreset {
  s: number;
  label: string;
  note: string;
}

export const REACTION_PRESETS: ReactionPreset[] = [
  { s: 0.67, label: 'Highway Code', note: 'The thinking time behind the Highway Code’s typical stopping distances.' },
  { s: 1.25, label: 'Brake lights ahead', note: 'An unexpected but common signal, such as the car in front braking (Green, 2000).' },
  { s: 1.5, label: 'Sudden surprise', note: 'Something suddenly moves into your path (Green, 2000).' },
  { s: 2.5, label: 'Road design', note: 'The US design value, long enough for about 90% of drivers (AASHTO).' },
];

export type SpeedUnitRoad = 'mph' | 'kmh';
export const MS_PER: Record<SpeedUnitRoad, number> = { mph: 0.44704, kmh: 1 / 3.6 };

export const M_TO_FT = 3.28084;
/** The Highway Code counts stopping distances in car lengths of roughly 4 m (23 m ≈ 6 car lengths). */
export const CAR_LENGTH_M = 4;

export interface Stopping {
  thinking: number;
  braking: number;
  total: number;
}

/** Distances in metres for a speed in m/s, a reaction time in seconds and a road surface. */
export const stoppingDistance = (speedMs: number, reactionS: number, road: Road): Stopping => {
  const thinking = speedMs * reactionS;
  const braking = (speedMs * speedMs) / (2 * (DRY_DECEL / ROADS[road].factor));
  return { thinking, braking, total: thinking + braking };
};

/** Typical stopping distances from the Highway Code, Rule 126 (metres), for checking the model against. */
export const HIGHWAY_CODE = [
  { mph: 20, thinking: 6, braking: 6, total: 12, feet: 40 },
  { mph: 30, thinking: 9, braking: 14, total: 23, feet: 75 },
  { mph: 40, thinking: 12, braking: 24, total: 36, feet: 118 },
  { mph: 50, thinking: 15, braking: 38, total: 53, feet: 175 },
  { mph: 60, thinking: 18, braking: 55, total: 73, feet: 240 },
  { mph: 70, thinking: 21, braking: 75, total: 96, feet: 315 },
];
