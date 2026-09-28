// Fortaleza has no DST: local time is always UTC-3.
export const UTC_OFFSET_MIN = -180;

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
