import { dayOfYear, daysInYear, fromDayOfYear } from './time.js';

// a daylight span plays in ~12 s (60 min per second), a year in ~12 s (30 days per second)
const MIN_PER_S = 60;
const DAYS_PER_S = 30;

/**
 * Moves `state` forward by `dt` seconds of playback ('day' or 'year').
 * Year playback keeps only the fraction of a day in `state.doyFrac` and always reads the
 * date from `state`, so a date picked while playing sticks instead of being overwritten.
 */
export function advance(state, dt, [rise, set]) {
  if (state.playing === 'day') {
    state.min += dt * MIN_PER_S;
    if (state.min >= set) state.min = rise;
  } else if (state.playing === 'year') {
    const f = (state.doyFrac ?? 0) + dt * DAYS_PER_S;
    const whole = Math.floor(f);
    state.doyFrac = f - whole;
    if (whole) Object.assign(state, fromDayOfYear(state.y, (dayOfYear(state) + whole) % daysInYear(state.y)));
  }
}

/**
 * Animation loop that calls `onFrame(dt)` once per frame, dt in seconds (capped at 0.1).
 * There is never more than one pending frame, however often start() is called.
 */
export function createPlayer(onFrame, {
  raf = (cb) => requestAnimationFrame(cb),
  caf = (id) => cancelAnimationFrame(id),
} = {}) {
  let id = 0, last = 0;
  const tick = (ts) => {
    const dt = last ? Math.min(0.1, (ts - last) / 1000) : 0;
    last = ts;
    id = raf(tick); // before onFrame, so a stop() from inside it cancels this one
    onFrame(dt);
  };
  return {
    start() { caf(id); last = 0; id = raf(tick); },
    stop() { caf(id); id = 0; },
  };
}
