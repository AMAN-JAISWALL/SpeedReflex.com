// Client-only helpers shared by the tool scripts.

export const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or blocked — the tools still work without history */
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

/**
 * Input timestamp in the performance.now() timebase. Pointer/key events carry the time the
 * OS saw the input, which is more accurate than reading the clock inside the handler.
 */
export const eventTime = (e: Event): number => {
  const now = performance.now();
  const t = e.timeStamp;
  return t > 0 && t <= now && now - t < 1000 ? t : now;
};

/**
 * Timestamp of the frame that first shows a DOM change made in `apply`.
 * The change is applied inside one animation frame; the next frame's timestamp is when it
 * was presented, which is when the user could first see it.
 */
export const paintStimulus = (apply: () => void, onPresented: (t: number) => void): void => {
  requestAnimationFrame(() => {
    apply();
    requestAnimationFrame((presented) => onPresented(presented));
  });
};

export type ShareOutcome = 'shared' | 'copied' | 'failed' | 'cancelled';

export const shareOrCopy = async (data: { title: string; text: string; url: string }): Promise<ShareOutcome> => {
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    }
  }
  return copyText(`${data.text} ${data.url}`);
};

export const copyText = async (text: string): Promise<ShareOutcome> => {
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
};

let audioCtx: AudioContext | null = null;
const audio = (): AudioContext => (audioCtx ??= new AudioContext());

const tone = (ctx: AudioContext, at: number, frequency: number, durationMs: number, volume: number): void => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + durationMs / 1000);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + durationMs / 1000 + 0.02);
};

/** Short sine beep. Must first be called from a user gesture so the AudioContext can start. */
export const beep = (frequency = 880, durationMs = 120, volume = 0.08): void => {
  try {
    const ctx = audio();
    if (ctx.state === 'suspended') void ctx.resume();
    tone(ctx, ctx.currentTime, frequency, durationMs, volume);
  } catch {
    /* audio unavailable */
  }
};

/** Starts audio from inside a user gesture, and asks iOS to play even when the silent switch is on. */
export const unlockAudio = (): void => {
  try {
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'playback';
    const ctx = audio();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* audio unavailable */
  }
};

/**
 * Plays a tone straight away and returns when it reaches the speakers, on the performance.now() clock.
 * The browser's output timestamp includes the output latency it knows about, so the reaction clock
 * starts when the sound is audible rather than when it was scheduled.
 */
export const playTone = (frequency = 1000, durationMs = 150, volume = 0.25): number => {
  const lead = 0.03;
  try {
    const ctx = audio();
    const at = ctx.currentTime + lead;
    tone(ctx, at, frequency, durationMs, volume);
    const ts = ctx.getOutputTimestamp?.();
    if (ts?.performanceTime && ts.contextTime !== undefined) return ts.performanceTime + (at - ts.contextTime) * 1000;
    return performance.now() + (lead + (ctx.outputLatency || ctx.baseLatency || 0)) * 1000;
  } catch {
    return performance.now();
  }
};

export const vibrate = (pattern: number | number[]): void => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
};

export const prefersReducedMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;

const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export const formatDate = (ts: number): string => dateFmt.format(new Date(ts));

/** Is at least half of the element inside the viewport? */
export const onScreen = (el: Element): boolean => {
  const r = el.getBoundingClientRect();
  return r.height > 0 && Math.min(r.bottom, innerHeight) - Math.max(r.top, 0) >= r.height / 2;
};

/** Is focus somewhere that uses the keyboard itself (so global shortcuts must stand down)? */
export const isTypingTarget = (el: Element | null): boolean =>
  !!el && (el.matches('input, textarea, select, [contenteditable="true"]') || el.closest('[role="dialog"]') !== null);
