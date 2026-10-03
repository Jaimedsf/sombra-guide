// ---------- address search ----------
// Esri's World Geocoder knows Brazilian house numbers (OSM rarely has them in Fortaleza).
// Anonymous use is allowed for searches whose results are not stored; Nominatim is the fallback.
// Typing only asks Esri's suggest endpoint, which is meant for autocomplete; Nominatim's usage
// policy forbids autocomplete, so it is only queried when a search is submitted.

const ESRI = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer';
// Fortaleza metro area (xmin,ymin,xmax,ymax), used to keep address search local
const SEARCH_BOX = '-38.70,-3.92,-38.35,-3.66';
const PRECISION = {
  PointAddress: 'número exato', Subaddress: 'número exato',
  StreetAddress: 'número aproximado', StreetAddressExt: 'número aproximado',
  StreetName: 'só a rua', StreetInt: 'cruzamento', POI: 'local',
};

async function esri(op, params, { lng, lat }, signal) {
  const url = `${ESRI}/${op}?` + new URLSearchParams({
    f: 'json', countryCode: 'BRA', langCode: 'pt', searchExtent: SEARCH_BOX, location: `${lng},${lat}`, ...params,
  });
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(res.status);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

async function searchEsri(q, center, signal, magicKey) {
  const data = await esri('findAddressCandidates', {
    singleLine: q, maxLocations: '6', outFields: 'Addr_type', ...(magicKey && { magicKey }),
  }, center, signal);
  const seen = new Set();
  return data.candidates
    .filter((c) => c.score >= 75 && !seen.has(c.address) && seen.add(c.address))
    .map((c) => ({
      lng: c.location.x, lat: c.location.y, label: c.address,
      precision: PRECISION[c.attributes.Addr_type] || 'região',
      exact: /Address$|^Subaddress$/.test(c.attributes.Addr_type) && c.score >= 95,
    }));
}

async function searchNominatim(q, signal) {
  // west,north,east,south as Nominatim expects
  const [w, s1, e, n] = SEARCH_BOX.split(',');
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=br&accept-language=pt-BR&bounded=1&viewbox=${w},${n},${e},${s1}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(res.status);
  return (await res.json()).map((r) => ({
    lng: +r.lon, lat: +r.lat,
    label: r.display_name.replace(/, (Região Geográfica|Mesorregião|Microrregião|Região Metropolitana|Região Nordeste)[^,]*/g, '').replace(/, Brasil$/, ''),
    precision: r.addresstype === 'road' ? 'só a rua' : r.addresstype === 'house' || r.addresstype === 'building' ? 'número exato' : 'local',
    exact: r.addresstype === 'house' || r.addresstype === 'building',
  }));
}

/** Submitted search: Esri first (biased to `center`), Nominatim if Esri fails or finds nothing. Rejects only if Nominatim fails too. */
export async function findAddress(q, center, signal) {
  let found = [];
  try { found = await searchEsri(q, center, signal); } catch (err) { if (signal?.aborted) throw err; }
  return found.length ? found : searchNominatim(q, signal);
}

/** Suggestions while typing: [{ label, magicKey }], without coordinates yet. */
export async function suggestAddress(q, center, signal) {
  const data = await esri('suggest', { text: q, maxSuggestions: '6' }, center, signal);
  return data.suggestions
    .filter((s) => !s.isCollection) // categories ("restaurantes") would need a list of their own
    .map((s) => ({ label: s.text.replace(/, BRA$/, ''), magicKey: s.magicKey }));
}

/** Where a picked suggestion is: a findAddress-style result, or null if Esri no longer finds it. */
export async function resolveSuggestion({ label, magicKey }, center, signal) {
  const [best] = await searchEsri(label, center, signal, magicKey);
  return best ?? null;
}

/**
 * Runs async tasks one at a time: starting one aborts the one before, through its signal.
 * An overtaken task resolves to undefined, even if its answer had already arrived, so a
 * slow answer to an old query never replaces the results of a newer one.
 */
export function latestOnly() {
  let current = null;
  const run = async (task) => {
    current?.abort();
    const ctrl = (current = new AbortController());
    try {
      const result = await task(ctrl.signal);
      return ctrl.signal.aborted ? undefined : result;
    } catch (err) {
      if (ctrl.signal.aborted) return undefined;
      throw err;
    }
  };
  run.cancel = () => current?.abort();
  return run;
}
