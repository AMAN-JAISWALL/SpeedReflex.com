// The English blog. Each post is an .astro page under src/pages/blog/ that renders <BlogArticle post={postBySlug('…')}>.
// This registry drives the blog index, "more articles" lists, home-page teasers and structured data.

import type { ToolId } from './site';

export type BlogTopic = 'Speedometers' | 'Stopping distance' | 'Reaction time';

export interface BlogPost {
  slug: string;
  /** <title> — the SEO title. */
  title: string;
  /** On-page H1. */
  h1: string;
  description: string;
  /** Short summary for cards and the article lede. */
  excerpt: string;
  topic: BlogTopic;
  published: string;
  modified: string;
  readMinutes: number;
  /** Topics covered, for structured data. */
  keywords: string[];
  /** Tools promoted at the end of the article. */
  tools: ToolId[];
}

export const blogHref = (slug: string): string => `/blog/${slug}/`;

export const POSTS: BlogPost[] = [
  {
    slug: 'speedometer-not-working',
    title: 'Speedometer Not Working? Causes, Sensor Symptoms & Fixes',
    h1: 'Speedometer Not Working? Common Causes and How to Fix Them',
    description:
      'Why a speedometer stops working, bounces or reads zero — from a bad speed sensor or fuse to a failed gauge — how to test it, what repairs cost, and a free backup.',
    excerpt:
      'A dead, stuck or bouncing speedometer usually comes down to one of a handful of faults. Here is how to narrow it down, test the speed sensor and decide what to fix first.',
    topic: 'Speedometers',
    published: '2026-11-04',
    modified: '2026-11-04',
    readMinutes: 8,
    keywords: ['speedometer not working', 'speedometer sensor', 'vehicle speed sensor', 'speedometer bouncing', 'speedometer repair cost'],
    tools: ['car', 'speedometer', 'speedoCalc'],
  },
  {
    slug: 'speedometer-calibration',
    title: 'How to Calibrate a Speedometer (and Check It With GPS)',
    h1: 'How to Calibrate a Speedometer — and Check It With GPS',
    description:
      'Check your speedometer’s accuracy with GPS or mile markers, then recalibrate it after bigger tires or gear changes. Methods, typical costs and calibration for court.',
    excerpt:
      'Bigger tires, new gears or a swapped instrument cluster can all leave your speedometer reading wrong. Here is how to measure the error and the ways to correct it.',
    topic: 'Speedometers',
    published: '2026-11-04',
    modified: '2026-11-04',
    readMinutes: 7,
    keywords: ['speedometer calibration', 'calibrate speedometer', 'recalibrate speedometer', 'bigger tires speedometer', 'speedometer calibration cost'],
    tools: ['speedoCalc', 'car', 'speedometer'],
  },
  {
    slug: 'how-to-read-a-speedometer',
    title: 'How to Read a Speedometer: mph, km/h, Odometer & Tachometer',
    h1: 'How to Read a Speedometer (mph, km/h and Metric Dials)',
    description:
      'Learn how to read a speedometer — analog and digital, mph and km/h, metric dials — what it really measures, and how it differs from the odometer and tachometer.',
    excerpt:
      'The needle, the two rings of numbers, the odometer and the tachometer — a plain-English guide to every number on the dashboard, including metric speedometers.',
    topic: 'Speedometers',
    published: '2026-11-04',
    modified: '2026-11-04',
    readMinutes: 6,
    keywords: ['how to read a speedometer', 'metric speedometer reading', 'odometer vs speedometer', 'speedometer and tachometer', 'what does a speedometer measure'],
    tools: ['speedometer', 'car', 'speedoCalc'],
  },
  {
    slug: 'why-speedometers-go-so-high',
    title: 'Why Do Speedometers Go So High? Max Speedometer Readings Explained',
    h1: 'Why Do Speedometers Go So High?',
    description:
      'Why a car’s max speedometer reading is far above its top speed, what a maxed-out or pegged speedometer means, and the short-lived US 85 mph speedometer rule.',
    excerpt:
      'Your hatchback’s dial runs to 140 mph but it will never get there. The reasons are part engineering, part readability, part marketing — and a bit of history.',
    topic: 'Speedometers',
    published: '2026-11-04',
    modified: '2026-11-04',
    readMinutes: 5,
    keywords: ['max speedometer', 'why do speedometers go so high', 'maxed out speedometer', 'speedometer pegged', '85 mph speedometer'],
    tools: ['speedometer', 'car', 'motorcycle'],
  },
  {
    slug: 'semi-truck-stopping-distance',
    title: 'Semi Truck Stopping Distance: Chart by Speed & Why It’s Longer',
    h1: 'Semi Truck Stopping Distance: Chart, Formula and Why Trucks Need More Room',
    description:
      'How far a loaded semi truck needs to stop at 20–70 mph, how the CDL formula adds brake lag, and how truck, car and motorcycle stopping distances compare.',
    excerpt:
      'A fully loaded 18-wheeler needs about 450 feet to stop from 55 mph — roughly a hundred feet more than a car. Here is where that distance comes from.',
    topic: 'Stopping distance',
    published: '2026-11-04',
    modified: '2026-11-04',
    readMinutes: 6,
    keywords: ['semi truck stopping distance', 'truck stopping distance chart', 'semi stopping distance', 'car vs motorcycle stopping distance', 'vehicle size stopping distance'],
    tools: ['stopping', 'sightDistance', 'reaction'],
  },
  {
    slug: 'stopping-distance-crash-severity',
    title: 'Stopping Distances and the Severity of Crashes',
    h1: 'Stopping Distances and the Severity of Crashes: Why 5 mph Matters',
    description:
      'How stopping distance links speed to crash severity: impact speeds when you can’t stop in time, the physics of kinetic energy, and pedestrian injury risk.',
    excerpt:
      'Drive 5 mph faster and you don’t just stop a little later — at the point where you would have stopped, you are still doing about 20 mph. Here is the maths.',
    topic: 'Stopping distance',
    published: '2026-11-04',
    modified: '2026-11-04',
    readMinutes: 5,
    keywords: ['stopping distances and severity of crashes', 'impact speed', 'speed and crash severity', 'kinetic energy braking'],
    tools: ['stopping', 'reaction', 'car'],
  },
];

export const postBySlug = (slug: string): BlogPost => {
  const post = POSTS.find((p) => p.slug === slug);
  if (!post) throw new Error(`Unknown blog post: ${slug}`);
  return post;
};

/** Newest first (stable for posts published the same day). */
export const postsByDate = (): BlogPost[] => [...POSTS].sort((a, b) => b.published.localeCompare(a.published));

/** Other posts to read next: same topic first, then the rest. */
export const relatedPosts = (slug: string, count = 3): BlogPost[] => {
  const current = postBySlug(slug);
  const others = POSTS.filter((p) => p.slug !== slug);
  return [...others.filter((p) => p.topic === current.topic), ...others.filter((p) => p.topic !== current.topic)].slice(0, count);
};
