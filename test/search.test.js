// Address search: cancelling stale searches and the Esri -> Nominatim fallback.
// fetch is replaced by a stub, so no request leaves the machine.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { findAddress, suggestAddress, resolveSuggestion, latestOnly } from '../src/search.js';

const CENTER = { lng: -38.4965, lat: -3.7262 };
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const json = (body) => ({ ok: true, json: async () => body });
// answers by host; records every URL asked for
function stubFetch(routes) {
  const urls = [];
  globalThis.fetch = async (url, { signal } = {}) => {
    urls.push(url);
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    const route = Object.keys(routes).find((k) => url.includes(k));
    return routes[route](url);
  };
  return urls;
}
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

test('a slow answer to an older search never replaces a newer one', async () => {
  const run = latestOnly();
  const slow = deferred(), fast = deferred();
  let oldSignal;
  const older = run((signal) => { oldSignal = signal; return slow.promise; });
  const newer = run(() => fast.promise);
  fast.resolve('new');
  slow.resolve('old'); // arrives last
  assert.equal(await newer, 'new');
  assert.equal(await older, undefined);
  assert.ok(oldSignal.aborted);
});

test('errors of an overtaken search are swallowed, errors of the latest one are not', async () => {
  const run = latestOnly();
  const older = run(async () => { await new Promise((r) => setTimeout(r, 5)); throw new Error('old request failed'); });
  const newer = run(async () => { throw new Error('offline'); });
  await assert.rejects(newer, /offline/);
  assert.equal(await older, undefined);
});

test('cancel() aborts the search in flight', async () => {
  const run = latestOnly();
  const pending = deferred();
  const call = run(() => pending.promise);
  run.cancel();
  pending.resolve('late');
  assert.equal(await call, undefined);
});

test('a submitted search falls back to Nominatim when Esri fails', async () => {
  const urls = stubFetch({
    'arcgis.com': () => ({ ok: false, status: 503 }),
    'nominatim': () => json([{ lon: '-38.5', lat: '-3.72', display_name: 'Rua X, Meireles, Fortaleza, Brasil', addresstype: 'road' }]),
  });
  const found = await findAddress('rua x', CENTER);
  assert.equal(urls.length, 2);
  assert.deepEqual(found, [{ lng: -38.5, lat: -3.72, label: 'Rua X, Meireles, Fortaleza', precision: 'só a rua', exact: false }]);
});

test('a cancelled search does not go on to Nominatim', async () => {
  const urls = stubFetch({ 'arcgis.com': () => json({ candidates: [] }), 'nominatim': () => json([]) });
  const ctrl = new AbortController();
  ctrl.abort();
  await assert.rejects(findAddress('rua x', CENTER, ctrl.signal));
  assert.ok(urls.every((u) => !u.includes('nominatim')));
});

test('typing asks only Esri suggest, never Nominatim, and skips category suggestions', async () => {
  const urls = stubFetch({
    '/suggest?': () => json({ suggestions: [
      { text: 'Rua Silva Paulet 40, Meireles, Fortaleza, Ceará, 60120-020, BRA', magicKey: 'k1', isCollection: false },
      { text: 'Restaurantes', magicKey: 'k2', isCollection: true },
    ] }),
  });
  const found = await suggestAddress('silva paulet 40', CENTER);
  assert.deepEqual(found, [{ label: 'Rua Silva Paulet 40, Meireles, Fortaleza, Ceará, 60120-020', magicKey: 'k1' }]);
  assert.equal(urls.length, 1);
  assert.ok(!urls[0].includes('nominatim'));
});

test('a picked suggestion is located with its magicKey', async () => {
  const urls = stubFetch({
    'findAddressCandidates': () => json({ candidates: [
      { address: 'Rua Silva Paulet 40, Meireles', location: { x: -38.5026, y: -3.7254 }, score: 100, attributes: { Addr_type: 'StreetAddress' } },
    ] }),
  });
  const r = await resolveSuggestion({ label: 'Rua Silva Paulet 40, Meireles', magicKey: 'k1' }, CENTER);
  assert.equal(new URL(urls[0]).searchParams.get('magicKey'), 'k1');
  assert.deepEqual([r.lng, r.lat, r.precision], [-38.5026, -3.7254, 'número aproximado']);
});
