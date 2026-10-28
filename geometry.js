// Bed shapes, polygon helpers and the natural-looking auto layout.
(function () {
  const TAU = Math.PI * 2;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pip(poly, x, y) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function distSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }
  function edgeDist(poly, x, y) {
    let m = 1e9;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
      m = Math.min(m, distSeg(x, y, poly[j][0], poly[j][1], poly[i][0], poly[i][1]));
    return m;
  }
  function area(poly) {
    let a = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
    return Math.abs(a) / 2;
  }
  function bbox(poly) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    poly.forEach(p => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }
  function arcPts(cx, cy, rx, ry, a0, a1, n) {
    const out = [];
    for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
    return out;
  }
  const clamp01 = v => Math.max(0, Math.min(1, v));

  // ---- shapes: build(params) -> { poly, depth(x,y) in 0..1 (0 = front/short side, 1 = back/tall side), mode }
  const SHAPES = {
    rect: {
      label: "Rectangle", hint: "A classic border along a fence, wall or path.",
      params: [{ k: "w", label: "Width (ft)", def: 16, min: 2, max: 60 }, { k: "d", label: "Depth (ft)", def: 6, min: 2, max: 30 }],
      build(p) { return { poly: [[0, 0], [p.w, 0], [p.w, p.d], [0, p.d]], depth: (x, y) => clamp01(y / p.d), mode: "border" }; }
    },
    lshape: {
      label: "L-shape", hint: "Wraps a corner. The notch is cut from the back right.",
      params: [{ k: "w", label: "Overall width (ft)", def: 14, min: 4, max: 60 }, { k: "d", label: "Overall depth (ft)", def: 9, min: 4, max: 30 },
        { k: "cw", label: "Notch width (ft)", def: 6, min: 1, max: 40 }, { k: "cd", label: "Notch depth (ft)", def: 5, min: 1, max: 25 }],
      build(p) {
        const cw = Math.min(p.cw, p.w - 1.5), cd = Math.min(p.cd, p.d - 1.5);
        return { poly: [[0, 0], [p.w, 0], [p.w, p.d - cd], [p.w - cw, p.d - cd], [p.w - cw, p.d], [0, p.d]], depth: (x, y) => clamp01(y / p.d), mode: "border" };
      }
    },
    curved: {
      label: "Curved border", hint: "A gently wavy bed with a softer, more natural edge.",
      params: [{ k: "w", label: "Width (ft)", def: 16, min: 4, max: 60 }, { k: "d", label: "Depth (ft)", def: 5.5, min: 2, max: 30 }],
      build(p) {
        const yf = x => 0.28 * p.d * (0.5 - 0.5 * Math.cos((TAU * x) / p.w));
        const yb = x => p.d * (1 - 0.12 * (0.5 + 0.5 * Math.cos((TAU * x) / p.w)));
        const n = 48, poly = [];
        for (let i = 0; i <= n; i++) { const x = (p.w * i) / n; poly.push([x, yf(x)]); }
        for (let i = n; i >= 0; i--) { const x = (p.w * i) / n; poly.push([x, yb(x)]); }
        return { poly, depth: (x, y) => clamp01((y - yf(x)) / (yb(x) - yf(x) || 1)), mode: "border" };
      }
    },
    half: {
      label: "Half moon", hint: "Against a wall or fence, with a curved front.",
      params: [{ k: "w", label: "Width across the flat side (ft)", def: 12, min: 3, max: 50 }],
      build(p) {
        const R = p.w / 2;
        return { poly: arcPts(R, R, R, R, Math.PI, TAU, 40), depth: (x, y) => clamp01(y / R), mode: "border" };
      }
    },
    wedge: {
      label: "Corner wedge", hint: "Fills a corner where two walls or fences meet.",
      params: [{ k: "r", label: "Radius (ft)", def: 8, min: 3, max: 30 }],
      build(p) {
        const R = p.r, poly = [[0, R]].concat(arcPts(0, R, R, R, 0, -Math.PI / 2, 32));
        return { poly, depth: (x, y) => clamp01(1 - Math.hypot(x, y - R) / R), mode: "border" };
      }
    },
    circle: {
      label: "Round island", hint: "Seen from every side, with the tallest plants in the middle.",
      params: [{ k: "dia", label: "Diameter (ft)", def: 8, min: 3, max: 40 }],
      build(p) {
        const R = p.dia / 2;
        return { poly: arcPts(R, R, R, R, 0, TAU, 56).slice(0, -1), depth: (x, y) => clamp01(1 - Math.hypot(x - R, y - R) / R), mode: "island" };
      }
    },
    oval: {
      label: "Oval island", hint: "A longer island bed, tallest plants down the middle.",
      params: [{ k: "w", label: "Width (ft)", def: 12, min: 3, max: 50 }, { k: "d", label: "Depth (ft)", def: 6, min: 3, max: 30 }],
      build(p) {
        const a = p.w / 2, b = p.d / 2;
        return { poly: arcPts(a, b, a, b, 0, TAU, 56).slice(0, -1), depth: (x, y) => clamp01(1 - Math.hypot((x - a) / a, (y - b) / b)), mode: "island" };
      }
    },
    free: {
      label: "Draw your own", hint: "Click points to outline any shape you like.",
      params: [], // polygon comes from the drawing tool
      build(p, st) {
        const poly = (st && st.freePoly && st.freePoly.length >= 3) ? st.freePoly : [[0, 0], [10, 0], [10, 5], [0, 5]];
        const bb = bbox(poly);
        if (st && st.freeView === "island") {
          let mx = 0;
          for (let i = 0; i < 400; i++) {
            const x = bb.x0 + Math.random() * bb.w, y = bb.y0 + Math.random() * bb.h;
            if (pip(poly, x, y)) mx = Math.max(mx, edgeDist(poly, x, y));
          }
          mx = mx || 1;
          return { poly, depth: (x, y) => clamp01(edgeDist(poly, x, y) / mx), mode: "island" };
        }
        return { poly, depth: (x, y) => clamp01((y - bb.y0) / (bb.h || 1)), mode: "border" };
      }
    }
  };

  function buildBed(state) {
    const sh = SHAPES[state.shape] || SHAPES.rect;
    const p = {};
    sh.params.forEach(d => { p[d.k] = (state.dims && state.dims[d.k] != null) ? +state.dims[d.k] : d.def; });
    const bed = sh.build(p, state);
    // Shift polygon so its bounding box starts at 0,0 (keeps drawing simple)
    const bb = bbox(bed.poly);
    if (bb.x0 !== 0 || bb.y0 !== 0) {
      const dx = bb.x0, dy = bb.y0, old = bed.depth;
      bed.poly = bed.poly.map(q => [q[0] - dx, q[1] - dy]);
      bed.depth = (x, y) => old(x + dx, y + dy);
    }
    bed.bb = bbox(bed.poly);
    bed.area = area(bed.poly);
    bed.label = sh.label;
    return bed;
  }

  // ---------------- plant helpers ----------------
  const hMean = p => (p.hLo + p.hHi) / 2;
  const spFt = p => p.spacing / 12;

  function depthTargets(plants) {
    // plants: array of plant objects. Returns {id: target depth 0..1}
    const hs = plants.map(hMean), lo = Math.min(...hs), hi = Math.max(...hs), out = {};
    plants.forEach(p => { const t = hi > lo ? (hMean(p) - lo) / (hi - lo) : 0.5; out[p.id] = 0.1 + 0.8 * t; });
    return out;
  }

  function makeEngine(bed, byId, placed, rng) {
    const bb = bed.bb;
    function valid(id, x, y, factor) {
      const r = spFt(byId[id]) / 2;
      if (!pip(bed.poly, x, y)) return false;
      if (edgeDist(bed.poly, x, y) < r * 0.75) return false;
      for (let i = 0; i < placed.length; i++) {
        const q = placed[i];
        if (Math.hypot(x - q.x, y - q.y) < (spFt(byId[id]) + spFt(byId[q.id])) / 2 * factor) return false;
      }
      return true;
    }
    function randPoint() { return [bb.x0 + rng() * bb.w, bb.y0 + rng() * bb.h]; }
    function pickAnchor(id, target, anchorsSame) {
      let best = null, bs = 1e9;
      for (const factor of [0.92, 0.82]) {
        for (let i = 0; i < 260; i++) {
          const [x, y] = randPoint();
          if (!valid(id, x, y, factor)) continue;
          let s = Math.abs(bed.depth(x, y) - target) * 3 + rng() * 0.4;
          anchorsSame.forEach(a => { s -= Math.min(Math.hypot(a[0] - x, a[1] - y), 7) * 0.12; });
          if (s < bs) { bs = s; best = [x, y]; }
        }
        if (best) return best;
      }
      // last resort: scan the whole bed on a fine grid at a tighter (but still allowed) spacing
      let bestG = null, bsG = 1e9;
      for (let y = bb.y0; y <= bb.y0 + bb.h; y += 0.2) for (let x = bb.x0; x <= bb.x0 + bb.w; x += 0.2) {
        if (!valid(id, x, y, 0.78)) continue;
        let s = Math.abs(bed.depth(x, y) - target) * 3 + rng() * 0.4;
        anchorsSame.forEach(a => { s -= Math.min(Math.hypot(a[0] - x, a[1] - y), 7) * 0.12; });
        if (s < bsG) { bsG = s; bestG = [x, y]; }
      }
      return bestG;
    }
    function placeNear(id, tx, ty, target) {
      const s = spFt(byId[id]);
      for (const factor of [0.92, 0.82, 0.76]) {
        let best = null, bs = 1e9;
        for (let i = 0; i < (factor < 0.8 ? 400 : 120); i++) {
          const a = rng() * TAU, rr = i === 0 ? 0 : Math.abs(gauss(rng)) * 0.45 * s;
          const x = tx + Math.cos(a) * rr, y = ty + Math.sin(a) * rr;
          if (!valid(id, x, y, factor)) continue;
          const sc = Math.hypot(x - tx, y - ty) + Math.abs(bed.depth(x, y) - target) * 1.2 * s;
          if (sc < bs) { bs = sc; best = [x, y]; }
        }
        if (best) return best;
      }
      return null;
    }
    return { valid, randPoint, pickAnchor, placeNear };
  }
  function gauss(rng) { return Math.sqrt(-2 * Math.log(rng() + 1e-9)) * Math.cos(TAU * rng()); }

  function groupSizes(n) {
    if (n <= 2) return n > 0 ? [n] : [];
    const k = Math.ceil(n / 5), base = Math.floor(n / k), extra = n % k, out = [];
    for (let i = 0; i < k; i++) out.push(base + (i < extra ? 1 : 0));
    return out;
  }

  // items: [{ plant, n }]; returns { placements, unplaced:{id:n} }
  function autoLayout(bed, items, seed, opts) {
    opts = opts || {};
    const rng = mulberry32(seed || 1);
    const byId = {}; items.forEach(it => (byId[it.plant.id] = it.plant));
    const placed = [], unplaced = {};
    const targets = depthTargets(items.map(i => i.plant));
    const eng = makeEngine(bed, byId, placed, rng);
    const order = items.slice().sort((a, b) => (a.plant.filler ? 1 : 0) - (b.plant.filler ? 1 : 0) || spFt(b.plant) - spFt(a.plant) || hMean(b.plant) - hMean(a.plant));
    order.forEach(it => {
      const p = it.plant, anchors = [], target = targets[p.id];
      let left = it.n;
      groupSizes(it.n).forEach(size => {
        const a = eng.pickAnchor(p.id, target, anchors);
        if (!a) { unplaced[p.id] = (unplaced[p.id] || 0) + size; left -= size; return; }
        anchors.push(a);
        placed.push({ id: p.id, x: a[0], y: a[1] });
        const ang = rng() * TAU, s = spFt(p);
        for (let i = 1; i < size; i++) {
          const side = i % 2 ? 1 : -1;
          const tx = a[0] + Math.cos(ang) * i * s * 0.85 + Math.cos(ang + Math.PI / 2) * side * 0.3 * s;
          const ty = a[1] + Math.sin(ang) * i * s * 0.85 + Math.sin(ang + Math.PI / 2) * side * 0.3 * s;
          const q = eng.placeNear(p.id, tx, ty, target) || eng.pickAnchor(p.id, target, [[a[0], a[1]]]);
          if (q) placed.push({ id: p.id, x: q[0], y: q[1] }); else unplaced[p.id] = (unplaced[p.id] || 0) + 1;
        }
      });
    });
    // groundcover carpet: fill leftover gaps with the smallest filler plant
    if (opts.fill) {
      const f = items.filter(i => i.plant.filler).sort((a, b) => spFt(a.plant) - spFt(b.plant))[0];
      if (f) {
        let fails = 0;
        while (fails < 400 && placed.length < 600) {
          const [x, y] = eng.randPoint();
          if (eng.valid(f.plant.id, x, y, 0.97)) { placed.push({ id: f.plant.id, x, y, c: 1 }); fails = 0; } else fails++;
        }
      }
    }
    return { placements: placed, unplaced };
  }

  // add one plant at the best spot (near others of its kind, at the right depth)
  // re-fill the groundcover carpet (placements flagged c:1) around the other plants
  function refillCarpet(bed, byId, placed, fillerId, seed) {
    for (let i = placed.length - 1; i >= 0; i--) if (placed[i].c) placed.splice(i, 1);
    const ids = Array.isArray(fillerId) ? fillerId.filter(Boolean) : (fillerId ? [fillerId] : []);
    if (!ids.length) return;
    const rng = mulberry32(seed || 5), eng = makeEngine(bed, byId, placed, rng);
    // with several groundcovers, scatter patch centers and let each patch grow its own kind
    const centers = []; if (ids.length > 1) for (let i = 0; i < ids.length * 3; i++) centers.push({ id: ids[i % ids.length], p: eng.randPoint() });
    const pick = (x, y) => { if (ids.length === 1) return ids[0]; let best = centers[0], bd = 1e9; centers.forEach(c => { const d = Math.hypot(c.p[0] - x, c.p[1] - y); if (d < bd) { bd = d; best = c; } }); return best.id; };
    let fails = 0;
    while (fails < 600 && placed.length < 600) {
      const [x, y] = eng.randPoint(), fid = pick(x, y);
      if (eng.valid(fid, x, y, 0.97)) { placed.push({ id: fid, x, y, c: 1 }); fails = 0; } else fails++;
    }
  }
  function placeOne(bed, byId, placed, id, targets, seed) {
    const rng = mulberry32(seed || Math.floor(Math.random() * 1e9));
    const eng = makeEngine(bed, byId, placed, rng);
    const same = placed.filter(p => p.id === id);
    const target = (targets && targets[id] != null) ? targets[id] : 0.5;
    let best = null, bs = 1e9;
    for (const factor of [0.92, 0.82, 0.7]) {
      for (let i = 0; i < 400; i++) {
        const [x, y] = eng.randPoint();
        if (!eng.valid(id, x, y, factor)) continue;
        let s = Math.abs(bed.depth(x, y) - target) * 3 + rng() * 0.3;
        if (same.length) { const d = Math.min(...same.map(q => Math.hypot(q.x - x, q.y - y))); s += Math.min(d, 6) * 0.35; }
        if (s < bs) { bs = s; best = [x, y]; }
      }
      if (best) break;
    }
    return best ? { id, x: best[0], y: best[1] } : null;
  }

  // place a new plant right beside an existing one (for "goes well with")
  function placeBeside(bed, byId, placed, id, tx, ty, targets, anchorId) {
    const rng = mulberry32(Math.floor(Math.random() * 1e9));
    const eng = makeEngine(bed, byId, placed, rng);
    const target = (targets && targets[id] != null) ? targets[id] : 0.5;
    const d0 = (spFt(byId[id]) + spFt(byId[anchorId])) / 2;
    for (const factor of [0.9, 0.82, 0.75]) {
      let best = null, bs = 1e9;
      for (const mult of [0.95, 1.05, 1.2, 1.4, 1.7, 2.1]) {
        for (let a = 0; a < 24; a++) {
          const ang = (a / 24) * TAU + rng() * 0.1, x = tx + Math.cos(ang) * d0 * mult, y = ty + Math.sin(ang) * d0 * mult;
          if (!eng.valid(id, x, y, factor)) continue;
          const s = Math.hypot(x - tx, y - ty) + Math.abs(bed.depth(x, y) - target) * 2 * d0;
          if (s < bs) { bs = s; best = [x, y]; }
        }
        if (best) return { id, x: best[0], y: best[1] };
      }
    }
    return null;
  }

  // suggested quantities so the mature circles cover about 75% of the bed
  function suggestQuantities(bed, plants) {
    const out = {};
    if (!plants.length) return out;
    const real = plants.filter(p => !p.filler), fill = plants.filter(p => p.filler);
    const w = new Map(); plants.forEach(p => w.set(p.id, p.filler ? 0.55 : 1));
    const tot = [...w.values()].reduce((a, b) => a + b, 0);
    const budget = bed.area * (fill.length ? 0.56 : 0.62);
    plants.forEach(p => {
      const r = spFt(p) / 2, circle = Math.PI * r * r;
      let c = (budget * w.get(p.id) / tot) / circle;
      if (c < 1.5) c = 1; else c = Math.round((c - 1) / 2) * 2 + 1;
      out[p.id] = Math.max(1, c);
    });
    // trim if too crowded
    const cov = () => plants.reduce((s, p) => s + out[p.id] * Math.PI * Math.pow(spFt(p) / 2, 2), 0) / bed.area;
    let guard = 40;
    while (cov() > 0.7 && guard--) {
      const big = plants.slice().sort((a, b) => out[b.id] * spFt(b) ** 2 - out[a.id] * spFt(a) ** 2)[0];
      if (out[big.id] > 1) out[big.id] -= 1; else break;
    }
    return out;
  }

  window.Geo = { refillCarpet, SHAPES, buildBed, autoLayout, placeOne, placeBeside, suggestQuantities, depthTargets, mulberry32, pip, edgeDist, area, bbox, hMean, spFt };
})();
