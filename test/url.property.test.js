// Property-based tests for the moment kept in the URL (?data=AAAA-MM-DD&hora=HH:MM).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { parseMoment, momentSearch } from '../src/url.js';

const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const y = fc.integer({ min: 1000, max: 9999 });
const m = fc.integer({ min: 1, max: 12 });
const min = fc.integer({ min: 0, max: 1439 });
const realDate = fc.tuple(y, m).chain(([yy, mm]) =>
  fc.record({ y: fc.constant(yy), m: fc.constant(mm), d: fc.integer({ min: 1, max: daysInMonth(yy, mm) }) }));
const hhmm = (h, mm) => `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;

test('a simulated moment survives a round trip through the URL', () => {
  fc.assert(fc.property(realDate, min, (date, mn) => {
    assert.deepEqual(parseMoment(momentSearch('', { ...date, min: mn, live: false })), { ...date, min: mn });
  }));
});

test('dates that do not exist are ignored, real ones are kept', () => {
  fc.assert(fc.property(y, fc.integer({ min: 0, max: 13 }), fc.integer({ min: 0, max: 32 }), (yy, mm, dd) => {
    const real = mm >= 1 && mm <= 12 && dd >= 1 && dd <= daysInMonth(yy, mm);
    const got = parseMoment(`?data=${yy}-${mm}-${dd}`);
    assert.deepEqual(got, real ? { y: yy, m: mm, d: dd } : {});
  }));
});

test('times past 23:59 are ignored', () => {
  const badTime = fc.oneof(
    fc.tuple(fc.integer({ min: 24, max: 99 }), fc.integer({ min: 0, max: 59 })),
    fc.tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 60, max: 99 })),
  );
  fc.assert(fc.property(badTime, ([h, mm]) => {
    assert.deepEqual(parseMoment(`?hora=${hhmm(h, mm)}`), {});
  }));
});

test('live mode takes the moment out of the URL and keeps other parameters', () => {
  assert.equal(momentSearch('?data=2026-12-21&hora=16:30', { live: true }), '');
  assert.equal(momentSearch('?x=1&data=2026-12-21&hora=16:30', { live: true }), '?x=1');
});

test('the URL stays readable and drops fractions of a minute', () => {
  assert.equal(momentSearch('', { y: 2026, m: 12, d: 21, min: 990.7, live: false }), '?data=2026-12-21&hora=16:30');
});
