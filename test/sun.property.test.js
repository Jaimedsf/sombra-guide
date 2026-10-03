// Property-based tests (fast-check): random dates and times, rules that must always hold.
// Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { getPosition, getTimes } from 'suncalc';
import { toUtc, toLocalMin } from '../src/time.js';
import { daylight, nextSunrise } from '../src/sun.js';

const LAT = -3.7262, LNG = -38.4965; // Fortaleza (Meireles)

// any calendar day from 2000 to 2099 (day 1-28 keeps every month valid)
const day = fc.record({
  y: fc.integer({ min: 2000, max: 2099 }),
  m: fc.integer({ min: 1, max: 12 }),
  d: fc.integer({ min: 1, max: 28 }),
});
const minute = fc.integer({ min: 0, max: 1439 });

test('Fortaleza local time survives a round trip through UTC', () => {
  fc.assert(fc.property(day, minute, ({ y, m, d }, min) => {
    assert.equal(toLocalMin(toUtc(y, m, d, min)), min);
  }));
});

test('Fortaleza is always UTC-3', () => {
  fc.assert(fc.property(day, minute, ({ y, m, d }, min) => {
    const t = toUtc(y, m, d, min);
    assert.equal((t.getUTCHours() * 60 + t.getUTCMinutes() - min + 1440) % 1440, 180);
  }));
});

test('noon sun is always high: between ~63° (June) and 90° (overhead in Mar/Oct)', () => {
  fc.assert(fc.property(day, ({ y, m, d }) => {
    const { solarNoon } = getTimes(toUtc(y, m, d, 720), LAT, LNG);
    const alt = getPosition(solarNoon, LAT, LNG).altitude;
    assert.ok(alt > 62.5 && alt <= 90.1, `noon altitude ${alt} on ${y}-${m}-${d}`);
  }));
});

test('near the equator every day lasts about 12 hours', () => {
  fc.assert(fc.property(day, ({ y, m, d }) => {
    const { sunrise, solarNoon, sunset } = getTimes(toUtc(y, m, d, 720), LAT, LNG);
    assert.ok(sunrise < solarNoon && solarNoon < sunset);
    const hours = (sunset - sunrise) / 3.6e6;
    assert.ok(hours > 11.9 && hours < 12.4, `day length ${hours} h on ${y}-${m}-${d}`);
  }));
});

test('sunrise and sunset are in the morning and late afternoon, local time', () => {
  fc.assert(fc.property(day, ({ y, m, d }) => {
    const { sunrise, sunset } = getTimes(toUtc(y, m, d, 720), LAT, LNG);
    const rise = toLocalMin(sunrise), set = toLocalMin(sunset);
    assert.ok(rise > 5 * 60 && rise < 6 * 60, `sunrise ${rise}`);
    assert.ok(set > 17 * 60 && set < 18 * 60, `sunset ${set}`);
  }));
});

test('after sunset, the next sunrise is the next day\'s, rounded like the "Nascer" card', () => {
  fc.assert(fc.property(day, fc.integer({ min: 17 * 60, max: 1439 }), ({ y, m, d }, min) => {
    fc.pre(min > daylight(y, m, d, LAT, LNG)[1]);
    assert.deepEqual(nextSunrise({ y, m, d, min }, LAT, LNG), { min: daylight(y, m, d + 1, LAT, LNG)[0], tomorrow: true });
  }));
});

test('before dawn, the next sunrise is the same day\'s', () => {
  fc.assert(fc.property(day, fc.integer({ min: 0, max: 299 }), ({ y, m, d }, min) => {
    assert.deepEqual(nextSunrise({ y, m, d, min }, LAT, LNG), { min: daylight(y, m, d, LAT, LNG)[0], tomorrow: false });
  }));
});

test('the night of 31 Dec points to the sunrise of 1 Jan', () => {
  const next = nextSunrise({ y: 2026, m: 12, d: 31, min: 22 * 60 }, LAT, LNG);
  assert.deepEqual(next, { min: daylight(2027, 1, 1, LAT, LNG)[0], tomorrow: true });
});
