// Property-based tests (fast-check): random dates and times, rules that must always hold.
// Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { getPosition, getTimes } from 'suncalc';
import { toUtc, toLocalMin, usesFortalezaTime } from '../src/time.js';
import { daylight, nextSunrise, sunPath } from '../src/sun.js';

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

const dateAfter = (y, m, d, days) => {
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
};

test('after sunset, the next sunrise is the next day\'s, rounded like the "Nascer" card', () => {
  fc.assert(fc.property(day, fc.integer({ min: 17 * 60, max: 1439 }), ({ y, m, d }, min) => {
    fc.pre(min > daylight(y, m, d, LAT, LNG)[1]);
    assert.deepEqual(nextSunrise({ y, m, d, min }, LAT, LNG), { ...dateAfter(y, m, d, 1), min: daylight(y, m, d + 1, LAT, LNG)[0], days: 1 });
  }));
});

test('before dawn, the next sunrise is the same day\'s', () => {
  fc.assert(fc.property(day, fc.integer({ min: 0, max: 299 }), ({ y, m, d }, min) => {
    assert.deepEqual(nextSunrise({ y, m, d, min }, LAT, LNG), { y, m, d, min: daylight(y, m, d, LAT, LNG)[0], days: 0 });
  }));
});

test('the night of 31 Dec points to the sunrise of 1 Jan', () => {
  const next = nextSunrise({ y: 2026, m: 12, d: 31, min: 22 * 60 }, LAT, LNG);
  assert.deepEqual(next, { y: 2027, m: 1, d: 1, min: daylight(2027, 1, 1, LAT, LNG)[0], days: 1 });
});

// The map can be dragged anywhere and "Minha localização" can be anywhere: the panel must cope
// with polar day and night and with places whose day runs past midnight in Fortaleza's clock.
const anywhere = fc.record({ lat: fc.double({ min: -89.9, max: 89.9, noNaN: true }), lng: fc.double({ min: -180, max: 180, noNaN: true }) });

test('anywhere on Earth, daylight is one span of the day or null', () => {
  fc.assert(fc.property(day, anywhere, ({ y, m, d }, { lat, lng }) => {
    const light = daylight(y, m, d, lat, lng);
    if (light) assert.ok(light[0] >= 0 && light[0] < light[1] && light[1] <= 1439, JSON.stringify(light));
  }));
});

test('anywhere on Earth, the next sunrise is a real minute ahead, or none within a year', () => {
  fc.assert(fc.property(day, minute, anywhere, ({ y, m, d }, min, { lat, lng }) => {
    const next = nextSunrise({ y, m, d, min }, lat, lng);
    if (!next) return;
    assert.ok(next.min >= 0 && next.min <= 1439 && next.days >= 0 && next.days <= 371, JSON.stringify(next));
    assert.deepEqual(dateAfter(y, m, d, next.days), { y: next.y, m: next.m, d: next.d });
  }), { numRuns: 60 });
});

test('anywhere on Earth, the compass path only has the sun above the horizon', () => {
  fc.assert(fc.property(day, anywhere, ({ y, m, d }, { lat, lng }) => {
    for (const [az, alt] of sunPath(y, m, d, lat, lng)) assert.ok(az >= 0 && az <= 360 && alt > -1, `${az} ${alt}`);
  }), { numRuns: 60 });
});

test('Svalbard: midnight sun in June, polar night in December', () => {
  const [lat, lng] = [78.22, 15.65];
  assert.equal(daylight(2026, 6, 21, lat, lng), null);
  const june = sunPath(2026, 6, 21, lat, lng);
  assert.ok(june.length >= 144 && june.every(([, alt]) => alt > 0), 'sun up all day, all the way round');
  assert.equal(daylight(2026, 12, 21, lat, lng), null);
  assert.deepEqual(sunPath(2026, 12, 21, lat, lng), []);
  const next = nextSunrise({ y: 2026, m: 12, d: 21, min: 720 }, lat, lng);
  assert.ok(next.days > 30 && next.days < 90 && next.y === 2027 && next.m === 2, JSON.stringify(next));
});

test('the time zone notice shows outside the UTC-3 part of Brazil only', () => {
  const sameClock = { Fortaleza: [-38.50, -3.73], Natal: [-35.21, -5.79], Recife: [-34.88, -8.05], Belém: [-48.49, -1.46],
    Brasília: [-47.88, -15.79], 'São Paulo': [-46.63, -23.55], 'Porto Alegre': [-51.23, -30.03], Macapá: [-51.07, 0.03] };
  const otherClock = { Manaus: [-60.02, -3.12], Cuiabá: [-56.10, -15.60], 'Rio Branco': [-67.81, -9.97],
    'Fernando de Noronha': [-32.42, -3.85], Lisboa: [-9.14, 38.72], Tóquio: [139.76, 35.68] };
  for (const [name, [lng, lat]] of Object.entries(sameClock)) assert.ok(usesFortalezaTime(lng, lat), name);
  for (const [name, [lng, lat]] of Object.entries(otherClock)) assert.ok(!usesFortalezaTime(lng, lat), name);
});
