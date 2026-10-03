import { fmtDate, fmtMin } from './time.js';

// A fixed moment lives in the query string, ?data=2026-12-21&hora=16:30, next to MapLibre's
// camera hash, so a copied link opens the same view at the same date and time.

/** The valid parts of ?data=&hora=: { y, m, d } and/or { min }. Malformed values are left out. */
export function parseMoment(search) {
  const q = new URLSearchParams(search);
  const moment = {};
  const date = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(q.get('data') || '');
  if (date) {
    const [y, m, d] = date.slice(1).map(Number);
    // Date.UTC rolls 31 Feb or month 13 over; only a real date comes back unchanged
    const t = new Date(Date.UTC(y, m - 1, d));
    if (t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d) Object.assign(moment, { y, m, d });
  }
  const hora = /^(\d{1,2}):(\d{2})$/.exec(q.get('hora') || '');
  if (hora && +hora[1] < 24 && +hora[2] < 60) moment.min = +hora[1] * 60 + +hora[2];
  return moment;
}

/** Query string for `state`: the moment when simulating, none in live mode. Other parameters stay. */
export function momentSearch(search, state) {
  const q = new URLSearchParams(search);
  if (state.live) {
    q.delete('data');
    q.delete('hora');
  } else {
    q.set('data', fmtDate(state));
    q.set('hora', fmtMin(state.min));
  }
  const s = q.toString().replace(/%3A/gi, ':'); // "16:30" reads better than "16%3A30"
  return s ? `?${s}` : '';
}
