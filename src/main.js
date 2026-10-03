import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre 6 loads its worker as a separate module; let Vite bundle it and hand over the URL
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { createCityLayer } from './city3d.js';
import extraBuildings from './extra-buildings.json';
import { getPosition, getTimes } from 'suncalc';
import { localNow, toUtc, toLocalMin, fmtMin, fmtDate, dayOfYear, daysInYear, fromDayOfYear } from './time.js';
import { advance, createPlayer } from './play.js';
import { daylight, nextSunrise } from './sun.js';
import { parseMoment, momentSearch } from './url.js';
import { findAddress, suggestAddress, resolveSuggestion, latestOnly } from './search.js';
import './style.css';

const START = [-38.4965, -3.7262];

const $ = (id) => document.getElementById(id);
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
// screen readers get the whole month name
const MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIRS = ['norte', 'nordeste', 'leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste'];
const dirName = (deg) => DIRS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

// ---------- time state (always Fortaleza local) ----------
const state = { y: 2026, m: 1, d: 1, min: 720, live: true, playing: null };

const setDayOfYear = (doy) => Object.assign(state, fromDayOfYear(state.y, doy));
Object.assign(state, localNow());
// optional ?data=2026-12-21&hora=16:30 opens a fixed moment instead of now
{
  const moment = parseMoment(location.search);
  if (Object.keys(moment).length) Object.assign(state, moment, { live: false });
}
maplibregl.setWorkerUrl(workerUrl);

// ---------- map ----------
// a message over the map when it can't start, instead of a blank screen
function mapError(text, retry) {
  const box = Object.assign(document.createElement('div'), { className: 'map-error', role: 'alert' });
  box.append(Object.assign(document.createElement('p'), { textContent: text }));
  if (retry) {
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'btn primary', textContent: 'Tentar de novo' });
    b.addEventListener('click', () => location.reload());
    box.append(b);
  }
  document.body.append(box);
}

// phones: fewer pixels and a lighter 3D profile keep panning smooth
const PHONE = matchMedia('(max-width: 560px), (pointer: coarse)').matches;
let map;
try {
  map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: START,
    zoom: 16.2,
    pitch: 60,
    bearing: -25,
    maxPitch: 78,
    // the address search providers are credited next to the map's own data credits
    attributionControl: { compact: true, customAttribution: 'Busca: <a href="https://www.esri.com" target="_blank" rel="noopener">Powered by Esri</a> · Nominatim' },
    hash: true, // view lives in the URL, so it can be shared
    pixelRatio: Math.min(devicePixelRatio, 2), // 3x screens cost 2.25x the pixels for little gain
  });
} catch (err) {
  // no WebGL 2: nothing on the page works without the map
  document.body.classList.add('no-map');
  mapError('O mapa 3D precisa de WebGL 2, e este navegador não conseguiu ativá-lo. Tente outro navegador ou ligue a aceleração por hardware nas configurações dele.');
  throw err;
}
// errors before the style arrives mean no map at all (offline, tile server down); later ones
// are single tiles that MapLibre retries
let styleLoaded = false;
map.once('style.load', () => { styleLoaded = true; });
map.on('error', () => {
  if (styleLoaded || document.querySelector('.map-error')) return;
  mapError('O mapa não carregou. Verifique a conexão e tente de novo.', true);
});
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
// three.js draws the buildings (with real shadows) instead of the style's extrusions
const city = createCityLayer(map, {
  extra: extraBuildings.features,
  ...(PHONE && { radius: 700, shadowMapSize: 2048 }), // ~0.7 m shadow texel (desktop ~0.6 m), ~1/3 of the geometry
});
map.on('load', () => {
  if (map.getLayer('building-3d')) map.removeLayer('building-3d');
  // keep the flat 'building' layer but invisible: MapLibre only keeps a source layer's
  // features in new tiles while some style layer uses it, and city3d reads them from there
  if (map.getLayer('building')) map.setPaintProperty('building', 'fill-opacity', 0);
  map.addLayer(city);
});

// ---------- sun ----------
const clamp01 = (v) => Math.min(1, Math.max(0, v));
function applySun(pos) {
  const day = clamp01(pos.altitude / 8); // fades through twilight
  city.setSun(pos.azimuth, pos.altitude, day);
  map.getCanvas().style.filter = day >= 1 ? '' : `brightness(${0.45 + 0.55 * day}) saturate(${0.5 + 0.5 * day})`;
}

// ---------- compass (sky dome seen from above) ----------
const skyXY = (azDeg, altDeg, bearing) => {
  const a = ((azDeg - bearing) * Math.PI) / 180;
  const r = (50 * (90 - Math.max(altDeg, 0))) / 90;
  return [r * Math.sin(a), -r * Math.cos(a)];
};
function drawCompass(pos, times, [lng, lat]) {
  const b = map.getBearing();
  const svg = $('compass');
  let h = `<circle r="50" class="dome"/><circle r="25" class="ring"/>`;
  // today's sun path, sampled every 10 minutes between sunrise and sunset
  const rise = toLocalMin(times.sunrise), set = toLocalMin(times.sunset), path = [];
  for (let m = rise; m <= set; m += 10) {
    const p = getPosition(toUtc(state.y, state.m, state.d, m), lat, lng);
    path.push(skyXY(p.azimuth, p.altitude, b).map((v) => v.toFixed(1)).join(','));
  }
  h += `<polyline points="${path.join(' ')}" class="path"/>`;
  ['N', 'L', 'S', 'O'].forEach((t, i) => {
    const a = ((i * 90 - b) * Math.PI) / 180;
    h += `<text x="${(57 * Math.sin(a)).toFixed(1)}" y="${(-57 * Math.cos(a) + 3.5).toFixed(1)}" class="${t === 'N' ? 'cardinal n' : 'cardinal'}">${t}</text>`;
  });
  if (pos.altitude > 0) {
    // shadow of a 10 m pole, drawn from the center away from the sun
    const len = Math.min(48, (10 / Math.tan((pos.altitude * Math.PI) / 180)) * 2.4);
    const a = ((pos.azimuth + 180 - b) * Math.PI) / 180;
    h += `<line x1="0" y1="0" x2="${(len * Math.sin(a)).toFixed(1)}" y2="${(-len * Math.cos(a)).toFixed(1)}" class="shadow"/>`;
    const [x, y] = skyXY(pos.azimuth, pos.altitude, b);
    h += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" class="sun"/>`;
  }
  h += `<circle r="2.2" class="pole"/>`;
  svg.innerHTML = h;
}

// ---------- UI ----------
// the hour slider only spans daylight for the chosen date (and map center)
let dayRange = [0, 1439];
function render() {
  const { lng, lat } = map.getCenter();
  const times = getTimes(toUtc(state.y, state.m, state.d, 720), lat, lng);
  dayRange = daylight(state.y, state.m, state.d, lat, lng);
  // live mode keeps the real clock, even at night; simulated moments stay within daylight
  if (!state.live) state.min = Math.min(dayRange[1], Math.max(dayRange[0], state.min));
  const date = toUtc(state.y, state.m, state.d, state.min);
  const pos = getPosition(date, lat, lng);
  const noon = getPosition(times.solarNoon, lat, lng);
  applySun(pos);

  $('clk').textContent = fmtMin(state.min);
  $('mode').textContent = state.live ? 'agora' : state.playing ? 'animando' : 'simulação';
  $('mode').dataset.live = state.live;
  $('date-label').textContent = `${state.d} ${MONTHS[state.m - 1]} ${state.y}`;
  $('sun-line').textContent = pos.altitude > 0
    ? `Sol a ${pos.altitude.toFixed(0)}° de altura, no ${dirName(pos.azimuth)} (${pos.azimuth.toFixed(0)}°)`
    // official sunrise/sunset is when the sun's upper edge touches the horizon (~ -0.83°)
    : pos.altitude > -1 ? `Sol no horizonte · ${state.min < 720 ? 'nascendo' : 'se pondo'} no ${dirName(pos.azimuth)}`
      : pos.altitude > -6 ? 'Crepúsculo · sol abaixo do horizonte' : 'Noite · sem sol';
  $('f-rise').textContent = fmtMin(dayRange[0]); // same rounding as the slider ends
  $('f-set').textContent = fmtMin(dayRange[1]);
  $('f-noon').textContent = fmtMin(toLocalMin(times.solarNoon));
  $('f-noonalt').textContent = `${noon.altitude.toFixed(0)}° · ${dirName(noon.azimuth)}`;

  if (pos.altitude > 0) {
    const ratio = 1 / Math.tan((pos.altitude * Math.PI) / 180);
    const len = 10 * ratio;
    $('shadow-note').textContent = `Um prédio de 10 m faz sombra de ${len < 100 ? len.toFixed(1).replace('.', ',') : '100+'} m para o ${dirName(pos.azimuth + 180)}.`
      + (noon.altitude > 86 ? ' Perto do meio-dia de hoje o sol passa quase a pino.' : '');
  } else if (pos.altitude > -1) {
    $('shadow-note').textContent = 'Sol rente ao horizonte: as sombras ficam longas demais para medir.';
  } else {
    const next = nextSunrise(state, lat, lng);
    $('shadow-note').textContent = `Sem sombra do sol agora. Próximo nascer: ${next.tomorrow ? 'amanhã, ' : ''}${fmtMin(next.min)}.`;
  }

  // the slider only spans daylight; at night (live mode only) it is dimmed and says so
  const night = state.min < dayRange[0] || state.min > dayRange[1];
  $('time').min = dayRange[0];
  $('time').max = dayRange[1];
  $('time').value = Math.floor(state.min);
  $('time').classList.toggle('night', night);
  $('time').setAttribute('aria-valuetext', night ? `${fmtMin(state.min)}, noite` : fmtMin(state.min));
  $('t-rise').textContent = `nascer ${fmtMin(dayRange[0])}`;
  $('t-night').textContent = night ? 'agora é noite' : '';
  $('t-set').textContent = `pôr ${fmtMin(dayRange[1])}`;
  $('doy').max = daysInYear(state.y) - 1; // before value, or 31 Dec of a leap year gets clamped
  $('doy').value = dayOfYear(state);
  $('doy').setAttribute('aria-valuetext', `${state.d} de ${MONTH_NAMES[state.m - 1]} de ${state.y}`);
  $('date').value = fmtDate(state);
  $('play-day').setAttribute('aria-pressed', state.playing === 'day');
  $('play-year').setAttribute('aria-pressed', state.playing === 'year');
  $('play-day').textContent = state.playing === 'day' ? '❚❚ Dia' : '▶ Dia';
  $('play-year').textContent = state.playing === 'year' ? '❚❚ Ano' : '▶ Ano';
  drawCompass(pos, times, [lng, lat]);
  syncUrlSoon();
}

// keep the chosen moment in the URL (none in live mode), so a copied link opens it.
// Debounced: while playing, render() runs every frame, and browsers limit replaceState calls.
let urlTimer = 0;
function syncUrlSoon() {
  clearTimeout(urlTimer);
  urlTimer = setTimeout(() => {
    const search = momentSearch(location.search, state);
    if (search !== location.search) history.replaceState(history.state, '', location.pathname + search + location.hash);
  }, 400);
}

const manual = () => { state.live = false; };
$('time').addEventListener('input', (e) => { manual(); state.min = +e.target.value; render(); });
$('doy').addEventListener('input', (e) => { manual(); setDayOfYear(+e.target.value); render(); });
$('date').addEventListener('change', (e) => {
  const [y, m, d] = e.target.value.split('-').map(Number);
  if (!y) return;
  manual(); Object.assign(state, { y, m, d }); render();
});
$('now').addEventListener('click', () => { state.playing = null; player.stop(); state.live = true; Object.assign(state, localNow()); render(); });
document.querySelectorAll('.presets .chip').forEach((b) => b.addEventListener('click', () => {
  const [m, d] = b.dataset.md.split('-').map(Number);
  manual(); Object.assign(state, { m, d }); render();
}));
// ---------- address search ----------
// One search at a time, typed or submitted: a new one cancels the one still running,
// so a late answer can't replace a newer list.
const latest = latestOnly();
const list = $('results');
const TYPE_MIN_CHARS = 3;
const TYPE_PAUSE_MS = 350;
const NO_ANSWER = 'A busca não respondeu. Verifique a conexão e tente de novo.';
let typing = 0;
let marker = null;

// the list floats over the panel: fit it to what is left of the panel below the field
function openList() {
  list.hidden = false;
  const room = $('panel').getBoundingClientRect().bottom - list.getBoundingClientRect().top - 10;
  list.style.setProperty('--room', `${Math.max(120, room)}px`);
}
const msgItem = (text) => Object.assign(document.createElement('li'), { className: 'msg', textContent: text });
function showMessage(text) {
  openList();
  list.replaceChildren(msgItem(text));
}
function showResults(items, pick, note) {
  openList();
  list.replaceChildren(...(note ? [msgItem(note)] : []), ...items.map((r) => {
    const b = Object.assign(document.createElement('button'), { type: 'button', textContent: r.label });
    if (r.precision) b.append(Object.assign(document.createElement('span'), { className: 'precision', textContent: r.precision }));
    b.addEventListener('click', () => pick(r));
    const li = document.createElement('li');
    li.append(b);
    return li;
  }));
}
function closeResults() {
  clearTimeout(typing);
  latest.cancel();
  list.hidden = true;
}

function goTo(r) {
  closeResults();
  marker?.remove();
  marker = new maplibregl.Marker({ color: '#c9770a' }).setLngLat([r.lng, r.lat]).addTo(map);
  map.flyTo({ center: [r.lng, r.lat], zoom: 17.5, pitch: 60, duration: 2200 });
  $('q').blur(); // closes the phone keyboard so the map is visible
}

async function pickSuggestion(s) {
  clearTimeout(typing);
  $('q').value = s.label;
  showMessage('Buscando…');
  let found;
  try { found = await latest((signal) => resolveSuggestion(s, map.getCenter(), signal)); } catch {
    return showMessage(NO_ANSWER);
  }
  if (found === undefined) return; // a newer search owns the list now
  if (found) goTo(found); else showMessage('Endereço não encontrado. Tente buscar de novo.');
}

// suggestions while typing, after a short pause
$('q').addEventListener('input', () => {
  clearTimeout(typing);
  const q = $('q').value.trim();
  if (q.length < TYPE_MIN_CHARS) return closeResults();
  typing = setTimeout(async () => {
    let found;
    try { found = await latest((signal) => suggestAddress(q, map.getCenter(), signal)); } catch {
      return; // stay quiet while typing; a submitted search reports errors
    }
    if (found?.length) showResults(found, pickSuggestion);
    else if (found) list.hidden = true;
  }, TYPE_PAUSE_MS);
});

// Enter or "Buscar": full search with precision tags, jumping straight to a single exact match
$('search').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearTimeout(typing);
  const q = $('q').value.trim();
  if (!q) return;
  showMessage('Buscando…');
  let found;
  try { found = await latest((signal) => findAddress(q, map.getCenter(), signal)); } catch {
    return showMessage(NO_ANSWER);
  }
  if (!found) return; // a newer search owns the list now
  if (!found.length) return showMessage('Nada encontrado em Fortaleza. Tente "rua, número, bairro" ou o nome de um lugar.');
  if (found[0].exact && found.filter((r) => r.exact).length === 1) return goTo(found[0]);
  showResults(found, goTo, /\d/.test(q) && !found.some((r) => r.exact) ? 'Número não encontrado; mostrando a rua. Tente incluir o bairro.' : '');
});

// arrows move between the field and the results; Esc closes them
function navigate(e) {
  if (list.hidden) return;
  const items = [...list.querySelectorAll('button')];
  if (e.key === 'Escape') {
    e.preventDefault(); // a search field would also clear its text
    closeResults();
    $('q').focus();
  } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && items.length) {
    e.preventDefault();
    const i = items.indexOf(document.activeElement) + (e.key === 'ArrowDown' ? 1 : -1);
    (i < 0 ? $('q') : items[Math.min(i, items.length - 1)]).focus();
  }
}
$('q').addEventListener('keydown', navigate);
list.addEventListener('keydown', navigate);
// it covers part of the panel, so a tap anywhere else closes it
document.addEventListener('pointerdown', (e) => { if (!list.hidden && !e.target.closest('.search-box')) closeResults(); });
// map events can fire every frame; redraw the panel at most once per frame
let queued = false;
const renderSoon = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; render(); }); } };
map.on('moveend', renderSoon);
map.on('rotate', renderSoon);

// phones: the panel is a bottom sheet; "Mais" reveals the rest
$('sheet-toggle').addEventListener('click', () => {
  const open = $('panel').classList.toggle('open');
  $('sheet-toggle').setAttribute('aria-expanded', open);
  $('sheet-toggle').textContent = open ? 'Menos' : 'Mais';
});

const CAM = {
  'rot-left': () => ({ bearing: map.getBearing() - 30 }),
  'rot-right': () => ({ bearing: map.getBearing() + 30 }),
  'tilt-up': () => ({ pitch: Math.min(map.getMaxPitch(), map.getPitch() + 15) }),
  'tilt-down': () => ({ pitch: Math.max(0, map.getPitch() - 15) }),
  top: () => ({ pitch: 0, bearing: 0 }),
  '3d': () => ({ pitch: 60 }),
};
document.querySelectorAll('[data-cam]').forEach((b) =>
  b.addEventListener('click', () => map.easeTo({ ...CAM[b.dataset.cam](), duration: 500 })));

const player = createPlayer((dt) => { advance(state, dt, dayRange); render(); });
function togglePlay(kind) {
  manual();
  state.playing = state.playing === kind ? null : kind;
  state.doyFrac = 0;
  if (state.playing) player.start(); else player.stop();
  render();
}
$('play-day').addEventListener('click', () => togglePlay('day'));
$('play-year').addEventListener('click', () => togglePlay('year'));

setInterval(() => { if (state.live) { Object.assign(state, localNow()); render(); } }, 30000);
render();
