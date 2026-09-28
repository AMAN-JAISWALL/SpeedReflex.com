export const SITE = {
  name: 'SpeedReflex',
  domain: 'SpeedReflex.com',
  url: 'https://speedreflex.com',
  tagline: 'Reaction time tests & GPS speedometers',
  description:
    'Free reaction time tests and a GPS speedometer in your browser — frame-accurate timing, F1 start lights and live speed for cars, bikes, trains and planes.',
  /** The only published mailbox; used for privacy and general questions. */
  email: 'privacy@speedreflex.com',
};

export type ToolId = 'reaction' | 'f1' | 'audio' | 'speedometer' | 'car' | 'bike' | 'bus' | 'train' | 'flight' | 'stopping';

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
  },
  {
    id: 'speedometer',
    href: '/speedometer/',
    name: 'Online Speedometer',
    navLabel: 'Speedometer',
    category: 'speed',
    summary: 'How fast am I going? Live GPS speed, max, average and distance for any trip.',
    related: ['reaction', 'stopping', 'f1'],
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

export const REFLEX_TOOLS = TOOLS.filter((t) => t.category === 'reflex');
export const SPEED_TOOLS = TOOLS.filter((t) => t.category === 'speed');
/** The vehicle-specific speed tests (everything under the general speedometer). */
export const VEHICLE_TOOLS = SPEED_TOOLS.filter((t) => t.parent === 'speedometer');

/** Desktop header, in order. The mobile menu and footer list everything. */
export const NAV_TOOLS: ToolId[] = ['reaction', 'f1', 'speedometer', 'car', 'train', 'stopping'];
