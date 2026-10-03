import { getTimes } from 'suncalc';
import { toUtc, toLocalMin } from './time.js';

/** Daylight of a Fortaleza day as whole minutes [sunrise, sunset], rounded inward like the hour slider. */
export function daylight(y, m, d, lat, lng) {
  const { sunrise, sunset } = getTimes(toUtc(y, m, d, 720), lat, lng);
  return [Math.ceil(toLocalMin(sunrise)), Math.floor(toLocalMin(sunset))];
}

/** First sunrise after minute `min` of the day: that day's before dawn, the next day's after dusk. */
export function nextSunrise({ y, m, d, min }, lat, lng) {
  const [rise] = daylight(y, m, d, lat, lng);
  if (min < rise) return { min: rise, tomorrow: false };
  return { min: daylight(y, m, d + 1, lat, lng)[0], tomorrow: true }; // toUtc rolls 32 Dec into 1 Jan
}
