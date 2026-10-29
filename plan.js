// Interactive bed plan: SVG drawing, dragging, placing, objects, sun zones, and the outline drawing tool.
(function () {
  const NS = "http://www.w3.org/2000/svg";
  let svg, wrap, cb = {}, ctx = null, drag = null, draw = null, ui = null, northDrag = false, northCenter = { x: 0, y: 0 };
  let objDrag = null, paintDrag = false, brushEl = null, rubberEl = null;
  const sp = p => p.spacing / 12;
  const LEAFD = "M10.6 1.4C5.2 1.2 1.6 3.9 1.7 8c0 .9.3 1.7.7 2.3.5-2.6 2.3-4.6 4.9-5.8-2.1 1.5-3.6 3.4-4.2 6 .5.2 1.1.3 1.7.3 4 0 6-3.4 5.8-9.4z";
  const DEERD = "M6 11V6.2M6 6.2 3.2 2M4.3 3.7 2 4.2M6 6.2 8.8 2M7.7 3.7 10 4.2";
  const BAD = { nat: ["#E1EBCB", "#3F6B3A"], gar: ["#F3DDEA", "#8A3F72"], daisy: ["#FBEBC4", "#8A6410"], deer: ["#EFE2D3", "#7A5230"], tox: ["#B8392E", "#FFFFFF"] };
  const HLC = { tox: "#B8392E", deer: "#7A5230", daisy: "#C99A1E", nat: "#5E8F4A", gar: "#B8629B" };
  const HLT = { tox: "#B8392E", deer: "#7A5230", daisy: "#8A6410", nat: "#3F6B3A", gar: "#8A3F72" };
  const deerEats = p => p.deer === "C" || p.deer === "D";
  const badgeKinds = pl => { const k = [pl.native ? "nat" : "gar"]; if (pl.fam === "daisy") k.push("daisy"); if (deerEats(pl)) k.push("deer"); if (pl.toxic && pl.toxic.length) k.push("tox"); return k; };
  const hlKind = pl => pl.toxic && pl.toxic.length ? "tox" : deerEats(pl) ? "deer" : pl.fam === "daisy" ? "daisy" : pl.native ? "nat" : "gar";

  // sun-zone colors: soil mixed with sunny yellow, sage, or slate blue (opaque, so painted rows don't show seams)
  const SOIL = "#A68C72";
  function mix(a, b, t) { const h = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)), A = h(a), B = h(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); }
  const ZONE = { full: mix(SOIL, "#F7CF4A", 0.42), part: mix(SOIL, "#6FC25A", 0.6), shade: mix(SOIL, "#465F88", 0.46) };
  const ZONE_LAB = { full: "Full sun", part: "Part shade", shade: "Full shade" };

  function drawBadge(k, parent, br, cls, ox, oy, x, y) {
    const g = el("g", { class: cls + " bdg", "data-ox": ox, "data-oy": oy, transform: `translate(${x} ${y})` }, parent), c = BAD[k];
    el("circle", { cx: 0, cy: 0, r: br, fill: c[0], stroke: "#fff", "stroke-width": br * 0.16 }, g);
    const s = br * 1.25 / 12;
    if (k === "nat") el("path", { d: LEAFD, fill: c[1], transform: `translate(${-br * 0.62} ${-br * 0.62}) scale(${s})` }, g);
    else if (k === "deer") el("path", { d: DEERD, fill: "none", stroke: c[1], "stroke-width": 1.5, "stroke-linecap": "round", transform: `translate(${-br * 0.62} ${-br * 0.62}) scale(${s})` }, g);
    else el("text", { x: 0, y: br * 0.36, "font-size": br * (k === "gar" ? 1.05 : k === "tox" ? 1.4 : 1.25), fill: c[1], "text-anchor": "middle", "font-weight": 800, "font-family": "sans-serif" }, g, k === "gar" ? "◆" : k === "daisy" ? "✿" : "!");
    return g;
  }

  function el(name, attrs, parent, text) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function svgPt(evt) { const m = svg.getScreenCTM().inverse(), pt = svg.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY; return pt.matrixTransform(m); }
  function toBed(evt) { const q = svgPt(evt); return { x: q.x - ctx.ox, y: ctx.H - (q.y - ctx.oy) }; } // bed coordinates (feet), y up
  const near = (e, el2) => e.target.closest && e.target.closest(el2);

  function init(svgEl, callbacks) {
    svg = svgEl; wrap = svg.parentElement; cb = callbacks;
    svg.addEventListener("pointerdown", onDown);
    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerup", onUp);
    svg.addEventListener("pointercancel", onUp);
    svg.addEventListener("dblclick", onDbl);
    svg.addEventListener("pointerover", e => { if (draw || (ctx && ctx.paint)) return; const g = near(e, ".pl"); cb.onHover && cb.onHover(g ? g.dataset.id : null); });
    svg.addEventListener("pointerleave", () => { cb.onHover && cb.onHover(null); if (brushEl) brushEl.setAttribute("visibility", "hidden"); });
    svg.addEventListener("contextmenu", e => { if (draw || near(e, ".pl") || near(e, ".ob")) e.preventDefault(); });
    window.addEventListener("keydown", e => {
      if (!draw) return;
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); finishDraw(); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cancelDraw(); }
      else if (e.key === "Backspace" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z")) { e.preventDefault(); e.stopPropagation(); undoDraw(); }
    }, true);
  }

  function onDown(e) {
    if (!ctx) return;
    if (draw) { drawDown(e); return; }
    const pt = toBed(e);
    if (ctx.paint) {
      if (e.button !== 0) return;
      paintDrag = true; svg.setPointerCapture(e.pointerId); e.preventDefault();
      cb.onPaintStart && cb.onPaintStart(); cb.onPaint && cb.onPaint(pt.x, pt.y); return;
    }
    if (ctx.pathDraw) { if (e.button === 0) cb.onPathPoint && cb.onPathPoint(pt.x, pt.y); e.preventDefault(); return; }
    if (ctx.objArmed) { if (e.button === 0) cb.onObjPlace && cb.onObjPlace(pt.x, pt.y); e.preventDefault(); return; }
    if (near(e, ".north-hit")) { northDrag = true; svg.setPointerCapture(e.pointerId); e.preventDefault(); return; }
    const h = near(e, ".obh");
    if (h) { objDrag = { oi: +h.dataset.oi, h: h.dataset.h, moved: false, sx: e.clientX, sy: e.clientY }; cb.onObjEditStart && cb.onObjEditStart(); svg.setPointerCapture(e.pointerId); e.preventDefault(); return; }
    const g = near(e, ".pl");
    if (g && e.button === 2) { cb.onSelect && cb.onSelect(+g.dataset.idx, false); cb.onContextMenu && cb.onContextMenu(+g.dataset.idx, e.clientX, e.clientY); e.preventDefault(); return; }
    if (g) {
      const idx = +g.dataset.idx, p = ctx.placements[idx];
      cb.onSelect && cb.onSelect(idx, e.ctrlKey || e.metaKey);
      drag = { idx, dx: p.x - pt.x, dy: p.y - pt.y, moved: false, g: svg.querySelector(`.pl[data-idx="${idx}"]`) || g, sx: e.clientX, sy: e.clientY };
      svg.setPointerCapture(e.pointerId);
      e.preventDefault(); return;
    }
    const og = near(e, ".ob");
    if (og) {
      const oi = +og.dataset.oi, o = ctx.objects[oi];
      cb.onObjSelect && cb.onObjSelect(oi);
      if (e.button === 2) { cb.onObjMenu && cb.onObjMenu(oi, e.clientX, e.clientY); e.preventDefault(); return; }
      objDrag = { oi, h: "move", dx: o.x - pt.x, dy: o.y - pt.y, moved: false, sx: e.clientX, sy: e.clientY };
      svg.setPointerCapture(e.pointerId); e.preventDefault(); return;
    }
    if (ctx.armed) cb.onPlace && cb.onPlace(pt.x, pt.y);
    else if (!(e.ctrlKey || e.metaKey)) cb.onSelect && cb.onSelect(-1);
  }
  function onMove(e) {
    if (draw) { drawMove(e); return; }
    if (!ctx) return;
    if (ctx.paint) {
      const pt = toBed(e);
      if (brushEl) { brushEl.setAttribute("visibility", "visible"); brushEl.setAttribute("cx", pt.x); brushEl.setAttribute("cy", ctx.H - pt.y); }
      if (paintDrag) cb.onPaint && cb.onPaint(pt.x, pt.y);
      return;
    }
    if (ctx.pathDraw) {
      const pt = toBed(e), P = ctx.pathDraw.pts;
      if (rubberEl && P.length) { const l = P[P.length - 1]; rubberEl.setAttribute("x1", l[0]); rubberEl.setAttribute("y1", ctx.H - l[1]); rubberEl.setAttribute("x2", pt.x); rubberEl.setAttribute("y2", ctx.H - pt.y); rubberEl.setAttribute("visibility", "visible"); }
      return;
    }
    if (northDrag) {
      const q = svgPt(e), ang = Math.atan2(q.x - northCenter.x, -(q.y - northCenter.y)) * 180 / Math.PI;
      cb.onNorthMove && cb.onNorthMove(((ang % 360) + 360) % 360);
      return;
    }
    if (objDrag) {
      if (!objDrag.moved && Math.hypot(e.clientX - objDrag.sx, e.clientY - objDrag.sy) < 3) return;
      objDrag.moved = true;
      const o = ctx.objects[objDrag.oi], d = window.Geo.OBJ[o.t], pt = toBed(e), poly = ctx.bed.poly;
      if (o.pts && objDrag.h !== "move") {
        const ctr = () => { o.x = o.pts.reduce((s, q) => s + q[0], 0) / o.pts.length; o.y = o.pts.reduce((s, q) => s + q[1], 0) / o.pts.length; };
        if (objDrag.h === "pw") { const sm = window.Geo.pathPts(o); let m = Infinity; for (let k = 0; k + 1 < sm.length; k++) m = Math.min(m, window.Geo.segDist(pt.x, pt.y, sm[k], sm[k + 1])); o.w = Math.max(d.min, Math.min(d.max, Math.round(2 * m * 4) / 4)); }
        else { const k = +objDrag.h.slice(1); if (window.Geo.pip(poly, pt.x, pt.y) && o.pts[k]) { o.pts[k] = [pt.x, pt.y]; ctr(); } }
      } else if (o.pts) {
        const nx = pt.x + objDrag.dx, ny = pt.y + objDrag.dy;
        if (window.Geo.pip(poly, nx, ny)) { const ddx = nx - o.x, ddy = ny - o.y; o.pts = o.pts.map(q => [q[0] + ddx, q[1] + ddy]); o.x = nx; o.y = ny; }
      } else if (objDrag.h === "move") {
        const nx = pt.x + objDrag.dx, ny = pt.y + objDrag.dy;
        if (window.Geo.pip(poly, nx, ny)) { o.x = nx; o.y = ny; }
        else if (window.Geo.pip(poly, nx, o.y)) o.x = nx; else if (window.Geo.pip(poly, o.x, ny)) o.y = ny;
      } else {
        const rot = (o.rot || 0) * Math.PI / 180, ddx = pt.x - o.x, ddy = pt.y - o.y, c = Math.cos(-rot), s = Math.sin(-rot), lx = ddx * c - ddy * s, ly = ddx * s + ddy * c;
        const cl = v => Math.max(d.min, Math.min(d.max, Math.round(v * 4) / 4));
        if (objDrag.h === "d") o.w = o.h = cl(2 * Math.hypot(ddx, ddy));
        else if (objDrag.h === "w") o.w = cl(2 * Math.abs(lx));
        else if (objDrag.h === "h") o.h = cl(2 * Math.abs(ly));
        else if (objDrag.h === "rot") { let a = Math.atan2(ddy, ddx) * 180 / Math.PI - 90; a = ((a % 360) + 360) % 360; if (!e.shiftKey) a = Math.round(a / 15) * 15 % 360; o.rot = a; }
      }
      cb.onObjChange && cb.onObjChange(objDrag.oi);
      return;
    }
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 3) return;
    if (ctx.placements[drag.idx].lock) { if (!drag.warned) { drag.warned = true; cb.onLockedDrag && cb.onLockedDrag(); } return; }
    drag.moved = true; svg.querySelectorAll(".sellab").forEach(e => { e.style.display = "none"; });
    const pt = toBed(e), p = ctx.placements[drag.idx];
    let nx = pt.x + drag.dx, ny = pt.y + drag.dy;
    if (window.Geo.pip(ctx.bed.poly, nx, ny)) { p.x = nx; p.y = ny; }
    else {
      // slide along the edge: try each axis on its own
      if (window.Geo.pip(ctx.bed.poly, nx, p.y)) p.x = nx; else if (window.Geo.pip(ctx.bed.poly, p.x, ny)) p.y = ny;
    }
    const g = svg.querySelector(`.pl[data-idx="${drag.idx}"]`) || drag.g;
    const c = g.querySelector("circle.pc"), t = g.querySelector("text:not(.tx)");
    c.setAttribute("cx", p.x); c.setAttribute("cy", ctx.H - p.y);
    if (t) { t.setAttribute("x", p.x); t.setAttribute("y", ctx.H - p.y + ctx.fs * 0.35); }
    g.querySelectorAll(".tx").forEach(e => { const ox = +e.dataset.ox, oy = +e.dataset.oy; if (e.tagName === "g") { e.setAttribute("transform", `translate(${p.x + ox} ${ctx.H - p.y + oy})`); } else if (e.tagName === "circle") { e.setAttribute("cx", p.x + ox); e.setAttribute("cy", ctx.H - p.y + oy); } else { e.setAttribute("x", p.x + ox); e.setAttribute("y", ctx.H - p.y + oy); } });
  }
  function onUp(e) {
    if (draw) { drawUp(e); return; }
    const rel = () => { try { svg.releasePointerCapture(e.pointerId); } catch (_) {} };
    if (paintDrag) { paintDrag = false; rel(); cb.onPaintEnd && cb.onPaintEnd(); return; }
    if (northDrag) { northDrag = false; rel(); cb.onNorthDone && cb.onNorthDone(); return; }
    if (objDrag) { const d = objDrag; objDrag = null; rel(); if (d.moved) cb.onObjDone && cb.onObjDone(d.oi); return; }
    if (drag) { const d = drag; drag = null; rel(); if (d.moved) cb.onMoved && cb.onMoved(d.idx); }
  }
  function onDbl(e) { if (draw) drawDbl(e); else if (ctx && ctx.pathDraw) cb.onPathFinish && cb.onPathFinish(); }

  // --------------- objects ---------------
  function drawObject(o, i, parent, Y) {
    const G = window.Geo, d = G.OBJ[o.t]; if (!d) return;
    const g = el("g", { class: "ob" + (window.Geo.pip(ctx.bed.poly, o.x, o.y) ? "" : " out"), "data-oi": i }, parent);
    el("title", {}, g, d.label);
    const cx = o.x, cy = Y(o.y), r = o.w / 2;
    const polyStr = pts => pts.map(q => `${q[0].toFixed(3)},${Y(q[1]).toFixed(3)}`).join(" ");
    if (o.t === "path" && o.pts) {
      const dstr = "M" + G.pathPts(o).map(q => `${q[0].toFixed(3)},${Y(q[1]).toFixed(3)}`).join("L"), cap = { fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" };
      el("path", Object.assign({ d: dstr, stroke: "#AFA28A", "stroke-width": o.w }, cap), g);
      el("path", Object.assign({ d: dstr, stroke: "url(#gravel)", "stroke-width": Math.max(0.1, o.w - 0.14) }, cap), g);
    } else if (o.t === "path") {
      el("polygon", { points: polyStr(G.objOutline(o)), fill: "url(#gravel)", stroke: "#AFA28A", "stroke-width": 0.06, "stroke-linejoin": "round" }, g);
    } else if (o.t === "stone") {
      el("circle", { cx, cy, r, fill: "#BDB8AC", stroke: "#8F8A7E", "stroke-width": 0.05 }, g);
      el("circle", { cx: cx - r * 0.22, cy: cy - r * 0.22, r: r * 0.45, fill: "#CDC9BF" }, g);
    } else if (o.t === "stump") {
      el("circle", { cx, cy, r, fill: "#A27A55", stroke: "#6E4F33", "stroke-width": 0.07 }, g);
      [0.68, 0.38].forEach(k => el("circle", { cx, cy, r: r * k, fill: "none", stroke: "#7E5B3C", "stroke-width": 0.035 }, g));
    } else if (o.t === "rock") {
      el("polygon", { points: polyStr(G.objOutline(o, 24)), fill: "#A19D93", stroke: "#6F6B62", "stroke-width": 0.06, "stroke-linejoin": "round" }, g);
      el("polygon", { points: polyStr(G.objOutline({ t: "rock", x: o.x - o.w * 0.1, y: o.y + o.h * 0.1, w: o.w * 0.5, h: o.h * 0.45, rot: o.rot }, 16)), fill: "#B4B0A6" }, g);
    } else if (o.t === "birdbath") {
      el("circle", { cx, cy, r, fill: "#D4CFC4", stroke: "#8F8A7E", "stroke-width": 0.06 }, g);
      el("circle", { cx, cy, r: r * 0.72, fill: "#A9D0E3", stroke: "#8DB6CB", "stroke-width": 0.03 }, g);
    } else if (o.t === "shrub") {
      el("circle", { cx, cy, r, fill: "#557A47", stroke: "#3C5A32", "stroke-width": 0.07 }, g);
      for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2 + 0.4; el("circle", { cx: cx + Math.cos(a) * r * 0.52, cy: cy + Math.sin(a) * r * 0.52, r: r * 0.34, fill: "#628A52" }, g); }
      el("circle", { cx, cy, r: r * 0.3, fill: "#6A9459" }, g);
    } else if (o.t === "tree") {
      const tr = G.trunkR(o);
      el("circle", { cx, cy, r: tr, fill: "#7A5636", stroke: "#5A3E26", "stroke-width": 0.07 }, g);
      [0.62, 0.3].forEach(k => el("circle", { cx, cy, r: tr * k, fill: "none", stroke: "#5A3E26", "stroke-width": 0.03 }, g));
    }
    return g;
  }
  function objSelection(o, i, parent, Y, fs) {
    const G = window.Geo, d = G.OBJ[o.t], cx = o.x, cy = Y(o.y), rot = (o.rot || 0) * Math.PI / 180, c = Math.cos(rot), s = Math.sin(rot);
    const lp = (lx, ly) => [o.x + lx * c - ly * s, Y(o.y + lx * s + ly * c)];
    const top = el("g", { class: "obsel" }, parent);
    if (o.pts) return pathSelection(o, i, top, Y, fs);
    if (d.shape === "circ") el("circle", { cx, cy, r: o.w / 2 + 0.08, fill: "none", stroke: "#2E3A2C", "stroke-width": 0.06, "stroke-dasharray": "0.25 0.15", "pointer-events": "none" }, top);
    else el("polygon", { points: G.objOutline(o, 28).map(q => `${q[0]},${Y(q[1])}`).join(" "), fill: "none", stroke: "#2E3A2C", "stroke-width": 0.06, "stroke-dasharray": "0.25 0.15", "pointer-events": "none" }, top);
    const hr = Math.max(0.18, fs * 0.42);
    const handle = (x, y, h, fill) => el("circle", { class: "obh", "data-oi": i, "data-h": h, cx: x, cy: y, r: hr, fill: fill || "#fff", stroke: "#2E3A2C", "stroke-width": hr * 0.22 }, top);
    if (d.shape === "circ") handle(cx + o.w / 2, cy, "d");
    else {
      const [wx, wy] = lp(o.w / 2, 0), [hx, hy] = lp(0, o.h / 2), off = Math.max(0.8, fs * 2), [rx, ry] = lp(0, o.h / 2 + off);
      el("line", { x1: hx, y1: hy, x2: rx, y2: ry, stroke: "#2E3A2C", "stroke-width": 0.04, "pointer-events": "none" }, top);
      handle(wx, wy, "w"); handle(hx, hy, "h"); handle(rx, ry, "rot", "#E58A00");
    }
    // name tag above the object
    const size = d.shape === "circ" ? `${fmt(o.w)} ft` : `${fmt(o.w)} × ${fmt(o.h)} ft`;
    const txt = d.label + " · " + size, fsz = fs * 0.9, w = txt.length * fsz * 0.56 + fsz * 1.4, h = fsz * 1.8;
    const ext = d.shape === "circ" ? o.w / 2 : Math.max(o.w, o.h) / 2;
    let tx = Math.max(w / 2, Math.min(ctx.bed.bb.w - w / 2, cx)), ty = cy - ext - h * 0.6 - fsz * 0.3;
    if (ty - h / 2 < -ctx.oy * 0.9) ty = cy + ext + h * 0.6 + fsz * 0.3;
    const lg = el("g", { class: "sellab", "pointer-events": "none" }, top);
    el("rect", { x: tx - w / 2, y: ty - h / 2, width: w, height: h, rx: h / 2, fill: "#4b5244", stroke: "#fff", "stroke-width": 0.06 }, lg);
    el("text", { x: tx, y: ty + fsz * 0.34, "font-size": fsz, fill: "#fff", "text-anchor": "middle", "font-weight": 700, "font-family": "sans-serif" }, lg, txt);
  }
  const fmt = v => (Math.round(v * 4) / 4).toString();
  function pathSelection(o, i, top, Y, fs) {
    const G = window.Geo, sm = G.pathPts(o), hr = Math.max(0.18, fs * 0.42);
    el("path", { d: "M" + sm.map(q => `${q[0].toFixed(3)},${Y(q[1]).toFixed(3)}`).join("L"), fill: "none", stroke: "#2E3A2C", "stroke-width": 0.05, "stroke-dasharray": "0.25 0.15", "pointer-events": "none" }, top);
    const handle = (x, y, h, fill) => el("circle", { class: "obh", "data-oi": i, "data-h": h, cx: x, cy: y, r: hr, fill: fill || "#fff", stroke: "#2E3A2C", "stroke-width": hr * 0.22 }, top);
    o.pts.forEach((q, k) => handle(q[0], Y(q[1]), "p" + k));
    // width dot: out to the side of the middle of the path
    const m = Math.floor(sm.length / 2), a = sm[Math.max(0, m - 1)], b = sm[Math.min(sm.length - 1, m + 1)], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
    handle(sm[m][0] + nx * o.w / 2, Y(sm[m][1] + ny * o.w / 2), "pw", "#E58A00");
    const len = sm.reduce((s, q, k) => s + (k ? Math.hypot(q[0] - sm[k - 1][0], q[1] - sm[k - 1][1]) : 0), 0);
    const txt = `Path · ${fmt(o.w)} ft wide · ${Math.round(len)} ft long`, fsz = fs * 0.9, w = txt.length * fsz * 0.56 + fsz * 1.4, h = fsz * 1.8;
    const top0 = Math.max(...sm.map(q => q[1])) + o.w / 2;
    let tx = Math.max(w / 2, Math.min(ctx.bed.bb.w - w / 2, o.x)), ty = Y(top0) - h * 0.6 - fsz * 0.3;
    if (ty - h / 2 < -ctx.oy * 0.9) ty = Y(Math.min(...sm.map(q => q[1])) - o.w / 2) + h * 0.6 + fsz * 0.3;
    const lg = el("g", { class: "sellab", "pointer-events": "none" }, top);
    el("rect", { x: tx - w / 2, y: ty - h / 2, width: w, height: h, rx: h / 2, fill: "#4b5244", stroke: "#fff", "stroke-width": 0.06 }, lg);
    el("text", { x: tx, y: ty + fsz * 0.34, "font-size": fsz, fill: "#fff", "text-anchor": "middle", "font-weight": 700, "font-family": "sans-serif" }, lg, txt);
  }
  // the path being drawn: clicked points, the curve through them, and a rubber band to the pointer
  function drawPathPreview(root, Y, fs) {
    const P = ctx.pathDraw.pts, G = window.Geo, w = ctx.pathDraw.w;
    const pv = el("g", { "pointer-events": "none" }, root);
    if (P.length >= 2) {
      const sm = G.pathPts({ pts: P }), dstr = "M" + sm.map(q => `${q[0].toFixed(3)},${Y(q[1]).toFixed(3)}`).join("L");
      el("path", { d: dstr, fill: "none", stroke: "#AFA28A", "stroke-opacity": 0.75, "stroke-width": w, "stroke-linecap": "round", "stroke-linejoin": "round" }, pv);
    }
    P.forEach((q, k) => el("circle", { cx: q[0], cy: Y(q[1]), r: Math.max(0.14, fs * 0.34), fill: k === P.length - 1 ? "#E58A00" : "#fff", stroke: "#2E3A2C", "stroke-width": 0.05 }, pv));
    rubberEl = el("line", { x1: 0, y1: 0, x2: 0, y2: 0, stroke: "#2E3A2C", "stroke-width": 0.06, "stroke-dasharray": "0.2 0.12", visibility: "hidden" }, pv);
  }

  // --------------- main render ---------------
  function render(c) {
    ctx = c;
    if (draw) return renderDraw();
    const { bed, placements, byId, view, selIdx, hoverId } = c, selAll = c.selAll || (selIdx >= 0 ? [selIdx] : []);
    const objects = c.objects || [], sun = c.sun, lightBad = new Set(c.lightBad || []);
    const bb = bed.bb, fs = Math.max(0.26, Math.max(bb.w, bb.h) / 46);
    // legend items (badges in use, then sun zones) wrap onto extra rows when the bed is narrow
    const used = new Set(); placements.forEach(p => badgeKinds(byId[p.id]).forEach(k => used.add(k)));
    const lgItems = [["nat", "Michigan native"], ["gar", "Garden favorite"], ["daisy", "Daisy family"], ["deer", "Deer eat it"], ["tox", "Toxic plant"]].filter(x => used.has(x[0])).map(x => ({ k: x[0], t: x[1] }));
    if (sun && sun.show) ["full", "part", "shade"].forEach((z, i) => lgItems.push({ z, t: ZONE_LAB[z], br: i === 0 && lgItems.length > 0 }));
    const lbr = fs * 0.4, itemW = it => lbr * 1.5 + it.t.length * fs * 0.5 + fs * 0.9;
    let rows = 0; { let lx = lbr; if (lgItems.length) rows = 1; lgItems.forEach(it => { if (lx > lbr && (it.br || lx + itemW(it) > bb.w + fs * 2)) { rows++; lx = lbr; } lx += itemW(it); }); }
    const mL = fs * 4.2, mR = fs * 1.6, mT = fs * 3.2, mB = fs * (5.7 + Math.max(1, rows) * 1.25);
    c.H = bb.h; c.ox = mL; c.oy = mT; c.fs = fs;
    svg.setAttribute("viewBox", `0 0 ${(bb.w + mL + mR).toFixed(2)} ${(bb.h + mT + mB).toFixed(2)}`);
    svg.style.maxHeight = "640px";
    svg.innerHTML = ""; brushEl = null;
    const root = el("g", { transform: `translate(${mL.toFixed(2)} ${mT.toFixed(2)})` }, svg);
    { // north arrow (compass), draggable — sized and positioned so the needle tip and "N" label
      // never travel past the svg's top/left edge (which the plan-wrap container clips) at any rotation
      const r = Math.min(mL, mT) * 0.3, cx = Math.max(mL * 0.5, r * 1.3), cy = Math.max(mT * 0.62, r * 1.3);
      const ang = c.north || 0, rad = ang * Math.PI / 180;
      northCenter = { x: cx, y: cy };
      const cg = el("g", { class: "compass" }, svg);
      el("circle", { cx, cy, r, fill: "#fff", stroke: "#8E7660", "stroke-width": r * 0.1 }, cg);
      const tipx = cx + Math.sin(rad) * r * 0.78, tipy = cy - Math.cos(rad) * r * 0.78;
      const bx1 = cx + Math.sin(rad + 2.6) * r * 0.42, by1 = cy - Math.cos(rad + 2.6) * r * 0.42;
      const bx2 = cx + Math.sin(rad - 2.6) * r * 0.42, by2 = cy - Math.cos(rad - 2.6) * r * 0.42;
      el("polygon", { points: `${tipx},${tipy} ${bx1},${by1} ${cx},${cy} ${bx2},${by2}`, fill: "#4b5244" }, cg);
      el("text", { x: tipx, y: tipy, "font-size": r * 0.5, fill: "#4b5244", "text-anchor": "middle", "font-weight": 800, "font-family": "sans-serif", dy: ang > 90 && ang < 270 ? r * 0.5 : -r * 0.2 }, cg, "N");
      el("circle", { class: "north-hit", cx, cy, r: r * 1.3, fill: "transparent", cursor: "grab" }, cg);
    }
    const Y = y => bb.h - y;
    const defs = el("defs", {}, svg);
    { const pat = el("pattern", { id: "gravel", patternUnits: "userSpaceOnUse", width: 0.6, height: 0.6 }, defs);
      el("rect", { x: 0, y: 0, width: 0.6, height: 0.6, fill: "#D9D0BE" }, pat);
      [[0.1, 0.12, 0.05], [0.38, 0.22, 0.04], [0.22, 0.45, 0.05], [0.5, 0.5, 0.035]].forEach(([x, y, r]) => el("circle", { cx: x, cy: y, r, fill: "#BFB39C" }, pat)); }
    // photo patterns (only the plants in the bed)
    if (view === "photos") {
      const seen = {};
      placements.forEach(p => {
        if (seen[p.id] || !window.PHOTOS[p.id]) return; seen[p.id] = 1;
        const pat = el("pattern", { id: "ph-" + p.id, patternUnits: "objectBoundingBox", patternContentUnits: "objectBoundingBox", width: 1, height: 1 }, defs);
        el("image", { href: window.PHOTOS[p.id], x: 0, y: 0, width: 1, height: 1, preserveAspectRatio: "xMidYMid slice" }, pat);
      });
    }
    const poly = bed.poly.map(q => `${q[0].toFixed(3)},${Y(q[1]).toFixed(3)}`).join(" ");
    const clip = el("clipPath", { id: "bedclip" }, defs); el("polygon", { points: poly }, clip);
    el("polygon", { points: poly, fill: "#8E7660", stroke: "#8E7660", "stroke-width": fs * 0.9, "stroke-linejoin": "round" }, root);
    el("polygon", { points: poly, fill: SOIL }, root);
    // sun zones: the whole bed in its starting light, then the painted cells (runs of the same zone merged per row)
    if (sun && sun.show) {
      const zg = el("g", { "clip-path": "url(#bedclip)", "pointer-events": "none" }, root), res = sun.res, cells = sun.cells || {};
      const nx = Math.ceil(bb.w / res), ny = Math.ceil(bb.h / res);
      for (let j = 0; j < ny; j++) {
        let i = 0;
        while (i < nx) {
          const v = cells[i + "," + j] || sun.base; let k = i + 1;
          while (k < nx && (cells[k + "," + j] || sun.base) === v) k++;
          if (v && ZONE[v]) el("rect", { x: i * res, y: Y((j + 1) * res) - 0.01, width: (k - i) * res + 0.01, height: res + 0.02, fill: ZONE[v] }, zg);
          i = k;
        }
      }
    }
    if (c.showGrid !== false) {
      const grid = el("g", { "clip-path": "url(#bedclip)", stroke: sun && sun.show ? "rgba(70,55,40,.28)" : "#BBA388", "stroke-width": 0.035, "pointer-events": "none" }, root);
      for (let x = 1; x < bb.w; x++) el("line", { x1: x, y1: 0, x2: x, y2: bb.h }, grid);
      for (let y = 1; y < bb.h; y++) el("line", { x1: 0, y1: Y(y), x2: bb.w, y2: Y(y) }, grid);
      el("text", { x: 0, y: bb.h + fs * 2.4, "font-size": fs * 0.78, fill: "#9A9480", "font-style": "italic", "font-family": "sans-serif" }, root, "Each grid square = 1 ft");
    }
    // axis labels
    const step = bb.w > 30 ? 5 : bb.w > 16 ? 2 : 1;
    for (let x = 0; x <= bb.w + 0.01; x += step) el("text", { x, y: bb.h + fs * 1.5, "font-size": fs * 0.85, fill: "#7A7F70", "text-anchor": "middle", "font-family": "sans-serif" }, root, x + " ft");
    const ystep = bb.h > 24 ? 5 : bb.h > 12 ? 2 : 1;
    for (let y = 0; y <= bb.h + 0.01; y += ystep) el("text", { x: -fs * 0.6, y: Y(y) + fs * 0.3, "font-size": fs * 0.85, fill: "#7A7F70", "text-anchor": "end", "font-family": "sans-serif" }, root, y + "");
    el("text", { x: bb.w / 2, y: bb.h + fs * 3.4, "font-size": fs * 0.9, fill: "#4b5244", "text-anchor": "middle", "font-weight": 700, "font-family": "sans-serif" }, root,
      bed.mode === "island" ? "ALL SIDES ARE THE FRONT · tall plants in the middle" : "FRONT EDGE (lawn / path side)");
    if (bed.mode !== "island") el("text", { x: bb.w, y: -fs * 0.9, "font-size": fs * 0.9, fill: "#4b5244", "text-anchor": "end", "font-weight": 700, "font-family": "sans-serif" }, root, "BACK (fence / house / trees)");

    // objects sit under the plants (plants may lean over a path or rock)
    const olayer = el("g", { class: "olayer" }, root);
    objects.forEach((o, i) => drawObject(o, i, olayer, Y));

    // overlaps: plants too close together, or sitting on an object
    const bad = new Set();
    for (let i = 0; i < placements.length; i++) {
      for (let j = i + 1; j < placements.length; j++) {
        const a = placements[i], b = placements[j];
        const mix2 = !!byId[a.id].dormant !== !!byId[b.id].dormant;   // an early-dormant plant tucked among later ones is fine
        const need = (sp(byId[a.id]) + sp(byId[b.id])) / 2 * (mix2 ? 0.2 : 0.72);
        if (Math.hypot(a.x - b.x, a.y - b.y) < need) { bad.add(i); bad.add(j); }
      }
      if (objects.length && window.Geo.objHit(objects, placements[i].x, placements[i].y, sp(byId[placements[i].id]) / 2, 0.5)) bad.add(i);
    }
    ctx.badCount = bad.size;
    const order = placements.map((p, i) => i).sort((a, b) => sp(byId[placements[b].id]) - sp(byId[placements[a].id]));
    selAll.forEach(si => { const k = order.indexOf(si); if (k >= 0) { order.splice(k, 1); order.push(si); } });
    const layer = el("g", { class: "player" }, root);
    order.forEach(i => {
      const p = placements[i], pl = byId[p.id], r = sp(pl) / 2 * 0.96;
      const cls = ["pl"]; if (bad.has(i)) cls.push("bad"); else if (lightBad.has(i)) cls.push("wl"); if (selAll.includes(i)) cls.push("sel");
      if (hoverId && !selAll.includes(i)) cls.push(hoverId === p.id ? "hl" : "dim");
      const g = el("g", { class: cls.join(" "), "data-idx": i, "data-id": p.id }, layer);
      const fill = view === "photos" && window.PHOTOS[p.id] ? `url(#ph-${p.id})` : pl.hex;
      const pcEl = el("circle", { class: "pc", cx: p.x, cy: Y(p.y), r, fill }, g);
      if (selAll.includes(i)) { pcEl.setAttribute("style", `stroke:${HLC[hlKind(pl)]};stroke-width:.12`); }
      if (view !== "photos") el("text", { x: p.x, y: Y(p.y) + fs * 0.35, "font-size": Math.min(fs * 1.05, r * 0.95), fill: pl.txt }, g, pl.code);
      const kinds = badgeKinds(pl), br = Math.min(fs * 0.46, Math.max(r * 0.3, fs * 0.24)), step2 = br * 1.85;
      kinds.forEach((k, bi) => { const ox = (bi - (kinds.length - 1) / 2) * step2, oy = -r * 0.86; drawBadge(k, g, br, "tx", ox, oy, p.x + ox, Y(p.y) + oy); });
      if (p.lock) {
        const lr = Math.min(fs * 0.4, Math.max(r * 0.26, fs * 0.2)), ox = r * 0.72, oy = r * 0.72;
        const lg = el("g", { class: "tx", "data-ox": ox, "data-oy": oy, transform: `translate(${p.x + ox} ${Y(p.y) + oy})` }, g);
        el("circle", { cx: 0, cy: 0, r: lr, fill: "#5A5240", stroke: "#fff", "stroke-width": lr * 0.16 }, lg);
        const s = lr * 0.85 / 12;
        el("path", { d: "M3 6V4a3 3 0 1 1 6 0v2M2 6h8v5H2z", fill: "none", stroke: "#fff", "stroke-width": 1.4, "stroke-linejoin": "round", transform: `translate(${-lr * 0.5} ${-lr * 0.5}) scale(${s})` }, lg);
      }
    });
    // tree canopies float over the plants (see-through, not clickable)
    const canopy = el("g", { "pointer-events": "none", "clip-path": "url(#bedclip)" }, root);
    objects.forEach(o => { if (o.t === "tree") el("circle", { cx: o.x, cy: Y(o.y), r: o.w / 2, fill: "#2F5A2A", "fill-opacity": 0.1, stroke: "#2F5A2A", "stroke-width": 0.06, "stroke-dasharray": "0.35 0.2" }, canopy); });
    // spotlight: the selected plant gets a name tag above it while the others fade back
    svg.classList.toggle("hasSel", selAll.length > 0);
    if (selAll.length === 1 && placements[selAll[0]]) {
      const p = placements[selAll[0]], pl = byId[p.id], r = sp(pl) / 2 * 0.96;
      const txt = pl.name + (pl.native ? "" : " ◆") + (pl.fam === "daisy" ? " ✿" : ""), fsz = fs * 0.95, w = txt.length * fsz * 0.6 + fsz * 1.4, h = fsz * 1.9;
      let cx = Math.max(w / 2, Math.min(bb.w - w / 2, p.x)), cy = Y(p.y) - r - h * 0.5 - fsz * 0.45;
      if (cy - h / 2 < -mT * 0.9) cy = Y(p.y) + r + h * 0.5 + fsz * 0.45;
      const lg = el("g", { class: "sellab", "pointer-events": "none" }, root);
      el("rect", { x: cx - w / 2, y: cy - h / 2, width: w, height: h, rx: h / 2, fill: HLT[hlKind(pl)], stroke: "#fff", "stroke-width": 0.06 }, lg);
      el("text", { x: cx, y: cy + fsz * 0.34, "font-size": fsz, fill: "#fff", "text-anchor": "middle", "font-weight": 700, "font-family": "sans-serif" }, lg, txt);
    }
    rubberEl = null;
    if (c.pathDraw) drawPathPreview(root, Y, fs);
    if (c.objSel >= 0 && objects[c.objSel]) objSelection(objects[c.objSel], c.objSel, root, Y, fs);
    // legend
    if (lgItems.length) {
      const lgd = el("g", { "pointer-events": "none" }, root); root.insertBefore(lgd, olayer);
      let lx = lbr, ly = bb.h + fs * 5.7;
      lgItems.forEach(it => {
        if (lx > lbr && (it.br || lx + itemW(it) > bb.w + fs * 2)) { lx = lbr; ly += fs * 1.25; }
        if (it.k) drawBadge(it.k, lgd, lbr, "lgb", 0, 0, lx, ly);
        else el("rect", { x: lx - lbr, y: ly - lbr, width: lbr * 2, height: lbr * 2, rx: lbr * 0.3, fill: ZONE[it.z], stroke: "#8E7660", "stroke-width": lbr * 0.12 }, lgd);
        el("text", { x: lx + lbr * 1.5, y: ly + fs * 0.3, "font-size": fs * 0.8, fill: it.k === "tox" ? "#B8392E" : "#4b5244", "font-weight": 700, "font-family": "sans-serif" }, lgd, it.t);
        lx += itemW(it);
      });
    }
    // paint brush outline
    if (c.paint) { brushEl = el("circle", { class: "brushc", cx: -99, cy: -99, r: Math.max(0.25, c.paint.size / 2), fill: "none", stroke: "#2E3A2C", "stroke-width": 0.06, "stroke-dasharray": "0.15 0.1", "pointer-events": "none", visibility: "hidden" }, root); }
    svg.classList.toggle("placing", !!(c.armed || c.objArmed));
    svg.classList.toggle("painting", !!c.paint);
    svg.classList.remove("drawing");
    removeDrawUI();
  }

  // --------------- outline tool: click corners, close the shape, then drag, add or remove corners ---------------
  const SIZES = [[24, 14], [36, 20], [60, 34], [90, 50]];
  function chaikin(pts, it) {
    let p = pts;
    for (let k = 0; k < it; k++) {
      const q = [];
      for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
      p = q;
    }
    return p.map(q => [Math.round(q[0] * 100) / 100, Math.round(q[1] * 100) / 100]);
  }
  function startDraw(callbacks, opts) {
    opts = opts || {};
    draw = { pts: [], closed: false, cur: null, W: 36, H: 20, drag: -1, smooth: !!opts.smooth, hist: [], done: callbacks.onDone, cancel: callbacks.onCancel };
    if (opts.pts && opts.pts.length >= 3) {
      const bb = window.Geo.bbox(opts.pts), need = [bb.w + 6, bb.h + 6], sz = SIZES.find(s => s[0] >= need[0] && s[1] >= need[1]) || [Math.ceil(need[0]), Math.ceil(need[1])];
      draw.W = sz[0]; draw.H = sz[1];
      draw.pts = opts.pts.map(q => [Math.round((q[0] - bb.x0 + 3) * 2) / 2, Math.round((q[1] - bb.y0 + 3) * 2) / 2]);
      draw.closed = true;
    }
    ctx = ctx || {};
    makeDrawUI();
    renderDraw();
  }
  const snapv = v => Math.round(v * 2) / 2;
  function drawCoords(e) {
    const q = svgPt(e);
    return { x: Math.max(0, Math.min(draw.W, snapv(q.x - 2))), y: Math.max(0, Math.min(draw.H, snapv(draw.H - (q.y - 1.2)))) };
  }
  // hold Shift for straight lines: snap the new corner to 45-degree steps from the last one
  function straighten(p, e) {
    const last = draw.pts[draw.pts.length - 1];
    if (!e.shiftKey || !last || draw.closed) return p;
    const dx = p.x - last[0], dy = p.y - last[1], len = Math.hypot(dx, dy), a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    return { x: Math.max(0, Math.min(draw.W, snapv(last[0] + Math.cos(a) * len))), y: Math.max(0, Math.min(draw.H, snapv(last[1] + Math.sin(a) * len))) };
  }
  const remember = () => { draw.hist.push({ pts: draw.pts.map(q => q.slice()), closed: draw.closed }); if (draw.hist.length > 60) draw.hist.shift(); };
  function drawDown(e) {
    const t = e.target, k = draw.W / 36;
    if (t.classList.contains("dv")) {
      const i = +t.dataset.i;
      if (e.button === 2) { if (draw.closed && draw.pts.length > 3) { remember(); draw.pts.splice(i, 1); renderDraw(); } e.preventDefault(); return; }
      if (!draw.closed && i === 0 && draw.pts.length >= 3) { remember(); draw.closed = true; renderDraw(); return; }
      remember(); draw.drag = i; svg.setPointerCapture(e.pointerId); e.preventDefault(); return;
    }
    if (t.classList.contains("dm")) {
      const i = +t.dataset.i, a = draw.pts[i], b = draw.pts[(i + 1) % draw.pts.length];
      remember(); draw.pts.splice(i + 1, 0, [snapv((a[0] + b[0]) / 2), snapv((a[1] + b[1]) / 2)]); draw.drag = i + 1;
      svg.setPointerCapture(e.pointerId); renderDraw(); e.preventDefault(); return;
    }
    if (draw.closed || e.button !== 0) return;
    const p = straighten(drawCoords(e), e);
    if (draw.pts.length >= 3 && Math.hypot(p.x - draw.pts[0][0], p.y - draw.pts[0][1]) < 0.9 * k) { remember(); draw.closed = true; renderDraw(); return; }
    const last = draw.pts[draw.pts.length - 1];
    if (last && last[0] === p.x && last[1] === p.y) return;
    remember(); draw.pts.push([p.x, p.y]); renderDraw();
  }
  function drawMove(e) {
    if (draw.drag >= 0) { const p = drawCoords(e); draw.pts[draw.drag] = [p.x, p.y]; renderDraw(); return; }
    draw.cur = draw.closed ? null : straighten(drawCoords(e), e); renderDraw();
  }
  function drawUp(e) { if (draw.drag >= 0) { draw.drag = -1; try { svg.releasePointerCapture(e.pointerId); } catch (_) {} renderDraw(); } }
  function drawDbl(e) {
    const t = e.target;
    if (t.classList.contains("dv") && draw.closed) { if (draw.pts.length > 3) { remember(); draw.pts.splice(+t.dataset.i, 1); renderDraw(); } return; }
    if (!draw.closed && draw.pts.length >= 3) { draw.closed = true; renderDraw(); }
  }
  function finalPoly() { return draw.smooth ? chaikin(draw.pts, 3) : draw.pts.map(q => q.slice()); }
  function finishDraw() {
    if (!draw || draw.pts.length < 3) { if (ui) ui.msg.textContent = "Click at least 3 corners first."; return; }
    const out = { pts: draw.pts.map(q => q.slice()), poly: finalPoly(), smooth: draw.smooth }, done = draw.done;
    draw = null; removeDrawUI(); svg.classList.remove("drawing");
    done && done(out);
  }
  function cancelDraw() { const c = draw && draw.cancel; draw = null; removeDrawUI(); svg.classList.remove("drawing"); c && c(); }
  function undoDraw() { if (!draw) return; const h = draw.hist.pop(); if (h) { draw.pts = h.pts; draw.closed = h.closed; } else if (!draw.closed) draw.pts.pop(); renderDraw(); }
  function clearDraw() { if (!draw) return; remember(); draw.pts = []; draw.closed = false; renderDraw(); }
  function renderDraw() {
    svg.classList.add("drawing");
    const W = draw.W, H = draw.H, k = W / 36;
    svg.setAttribute("viewBox", `0 0 ${W + 3 * k} ${H + 3.2 * k}`);
    svg.innerHTML = "";
    const root = el("g", { transform: `translate(${2 * k} ${1.2 * k})` }, svg);
    const ruleStep = W > 60 ? 10 : 5;
    el("rect", { x: 0, y: 0, width: W, height: H, fill: "#FBFAF4", stroke: "#DDD7C4", "stroke-width": 0.08 * k }, root);
    for (let x = 0; x <= W; x++) el("line", { x1: x, y1: 0, x2: x, y2: H, stroke: x % 5 === 0 ? "#D9D2BA" : "#EEE9D8", "stroke-width": (x % 5 === 0 ? 0.06 : 0.035) * k }, root);
    for (let y = 0; y <= H; y++) el("line", { x1: 0, y1: y, x2: W, y2: y, stroke: y % 5 === 0 ? "#D9D2BA" : "#EEE9D8", "stroke-width": (y % 5 === 0 ? 0.06 : 0.035) * k }, root);
    for (let x = 0; x <= W; x += ruleStep) el("text", { x, y: H + 1.1 * k, "font-size": 0.7 * k, fill: "#7A7F70", "text-anchor": "middle", "font-family": "sans-serif" }, root, x + " ft");
    for (let y = 0; y <= H; y += ruleStep) el("text", { x: -0.3 * k, y: H - y + 0.25 * k, "font-size": 0.7 * k, fill: "#7A7F70", "text-anchor": "end", "font-family": "sans-serif" }, root, y + "");
    const Yd = q => [q[0], H - q[1]];
    const pts = draw.pts.map(Yd);
    if (draw.closed) {
      const shape = finalPoly().map(Yd);
      el("polygon", { points: shape.map(q => q.join(",")).join(" "), fill: "rgba(166,140,114,.45)", stroke: "#3F6B3A", "stroke-width": 0.14 * k, "stroke-linejoin": "round" }, root);
      if (draw.smooth) el("polygon", { points: pts.map(q => q.join(",")).join(" "), fill: "none", stroke: "#3F6B3A", "stroke-width": 0.05 * k, "stroke-dasharray": `${0.25 * k} ${0.18 * k}` }, root);
    } else {
      const all = draw.cur ? pts.concat([Yd([draw.cur.x, draw.cur.y])]) : pts;
      if (pts.length >= 3) el("polygon", { points: pts.map(q => q.join(",")).join(" "), fill: "rgba(166,140,114,.3)", stroke: "none" }, root);
      if (all.length > 1) el("polyline", { points: all.map(q => q.join(",")).join(" "), fill: "none", stroke: "#3F6B3A", "stroke-width": 0.14 * k, "stroke-linejoin": "round" }, root);
    }
    // side lengths
    const ring = draw.closed ? pts.concat([pts[0]]) : (draw.cur ? pts.concat([Yd([draw.cur.x, draw.cur.y])]) : pts);
    for (let i = 1; i < ring.length; i++) {
      const a = ring[i - 1], b = ring[i], len = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (len > 0.9 * k) el("text", { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 - 0.3 * k, "font-size": 0.62 * k, fill: "#3F6B3A", "text-anchor": "middle", "font-family": "sans-serif", "font-weight": 700, "pointer-events": "none" }, root, len.toFixed(1) + " ft");
    }
    // midpoint + handles (closed shape only): click one to add a corner there
    if (draw.closed) pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1.2 * k) return;
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, r = 0.26 * k;
      el("circle", { class: "dm", "data-i": i, cx: mx, cy: my, r, fill: "#fff", stroke: "#3F6B3A", "stroke-width": 0.05 * k, cursor: "copy" }, root);
      el("path", { d: `M${mx - r * 0.55} ${my}H${mx + r * 0.55}M${mx} ${my - r * 0.55}V${my + r * 0.55}`, stroke: "#3F6B3A", "stroke-width": 0.06 * k, "pointer-events": "none" }, root);
    });
    pts.forEach((q, i) => {
      const first = i === 0 && !draw.closed;
      el("circle", { class: "dv", "data-i": i, cx: q[0], cy: q[1], r: (first ? 0.36 : draw.closed ? 0.3 : 0.22) * k, fill: first ? "#E58A00" : "#3F6B3A", stroke: "#fff", "stroke-width": 0.06 * k, cursor: draw.closed ? "move" : first && pts.length >= 3 ? "pointer" : "move" }, root);
    });
    if (ui) {
      let m;
      if (draw.closed) {
        const fp = finalPoly(), bb = window.Geo.bbox(fp), A = window.Geo.area(fp);
        m = `About ${bb.w.toFixed(1)} × ${bb.h.toFixed(1)} ft, ${Math.round(A)} sq ft. Drag a dot to reshape, click a + to add a corner, double-click a dot to remove it. Then Save shape.`;
      } else m = pts.length < 3 ? "Click to place corners (they snap to the half foot). Hold Shift for straight lines." : "Keep clicking corners, then click the orange start point (or double-click) to close the shape.";
      ui.msg.textContent = m;
      ui.save.disabled = draw.pts.length < 3;
      ui.smooth.checked = draw.smooth;
      ui.size.value = draw.W + "x" + draw.H;
    }
  }
  function makeDrawUI() {
    removeDrawUI();
    const bar = document.createElement("div"); bar.className = "drawbar";
    const mk = (t, f, cls) => { const b = document.createElement("button"); b.type = "button"; b.className = "btn small " + (cls || ""); b.textContent = t; b.onclick = f; return b; };
    const msg = document.createElement("span"); msg.className = "tip";
    const save = mk("Save shape", finishDraw, "primary");
    const sm = document.createElement("label"); sm.className = "gridtoggle"; sm.innerHTML = '<input type="checkbox"> Smooth curves'; const smooth = sm.querySelector("input");
    smooth.onchange = () => { draw.smooth = smooth.checked; renderDraw(); };
    const size = document.createElement("select"); size.title = "Drawing area";
    SIZES.forEach(s => { const o = document.createElement("option"); o.value = s[0] + "x" + s[1]; o.textContent = `Area ${s[0]} × ${s[1]} ft`; size.appendChild(o); });
    size.onchange = () => { const [w, h] = size.value.split("x").map(Number); draw.W = w; draw.H = h; draw.pts = draw.pts.map(q => [Math.min(w, q[0]), Math.min(h, q[1])]); renderDraw(); };
    bar.append(save, mk("Undo", undoDraw), mk("Clear", clearDraw), mk("Cancel", cancelDraw), sm, size, msg);
    wrap.appendChild(bar); ui = { bar, msg, save, smooth, size };
    if (!SIZES.some(s => s[0] === draw.W && s[1] === draw.H)) { const o = document.createElement("option"); o.value = draw.W + "x" + draw.H; o.textContent = `Area ${draw.W} × ${draw.H} ft`; size.appendChild(o); }
  }
  function removeDrawUI() { if (ui) { ui.bar.remove(); ui = null; } }

  function setHover(id) {
    if (!svg) return;
    svg.querySelectorAll(".pl").forEach(g => { g.classList.toggle("hl", !!id && g.dataset.id === id); g.classList.toggle("dim", !!id && g.dataset.id !== id && !g.classList.contains("sel")); });
  }
  window.Plan = { init, render, startDraw, setHover, isDrawing: () => !!draw, ZONE, ZONE_LAB };
})();
