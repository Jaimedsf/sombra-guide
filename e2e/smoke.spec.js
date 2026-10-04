// End-to-end checks in a real Chrome against the built site: `npm run test:e2e`.
// The map tiles come from the network; the geocoders are answered by fixtures, so the search
// results are always the same.
import { test, expect } from '@playwright/test';

// requests the tests answer or block, anchored to their host
const ESRI = /^https:\/\/geocode\.arcgis\.com\//;
const ESRI_SUGGEST = /^https:\/\/geocode\.arcgis\.com\/arcgis\/rest\/services\/World\/GeocodeServer\/suggest\?/;
const ESRI_FIND = /^https:\/\/geocode\.arcgis\.com\/arcgis\/rest\/services\/World\/GeocodeServer\/findAddressCandidates\?/;
const NOMINATIM = /^https:\/\/nominatim\.openstreetmap\.org\//;
const MAP_STYLE = /^https:\/\/tiles\.openfreemap\.org\/styles\//;

const FORTALEZA = '?data=2026-12-21&hora=16:30#16.6/-3.7262/-38.4965/-25/60';
const SVALBARD_JUNE = '?data=2026-06-21&hora=12:00#14/78.22/15.65/0/40';
const SVALBARD_DECEMBER = '?data=2026-12-21&hora=12:00#14/78.22/15.65/0/40';

// any uncaught error in the page fails the test
let pageErrors;
test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
});
test.afterEach(() => expect(pageErrors).toEqual([]));

const mapReady = (page) => page.waitForFunction(() => window.__sombra?.map.loaded() && window.__sombra.map.getLayer('city-3d'), null, { timeout: 45_000 });

test('opens the moment and the camera from the URL', async ({ page }) => {
  await page.goto(FORTALEZA);
  await expect(page.locator('#clk')).toHaveText('16:30');
  await expect(page.locator('#date-label')).toHaveText('21 dez 2026');
  await expect(page.locator('#f-rise')).toHaveText('05:22');
  await expect(page.locator('#shadow-note')).toHaveText('Um prédio de 10 m faz sombra de 35,3 m para o nordeste.');
  await expect(page.locator('#tz-note')).toBeHidden();
});

test('keeps working where the sun never sets or never rises', async ({ page }) => {
  await page.goto(SVALBARD_JUNE);
  await expect(page.locator('#t-rise')).toHaveText('sol o dia todo');
  await expect(page.locator('#f-rise')).toHaveText('—');
  await expect(page.locator('#tz-note')).toBeVisible();
  await page.locator('#time').fill('600');
  await expect(page.locator('#clk')).toHaveText('10:00');

  await page.goto(SVALBARD_DECEMBER);
  await expect(page.locator('#t-rise')).toHaveText('sem sol hoje');
  await expect(page.locator('#shadow-note')).toHaveText(/^Sem sombra do sol agora\. Próximo nascer: \d+ fev, \d\d:\d\d\.$/);
});

test('suggests addresses while typing and pins the chosen one', async ({ page }) => {
  await page.route(ESRI_SUGGEST, (r) => r.fulfill({ json: { suggestions: [
    { text: 'Rua Silva Paulet 40, Meireles, Fortaleza, Ceará, 60120-020, BRA', magicKey: 'k1', isCollection: false },
  ] } }));
  await page.route(ESRI_FIND, (r) => r.fulfill({ json: { candidates: [
    { address: 'Rua Silva Paulet 40, Meireles, Fortaleza, Ceará, 60120-020', location: { x: -38.5026, y: -3.7254 }, score: 100, attributes: { Addr_type: 'StreetAddress' } },
  ] } }));
  await page.goto(FORTALEZA);
  await page.locator('#q').fill('silva paulet 40');
  await expect(page.locator('#results button')).toHaveText('Rua Silva Paulet 40, Meireles, Fortaleza, Ceará, 60120-020');
  await expect(page.locator('#search-status')).toHaveText('1 resultado. Use a seta para baixo para escolher.');
  await page.locator('#results button').click();
  await expect(page.locator('.maplibregl-popup .pin p')).toHaveText(/Silva Paulet 40/);
  await page.getByRole('button', { name: 'Remover marcador' }).click();
  await expect(page.locator('.maplibregl-popup')).toHaveCount(0);
});

test('falls back to Nominatim when Esri fails', async ({ page }) => {
  await page.route(ESRI, (r) => r.fulfill({ status: 503, body: '' }));
  await page.route(NOMINATIM, (r) => r.fulfill({ json: [
    { lon: '-38.5267', lat: '-3.7275', display_name: 'Praça do Ferreira, Centro, Fortaleza, Região Metropolitana de Fortaleza, Ceará, Brasil', addresstype: 'square' },
  ] }));
  await page.goto(FORTALEZA);
  await page.locator('#q').fill('Praça do Ferreira');
  await page.locator('#q').press('Enter');
  await expect(page.locator('#results button')).toHaveText('Praça do Ferreira, Centro, Fortaleza, Cearálocal');
});

test('copies a link with the moment and the camera', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { window.__copied = t; } } });
  });
  await page.goto(FORTALEZA);
  await page.locator('#time').fill('600');
  await page.locator('#share').click();
  await expect(page.locator('#share')).toHaveText('Link copiado');
  expect(await page.evaluate(() => window.__copied)).toMatch(/\?data=2026-12-21&hora=10:00#16\.6\/-3\.7262\/-38\.4965\/-25\/60$/);
});

test('says so when the map server is down, and the panel still works', async ({ page }) => {
  await page.route(MAP_STYLE, (r) => r.abort());
  await page.goto(FORTALEZA);
  await expect(page.locator('.map-error')).toContainText('O mapa não carregou');
  await expect(page.locator('.map-error button')).toHaveText('Tentar de novo');
  await page.locator('#time').fill('600');
  await expect(page.locator('#clk')).toHaveText('10:00');
});

test('explains that WebGL 2 is missing', async ({ page }) => {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) { return type === 'webgl2' ? null : get.call(this, type, ...args); };
  });
  await page.goto(FORTALEZA);
  await expect(page.locator('.map-error')).toContainText('WebGL 2');
  await expect(page.locator('#panel')).toBeHidden();
  expect(pageErrors).toHaveLength(1); // the map's own error, rethrown on purpose
  pageErrors.length = 0;
});

test('brings the 3D buildings back after the GPU context is lost', async ({ page }) => {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      const gl = get.call(this, type, ...args);
      if (type === 'webgl2' && gl && this.classList.contains('maplibregl-canvas')) window.__gl = gl;
      return gl;
    };
  });
  await page.goto(FORTALEZA);
  await mapReady(page);
  await page.evaluate(async () => {
    const ext = window.__gl.getExtension('WEBGL_lose_context');
    ext.loseContext();
    await new Promise((r) => setTimeout(r, 500));
    ext.restoreContext();
  });
  await expect.poll(() => page.evaluate(() => !!window.__sombra.map.getLayer('city-3d')), { timeout: 30_000 }).toBe(true);
});

test('folds the panel and remembers it', async ({ page }) => {
  await page.goto(FORTALEZA);
  await expect(page.locator('#sheet-toggle')).toHaveText('Menos');
  await page.locator('#sheet-toggle').click();
  await expect(page.locator('#panel-more')).toBeHidden();
  await page.reload();
  await expect(page.locator('#sheet-toggle')).toHaveText('Mais');
  await expect(page.locator('#panel-more')).toBeHidden();
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('starts with the panel folded and the camera buttons clear of the map controls', async ({ page }) => {
    await page.goto(FORTALEZA);
    await expect(page.locator('#sheet-toggle')).toHaveText('Mais');
    await expect(page.locator('#panel-more')).toBeHidden();
    const geo = await page.locator('.maplibregl-ctrl-geolocate').boundingBox();
    const cam = await page.locator('.cam').boundingBox();
    expect(geo.y + geo.height).toBeLessThanOrEqual(cam.y);
  });
});
