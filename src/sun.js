import { getPosition, getTimes } from 'suncalc';
import { toUtc, toLocalMin, UTC_OFFSET_MIN } from './time.js';

const DAY_MS = 86400000;

/**
 * Daylight of a Fortaleza day as whole minutes [sunrise, sunset], rounded inward like the
 * hour slider. null when it isn't one span of that day: the sun never rises or never sets
 * (polar day or night), or, far from Fortaleza's time zone, the day runs past midnight.
 */
export function daylight(y, m, d, lat, lng) {
  const { sunrise, sunset } = getTimes(toUtc(y, m, d, 720), lat, lng);
  if (!sunrise || !sunset) return null;
  const rise = Math.ceil(toLocalMin(sunrise)), set = Math.floor(toLocalMin(sunset));
  return rise < set ? [rise, set] : null;
}

/**
 * First sunrise after minute `min` of the day, as its Fortaleza date and minute, plus `days`
 * from that day (0 = same day, 1 = tomorrow). null if there is none within a year.
 */
export function nextSunrise({ y, m, d, min }, lat, lng) {
  const now = toUtc(y, m, d, min);
  for (let k = -1; k <= 370; k++) { // toUtc rolls day 32 into the next month, and so on
    const { sunrise } = getTimes(toUtc(y, m, d + k, 720), lat, lng);
    if (!sunrise || sunrise <= now) continue;
    const local = new Date(sunrise.getTime() + UTC_OFFSET_MIN * 60000);
    const day = { y: local.getUTCFullYear(), m: local.getUTCMonth() + 1, d: local.getUTCDate() };
    return {
      ...day,
      min: Math.min(1439, Math.ceil(toLocalMin(sunrise))), // same rounding as daylight()
      days: Math.round((Date.UTC(day.y, day.m - 1, day.d) - Date.UTC(y, m - 1, d)) / DAY_MS),
    };
  }
  return null;
}

/** The sun's path across the sky that day as [azimuth, altitude], every 10 minutes while it is up. */
export function sunPath(y, m, d, lat, lng) {
  const { sunrise, sunset, solarNoon } = getTimes(toUtc(y, m, d, 720), lat, lng);
  let from, to;
  if (sunrise && sunset) [from, to] = [sunrise.getTime(), sunset.getTime()];
  else if (getPosition(solarNoon, lat, lng).altitude > 0) [from, to] = [solarNoon - DAY_MS / 2, +solarNoon + DAY_MS / 2]; // up all day
  else return []; // polar night
  const points = [];
  for (let t = from; t <= to; t += 600000) {
    const p = getPosition(new Date(t), lat, lng);
    points.push([p.azimuth, p.altitude]);
  }
  return points;
}
