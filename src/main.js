import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre 6 loads its worker as a separate module; let Vite bundle it and hand over the URL
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { createCityLayer } from './city3d.js';
import extraBuildings from './extra-buildings.json';
import { getPosition, getTimes } from 'suncalc';
import { localNow, toUtc, toLocalMin } from './time.js';
import './style.css';

const START = [-38.4965, -3.7262];
// Fortaleza metro area (xmin,ymin,xmax,ymax), used to keep address search local
const SEARCH_BOX = '-38.70,-3.92,-38.35,-3.66';

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, '0');
const fmtMin = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(Math.floor(m % 60))}`;
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIRS = ['norte', 'nordeste', 'leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste'];
const dirName = (deg) => DIRS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

// ---------- time state (always Fortaleza local) ----------
const state = { y: 2026, m: 1, d: 1, min: 720, live: true, playing: null };

const dayOfYear = ({ y, m, d }) => Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000);
function setDayOfYear(doy) {
  const t = new Date(Date.UTC(state.y, 0, 1) + doy * 86400000);
  state.m = t.getUTCMonth() + 1;
  state.d = t.getUTCDate();
}
Object.assign(state, localNow());
// optional ?data=2026-12-21&hora=16:30 opens a fixed moment instead of now
{
  const q = new URLSearchParams(location.search);
  const [y, m, d] = (q.get('data') || '').split('-').map(Number);
  if (y && m && d) Object.assign(state, { y, m, d, live: false });
  const hora = /^(\d{1,2}):(\d{2})$/.exec(q.get('hora') || '');
  if (hora && +hora[1] < 24) Object.assign(state, { min: +hora[1] * 60 + +hora[2], live: false });
}
maplibregl.setWorkerUrl(workerUrl);

// ---------- map ----------
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://tiles.openfreemap.org/styles/liberty',
  center: START,
  zoom: 16.2,
  pitch: 60,
  bearing: -25,
  maxPitch: 78,
  attributionControl: { compact: true },
  hash: true, // view lives in the URL, so it can be shared
});
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
// three.js draws the buildings (with real shadows) instead of the style's extrusions
const city = createCityLayer(map, { extra: extraBuildings.features });
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
const NS = 'http://www.w3.org/2000/svg';
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
  dayRange = [Math.ceil(toLocalMin(times.sunrise)), Math.floor(toLocalMin(times.sunset))];
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
  } else {
    $('shadow-note').textContent = pos.altitude > -1
      ? 'Sol rente ao horizonte: as sombras ficam longas demais para medir.'
      : `Sem sombra do sol agora. Próximo nascer: ${fmtMin(toLocalMin(times.sunrise))}.`;
  }

  $('time').min = dayRange[0];
  $('time').max = dayRange[1];
  $('time').value = Math.floor(state.min);
  $('t-rise').textContent = `nascer ${fmtMin(dayRange[0])}`;
  $('t-set').textContent = `pôr ${fmtMin(dayRange[1])}`;
  $('doy').value = dayOfYear(state);
  $('date').value = `${state.y}-${pad(state.m)}-${pad(state.d)}`;
  $('play-day').setAttribute('aria-pressed', state.playing === 'day');
  $('play-year').setAttribute('aria-pressed', state.playing === 'year');
  $('play-day').textContent = state.playing === 'day' ? '❚❚ Dia' : '▶ Dia';
  $('play-year').textContent = state.playing === 'year' ? '❚❚ Ano' : '▶ Ano';
  drawCompass(pos, times, [lng, lat]);
}

const manual = () => { state.live = false; };
$('time').addEventListener('input', (e) => { manual(); state.min = +e.target.value; render(); });
$('doy').addEventListener('input', (e) => { manual(); setDayOfYear(+e.target.value); render(); });
$('date').addEventListener('change', (e) => {
  const [y, m, d] = e.target.value.split('-').map(Number);
  if (!y) return;
  manual(); Object.assign(state, { y, m, d }); render();
});
$('now').addEventListener('click', () => { state.playing = null; state.live = true; Object.assign(state, localNow()); render(); });
document.querySelectorAll('.presets .chip').forEach((b) => b.addEventListener('click', () => {
  const [m, d] = b.dataset.md.split('-').map(Number);
  manual(); Object.assign(state, { m, d }); render();
}));
// ---------- address search ----------
// Esri's World Geocoder knows Brazilian house numbers (OSM rarely has them in Fortaleza).
// Anonymous use is allowed for searches whose results are not stored; Nominatim is the fallback.
const PRECISION = {
  PointAddress: 'número exato', Subaddress: 'número exato',
  StreetAddress: 'número aproximado', StreetAddressExt: 'número aproximado',
  StreetName: 'só a rua', StreetInt: 'cruzamento', POI: 'local',
};
async function searchEsri(q) {
  const { lng, lat } = map.getCenter();
  const url = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?'
    + new URLSearchParams({
      f: 'json', singleLine: q, countryCode: 'BRA', langCode: 'pt', maxLocations: '6',
      outFields: 'Addr_type', searchExtent: SEARCH_BOX, location: `${lng},${lat}`,
    });
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const seen = new Set();
  return data.candidates
    .filter((c) => c.score >= 75 && !seen.has(c.address) && seen.add(c.address))
    .map((c) => ({
      lng: c.location.x, lat: c.location.y, label: c.address,
      precision: PRECISION[c.attributes.Addr_type] || 'região',
      exact: /Address$|^Subaddress$/.test(c.attributes.Addr_type) && c.score >= 95,
    }));
}
async function searchNominatim(q) {
  // west,north,east,south as Nominatim expects
  const [w, s1, e, n] = SEARCH_BOX.split(',');
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=br&accept-language=pt-BR&bounded=1&viewbox=${w},${n},${e},${s1}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status);
  return (await res.json()).map((r) => ({
    lng: +r.lon, lat: +r.lat,
    label: r.display_name.replace(/, (Região Geográfica|Mesorregião|Microrregião|Região Metropolitana|Região Nordeste)[^,]*/g, '').replace(/, Brasil$/, ''),
    precision: r.addresstype === 'road' ? 'só a rua' : r.addresstype === 'house' || r.addresstype === 'building' ? 'número exato' : 'local',
    exact: r.addresstype === 'house' || r.addresstype === 'building',
  }));
}

let marker = null;
function goTo(r) {
  marker?.remove();
  marker = new maplibregl.Marker({ color: '#c9770a' }).setLngLat([r.lng, r.lat]).addTo(map);
  map.flyTo({ center: [r.lng, r.lat], zoom: 17.5, pitch: 60, duration: 2200 });
  $('results').hidden = true;
}
$('search').addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = $('q').value.trim();
  if (!q) return;
  const list = $('results');
  list.hidden = false;
  list.innerHTML = '<li class="msg">Buscando…</li>';
  let found = [];
  try { found = await searchEsri(q); } catch { /* fall back below */ }
  if (!found.length) {
    try { found = await searchNominatim(q); } catch {
      list.innerHTML = '<li class="msg">A busca não respondeu. Verifique a conexão e tente de novo.</li>';
      return;
    }
  }
  if (!found.length) {
    list.innerHTML = '<li class="msg">Nada encontrado em Fortaleza. Tente "rua, número, bairro" ou o nome de um lugar.</li>';
    return;
  }
  if (found[0].exact && found.filter((r) => r.exact).length === 1) return goTo(found[0]);
  list.innerHTML = '';
  if (/\d/.test(q) && !found.some((r) => r.exact)) {
    list.insertAdjacentHTML('beforeend', '<li class="msg">Número não encontrado; mostrando a rua. Tente incluir o bairro.</li>');
  }
  found.forEach((r) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = r.label;
    const tag = document.createElement('span');
    tag.className = 'precision';
    tag.textContent = r.precision;
    b.appendChild(tag);
    b.addEventListener('click', () => goTo(r));
    li.appendChild(b);
    list.appendChild(li);
  });
});
map.on('moveend', () => render());
map.on('rotate', () => render());

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

// play: a day passes in ~20 s, a year in ~12 s
let last = 0;
function frame(ts) {
  if (!state.playing) return;
  const dt = last ? Math.min(0.1, (ts - last) / 1000) : 0;
  last = ts;
  if (state.playing === 'day') {
    state.min += dt * 60;
    if (state.min >= dayRange[1]) state.min = dayRange[0];
  } else {
    state._doyF = ((state._doyF ?? dayOfYear(state)) + dt * 30) % 365;
    setDayOfYear(Math.floor(state._doyF));
  }
  render();
  requestAnimationFrame(frame);
}
function togglePlay(kind) {
  manual();
  state.playing = state.playing === kind ? null : kind;
  state._doyF = undefined;
  last = 0;
  if (state.playing) requestAnimationFrame(frame);
  render();
}
$('play-day').addEventListener('click', () => togglePlay('day'));
$('play-year').addEventListener('click', () => togglePlay('year'));

setInterval(() => { if (state.live) { Object.assign(state, localNow()); render(); } }, 30000);
render();
