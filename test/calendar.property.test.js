// Property-based tests for the day-of-year helpers behind the "Dia do ano" slider.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { dayOfYear, daysInYear, fromDayOfYear } from '../src/time.js';

const year = fc.integer({ min: 1970, max: 2400 });
const yearAndDay = year.chain((y) => fc.record({ y: fc.constant(y), doy: fc.integer({ min: 0, max: daysInYear(y) - 1 }) }));

test('daysInYear matches the calendar, leap years included', () => {
  fc.assert(fc.property(year, (y) => {
    assert.equal(daysInYear(y), (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1)) / 86400000);
  }));
});

test('every day of the year survives a round trip through fromDayOfYear', () => {
  fc.assert(fc.property(yearAndDay, ({ y, doy }) => {
    assert.equal(dayOfYear({ y, ...fromDayOfYear(y, doy) }), doy);
  }));
});

test('the last day of every year is 31 Dec, so the slider reaches it in leap years too', () => {
  fc.assert(fc.property(year, (y) => {
    assert.deepEqual(fromDayOfYear(y, daysInYear(y) - 1), { m: 12, d: 31 });
  }));
});
