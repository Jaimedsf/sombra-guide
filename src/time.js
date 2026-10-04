// Fortaleza has no DST: local time is always UTC-3.
export const UTC_OFFSET_MIN = -180;

/**
 * Whether a place keeps Fortaleza's clock, roughly: Brazil from Amapá and Pará down to Rio
 * Grande do Sul (UTC-3). Elsewhere (Manaus, Acre, Noronha, abroad) the panel still shows
 * Fortaleza's time and says so. A box is enough: the notice is true wherever it shows.
 */
export const usesFortalezaTime = (lng, lat) => lng >= -54 && lng <= -34 && lat >= -34 && lat <= 5;

/** Current Fortaleza date and minute of day. */
export function localNow() {
  const t = new Date(Date.now() + UTC_OFFSET_MIN * 60000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), min: t.getUTCHours() * 60 + t.getUTCMinutes() + t.getUTCSeconds() / 60 };
}
/** Fortaleza local date + minute of day -> absolute Date. */
export const toUtc = (y, m, d, min) => new Date(Date.UTC(y, m - 1, d) + (min - UTC_OFFSET_MIN) * 60000);
/** Absolute Date -> Fortaleza minute of day. */
export const toLocalMin = (date) => {
  const t = new Date(date.getTime() + UTC_OFFSET_MIN * 60000);
  return t.getUTCHours() * 60 + t.getUTCMinutes() + t.getUTCSeconds() / 60;
};

const pad = (n) => String(n).padStart(2, '0');
/** Minute of day -> "HH:MM". */
export const fmtMin = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(Math.floor(m % 60))}`;
/** { y, m, d } -> "AAAA-MM-DD", the format of <input type="date"> and of ?data= */
export const fmtDate = ({ y, m, d }) => `${y}-${pad(m)}-${pad(d)}`;

export const daysInYear =(y) => ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365);
/** 0 for 1 Jan, up to daysInYear(y) - 1 for 31 Dec. */
export const dayOfYear = ({ y, m, d }) => Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000);
/** Inverse of dayOfYear: month and day of the `doy`-th day of year `y`. */
export function fromDayOfYear(y, doy) {
  const t = new Date(Date.UTC(y, 0, 1) + doy * 86400000);
  return { m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}
