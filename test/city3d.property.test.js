// Property-based tests for the building mesh behind the shadows: random footprints,
// rules every wall and roof must follow.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { buildingGeometry } from '../src/city3d.js';

const meters = (x, y) => [x, y]; // footprints below are already in local meters
const RADIUS = 1200;

// rotated rectangle, as a closed GeoJSON ring, clockwise or counter-clockwise
const rect = fc.record({
  cx: fc.double({ min: -300, max: 300, noNaN: true }),
  cy: fc.double({ min: -300, max: 300, noNaN: true }),
  w: fc.double({ min: 4, max: 80, noNaN: true }),
  h: fc.double({ min: 4, max: 80, noNaN: true }),
  angle: fc.double({ min: 0, max: Math.PI, noNaN: true }),
  cw: fc.boolean(),
});
const ring = ({ cx, cy, w, h, angle, cw }, scale = 1) => {
  const c = Math.cos(angle), s = Math.sin(angle);
  let pts = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]
    .map(([x, y]) => [cx + scale * (x * c - y * s), cy + scale * (x * s + y * c)]);
  if (cw) pts = pts.reverse();
  return [...pts, pts[0]];
};
const feature = (rings, props = {}) => ({
  properties: { render_height: 30, ...props }, geometry: { type: 'Polygon', coordinates: rings },
});

// triangles as { v: [[x,y,z] x3], n: [nx,ny,nz] }
function triangles({ pos, nrm }) {
  const out = [];
  for (let i = 0; i < pos.length; i += 9) {
    out.push({ v: [0, 3, 6].map((k) => pos.slice(i + k, i + k + 3)), n: nrm.slice(i, i + 3) });
  }
  return out;
}
const sub = (a, b) => a.map((v, i) => v - b[i]);
const cross = ([a, b, c], [d, e, f]) => [b * f - c * e, c * d - a * f, a * e - b * d];
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const faceNormal = ({ v: [a, b, c] }) => cross(sub(b, a), sub(c, a));
const roofArea = (tris) => tris.filter((t) => t.n[2] === 1).reduce((s, t) => s + faceNormal(t)[2] / 2, 0);
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

test('every triangle faces the way its normal points', () => {
  fc.assert(fc.property(rect, (r) => {
    for (const t of triangles(buildingGeometry([feature([ring(r)])], meters, RADIUS))) {
      assert.ok(dot(faceNormal(t), t.n) > 0, `triangle ${JSON.stringify(t)}`);
    }
  }));
});

test('the roof covers exactly the footprint, whichever way the ring turns', () => {
  fc.assert(fc.property(rect, (r) => {
    const area = roofArea(triangles(buildingGeometry([feature([ring(r)])], meters, RADIUS)));
    assert.ok(near(area, r.w * r.h), `roof ${area} vs footprint ${r.w * r.h}`);
  }));
});

test('walls point away from the building and span base to top', () => {
  fc.assert(fc.property(rect, fc.integer({ min: 0, max: 20 }), fc.integer({ min: 1, max: 150 }), (r, base, extra) => {
    const top = base + extra;
    const tris = triangles(buildingGeometry([feature([ring(r)], { render_min_height: base, render_height: top })], meters, RADIUS));
    const walls = tris.filter((t) => t.n[2] === 0);
    assert.equal(walls.length, 8); // 4 sides, 2 triangles each
    for (const t of walls) {
      const mid = t.v.reduce((m, p) => m.map((s, i) => s + p[i] / 3), [0, 0, 0]);
      assert.ok(dot(t.n, [mid[0] - r.cx, mid[1] - r.cy, 0]) > 0);
      assert.ok(t.v.every(([, , z]) => z === base || z === top));
    }
  }));
});

test('a courtyard is left open and its walls face into it', () => {
  fc.assert(fc.property(rect, (r) => {
    const outer = ring(r), hole = ring({ ...r, cw: !r.cw }, 0.5);
    const tris = triangles(buildingGeometry([feature([outer, hole])], meters, RADIUS));
    assert.ok(near(roofArea(tris), r.w * r.h * 0.75), 'roof = footprint minus courtyard');
    const inner = tris.filter((t) => t.n[2] === 0).filter((t) => t.v.every(([x, y]) => Math.hypot(x - r.cx, y - r.cy) < Math.hypot(r.w, r.h) / 4 + 1e-6));
    assert.equal(inner.length, 8);
    for (const t of inner) {
      const [x, y] = t.v[0];
      assert.ok(dot(t.n, [r.cx - x, r.cy - y, 0]) >= -1e-9, 'courtyard wall faces the courtyard');
    }
  }));
});

test('outlines marked hide_3d, empty heights and far buildings draw nothing', () => {
  const r = { cx: 0, cy: 0, w: 20, h: 10, angle: 0, cw: false };
  const none = (f) => assert.equal(buildingGeometry([f], meters, RADIUS).pos.length, 0);
  none(feature([ring(r)], { hide_3d: true }));
  none(feature([ring(r)], { render_height: 5, render_min_height: 5 }));
  none(feature([ring({ ...r, cx: RADIUS + 50 })]));
  assert.ok(buildingGeometry([feature([ring(r)], { render_height: 0 })], meters, RADIUS).pos.length > 0, 'no height = default 3 m');
});
