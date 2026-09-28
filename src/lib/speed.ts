// Units, presets and geometry for the GPS speedometer. Shared by server markup and client script.

export type SpeedUnit = 'kmh' | 'mph' | 'kn' | 'ms';

export const UNITS: Record<SpeedUnit, { label: string; short: string; perMs: number; distance: 'km' | 'mi' | 'nm' }> = {
  kmh: { label: 'km/h', short: 'KM/H', perMs: 3.6, distance: 'km' },
  mph: { label: 'mph', short: 'MPH', perMs: 2.2369362921, distance: 'mi' },
  kn: { label: 'knots', short: 'KNOTS', perMs: 1.9438444924, distance: 'nm' },
  ms: { label: 'm/s', short: 'M/S', perMs: 1, distance: 'km' },
};

const METERS_PER: Record<'km' | 'mi' | 'nm', number> = { km: 1000, mi: 1609.344, nm: 1852 };

export type SpeedPresetId = 'general' | 'car' | 'bike' | 'bus' | 'train' | 'flight';

export interface SpeedPreset {
  id: SpeedPresetId;
  noun: string;
  units: SpeedUnit[];
  /** Starting gauge range in km/h; the gauge auto-extends if you go faster. */
  rangeKmh: number;
  /** Positions implying more than this (m/s) are treated as GPS glitches. */
  maxPlausibleMs: number;
  /** Positions with a worse horizontal accuracy (m) are not used for distance or max speed. */
  maxAccuracyM: number;
  speedAlert: boolean;
  defaultAlertKmh: number;
  hud: boolean;
  showAltitude: boolean;
}

export const PRESETS: Record<SpeedPresetId, SpeedPreset> = {
  // The all-purpose speedometer on /speedometer/: any vehicle, so every unit and a wide plausibility limit.
  general: {
    id: 'general',
    noun: 'speedometer',
    units: ['kmh', 'mph', 'kn', 'ms'],
    rangeKmh: 160,
    maxPlausibleMs: 340,
    maxAccuracyM: 50,
    speedAlert: true,
    defaultAlertKmh: 100,
    hud: true,
    showAltitude: true,
  },
  car: {
    id: 'car',
    noun: 'car',
    units: ['kmh', 'mph', 'ms'],
    rangeKmh: 180,
    maxPlausibleMs: 110,
    maxAccuracyM: 40,
    speedAlert: true,
    defaultAlertKmh: 100,
    hud: true,
    showAltitude: false,
  },
  bike: {
    id: 'bike',
    noun: 'bike',
    units: ['kmh', 'mph', 'ms'],
    rangeKmh: 60,
    maxPlausibleMs: 90,
    maxAccuracyM: 30,
    speedAlert: true,
    defaultAlertKmh: 25,
    hud: true,
    showAltitude: true,
  },
  bus: {
    id: 'bus',
    noun: 'bus',
    units: ['kmh', 'mph', 'ms'],
    rangeKmh: 120,
    maxPlausibleMs: 60,
    maxAccuracyM: 40,
    speedAlert: true,
    defaultAlertKmh: 80,
    hud: false,
    showAltitude: false,
  },
  train: {
    id: 'train',
    noun: 'train',
    units: ['kmh', 'mph', 'ms'],
    rangeKmh: 200,
    // ~430 km/h: above the fastest conventional high-speed services, so real readings are never discarded.
    maxPlausibleMs: 120,
    maxAccuracyM: 50,
    speedAlert: false,
    defaultAlertKmh: 0,
    hud: false,
    showAltitude: false,
  },
  flight: {
    id: 'flight',
    noun: 'flight',
    units: ['kmh', 'mph', 'kn', 'ms'],
    rangeKmh: 1000,
    maxPlausibleMs: 340,
    maxAccuracyM: 100,
    speedAlert: false,
    defaultAlertKmh: 0,
    hud: false,
    showAltitude: true,
  },
};

export const toUnit = (ms: number, unit: SpeedUnit): number => ms * UNITS[unit].perMs;
export const fromUnit = (value: number, unit: SpeedUnit): number => value / UNITS[unit].perMs;

/** Countries that sign road speeds in mph. */
const MPH_REGIONS = new Set(['US', 'GB', 'LR', 'MM', 'PR', 'VI', 'GU', 'AS', 'MP', 'BS', 'BZ', 'KY', 'VG']);

export const defaultUnitFor = (locale: string): SpeedUnit => {
  const region = locale.split('-')[1]?.toUpperCase();
  return region && MPH_REGIONS.has(region) ? 'mph' : 'kmh';
};

// ---- Gauge geometry ---------------------------------------------------------------------------

const RANGE_LADDER = [20, 40, 60, 80, 100, 120, 160, 180, 200, 240, 320, 400, 600, 800, 1000, 1200, 1600];
const TICK_STEPS = [5, 10, 15, 20, 25, 30, 40, 50, 60, 100, 150, 200, 250, 300, 400];

/** Smallest ladder value that fits `value`. */
export const gaugeRange = (value: number): number =>
  RANGE_LADDER.find((r) => r >= value) ?? Math.ceil(value / 500) * 500;

export const initialRange = (preset: SpeedPreset, unit: SpeedUnit): number =>
  gaugeRange(toUnit(preset.rangeKmh / 3.6, unit));

/** Major tick step giving 4–8 labelled ticks, preferring ~6. */
export const tickStep = (max: number): number => {
  let best = max / 4;
  let bestScore = Infinity;
  for (const s of TICK_STEPS) {
    const n = max / s;
    if (!Number.isInteger(n) || n < 4 || n > 8) continue;
    const score = Math.abs(n - 6);
    if (score < bestScore) {
      best = s;
      bestScore = score;
    }
  }
  return best;
};

export const GAUGE = { cx: 160, cy: 160, r: 132, start: 135, sweep: 270 } as const;

export const polar = (deg: number, r: number = GAUGE.r): { x: number; y: number } => {
  const rad = (deg * Math.PI) / 180;
  return { x: GAUGE.cx + r * Math.cos(rad), y: GAUGE.cy + r * Math.sin(rad) };
};

export const arcPath = (fromDeg: number, toDeg: number, r: number = GAUGE.r): string => {
  const a = polar(fromDeg, r);
  const b = polar(toDeg, r);
  const large = toDeg - fromDeg > 180 ? 1 : 0;
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
};

export interface GaugeTick {
  value: number;
  major: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  lx: number;
  ly: number;
}

export const gaugeTicks = (max: number): GaugeTick[] => {
  const step = tickStep(max);
  const ticks: GaugeTick[] = [];
  for (let v = 0; v <= max + 1e-9; v += step / 2) {
    const major = Math.abs(v / step - Math.round(v / step)) < 1e-9;
    const deg = GAUGE.start + (v / max) * GAUGE.sweep;
    const outer = polar(deg, GAUGE.r - 14);
    const inner = polar(deg, GAUGE.r - (major ? 24 : 19));
    const label = polar(deg, GAUGE.r - 40);
    ticks.push({
      value: Math.round(v),
      major,
      x1: outer.x,
      y1: outer.y,
      x2: inner.x,
      y2: inner.y,
      lx: label.x,
      ly: label.y,
    });
  }
  return ticks;
};

// ---- Geodesy ----------------------------------------------------------------------------------

const EARTH_R = 6371008.8;
const toRad = (d: number) => (d * Math.PI) / 180;

export const haversine = (a: { lat: number; lon: number }, b: { lat: number; lon: number }): number => {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
};

export const bearing = (a: { lat: number; lon: number }, b: { lat: number; lon: number }): number => {
  const y = Math.sin(toRad(b.lon - a.lon)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lon - a.lon));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const compassPoint = (deg: number): string => COMPASS[Math.round(deg / 45) % 8];

export const formatDistance = (meters: number, unit: SpeedUnit): { value: string; unit: string } => {
  const d = UNITS[unit].distance;
  const v = meters / METERS_PER[d];
  return { value: v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.round(v).toString(), unit: d };
};

export const formatDuration = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
};

export interface TrackPoint {
  lat: number;
  lon: number;
  ele: number | null;
  t: number;
  speed: number;
}

const xmlEscape = (s: string) => s.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);

export const buildGpx = (points: TrackPoint[], name: string): string => {
  const pts = points
    .map(
      (p) =>
        `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}">` +
        (p.ele !== null ? `<ele>${p.ele.toFixed(1)}</ele>` : '') +
        `<time>${new Date(p.t).toISOString()}</time></trkpt>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="SpeedReflex.com" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${xmlEscape(name)}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`;
};
