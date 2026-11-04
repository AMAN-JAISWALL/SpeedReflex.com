export const SITE = {
  name: 'SpeedReflex',
  domain: 'SpeedReflex.com',
  url: 'https://speedreflex.com',
  tagline: 'Reaction time tests & GPS speedometers',
  description:
    'Free reaction time tests and a GPS speedometer in your browser — frame-accurate timing, F1 start lights and live speed for cars, bikes, trains and planes.',
  /** Main privacy mailbox. */
  email: 'privacy@speedreflex.com',
  /** General inquiries and support mailbox. */
  contactEmail: 'contact@speedreflex.com',
};

/** Tools that exist in every locale (and so have a translation in every locale file). */
export type LocalizedToolId = 'reaction' | 'f1' | 'audio' | 'speedometer' | 'car' | 'bike' | 'bus' | 'train' | 'flight' | 'stopping';
/** Tools published in English only — they are hidden from localized navigation and have no hreflang alternates. */
export type EnglishToolId = 'ruler' | 'boat' | 'motorcycle' | 'speedoCalc' | 'sightDistance';
export type ToolId = LocalizedToolId | EnglishToolId;

export interface Tool {
  id: ToolId;
  href: string;
  name: string;
  navLabel: string;
  category: 'reflex' | 'speed' | 'driving';
  summary: string;
  /** Breadcrumb parent — the vehicle speed tests sit under the general speedometer. */
  parent?: ToolId;
  /** The most useful next pages for someone on this tool, in order. */
  related: ToolId[];
  /** Extra related pages shown on the English version only (English-only tools can't appear on localized pages). */
  relatedEn?: ToolId[];
  /** Published in English only. */
  enOnly?: boolean;
  /** schema.org applicationCategory override for the WebApplication node. */
  appCategory?: string;
}

export const TOOLS: Tool[] = [
  {
    id: 'reaction',
    href: '/reaction-time-test/',
    name: 'Reaction Time Test',
    navLabel: 'Reaction Test',
    category: 'reflex',
    summary: 'Five frame-accurate attempts, your average, best, consistency and percentile.',
    related: ['f1', 'audio', 'stopping'],
    relatedEn: ['ruler'],
  },
  {
    id: 'f1',
    href: '/f1-reaction-time-test/',
    name: 'F1 Reaction Time Test',
    navLabel: 'F1 Test',
    category: 'reflex',
    summary: 'Five red lights, a random hold, lights out. See where you would launch on a 20-car grid.',
    related: ['reaction', 'audio', 'car'],
  },
  {
    id: 'audio',
    href: '/audio-reaction-time-test/',
    name: 'Audio Reaction Time Test',
    navLabel: 'Audio Test',
    category: 'reflex',
    summary: 'React to a beep instead of a flash — and see how your ears compare with your eyes.',
    related: ['reaction', 'f1', 'stopping'],
    relatedEn: ['ruler'],
  },
  {
    id: 'speedometer',
    href: '/speedometer/',
    name: 'Online Speedometer',
    navLabel: 'Speedometer',
    category: 'speed',
    summary: 'How fast am I going? Live GPS speed, max, average and distance for any trip.',
    related: ['reaction', 'stopping', 'f1'],
    relatedEn: ['speedoCalc'],
  },
  {
    id: 'car',
    href: '/car-speed-test/',
    name: 'Car Speed Test',
    navLabel: 'Car Speed',
    category: 'speed',
    summary: 'Check your true speed against the dashboard, with HUD mirror mode and speed alerts.',
    parent: 'speedometer',
    related: ['stopping', 'bike', 'speedometer'],
    relatedEn: ['speedoCalc'],
  },
  {
    id: 'bike',
    href: '/bike-speed-test/',
    name: 'Bike Speed Test',
    navLabel: 'Bike Speed',
    category: 'speed',
    summary: 'Speed, distance and moving average for bicycles, e-bikes and motorbikes.',
    parent: 'speedometer',
    related: ['car', 'speedometer', 'stopping'],
    relatedEn: ['motorcycle'],
  },
  {
    id: 'motorcycle',
    href: '/motorcycle-speed-test/',
    name: 'Motorcycle Speed Test',
    navLabel: 'Motorcycle Speed',
    category: 'speed',
    summary: 'A GPS motorcycle speedometer on your phone: true speed, top speed and trip distance.',
    parent: 'speedometer',
    related: ['bike', 'car', 'speedoCalc'],
    enOnly: true,
  },
  {
    id: 'boat',
    href: '/boat-speed-test/',
    name: 'Boat Speed Test',
    navLabel: 'Boat Speed',
    category: 'speed',
    summary: 'A GPS boat speedometer in knots, mph or km/h — speed over ground, max and distance.',
    parent: 'speedometer',
    related: ['speedometer', 'flight', 'train'],
    enOnly: true,
  },
  {
    id: 'bus',
    href: '/bus-speed-test/',
    name: 'Bus Speed Test',
    navLabel: 'Bus Speed',
    category: 'speed',
    summary: 'Check how fast your bus or coach is going from your seat, with GPS accuracy shown.',
    parent: 'speedometer',
    related: ['train', 'flight', 'speedometer'],
  },
  {
    id: 'train',
    href: '/train-speed-test/',
    name: 'Train Speed Test',
    navLabel: 'Train Speed',
    category: 'speed',
    summary: 'See how fast your train is really going — from commuter lines to 300 km/h high-speed rail.',
    parent: 'speedometer',
    related: ['flight', 'bus', 'speedometer'],
  },
  {
    id: 'flight',
    href: '/flight-speed-test/',
    name: 'Flight Speed Test',
    navLabel: 'Flight Speed',
    category: 'speed',
    summary: 'Ground speed, altitude and heading at 35,000 ft — works in airplane mode.',
    parent: 'speedometer',
    related: ['train', 'bus', 'speedometer'],
  },
  {
    id: 'stopping',
    href: '/stopping-distance-calculator/',
    name: 'Stopping Distance Calculator',
    navLabel: 'Stopping Distance',
    category: 'driving',
    summary: 'Thinking plus braking distance at any speed, reaction time and road condition.',
    related: ['reaction', 'car', 'f1'],
    relatedEn: ['sightDistance'],
  },
  {
    id: 'speedoCalc',
    href: '/speedometer-calculator/',
    name: 'Speedometer Calculator',
    navLabel: 'Speedometer Calculator',
    category: 'driving',
    summary: 'How new tire sizes or gears change your speedometer — true speed, error and the driven gear you need.',
    related: ['car', 'speedometer', 'stopping'],
    enOnly: true,
    appCategory: 'UtilitiesApplication',
  },
  {
    id: 'sightDistance',
    href: '/stopping-sight-distance-calculator/',
    name: 'Stopping Sight Distance Calculator',
    navLabel: 'Sight Distance',
    category: 'driving',
    summary: 'AASHTO stopping sight distance for any design speed, reaction time and grade, in feet or metres.',
    related: ['stopping', 'reaction', 'car'],
    enOnly: true,
    appCategory: 'UtilitiesApplication',
  },
  {
    id: 'ruler',
    href: '/ruler-drop-test/',
    name: 'Ruler Drop Test',
    navLabel: 'Ruler Drop Test',
    category: 'reflex',
    summary: 'Turn the centimetres or inches you caught a falling ruler at into a reaction time, with a full chart.',
    related: ['reaction', 'audio', 'f1'],
    enOnly: true,
    appCategory: 'EducationalApplication',
  },
];

export interface Guide {
  href: string;
  name: string;
  summary: string;
}

export const GUIDES: Guide[] = [
  {
    href: '/average-reaction-time/',
    name: 'Average Reaction Time',
    summary: 'What’s normal, good and fast — by age, stimulus and device, with sources.',
  },
];

export const toolById = (id: ToolId): Tool => {
  const tool = TOOLS.find((t) => t.id === id);
  if (!tool) throw new Error(`Unknown tool: ${id}`);
  return tool;
};

/** Is this tool published in `locale`? English-only tools exist at their English URL alone. */
export const isToolAvailable = (tool: Tool, locale: string): boolean => !tool.enOnly || locale === 'en';
export const toolsFor = (locale: string): Tool[] => TOOLS.filter((t) => isToolAvailable(t, locale));

export const REFLEX_TOOLS = TOOLS.filter((t) => t.category === 'reflex');
export const SPEED_TOOLS = TOOLS.filter((t) => t.category === 'speed');
/** The vehicle-specific speed tests (everything under the general speedometer). */
export const VEHICLE_TOOLS = SPEED_TOOLS.filter((t) => t.parent === 'speedometer');

export const reflexToolsFor = (locale: string): Tool[] => REFLEX_TOOLS.filter((t) => isToolAvailable(t, locale));
export const speedToolsFor = (locale: string): Tool[] => SPEED_TOOLS.filter((t) => isToolAvailable(t, locale));
export const drivingToolsFor = (locale: string): Tool[] =>
  TOOLS.filter((t) => t.category === 'driving' && isToolAvailable(t, locale));
export const vehicleToolsFor = (locale: string): Tool[] => VEHICLE_TOOLS.filter((t) => isToolAvailable(t, locale));

/** Related pages for a tool in `locale`: the shared list, plus English-only extras on the English site. */
export const relatedFor = (tool: Tool, locale: string): Tool[] =>
  [...tool.related, ...(locale === 'en' ? (tool.relatedEn ?? []) : [])]
    .map(toolById)
    .filter((t) => isToolAvailable(t, locale));

/** The English blog lives at /blog/. */
export const BLOG_HREF = '/blog/';

/** Desktop header, in order. The mobile menu and footer list everything. */
export const NAV_TOOLS: ToolId[] = ['reaction', 'f1', 'speedometer', 'car', 'train', 'stopping'];
