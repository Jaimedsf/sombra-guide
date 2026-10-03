import * as THREE from 'three';

// Defaults; phones get a lighter profile from main.js.
// Buildings are rebuilt around the map center within `radius` meters. The sun's
// shadow camera covers the same square, so radius / shadowMapSize is meters per texel.
const RADIUS = 1200;
const SHADOW_MAP = 4096;
const DEFAULT_HEIGHT_M = 3;
const MIN_ZOOM = 14;

const D2R = Math.PI / 180;
const mercX = (lng) => (lng + 180) / 360;
const mercY = (lat) => (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * D2R) / 2))) / 360;

/**
 * Wall and roof triangles for building footprints (GeoJSON features with render_height and
 * render_min_height), skipping those whose first vertex is more than `radius` meters away.
 * `toLocal(lng, lat)` gives [x, y] in meters. Returns flat arrays, 3 numbers per vertex;
 * every triangle is counter-clockwise seen from the side its normal points to.
 */
export function buildingGeometry(features, toLocal, radius) {
  const pos = [], nrm = [];
  for (const f of features) {
    // an outline whose building:part pieces are drawn instead (OpenMapTiles schema)
    if (f.properties.hide_3d) continue;
    const top = f.properties.render_height || DEFAULT_HEIGHT_M;
    const base = f.properties.render_min_height || 0;
    if (top <= base) continue;
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates]
      : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [];

    for (const poly of polys) {
      // cheap reject on the first vertex before converting every ring
      const first = poly[0]?.[0];
      if (!first || Math.hypot(...toLocal(first[0], first[1])) > radius) continue;
      const rings = poly.map((ring) => {
        const pts = ring.map(([lng, lat]) => toLocal(lng, lat));
        if (pts.length > 1 && pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1]) pts.pop();
        return pts;
      });
      if (rings[0].length < 3) continue;

      // outer ring counter-clockwise, holes clockwise, so wall normals point outward
      rings.forEach((r, i) => {
        const ccw = THREE.ShapeUtils.area(r.map(([px, py]) => ({ x: px, y: py }))) > 0;
        if (ccw !== (i === 0)) r.reverse();
      });

      for (const r of rings) {
        for (let i = 0; i < r.length; i++) {
          const [ax, ay] = r[i], [bx, by] = r[(i + 1) % r.length];
          const len = Math.hypot(bx - ax, by - ay) || 1;
          const nx = (by - ay) / len, ny = -(bx - ax) / len;
          pos.push(ax, ay, base, bx, by, base, bx, by, top, ax, ay, base, bx, by, top, ax, ay, top);
          nrm.push(nx, ny, 0, nx, ny, 0, nx, ny, 0, nx, ny, 0, nx, ny, 0, nx, ny, 0);
        }
      }

      const contour = rings[0].map(([px, py]) => new THREE.Vector2(px, py));
      const holes = rings.slice(1).map((r) => r.map(([px, py]) => new THREE.Vector2(px, py)));
      const all = contour.concat(...holes);
      for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(contour, holes)) {
        const a = all[i], b = all[j], c2 = all[k];
        const flip = (b.x - a.x) * (c2.y - a.y) - (b.y - a.y) * (c2.x - a.x) < 0;
        const [p, q] = flip ? [c2, b] : [b, c2];
        pos.push(a.x, a.y, top, p.x, p.y, top, q.x, q.y, top);
        nrm.push(0, 0, 1, 0, 0, 1, 0, 0, 1);
      }
    }
  }
  return { pos, nrm };
}

/**
 * MapLibre custom layer that draws OSM buildings (from the style's vector tiles)
 * with three.js and lets a directional "sun" cast real shadows on them and on the ground.
 * Scene units are meters around `origin`: x east, y north, z up.
 */
export function createCityLayer(map, {
  sourceId = 'openmaptiles', sourceLayer = 'building', extra = [], radius = RADIUS, shadowMapSize = SHADOW_MAP,
} = {}) {
  let renderer, scene, camera, sun, hemi, ground, shadowMat, buildings;
  let origin = null; // { x, y, scale } in mercator units
  let dirty = true;
  // reused every frame instead of allocated
  const viewMatrix = new THREE.Matrix4(), localMatrix = new THREE.Matrix4(), localScale = new THREE.Vector3();

  const toLocal = (lng, lat) => [
    (mercX(lng) - origin.x) / origin.scale,
    -(mercY(lat) - origin.y) / origin.scale,
  ];

  function rebuild() {
    const c = map.getCenter();
    const x = mercX(c.lng), y = mercY(c.lat);
    // mercator units per meter at this latitude
    origin = { x, y, scale: 1 / (40075016.686 * Math.cos(c.lat * D2R)) };

    const all = map.querySourceFeatures(sourceId, { sourceLayer });
    // Parent tiles (lower zoom) stay loaded too and carry simplified copies of the same
    // buildings; mixing them doubles roofs and casts bogus shadows. `_z` is MapLibre's
    // (internal) tile zoom on each feature.
    const zMax = all.reduce((z, f) => Math.max(z, f._z ?? 0), 0);
    // `extra`: GeoJSON buildings not yet in OSM, drawn the same way
    const features = all.filter((f) => (f._z ?? 0) === zMax).concat(extra);
    const { pos, nrm } = buildingGeometry(features, toLocal, radius);

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    buildings.geometry.dispose();
    buildings.geometry = geom;
    // right after a flight the new tiles may still be parsing: stay dirty and retry
    dirty = features.length === 0;
    map.triggerRepaint();
  }

  const layer = {
    id: 'city-3d',
    type: 'custom',
    renderingMode: '3d',

    onAdd(_map, gl) {
      // antialiasing is MapLibre's choice: it created the context
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl });
      renderer.autoClear = false;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;

      scene = new THREE.Scene();
      camera = new THREE.Camera();

      hemi = new THREE.HemisphereLight(0xf4f1ff, 0xb9ae98, 1.4);
      scene.add(hemi);

      sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
      sun.castShadow = true;
      sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
      Object.assign(sun.shadow.camera, { left: -radius, right: radius, top: radius, bottom: -radius, near: 10, far: 6000 });
      sun.shadow.bias = -0.0008;
      sun.shadow.normalBias = 1.2;
      scene.add(sun, sun.target);

      buildings = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial({
        color: 0xefe9df,
        // buildings have no floor, so the default back-face shadow casting leaves gaps
        shadowSide: THREE.FrontSide,
      }));
      buildings.castShadow = buildings.receiveShadow = true;
      buildings.frustumCulled = false;
      scene.add(buildings);

      // invisible ground that only shows the shadows falling on it
      shadowMat = new THREE.ShadowMaterial({ color: 0x141a3a, opacity: 0.38 });
      ground = new THREE.Mesh(new THREE.PlaneGeometry(radius * 6, radius * 6), shadowMat);
      ground.position.z = 0.05;
      ground.receiveShadow = true;
      ground.frustumCulled = false;
      scene.add(ground);

      // rebuild shortly after building tiles arrive or the view moves away from the built area
      let timer = 0;
      const schedule = () => { clearTimeout(timer); timer = setTimeout(update, 350); };
      const update = () => {
        const visible = map.getZoom() >= MIN_ZOOM - 0.5;
        buildings.visible = ground.visible = visible;
        if (!visible) return map.triggerRepaint();
        const c = map.getCenter();
        const moved = !origin || Math.hypot(...toLocal(c.lng, c.lat)) > radius / 3;
        if (dirty || moved) rebuild();
      };
      map.on('sourcedata', (e) => { if (e.sourceId === sourceId && e.tile) { dirty = true; schedule(); } });
      map.on('moveend', schedule);
      map.on('idle', schedule); // safety net once every tile has settled
      schedule();
    },

    render(gl, args) {
      if (!origin) return;
      // keep the shadow camera centered on what is being looked at
      const c = map.getCenter();
      const [cx, cy] = toLocal(c.lng, c.lat);
      sun.target.position.set(cx, cy, 0);
      sun.position.copy(sun.target.position).addScaledVector(layer.sunDir, 3000);
      ground.position.x = cx;
      ground.position.y = cy;

      viewMatrix.fromArray(args.defaultProjectionData.mainMatrix);
      localMatrix.makeTranslation(origin.x, origin.y, 0).scale(localScale.set(origin.scale, -origin.scale, origin.scale));
      camera.projectionMatrix.copy(viewMatrix.multiply(localMatrix));

      // three.js divides diffuse light by PI, hence the large-looking intensities
      sun.intensity = 5.5 * layer.day;
      hemi.intensity = 1.2 + 1.6 * layer.day;
      shadowMat.opacity = 0.38 * layer.day;

      renderer.resetState();
      // MapLibre narrows gl.depthRange per layer and three.js never resets it; a squeezed
      // range corrupts the shadow map depth (everything ends up self-shadowed)
      gl.depthRange(0, 1);
      renderer.setViewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      renderer.render(scene, camera);
    },

    sunDir: new THREE.Vector3(0, 0, 1),
    day: 1,

    /** azimuth: degrees clockwise from north; altitude: degrees above horizon; day: 0 (night) .. 1 */
    setSun(azimuth, altitude, day) {
      const az = azimuth * D2R, alt = Math.max(altitude, 0.5) * D2R;
      layer.sunDir.set(Math.sin(az) * Math.cos(alt), Math.cos(az) * Math.cos(alt), Math.sin(alt));
      layer.day = day;
      map.triggerRepaint();
    },
  };
  return layer;
}
