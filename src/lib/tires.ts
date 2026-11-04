// Tire-size and speedometer-gear maths for the speedometer calculator. Shared by server render and client script.

export const MM_PER_IN = 25.4;
/** Inches in a mile (63,360) ÷ π — revolutions per mile ≈ this ÷ tire diameter in inches. */
export const REVS_PER_MILE_K = 63360 / Math.PI;
/** GM-style cable speedometers are calibrated for 1,001 cable turns per mile. */
export const CABLE_TURNS_PER_MILE = 1001;

export interface Tire {
  /** Overall diameter in inches. */
  diameterIn: number;
  /** Section width in mm, when known. */
  widthMm?: number;
  /** Sidewall height in inches, when known. */
  sidewallIn?: number;
  rimIn?: number;
  /** How the size was written, normalised. */
  label: string;
}

/**
 * Parses a tire size such as "265/70R17", "P225/45ZR17", "LT265/75-16", "33x12.50R15" or a bare diameter ("31.5").
 * Returns null when the text isn't a recognisable size.
 */
export const parseTire = (raw: string): Tire | null => {
  const s = raw.trim().toUpperCase().replace(',', '.');
  if (!s) return null;

  // Metric / P-metric / LT-metric: width/aspect [construction] rim.
  const metric = s.match(/(\d{3})\s*\/\s*(\d{2,3})\s*[A-Z]*\s*-?\s*(\d{2}(?:\.\d)?)/);
  if (metric) {
    const widthMm = Number(metric[1]);
    const aspect = Number(metric[2]);
    const rimIn = Number(metric[3]);
    if (widthMm < 100 || widthMm > 450 || aspect < 20 || aspect > 100 || rimIn < 10 || rimIn > 30) return null;
    const sidewallIn = (widthMm * (aspect / 100)) / MM_PER_IN;
    return { diameterIn: rimIn + 2 * sidewallIn, widthMm, sidewallIn, rimIn, label: `${widthMm}/${aspect}R${rimIn}` };
  }

  // Flotation: diameter x width [construction] rim, all in inches.
  const flot = s.match(/(\d{2}(?:\.\d+)?)\s*X\s*(\d{1,2}(?:\.\d+)?)\s*[A-Z]*\s*-?\s*(\d{2}(?:\.\d)?)/);
  if (flot) {
    const diameterIn = Number(flot[1]);
    const widthIn = Number(flot[2]);
    const rimIn = Number(flot[3]);
    if (diameterIn < 20 || diameterIn > 60 || rimIn < 10 || rimIn > 30 || diameterIn <= rimIn) return null;
    return {
      diameterIn,
      widthMm: widthIn * MM_PER_IN,
      sidewallIn: (diameterIn - rimIn) / 2,
      rimIn,
      label: `${diameterIn}x${widthIn}R${rimIn}`,
    };
  }

  // A bare overall diameter in inches.
  const bare = s.match(/^(\d{2}(?:\.\d+)?)(?:\s*(?:IN|INCH|INCHES|"))?$/);
  if (bare) {
    const diameterIn = Number(bare[1]);
    if (diameterIn < 15 || diameterIn > 60) return null;
    return { diameterIn, label: `${diameterIn}″ diameter` };
  }
  return null;
};

export const circumferenceIn = (diameterIn: number): number => Math.PI * diameterIn;
/** Theoretical (unloaded) revolutions per mile. Real tires turn ~2–3% more because the loaded radius is smaller. */
export const revsPerMile = (diameterIn: number): number => REVS_PER_MILE_K / diameterIn;

/** True speed when the speedometer (calibrated for `original`) shows `indicated` on the `fitted` tire. */
export const trueSpeed = (indicated: number, originalIn: number, fittedIn: number): number => indicated * (fittedIn / originalIn);

/** Speedometer error in percent: positive when it reads high, negative when it reads low. */
export const speedoErrorPct = (originalIn: number, fittedIn: number): number => (originalIn / fittedIn - 1) * 100;

/** Exact driven-gear tooth count: (axle ratio × drive teeth × tire revs per mile) ÷ 1001. */
export const drivenGearTeeth = (axleRatio: number, driveTeeth: number, tireDiameterIn: number): number =>
  (axleRatio * driveTeeth * revsPerMile(tireDiameterIn)) / CABLE_TURNS_PER_MILE;

/** Error (%) of a speedometer fitted with `drivenTeeth` when the exact requirement is `exact` teeth. */
export const gearErrorPct = (exact: number, drivenTeeth: number): number => (exact / drivenTeeth - 1) * 100;
