// Sanity check for time conversion + sun math: `node check.mjs`
import assert from 'node:assert/strict';
import { getPosition, getTimes } from 'suncalc';
import { toUtc, toLocalMin } from './src/time.js';

const [lat, lng] = [-3.7262, -38.4965];
assert.equal(toUtc(2026, 12, 21, 16 * 60 + 30).toISOString(), '2026-12-21T19:30:00.000Z');
assert.equal(toLocalMin(new Date('2026-12-21T19:30:00Z')), 990);

const noon = (m, d) => getPosition(getTimes(toUtc(2026, m, d, 720), lat, lng).solarNoon, lat, lng);
// 90 - |lat - declination|: June sun ~63° to the north, December ~70° to the south
const jun = noon(6, 21), dec = noon(12, 21);
assert(Math.abs(jun.altitude - 63) < 1 && (Math.abs(jun.azimuth) < 2 || Math.abs(jun.azimuth - 360) < 2), `jun ${jun.altitude} ${jun.azimuth}`);
assert(Math.abs(dec.altitude - 70.2) < 1 && Math.abs(dec.azimuth - 180) < 2, `dec ${dec.altitude} ${dec.azimuth}`);
// The sun passes straight overhead in Fortaleza around 11 Mar and 2 Oct
assert(noon(3, 11).altitude > 89.5 && noon(10, 2).altitude > 89.5, 'zenith passage');
console.log('ok');
