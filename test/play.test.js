// Day and year playback: the animation loop and how it moves the date and time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { advance, createPlayer } from '../src/play.js';
import { dayOfYear, daysInYear } from '../src/time.js';

const DAYLIGHT = [330, 1050];

// stand-in for requestAnimationFrame: frames only run when flush() is called
function fakeFrames() {
  const pending = new Map();
  let next = 1;
  return {
    pending,
    raf: (cb) => { pending.set(next, cb); return next++; },
    caf: (id) => { pending.delete(id); },
    flush(ts) { const cbs = [...pending.values()]; pending.clear(); cbs.forEach((cb) => cb(ts)); },
  };
}

test('switching between day and year playback keeps a single animation loop', () => {
  const frames = fakeFrames();
  let calls = 0;
  const player = createPlayer(() => { calls++; }, frames);
  player.start(); // ▶ Dia
  frames.flush(16);
  player.start(); // ▶ Ano, without pausing first
  frames.flush(32);
  player.start(); // ▶ Dia again
  calls = 0;
  frames.flush(48);
  assert.equal(calls, 1);
  assert.equal(frames.pending.size, 1);
});

test('stop leaves no frame pending, even when called from inside a frame', () => {
  const frames = fakeFrames();
  const player = createPlayer(() => player.stop(), frames);
  player.start();
  frames.flush(16);
  assert.equal(frames.pending.size, 0);
});

test('frame time is measured from the previous frame and capped at 0.1 s', () => {
  const frames = fakeFrames();
  const dts = [];
  const player = createPlayer((dt) => dts.push(dt), frames);
  player.start();
  [1000, 1016, 1516].forEach((ts) => frames.flush(ts));
  assert.deepEqual(dts, [0, 0.016, 0.1]);
});

test('day playback wraps from sunset back to sunrise', () => {
  const state = { y: 2026, m: 3, d: 20, min: 1045, playing: 'day' };
  advance(state, 0.1, DAYLIGHT);
  assert.equal(state.min, DAYLIGHT[0]);
});

test('a date picked during year playback sticks', () => {
  const state = { y: 2026, m: 1, d: 1, min: 720, playing: 'year' };
  for (let i = 0; i < 5; i++) advance(state, 0.1, DAYLIGHT);
  Object.assign(state, { m: 6, d: 21 }); // slider, preset or date input
  const picked = dayOfYear(state);
  advance(state, 0.01, DAYLIGHT);
  const now = dayOfYear(state);
  assert.ok(now >= picked && now <= picked + 1, `jumped from day ${picked} to day ${now}`);
});

test('year playback visits every day, 31 Dec of leap years included, then wraps to 1 Jan', () => {
  fc.assert(fc.property(fc.integer({ min: 2000, max: 2099 }), (y) => {
    const state = { y, m: 1, d: 1, min: 720, playing: 'year' };
    const seen = new Set([0]);
    let prev = 0;
    for (;;) {
      advance(state, 0.01, DAYLIGHT);
      const doy = dayOfYear(state);
      if (doy < prev) break; // wrapped
      seen.add(doy);
      prev = doy;
    }
    assert.equal(state.y, y);
    assert.equal(dayOfYear(state), 0);
    assert.equal(seen.size, daysInYear(y));
  }), { numRuns: 30 });
});
