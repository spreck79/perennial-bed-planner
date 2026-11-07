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
        if (st && st.freeView === "island") return { poly, depth: islandDepth(poly), mode: "island" };
        return { poly, depth: (x, y) => clamp01((y - bb.y0) / (bb.h || 1)), mode: "border" };
      }
    }
  };

  // island depth: 0 at the edge, 1 at the point farthest from any edge (tallest plants in the middle)
  function islandDepth(poly) {
    const bb = bbox(poly); let mx = 0;
    for (let i = 0; i < 400; i++) {
      const x = bb.x0 + Math.random() * bb.w, y = bb.y0 + Math.random() * bb.h;
      if (pip(poly, x, y)) mx = Math.max(mx, edgeDist(poly, x, y));
    }
    mx = mx || 1;
    return (x, y) => clamp01(edgeDist(poly, x, y) / mx);
  }
  // Which side is the front (where people see the bed from): short plants there, tall plants toward the
  // opposite side. Each value is the direction from front to back on the plan (+y is up on screen);
  // "c" means seen from all sides, tallest in the middle.
  const FRONTS = { s: [0, 1], n: [0, -1], w: [1, 0], e: [-1, 0], sw: [1, 1], se: [-1, 1], nw: [1, -1], ne: [-1, -1] };
  // The parts of the bed's outline people see it from: for each viewing side, the edges that face that way
  // and sit near that side (for a corner, just the stretch near the corner). Pieces are at most half a foot,
  // so a long edge is lit only where it should be. Returns [[x1, y1, x2, y2], ...] in bed feet.
  function viewEdges(bed) {
    const vs = (bed.views || []).filter(v => FRONTS[v]), P = bed.poly, n = P.length, out = [];
    if (!vs.length || n < 3) return out;
    let a2 = 0; for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; a2 += a[0] * b[1] - b[0] * a[1]; }
    const ccw = a2 > 0;
    vs.forEach(v => {
      const d = FRONTS[v], L = Math.hypot(d[0], d[1]), bx = d[0] / L, by = d[1] / L, corner = !!(d[0] && d[1]);
      let lo = Infinity, hi = -Infinity; P.forEach(q => { const t = q[0] * bx + q[1] * by; lo = Math.min(lo, t); hi = Math.max(hi, t); });
      const depth = (x, y) => ((x * bx + y * by) - lo) / ((hi - lo) || 1), near = corner ? 0.3 : 0.5;
      for (let i = 0; i < n; i++) {
        const a = P[i], b = P[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy); if (len < 1e-6) continue;
        const nx = (ccw ? dy : -dy) / len, ny = (ccw ? -dx : dx) / len;   // outward normal
        if (-(nx * bx + ny * by) < 0.45) continue;                       // doesn't face the viewer
        const k = Math.max(1, Math.ceil(len / 0.5));
        for (let j = 0; j < k; j++) {
          const x1 = a[0] + dx * j / k, y1 = a[1] + dy * j / k, x2 = a[0] + dx * (j + 1) / k, y2 = a[1] + dy * (j + 1) / k;
          if (depth((x1 + x2) / 2, (y1 + y2) / 2) <= near) out.push([x1, y1, x2, y2]);
        }
      }
    });
    return out;
  }
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
    // where people see the bed from: one or more edges or corners, or "c" for all sides (an island)
    const views = Array.isArray(state.front) ? state.front.filter(v => v === "c" || FRONTS[v])
      : state.front ? [state.front] : (state.shape === "free" && state.freeView === "island" ? ["c"] : null);
    if (views && views.includes("c")) { if (bed.mode !== "island") { bed.depth = islandDepth(bed.poly); bed.mode = "island"; } }
    else if (views && views.length) {
      // for each side: 0 at that side's edge, 1 at the far side. Seen from several sides, a spot is as
      // "front" as it is close to the nearest of them, so the tallest plants end up farthest from all.
      const one = v => { const d = FRONTS[v], L = Math.hypot(d[0], d[1]), bx = d[0] / L, by = d[1] / L, pr = (x, y) => x * bx + y * by;
        let lo = Infinity, hi = -Infinity; bed.poly.forEach(q => { const t = pr(q[0], q[1]); lo = Math.min(lo, t); hi = Math.max(hi, t); });
        return { f: (x, y) => clamp01((pr(x, y) - lo) / ((hi - lo) || 1)), ext: hi - lo }; };
      const fs = views.map(one);
      if (fs.length === 1) { bed.depth = fs[0].f; bed.depthFt = fs[0].ext; }
      else {
        const raw = (x, y) => Math.min(...fs.map(o => o.f(x, y))), b0 = bbox(bed.poly); let mx = 0;
        for (let i = 0; i <= 40; i++) for (let j = 0; j <= 40; j++) { const x = b0.x0 + b0.w * i / 40, y = b0.y0 + b0.h * j / 40; if (pip(bed.poly, x, y)) mx = Math.max(mx, raw(x, y)); }
        mx = mx || 1;
        bed.depth = (x, y) => clamp01(raw(x, y) / mx); bed.depthFt = mx * Math.min(...fs.map(o => o.ext));
      }
      bed.mode = "border";
    }
    bed.views = bed.mode === "island" ? ["c"] : (views && views.length ? views : ["s"]);
    bed.front = bed.views.length === 1 ? bed.views[0] : "multi";
    bed.bb = bbox(bed.poly);
    if (bed.depthFt == null) bed.depthFt = bed.mode === "island" ? Math.min(bed.bb.w, bed.bb.h) / 2 : bed.bb.h;
    bed.area = area(bed.poly);
    // Paths people walk on are viewing sides too (unless a path is marked as a work path, view: false): plants
    // are short beside them and taller farther away. The paths are read from the plan as it is now, so moving
    // or adding a path changes the depth without rebuilding the bed.
    { const base = bed.depth, depthFt0 = bed.depthFt; let pKey = NaN, pFn = null, pFt = depthFt0;
      const viewPaths = () => (state.objects || []).filter(o => o.t === "path" && o.view !== false);
      const keyOf = ps => ps.reduce((k, o, i) => k + (i + 1) * (o.x * 3 + o.y * 7 + o.w * 11 + (o.h || 0) * 13 + (o.rot || 0) * 17 + (o.pts ? o.pts.reduce((s, q) => s + q[0] * 19 + q[1] * 23, 0) : 0)), ps.length * 1e6);
      const make = ps => {
        if (!ps.length) return null;
        const blocks = ps.map(objBlock).filter(Boolean), D = Math.max(2, depthFt0 || 4);
        const dist = (x, y) => { let m = Infinity; blocks.forEach(b => (m = Math.min(m, objDist(b, x, y)))); return Math.max(0, m); };
        const raw = (x, y) => Math.min(base(x, y), clamp01(dist(x, y) / D)), b0 = bed.bb; let mx = 0, ft = 0;
        for (let i = 0; i <= 40; i++) for (let j = 0; j <= 40; j++) {
          const x = b0.x0 + b0.w * i / 40, y = b0.y0 + b0.h * j / 40; if (!pip(bed.poly, x, y)) continue;
          mx = Math.max(mx, raw(x, y)); ft = Math.max(ft, Math.min(base(x, y) * depthFt0, dist(x, y)));   // the farthest any spot is from where people look
        }
        mx = mx || 1; pFt = ft || depthFt0; return (x, y) => clamp01(raw(x, y) / mx);
      };
      const sync = () => { const ps = viewPaths(), k = keyOf(ps); if (k !== pKey) { pKey = k; pFt = depthFt0; pFn = make(ps); } };
      bed.depth = (x, y) => { sync(); return pFn ? pFn(x, y) : base(x, y); };
      bed.viewDepthFt = () => { sync(); return pFn ? pFt : depthFt0; };   // how deep the bed really is from the viewer's side, paths included
      bed.viewPaths = viewPaths;
    }
    bed.label = sh.label;
    return bed;
  }

  // ---------------- objects in the bed (paths, stones, stumps, rocks, birdbaths, shrubs, trees) ----------------
  // w/h are feet; circles use w as the diameter. Trees only block their trunk: plants can grow under the canopy.
  const OBJ = {
    path: { label: "Path", w: 2, h: 6, min: 1, max: 40, shape: "rect", rot: true, draw: true, note: "Plants are kept off the path but can lean over its edges." },
    stone: { label: "Stepping stone", w: 1.25, h: 1.25, min: 0.75, max: 3, shape: "circ", note: "A single stone. Add several to make a stepping-stone path." },
    stump: { label: "Tree stump", w: 1.5, h: 1.5, min: 0.5, max: 5, shape: "circ", note: "Plants are kept clear of the stump." },
    rock: { label: "Rock", w: 2, h: 1.4, min: 0.5, max: 8, shape: "ell", rot: true, note: "Plants are kept clear of the rock but can tuck in around it." },
    birdbath: { label: "Birdbath", w: 2, h: 2, min: 1, max: 4, shape: "circ", note: "Size is the width of the bowl." },
    shrub: { label: "Shrub", w: 4, h: 4, min: 1.5, max: 12, shape: "circ", note: "Size is how wide the shrub grows. Nothing is planted under it." },
    hedge: { label: "Hedge / shrub row", w: 4, h: 1.5, min: 1, max: 24, shape: "rect", rot: true, note: "A straight run of shrubs, like a boxwood hedge. Nothing is planted under it." },
    tree: { label: "Tree", w: 10, h: 10, min: 4, max: 40, shape: "circ", note: "Size is the canopy width. Only the trunk takes up room, so plants can grow underneath. Use Paint sun to mark the shade it casts." }
  };
  const trunkR = o => Math.max(0.6, o.w * 0.06);
  // How a hedge is drawn, in its own unrotated frame (feet, centered on 0,0), so the screen and the PDF match:
  // a soft-cornered outline, and a row of the round shrub's rosettes (7 lobes in a ring + a bright center)
  // spaced so neighbors always overlap, like several round shrubs grown into one. hw/hh are half the size.
  function hedgeLayout(hw, hh) {
    const m = Math.min(hw, hh), R = m * 0.6, cx = hw - R, cy = hh - R, outline = [];
    [[cx, cy, 0], [-cx, cy, 90], [-cx, -cy, 180], [cx, -cy, 270]].forEach(([x, y, a0]) => {
      for (let k = 0; k <= 8; k++) { const a = (a0 + 90 * k / 8) * Math.PI / 180; outline.push([x + Math.cos(a) * R, y + Math.sin(a) * R]); }
    });
    const long = hw >= hh, span = Math.abs(hw - hh), n = 1 + Math.ceil(2 * span / (1.6 * m) - 1e-9), centers = [], lobes = [];
    for (let i = 0; i < n; i++) { const t = n === 1 ? 0 : -span + 2 * span * i / (n - 1); centers.push(long ? [t, 0] : [0, t]); }
    centers.forEach(([x, y], i) => { for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2 + 0.4 + i * 0.9; lobes.push([x + Math.cos(a) * m * 0.52, y + Math.sin(a) * m * 0.52]); } });
    return { outline, lobes, centers, lobeR: m * 0.34, centerR: m * 0.3 };
  }
  // a drawn path: its clicked points joined by a smooth curve (Catmull-Rom), as many small steps
  function pathPts(o) {
    const P = o.pts; if (!P || P.length < 2) return [];
    if (P.length === 2) return P.map(q => [q[0], q[1]]);
    const out = [], n = P.length;
    for (let i = 0; i < n - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n - 1, i + 2)];
      for (let k = 0; k < 10; k++) {
        const t = k / 10, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(a => 0.5 * ((2 * p1[a]) + (-p0[a] + p2[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * t3)));
      }
    }
    out.push([P[n - 1][0], P[n - 1][1]]); return out;
  }
  function segDist(x, y, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L)) : 0;
    return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
  }
  function objBlock(o) {
    const d = OBJ[o.t]; if (!d) return null;
    if (o.t === "path" && o.pts && o.pts.length >= 2) return { k: "l", pts: pathPts(o), hw: o.w / 2 };
    if (o.t === "tree") return { k: "c", x: o.x, y: o.y, r: trunkR(o) };
    if (d.shape === "rect") return { k: "r", x: o.x, y: o.y, a: o.w / 2, b: o.h / 2, rot: (o.rot || 0) * Math.PI / 180 };
    if (d.shape === "ell") return { k: "e", x: o.x, y: o.y, a: o.w / 2, b: o.h / 2, rot: (o.rot || 0) * Math.PI / 180 };
    return { k: "c", x: o.x, y: o.y, r: o.w / 2 };
  }
  // signed distance from a point to an object's footprint (negative = inside)
  function objDist(b, x, y) {
    if (b.k === "l") { let m = Infinity; for (let i = 0; i + 1 < b.pts.length; i++) m = Math.min(m, segDist(x, y, b.pts[i], b.pts[i + 1])); return m - b.hw; }
    if (b.k === "c") return Math.hypot(x - b.x, y - b.y) - b.r;
    const c = Math.cos(-b.rot), s = Math.sin(-b.rot), dx = x - b.x, dy = y - b.y, lx = dx * c - dy * s, ly = dx * s + dy * c;
    if (b.k === "r") { const qx = Math.abs(lx) - b.a, qy = Math.abs(ly) - b.b; return qx > 0 || qy > 0 ? Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) : Math.max(qx, qy); }
    const n = Math.hypot(lx / b.a, ly / b.b); return (n - 1) * Math.min(b.a, b.b);
  }
  // the first object a plant of radius r at x,y sits on (f = how much of the radius may overhang)
  function objHit(objs, x, y, r, f) {
    for (const o of objs || []) { const b = objBlock(o); if (b && objDist(b, x, y) < r * f) return o; }
    return null;
  }
  // corner points of an object's outline (for drawing rectangles and ellipses)
  function objOutline(o, n) {
    const d = OBJ[o.t], rot = (o.rot || 0) * Math.PI / 180, c = Math.cos(rot), s = Math.sin(rot), pts = [];
    if (d.shape === "rect") [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([u, v]) => { const lx = u * o.w / 2, ly = v * o.h / 2; pts.push([o.x + lx * c - ly * s, o.y + lx * s + ly * c]); });
    else for (let i = 0; i < (n || 28); i++) { const a = i / (n || 28) * TAU, lx = Math.cos(a) * o.w / 2, ly = Math.sin(a) * (d.shape === "ell" ? o.h : o.w) / 2; pts.push([o.x + lx * c - ly * s, o.y + lx * s + ly * c]); }
    return pts;
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

  function makeEngine(bed, byId, placed, rng, lightOf) {
    const bb = bed.bb, blocks = (bed.objects || []).map(objBlock).filter(Boolean);
    // painted sun zones: 1 when the spot's light doesn't suit the plant (ignored for plants that suit none of the bed's zones).
    // lightOf can narrow a plant to particular zones, e.g. the zone a suggested planting picked it for.
    const zones = bed.lightZones ? bed.lightZones() : null;
    function lightPen(id, x, y) {
      if (!zones || !bed.lightAt) return 0;
      const pl = byId[id], ok = (lightOf && lightOf[id]) || (pl && pl.sun); if (!ok || !ok.some(z => zones.has(z))) return 0;
      const z = bed.lightAt(x, y); return z && !ok.includes(z) ? 1 : 0;
    }
    // the depth (front 0 .. back 1) a plant should sit at, at this spot: when the bed has sun zones, plants are
    // ranked by height within the zone and spread over that zone's own front-to-back range
    function tg(id, x, y, t) { return bed.targetAt ? bed.targetAt(id, x, y, t) : t; }
    function valid(id, x, y, factor) {
      const r = spFt(byId[id]) / 2;
      if (!pip(bed.poly, x, y)) return false;
      if (lightPen(id, x, y)) return false;   // painted sun zones are a rule, not a wish: a plant only goes where the light suits it
      if (edgeDist(bed.poly, x, y) < r * 0.75) return false;
      for (let i = 0; i < blocks.length; i++) if (objDist(blocks[i], x, y) < r * 0.7) return false;
      for (let i = 0; i < placed.length; i++) {
        const q = placed[i];
        // early-dormant plants (spring bulbs, bluebells) may share space with later-growing plants
        const mix = !!byId[id].dormant !== !!byId[q.id].dormant, f = mix ? factor * 0.3 : factor;
        if (Math.hypot(x - q.x, y - q.y) < (spFt(byId[id]) + spFt(byId[q.id])) / 2 * f) return false;
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
          let s = Math.abs(bed.depth(x, y) - tg(id, x, y, target)) * 3 + rng() * 0.4 + lightPen(id, x, y) * 8;
          anchorsSame.forEach(a => { s -= Math.min(Math.hypot(a[0] - x, a[1] - y), 7) * 0.12; });
          if (s < bs) { bs = s; best = [x, y]; }
        }
        if (best) return best;
      }
      // last resort: scan the whole bed on a fine grid at a tighter (but still allowed) spacing
      let bestG = null, bsG = 1e9;
      for (let y = bb.y0; y <= bb.y0 + bb.h; y += 0.2) for (let x = bb.x0; x <= bb.x0 + bb.w; x += 0.2) {
        if (!valid(id, x, y, 0.78)) continue;
        let s = Math.abs(bed.depth(x, y) - tg(id, x, y, target)) * 3 + rng() * 0.4 + lightPen(id, x, y) * 8;
        anchorsSame.forEach(a => { s -= Math.min(Math.hypot(a[0] - x, a[1] - y), 7) * 0.12; });
        if (s < bsG) { bsG = s; bestG = [x, y]; }
      }
      return bestG;
    }
    function placeNear(id, tx, ty, target) {
      const s = spFt(byId[id]); let wrongLight = null;
      for (const factor of [0.92, 0.82, 0.76]) {
        let best = null, bs = 1e9;
        for (let i = 0; i < (factor < 0.8 ? 400 : 120); i++) {
          const a = rng() * TAU, rr = i === 0 ? 0 : Math.abs(gauss(rng)) * 0.45 * s;
          const x = tx + Math.cos(a) * rr, y = ty + Math.sin(a) * rr;
          if (!valid(id, x, y, factor)) continue;
          const sc = Math.hypot(x - tx, y - ty) + Math.abs(bed.depth(x, y) - tg(id, x, y, target)) * 1.2 * s + lightPen(id, x, y) * 6 * s;
          if (sc < bs) { bs = sc; best = [x, y]; }
        }
        if (best && !lightPen(id, best[0], best[1])) return best;
        if (best && !wrongLight) wrongLight = best;
      }
      // only wrong-light spots nearby: let the caller look across the whole bed instead (when sun zones are painted)
      return zones ? null : wrongLight;
    }
    return { valid, randPoint, pickAnchor, placeNear, lightPen, tg };
  }
  function gauss(rng) { return Math.sqrt(-2 * Math.log(rng() + 1e-9)) * Math.cos(TAU * rng()); }

  function groupSizes(n) {
    if (n <= 2) return n > 0 ? [n] : [];
    const k = Math.ceil(n / 5), base = Math.floor(n / k), extra = n % k, out = [];
    for (let i = 0; i < k; i++) out.push(base + (i < extra ? 1 : 0));
    return out;
  }

  // items: [{ plant, n, zones? }] (zones narrows where in the light it may go); returns { placements, unplaced:{id:n} }
  function autoLayout(bed, items, seed, opts) {
    opts = opts || {};
    const rng = mulberry32(seed || 1);
    const byId = {}; items.forEach(it => (byId[it.plant.id] = it.plant));
    (opts.avoidPlants || []).forEach(p => { if (!byId[p.id]) byId[p.id] = p; });
    const placed = (opts.avoid || []).map(a => ({ id: a.id, x: a.x, y: a.y })), avoidN = placed.length, unplaced = {};
    const targets = depthTargets(items.map(i => i.plant));
    const lightOf = {}; items.forEach(it => { if (it.zones && it.zones.length) lightOf[it.plant.id] = it.zones; });
    const eng = makeEngine(bed, byId, placed, rng, lightOf);
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
          if (eng.valid(f.plant.id, x, y, 0.97) && !eng.lightPen(f.plant.id, x, y)) { placed.push({ id: f.plant.id, x, y, c: 1 }); fails = 0; } else fails++;
        }
      }
    }
    return { placements: placed.slice(avoidN), unplaced };
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
    // the nearest patch's groundcover, or the next nearest when that one doesn't suit the spot's light
    const order = (x, y) => ids.length === 1 ? ids : centers.slice().sort((a, b) => Math.hypot(a.p[0] - x, a.p[1] - y) - Math.hypot(b.p[0] - x, b.p[1] - y)).map(c => c.id).filter((id, i, a) => a.indexOf(id) === i);
    let fails = 0;
    while (fails < 600 && placed.length < 600) {
      const [x, y] = eng.randPoint(), fid = order(x, y).find(id => !eng.lightPen(id, x, y));
      if (fid && eng.valid(fid, x, y, 0.97)) { placed.push({ id: fid, x, y, c: 1 }); fails = 0; } else fails++;
    }
  }
  function placeOne(bed, byId, placed, id, targets, seed) {
    const rng = mulberry32(seed || Math.floor(Math.random() * 1e9));
    const eng = makeEngine(bed, byId, placed, rng);
    const same = placed.filter(p => p.id === id);
    const target = (targets && targets[id] != null) ? targets[id] : 0.5;
    let best = null, bs = 1e9;
    for (const factor of [0.92, 0.82, 0.74]) {
      for (let i = 0; i < 400; i++) {
        const [x, y] = eng.randPoint();
        if (!eng.valid(id, x, y, factor)) continue;
        let s = Math.abs(bed.depth(x, y) - eng.tg(id, x, y, target)) * 3 + rng() * 0.3 + eng.lightPen(id, x, y) * 8;
        if (same.length) { const d = Math.min(...same.map(q => Math.hypot(q.x - x, q.y - y))); s += Math.min(d, 6) * 0.35; }
        if (s < bs) { bs = s; best = [x, y]; }
      }
      if (best) break;
    }
    return best ? { id, x: best[0], y: best[1] } : null;
  }

  // place a plant as close as it can go to a chosen spot (for "Add a plant here"): the spot itself if it's
  // free, otherwise the nearest open spot, preferring light that suits the plant
  function placeAt(bed, byId, placed, id, tx, ty) {
    const eng = makeEngine(bed, byId, placed, mulberry32(7)), s = spFt(byId[id]);
    for (const factor of [0.92, 0.82]) {
      let best = null, bs = 1e9;
      for (let rr = 0; rr <= s * 3 + 1; rr += s * 0.2 + 0.05) {
        const n = rr === 0 ? 1 : Math.max(8, Math.round(TAU * rr / (s * 0.25 + 0.1)));
        for (let a = 0; a < n; a++) {
          const x = tx + Math.cos(a / n * TAU) * rr, y = ty + Math.sin(a / n * TAU) * rr;
          if (!eng.valid(id, x, y, factor)) continue;
          const sc = rr + eng.lightPen(id, x, y) * s * 2;
          if (sc < bs) { bs = sc; best = [x, y]; }
        }
        if (best && bs <= rr + 1e-6) break;   // nothing farther out can beat it
      }
      if (best) return { id, x: best[0], y: best[1] };
    }
    return null;
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
          const s = Math.hypot(x - tx, y - ty) + Math.abs(bed.depth(x, y) - target) * 2 * d0 + eng.lightPen(id, x, y) * 3 * d0;
          if (s < bs) { bs = s; best = [x, y]; }
        }
        if (best) return { id, x: best[0], y: best[1] };
      }
    }
    return null;
  }

  // fill empty spots with companions of the nearest plant, kept short-to-tall and in light that suits them.
  // pairs: { plantId: [companion ids] }. Returns the new placements (already pushed onto placed).
  function fillCompanions(bed, byId, placed, pairs, targets, seed, max) {
    const rng = mulberry32(seed || 9), eng = makeEngine(bed, byId, placed, rng), added = [], have = {};
    placed.forEach(q => { have[q.id] = 1; });
    let fails = 0;
    while (fails < 700 && added.length < (max || 60)) {
      const [x, y] = eng.randPoint();
      if (!pip(bed.poly, x, y)) { fails++; continue; }
      let anc = null, ad = 1e9;
      placed.forEach(q => { if (q.c) return; const d = Math.hypot(q.x - x, q.y - y); if (d < ad) { ad = d; anc = q; } });
      const cands = anc ? (pairs[anc.id] || []) : [];
      let best = null, bs = 1e9;
      cands.forEach(id => {
        const pl = byId[id]; if (!pl) return;
        if (ad > (spFt(pl) + spFt(byId[anc.id])) / 2 * 1.6) return;          // has to sit right beside its partner
        if (!eng.valid(id, x, y, 0.95) || eng.lightPen(id, x, y)) return;
        const dm = Math.abs(bed.depth(x, y) - (targets[id] != null ? targets[id] : 0.5));
        if (dm > 0.32) return;                                               // keep short plants in front, tall in back
        const s = dm * 3 - spFt(pl) * 0.35 - (have[id] ? 0.3 : 0) + rng() * 0.35;
        if (s < bs) { bs = s; best = id; }
      });
      if (best) { const q = { id: best, x, y }; placed.push(q); added.push(q); have[best] = 1; fails = 0; } else fails++;
    }
    return added;
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

  window.Geo = { viewEdges, OBJ, pathPts, segDist, objBlock, objDist, objHit, objOutline, trunkR, hedgeLayout, fillCompanions, refillCarpet, SHAPES, buildBed, autoLayout, placeOne, placeAt, placeBeside, suggestQuantities, depthTargets, mulberry32, pip, edgeDist, area, bbox, hMean, spFt };
})();
