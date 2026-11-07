// Interactive bed plan: SVG drawing, dragging, placing, objects, sun zones, and the outline drawing tool.
(function () {
  const NS = "http://www.w3.org/2000/svg";
  let svg, wrap, cb = {}, ctx = null, drag = null, draw = null, ui = null;
  let objDrag = null, paintDrag = false, brushEl = null, rubberEl = null, curDefs = null, ctxEat = 0;
  const sp = p => p.spacing / 12;
  const LEAFD = "M10.6 1.4C5.2 1.2 1.6 3.9 1.7 8c0 .9.3 1.7.7 2.3.5-2.6 2.3-4.6 4.9-5.8-2.1 1.5-3.6 3.4-4.2 6 .5.2 1.1.3 1.7.3 4 0 6-3.4 5.8-9.4z";
  const DEERD = "M6 11V6.2M6 6.2 3.2 2M4.3 3.7 2 4.2M6 6.2 8.8 2M7.7 3.7 10 4.2";
  const BAD = { nat: ["#E1EBCB", "#3F6B3A"], gar: ["#F3DDEA", "#8A3F72"], daisy: ["#FBEBC4", "#8A6410"], deer: ["#EFE2D3", "#7A5230"], tox: ["#B8392E", "#FFFFFF"], cold: ["#4F7FB4", "#FFFFFF"] };
  const HLC = { tox: "#B8392E", deer: "#7A5230", daisy: "#C99A1E", nat: "#5E8F4A", gar: "#B8629B" };
  const HLT = { tox: "#B8392E", deer: "#7A5230", daisy: "#8A6410", nat: "#3F6B3A", gar: "#8A3F72" };
  const deerEats = p => p.deer === "C" || p.deer === "D";
  const badgeKinds = pl => { const k = [pl.native ? "nat" : "gar"]; if (pl.fam === "daisy") k.push("daisy"); if (deerEats(pl)) k.push("deer"); if (pl.toxic && pl.toxic.length) k.push("tox"); if (window.isTender && window.isTender(pl)) k.push("cold"); return k; };
  const hlKind = pl => pl.toxic && pl.toxic.length ? "tox" : deerEats(pl) ? "deer" : pl.fam === "daisy" ? "daisy" : pl.native ? "nat" : "gar";

  // sun-zone colors: match the per-plant sun-badge icon colors, so the painted zones and the badges read as the same system
  const SOIL = "#A68C72";
  const VIEWC = "#4E8C3A";   // the green of the rim along the sides the bed is seen from
  const ZONE = { full: "#F2C40C", part: "#B5A153", shade: "#6E6E6E" };
  const ZONE_LAB = { full: "Full sun", part: "Part shade", shade: "Shade" };
  // How much direct sun each light level means. One wording, shared with app.js (tooltips, timeline,
  // paint buttons) and pdf.js (legend, plant cards), so every place says the same thing.
  const ZONE_HRS = { full: "6+ hrs", part: "3–6 hrs", shade: "under 3 hrs" };
  const ZONE_TIP = { full: "Full sun: 6 or more hours of direct sun a day", part: "Part shade: 3 to 6 hours of direct sun a day", shade: "Shade: little or no direct sun, under 3 hours a day" };
  // a plant's light range, in hours of direct sun a day
  // width of a plant code in ems (bold capitals are wider than small letters), so up to 4 letters always fit the circle
  function codeEm(c) { let w = 0; for (const ch of String(c || "")) w += /[A-Z]/.test(ch) ? (/[MW]/.test(ch) ? 0.9 : 0.74) : (/[mw]/.test(ch) ? 0.84 : 0.58); return Math.max(w, 1.3); }
  function sunNeed(p) {
    const k = ["full", "part", "shade"].filter(z => p && p.sun && p.sun.includes(z)).join(",");
    // shade plants lead with the shade, so "up to 6 hours" never reads as "needs 6 hours of sun"
    return ({ full: "Needs 6 or more hours of direct sun a day", part: "Needs 3 to 6 hours of direct sun a day", shade: "Does best with little or no direct sun, under 3 hours a day",
      "full,part": "Needs at least 3 hours of direct sun a day", "part,shade": "Grows in shade, or with up to 6 hours of direct sun a day",
      "full,part,shade": "Grows in any light, from shade to full sun" })[k] || "";
  }
  const sunTip = p => [p.light, sunNeed(p)].filter(Boolean).join("\n");

  function drawBadge(k, parent, br, cls, ox, oy, x, y) {
    const g = el("g", { class: cls + " bdg", "data-ox": ox, "data-oy": oy, transform: `translate(${x} ${y})` }, parent), c = BAD[k];
    el("circle", { cx: 0, cy: 0, r: br, fill: c[0], stroke: "#fff", "stroke-width": br * 0.16 }, g);
    const s = br * 1.25 / 12;
    if (k === "nat") el("path", { d: LEAFD, fill: c[1], transform: `translate(${-br * 0.62} ${-br * 0.62}) scale(${s})` }, g);
    else if (k === "deer") el("path", { d: DEERD, fill: "none", stroke: c[1], "stroke-width": 1.5, "stroke-linecap": "round", transform: `translate(${-br * 0.62} ${-br * 0.62}) scale(${s})` }, g);
    else if (k === "cold") [0, 60, 120].forEach(a => el("line", { x1: 0, y1: -br * 0.62, x2: 0, y2: br * 0.62, stroke: c[1], "stroke-width": br * 0.17, "stroke-linecap": "round", transform: `rotate(${a})` }, g));
    else el("text", { x: 0, y: br * 0.36, "font-size": br * (k === "gar" ? 1.05 : k === "tox" ? 1.4 : 1.25), fill: c[1], "text-anchor": "middle", "font-weight": 800, "font-family": "sans-serif" }, g, k === "gar" ? "◆" : k === "daisy" ? "✿" : "!");
    return g;
  }

  // sun-needs badge: same colors as the plant-list icon, blended left-to-right when a plant spans more
  // than one light level. Drawn alone above each plant, leading the way the icon leads everywhere else.
  const SUNCOL = { full: "#F2C40C", part: "#B5A153", shade: "#6E6E6E" };
  const sunCats = pl => ["full", "part", "shade"].filter(k => pl.sun && pl.sun.includes(k));
  function sunFill(pl) {
    const cats = sunCats(pl);
    if (cats.length <= 1) return SUNCOL[cats[0] || "part"];
    const id = "sungrad-" + cats.join("-");
    if (curDefs && !curDefs.querySelector("#" + id)) {
      const grad = el("linearGradient", { id, x1: "0%", y1: "0%", x2: "100%", y2: "0%" }, curDefs);
      cats.forEach((k, i) => el("stop", { offset: (i / (cats.length - 1) * 100) + "%", "stop-color": SUNCOL[k] }, grad));
    }
    return curDefs ? `url(#${id})` : SUNCOL[cats[0]];
  }
  function drawSunBadge(pl, parent, br, cls, ox, oy, x, y) {
    const g = el("g", { class: cls + " bdg sunb", "data-ox": ox, "data-oy": oy, "data-k": "sun", "data-tip": sunTip(pl), transform: `translate(${x} ${y})` }, parent);
    el("circle", { cx: 0, cy: 0, r: br, fill: sunFill(pl), stroke: "#fff", "stroke-width": br * 0.16 }, g);
    const s = br / 6, sw = br * 0.22;
    el("circle", { cx: 0, cy: 0, r: 2.5 * s, fill: "#fff" }, g);
    [[0, -5.2, 0, -3.6], [0, 3.6, 0, 5.2], [-5.2, 0, -3.6, 0], [3.6, 0, 5.2, 0],
     [-3.7, -3.7, -2.6, -2.6], [2.6, 2.6, 3.7, 3.7], [-3.7, 3.7, -2.6, 2.6], [2.6, -2.6, 3.7, -3.7]]
      .forEach(([x1, y1, x2, y2]) => el("line", { x1: x1 * s, y1: y1 * s, x2: x2 * s, y2: y2 * s, stroke: "#fff", "stroke-width": sw, "stroke-linecap": "round" }, g));
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

  // --------------- zoom and pan ---------------
  // The plan's full picture is "base" (in viewBox units). The view shows 1/z of it, centered at fx, fy
  // (fractions of the base). Dragging empty space pans; Ctrl + scroll, a trackpad pinch or the buttons zoom.
  let base = null, view = { z: 1, fx: 0.5, fy: 0.5 }, mainView = null, pan = null, zbar = null, zhint = null, hintT = 0;
  const ZMAX = 8;
  function viewRect() {
    const z = view.z, vw = base.w / z, vh = base.h / z, sl = z > 1.001 ? 0.25 : 0;   // a little slack so the edges can be pulled into view
    const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const cx = cl(view.fx * base.w, vw / 2 - sl * vw, base.w - vw / 2 + sl * vw), cy = cl(view.fy * base.h, vh / 2 - sl * vh, base.h - vh / 2 + sl * vh);
    view.fx = cx / base.w; view.fy = cy / base.h;
    return { x: cx - vw / 2, y: cy - vh / 2, w: vw, h: vh, cx, cy };
  }
  function applyView() {
    if (!base) return;
    const r = viewRect();
    svg.setAttribute("viewBox", `${r.x.toFixed(3)} ${r.y.toFixed(3)} ${r.w.toFixed(3)} ${r.h.toFixed(3)}`);
    if (zbar) { zbar.querySelector(".zpct").textContent = Math.round(view.z * 100) + "%"; zbar.querySelector(".zout").disabled = view.z <= 1.001; zbar.querySelector(".zin").disabled = view.z >= ZMAX - 0.001;
      zbar.querySelector(".zfit").disabled = view.z <= 1.001 && Math.abs(view.fx - 0.5) < 0.001 && Math.abs(view.fy - 0.5) < 0.001; }
  }
  // zoom by a factor, keeping the point under (clientX, clientY) still (or the middle of the view)
  function zoomBy(f, clientX, clientY) {
    if (!base) return;
    const r = viewRect(), nz = Math.max(1, Math.min(ZMAX, view.z * f)); if (nz === view.z) return;
    let px = r.cx, py = r.cy;
    if (clientX != null) { const q = svgPt({ clientX, clientY }); px = q.x; py = q.y; }
    const relx = (px - r.x) / r.w, rely = (py - r.y) / r.h, nw = base.w / nz, nh = base.h / nz;
    view.z = nz; view.fx = (px - relx * nw + nw / 2) / base.w; view.fy = (py - rely * nh + nh / 2) / base.h;
    applyView(); cb.onView && cb.onView();
  }
  function resetView() { view = { z: 1, fx: 0.5, fy: 0.5 }; applyView(); cb && cb.onView && cb.onView(); }
  function zoomHint() {
    if (!zhint) return;
    zhint.classList.add("on"); clearTimeout(hintT); hintT = setTimeout(() => zhint.classList.remove("on"), 1400);
  }
  function makeZoomBar() {
    zbar = document.createElement("div"); zbar.className = "zoombar";
    zbar.innerHTML = '<button type="button" class="zout" title="Zoom out">−</button><span class="zpct">100%</span><button type="button" class="zin" title="Zoom in (or Ctrl + scroll)">+</button><button type="button" class="zfit" title="Show the whole bed">Fit</button>';
    zbar.querySelector(".zin").onclick = () => zoomBy(1.4);
    zbar.querySelector(".zout").onclick = () => zoomBy(1 / 1.4);
    zbar.querySelector(".zfit").onclick = resetView;
    zhint = document.createElement("div"); zhint.className = "zoomhint"; zhint.textContent = TOUCH ? "Pinch with two fingers to zoom." : "Hold Ctrl and scroll to zoom. Once zoomed in, drag an empty spot to move around.";
    wrap.append(zbar, zhint);
    svg.addEventListener("wheel", e => {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomBy(Math.exp(-e.deltaY * 0.0025), e.clientX, e.clientY); }
      else zoomHint();
    }, { passive: false });
  }

  function init(svgEl, callbacks) {
    svg = svgEl; wrap = svg.parentElement; cb = callbacks; makeZoomBar();
    svg.addEventListener("pointerdown", tDown);
    svg.addEventListener("pointermove", tMove);
    svg.addEventListener("pointerup", tUp);
    svg.addEventListener("pointercancel", tUp);
    svg.addEventListener("dblclick", onDbl);
    svg.addEventListener("pointerover", e => { if (draw || (ctx && ctx.paint)) return; const g = near(e, ".pl"); cb.onHover && cb.onHover(g ? g.dataset.id : null); });
    svg.addEventListener("pointerleave", () => { cb.onHover && cb.onHover(null); if (brushEl) brushEl.setAttribute("visibility", "hidden"); });
    svg.addEventListener("contextmenu", e => { if (draw || near(e, ".pl") || near(e, ".ob")) e.preventDefault(); });
    // Our own menu opens on the right-button press. Near the window edge it gets nudged to fit and lands
    // under the pointer, so the browser's menu event that follows fires on our menu instead of the plant.
    // Swallow that follow-up event wherever it lands.
    window.addEventListener("contextmenu", e => {
      if (ctxEat && Date.now() - ctxEat < 1500) { e.preventDefault(); ctxEat = 0; }
      else if (e.target && e.target.closest && e.target.closest(".ctxmenu")) e.preventDefault();
    }, true);
    window.addEventListener("keydown", e => {
      if (!draw) return;
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); finishDraw(); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cancelDraw(); }
      else if (e.key === "Backspace" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z")) { e.preventDefault(); e.stopPropagation(); undoDraw(); }
    }, true);
  }

  // --------------- touch: press and hold = right-click, two fingers = zoom and move around ---------------
  // Mouse and pen go straight to onDown/onMove/onUp. A finger does too, but holding it still for half a
  // second turns the press into a right-click (the same menus), and a second finger turns the gesture into
  // a pinch that zooms around the fingers and follows them as they move.
  // a phone or tablet: no mouse to hover or right-click with, so the wording changes too
  const TOUCH = !!(window.matchMedia && window.matchMedia("(hover: none) and (pointer: coarse)").matches);
  let clickEat = 0;
  window.addEventListener("click", e => { if (clickEat && Date.now() - clickEat < 1500) { e.preventDefault(); e.stopPropagation(); clickEat = 0; } }, true);
  const fingers = new Map(); let hold = null, pinch = null, afterPinch = false;
  const HOLD_MS = 520;
  function quietGesture() {   // drop whatever the first finger started, without treating it as a click
    if (draw) {
      if (draw.drag >= 0) { if (!draw.dragMoved) draw.hist.pop(); draw.drag = -1; }
      if (draw.move) { if (!draw.move.moved) draw.hist.pop(); draw.move = null; svg.classList.remove("movingshape"); }
      pan = null; renderDraw(); return;
    }
    if (pan) { pan = null; svg.classList.remove("panning"); }
    if (drag) { const d = drag; drag = null; zonesOff(); if (d.moved) cb.onMoved && cb.onMoved(d.idx); }
    if (objDrag) { const d = objDrag; objDrag = null; if (d.moved) cb.onObjDone && cb.onObjDone(d.oi); }
    if (paintDrag) { paintDrag = false; cb.onPaintEnd && cb.onPaintEnd(); }
  }
  function fakeRight(h) {
    return { button: 2, buttons: 2, target: h.target, clientX: h.x, clientY: h.y, pointerId: h.id, pointerType: "touch", ctrlKey: false, metaKey: false, shiftKey: false, preventDefault() {}, stopPropagation() {} };
  }
  function tDown(e) {
    if (e.pointerType !== "touch") { onDown(e); return; }
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.size === 2) {
      if (hold) { clearTimeout(hold.t); hold = null; }
      quietGesture();
      const [a, b] = [...fingers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      e.preventDefault(); return;
    }
    if (fingers.size > 2 || pinch) return;
    afterPinch = false;
    onDown(e);
    const busy = ctx && (ctx.paint || ctx.pathDraw || ctx.objArmed || ctx.armed);
    if (!busy) hold = { id: e.pointerId, x: e.clientX, y: e.clientY, target: e.target, t: setTimeout(() => {
      const h = hold; hold = null; if (!h) return;
      quietGesture(); try { svg.releasePointerCapture(h.id); } catch (_) {}
      if (navigator.vibrate) try { navigator.vibrate(12); } catch (_) {}
      onDown(fakeRight(h));
      clickEat = Date.now();   // lifting the finger sends a click that would close the menu again
      afterPinch = true;   // the rest of this touch does nothing more (the menu is open)
    }, HOLD_MS) };
  }
  function tMove(e) {
    if (e.pointerType !== "touch") { onMove(e); return; }
    const f = fingers.get(e.pointerId); if (!f) return;
    f.x = e.clientX; f.y = e.clientY;
    if (hold && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 10) { clearTimeout(hold.t); hold = null; }
    if (pinch && fingers.size >= 2) {
      const [a, b] = [...fingers.values()], d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (base) {
        zoomBy(d / pinch.d, mx, my);
        const m = svg.getScreenCTM(); view.fx -= (mx - pinch.mx) / m.a / base.w; view.fy -= (my - pinch.my) / m.d / base.h; applyView();
        if (draw) renderDraw();
      }
      pinch.d = d; pinch.mx = mx; pinch.my = my; e.preventDefault(); return;
    }
    if (afterPinch) return;
    onMove(e);
  }
  function tUp(e) {
    if (e.pointerType !== "touch") { onUp(e); return; }
    fingers.delete(e.pointerId);
    if (hold) { clearTimeout(hold.t); hold = null; }
    if (pinch) { if (fingers.size < 2) { pinch = null; afterPinch = true; cb.onView && cb.onView(); } return; }
    if (afterPinch) { if (!fingers.size) afterPinch = false; return; }
    onUp(e);
  }

  function onDown(e) {
    if (!ctx) return;
    if (e.button === 2 && (draw || near(e, ".pl") || near(e, ".ob"))) ctxEat = Date.now();
    if (draw) { drawDown(e); return; }
    const pt = toBed(e);
    if (ctx.paint) {
      if (e.button !== 0) return;
      paintDrag = true; svg.setPointerCapture(e.pointerId); e.preventDefault();
      cb.onPaintStart && cb.onPaintStart(); cb.onPaint && cb.onPaint(pt.x, pt.y); return;
    }
    if (ctx.pathDraw) { if (e.button === 0) cb.onPathPoint && cb.onPathPoint(pt.x, pt.y); e.preventDefault(); return; }
    if (ctx.objArmed) { if (e.button === 0) cb.onObjPlace && cb.onObjPlace(pt.x, pt.y); e.preventDefault(); return; }
    const h = near(e, ".obh");
    if (h) { objDrag = { oi: +h.dataset.oi, h: h.dataset.h, moved: false, sx: e.clientX, sy: e.clientY }; cb.onObjEditStart && cb.onObjEditStart(); svg.setPointerCapture(e.pointerId); e.preventDefault(); return; }
    const g = near(e, ".pl");
    if (g && e.button === 2) { cb.onSelect && cb.onSelect(+g.dataset.idx, false); cb.onContextMenu && cb.onContextMenu(+g.dataset.idx, e.clientX, e.clientY); e.preventDefault(); return; }
    if (g) {
      const idx = +g.dataset.idx, p = ctx.placements[idx], add = e.ctrlKey || e.metaKey || e.shiftKey || !!(cb.isMulti && cb.isMulti());
      const wasOnly = !add && !!(cb.isOnlySelected && cb.isOnlySelected(idx));   // a second click on the selected plant lets it go
      cb.onSelect && cb.onSelect(idx, add);
      drag = { idx, dx: p.x - pt.x, dy: p.y - pt.y, moved: false, g: svg.querySelector(`.pl[data-idx="${idx}"]`) || g, sx: e.clientX, sy: e.clientY, wasOnly };
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
    // right-click an empty spot inside the bed: add a plant or object right there
    if (e.button === 2) {
      if (window.Geo.pip(ctx.bed.poly, pt.x, pt.y)) { ctxEat = Date.now(); cb.onSpotMenu && cb.onSpotMenu(pt.x, pt.y, e.clientX, e.clientY); e.preventDefault(); }
      return;
    }
    if (ctx.armed) { cb.onPlace && cb.onPlace(pt.x, pt.y); return; }
    if (e.button === 0) { const r = viewRect(); pan = { sx: e.clientX, sy: e.clientY, cx: r.cx, cy: r.cy, moved: false, add: e.ctrlKey || e.metaKey || e.shiftKey || !!(cb.isMulti && cb.isMulti()) }; svg.setPointerCapture(e.pointerId); e.preventDefault(); }
  }
  function onMove(e) {
    if (draw) { drawMove(e); return; }
    if (!ctx) return;
    if (pan) {
      if (view.z <= 1.001) return;   // at 100% the plan stays put; zoom in to move around
      if (!pan.moved && Math.hypot(e.clientX - pan.sx, e.clientY - pan.sy) < 4) return;
      if (!pan.moved) { pan.moved = true; svg.classList.add("panning"); cb.onPanStart && cb.onPanStart(); }
      const m = svg.getScreenCTM();
      view.fx = (pan.cx - (e.clientX - pan.sx) / m.a) / base.w; view.fy = (pan.cy - (e.clientY - pan.sy) / m.d) / base.h;
      applyView(); return;
    }
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
    if (!drag.moved) { cb.onDragStart && cb.onDragStart(drag.idx); zonesFor(drag.idx); }
    drag.moved = true; svg.querySelectorAll(".sellab").forEach(e => { e.style.display = "none"; });
    const pt = toBed(e), p = ctx.placements[drag.idx];
    let nx = pt.x + drag.dx, ny = pt.y + drag.dy;
    if (window.Geo.pip(ctx.bed.poly, nx, ny)) { p.x = nx; p.y = ny; }
    else {
      // slide along the edge: try each axis on its own
      if (window.Geo.pip(ctx.bed.poly, nx, p.y)) p.x = nx; else if (window.Geo.pip(ctx.bed.poly, p.x, ny)) p.y = ny;
    }
    movePl(drag.idx, drag.g);
    // neighbors slide aside to make room while you drag, and slide back once the plant moves on
    const ch = cb.onDragPush ? cb.onDragPush(drag.idx) : [];
    ch.forEach(i => { if (i !== drag.idx) movePl(i); });
  }
  // redraw one plant at its current spot (the dragged one, or a neighbor that was pushed aside)
  function movePl(idx, fallback) {
    const p = ctx.placements[idx], g = svg.querySelector(`.pl[data-idx="${idx}"]`) || fallback; if (!p || !g) return;
    const c = g.querySelector("circle.pc"), t = g.querySelector("text:not(.tx)");
    if (c) { c.setAttribute("cx", p.x); c.setAttribute("cy", ctx.H - p.y); }
    if (t) { t.setAttribute("x", p.x); t.setAttribute("y", ctx.H - p.y + ctx.fs * 0.35); }
    g.querySelectorAll(".tx").forEach(e => { const ox = +e.dataset.ox, oy = +e.dataset.oy; if (e.tagName === "g") { e.setAttribute("transform", `translate(${p.x + ox} ${ctx.H - p.y + oy})`); } else if (e.tagName === "circle") { e.setAttribute("cx", p.x + ox); e.setAttribute("cy", ctx.H - p.y + oy); } else { e.setAttribute("x", p.x + ox); e.setAttribute("y", ctx.H - p.y + oy); } });
  }
  // while a plant is dragged, the painted sun zones that suit it stay bright and the others fade
  function zonesFor(idx) { const pl = ctx.byId[ctx.placements[idx].id]; if (pl) zonesForSun(pl.sun); }
  function zonesForSun(sun) {
    const zs = svg.querySelectorAll(".zlayer .ztip"); if (!zs.length) return;
    zs.forEach(g => g.classList.toggle("zok", !!(sun && sun.includes(g.dataset.z))));
    svg.classList.add("zdrag");
  }
  // for dropping a plant dragged in from the Plants list: a point on the screen in bed feet, and how many screen
  // pixels one foot takes at the current zoom
  function clientToBed(cx, cy) { return toBed({ clientX: cx, clientY: cy }); }
  function pxPerFt() { const m = svg.getScreenCTM(); return m ? Math.hypot(m.a, m.b) : 30; }
  function zonesOff() { svg.classList.remove("zdrag"); }
  function onUp(e) {
    if (draw) { drawUp(e); return; }
    const rel = () => { try { svg.releasePointerCapture(e.pointerId); } catch (_) {} };
    if (paintDrag) { paintDrag = false; rel(); cb.onPaintEnd && cb.onPaintEnd(); return; }
    if (pan) {   // a click (no drag) on empty space clears the selection; a drag moved the view
      const p = pan; pan = null; rel(); svg.classList.remove("panning");
      if (p.moved) cb.onView && cb.onView(); else if (!p.add) cb.onSelect && cb.onSelect(-1);
      return;
    }
    if (objDrag) { const d = objDrag; objDrag = null; rel(); if (d.moved) cb.onObjDone && cb.onObjDone(d.oi); return; }
    if (drag) { const d = drag; drag = null; rel(); zonesOff(); if (d.moved) cb.onMoved && cb.onMoved(d.idx); else if (d.wasOnly) cb.onSelect && cb.onSelect(-1); }
  }
  function onDbl(e) { if (draw) drawDbl(e); else if (ctx && ctx.pathDraw) cb.onPathFinish && cb.onPathFinish(); }

  // --------------- objects ---------------
  // the round-shrub graphic, seen from above: a dark clump, 7 lighter lobes in a ring, and a bright center.
  // The hedge reuses the same rosette (see Geo.hedgeLayout) so the two read as the same plant.
  function shrubBlob(cx, cy, r, parent) {
    el("circle", { cx, cy, r, fill: "#557A47", stroke: "#3C5A32", "stroke-width": 0.07 }, parent);
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2 + 0.4; el("circle", { cx: cx + Math.cos(a) * r * 0.52, cy: cy + Math.sin(a) * r * 0.52, r: r * 0.34, fill: "#628A52" }, parent); }
    el("circle", { cx, cy, r: r * 0.3, fill: "#6A9459" }, parent);
  }
  // a footprint (sole and heel) at screen point x, y, pointing along angle deg (0 = up the screen), len feet long
  function footprint(parent, x, y, deg, len, left) {
    const g = el("g", { transform: `translate(${x.toFixed(3)} ${y.toFixed(3)}) rotate(${deg.toFixed(1)}) scale(${left ? -1 : 1} 1)` }, parent), L = len;
    el("ellipse", { cx: L * 0.03, cy: -L * 0.06, rx: L * 0.17, ry: L * 0.24 }, g);   // ball of the foot
    el("ellipse", { cx: 0, cy: L * 0.3, rx: L * 0.13, ry: L * 0.16 }, g);            // heel
    [[-0.13, -0.38, 0.075], [-0.03, -0.43, 0.06], [0.06, -0.42, 0.052], [0.13, -0.37, 0.046], [0.18, -0.3, 0.04]].forEach(t => el("circle", { cx: L * t[0], cy: L * t[1], r: L * t[2] }, g));   // toes
  }
  // footprints walking along a path: left, right, left... down the middle of it
  function pathFootprints(o, parent, Y) {
    const G = window.Geo, P = G.pathPts(o).map(q => [q[0], Y(q[1])]); if (P.length < 2) return;
    const fg = el("g", { class: "feet", fill: "#5F5747", opacity: 0.55, "pointer-events": "none" }, parent);
    const len = Math.min(0.75, o.w * 0.34), stride = len * 1.55, side = Math.min(o.w * 0.16, len * 0.42);
    let acc = stride / 2, n = 0;
    for (let i = 0; i + 1 < P.length; i++) {
      const a = P[i], b = P[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], segL = Math.hypot(dx, dy); if (!segL) continue;
      while (acc <= segL) {
        const t = acc / segL, x = a[0] + dx * t, y = a[1] + dy * t, nx = -dy / segL, ny = dx / segL, left = n % 2 === 0, off = left ? -side : side;
        footprint(fg, x + nx * off, y + ny * off, Math.atan2(dy, dx) * 180 / Math.PI + 90, len, left);
        acc += stride; n++;
      }
      acc -= segL;
    }
  }
  function drawObject(o, i, parent, Y) {
    const G = window.Geo, d = G.OBJ[o.t]; if (!d) return;
    const g = el("g", { class: "ob" + (window.Geo.pip(ctx.bed.poly, o.x, o.y) ? "" : " out"), "data-oi": i }, parent);
    el("title", {}, g, d.label);
    const cx = o.x, cy = Y(o.y), r = o.w / 2;
    const polyStr = pts => pts.map(q => `${q[0].toFixed(3)},${Y(q[1]).toFixed(3)}`).join(" ");
    if (o.t === "path" && o.pts) {
      const dstr = "M" + G.pathPts(o).map(q => `${q[0].toFixed(3)},${Y(q[1]).toFixed(3)}`).join("L"), cap = { fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" };
      if (o.view !== false) el("path", Object.assign({ class: "pathview ztip", "data-k": "view", "data-tip": "People walk and look here: short plants beside the path, taller farther away", d: dstr, stroke: VIEWC, "stroke-width": o.w + 0.3 }, cap), g);
      el("path", Object.assign({ d: dstr, stroke: "#AFA28A", "stroke-width": o.w }, cap), g);
      el("path", Object.assign({ d: dstr, stroke: "url(#gravel)", "stroke-width": Math.max(0.1, o.w - 0.14) }, cap), g);
      pathFootprints(o, g, Y);
    } else if (o.t === "path") {
      const pa = { points: polyStr(G.objOutline(o)), fill: "url(#gravel)", stroke: "#AFA28A", "stroke-width": 0.06, "stroke-linejoin": "round" };
      if (o.view !== false) Object.assign(pa, { class: "pathview ztip", "data-k": "view", "data-tip": "People walk and look here: short plants beside the path, taller farther away", stroke: VIEWC, "stroke-width": 0.15 });
      el("polygon", pa, g);
      { const t = (o.rot || 0) * Math.PI / 180, hx = -Math.sin(t) * o.h / 2, hy = Math.cos(t) * o.h / 2;   // footprints down its length
        pathFootprints({ w: o.w, pts: [[o.x - hx, o.y - hy], [o.x + hx, o.y + hy]] }, g, Y); }
    } else if (o.t === "stone") {
      el("circle", { cx, cy, r, fill: "#BDB8AC", stroke: "#8F8A7E", "stroke-width": 0.05 }, g);
      el("circle", { cx: cx - r * 0.22, cy: cy - r * 0.22, r: r * 0.45, fill: "#CDC9BF" }, g);
      { const fg = el("g", { class: "feet", fill: "#5F5747", opacity: 0.5, "pointer-events": "none" }, g); footprint(fg, cx, cy, -20, r * 1.05, i % 2 === 0); }   // a step on each stone
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
      shrubBlob(cx, cy, r, g);
    } else if (o.t === "hedge") {
      // several round shrubs grown together: one soft-cornered clump with a single outline, and inside it a row
      // of the round shrub's rosettes (lobe ring + bright center) overlapping like neighboring plants
      const rot = (o.rot || 0) * Math.PI / 180, cr = Math.cos(rot), sr = Math.sin(rot);
      const toScreen = (lx, ly) => [o.x + lx * cr - ly * sr, Y(o.y + lx * sr + ly * cr)];
      const L = G.hedgeLayout(o.w / 2, o.h / 2);
      el("polygon", { points: L.outline.map(p => { const q = toScreen(p[0], p[1]); return q[0].toFixed(3) + "," + q[1].toFixed(3); }).join(" "), fill: "#557A47", stroke: "#3C5A32", "stroke-width": 0.07, "stroke-linejoin": "round" }, g);
      L.lobes.forEach(p => { const q = toScreen(p[0], p[1]); el("circle", { cx: q[0], cy: q[1], r: L.lobeR, fill: "#628A52" }, g); });
      L.centers.forEach(p => { const q = toScreen(p[0], p[1]); el("circle", { cx: q[0], cy: q[1], r: L.centerR, fill: "#6A9459" }, g); });
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
    const lgItems = [["nat", "Michigan native"], ["gar", "Garden favorite"], ["daisy", "Daisy family"], ["deer", "Deer eat it"], ["tox", "Toxic plant"], ["cold", "Needs winter care"]].filter(x => used.has(x[0])).map(x => ({ k: x[0], t: x[1] }));
    if (sun && sun.show) ["full", "part", "shade"].forEach((z, i) => lgItems.push({ z, t: ZONE_LAB[z] + " (" + ZONE_HRS[z] + ")", br: i === 0 && lgItems.length > 0 }));
    if ((bed.views || []).some(v => v !== "c") || objects.some(o => o.t === "path" && o.view !== false)) lgItems.push({ v: true, t: "Seen from" });
    const lbr = fs * 0.4, itemW = it => lbr * 1.5 + it.t.length * fs * 0.5 + fs * 0.9;
    let rows = 0; { let lx = lbr; if (lgItems.length) rows = 1; lgItems.forEach(it => { if (lx > lbr && (it.br || lx + itemW(it) > bb.w + fs * 2)) { rows++; lx = lbr; } lx += itemW(it); }); }
    const mL = fs * 4.2, mR = fs * 1.6, mT = fs * 1.4, mB = fs * 2.4;   // the legend sits under the plan, outside the picture
    c.H = bb.h; c.ox = mL; c.oy = mT; c.fs = fs;
    base = { w: bb.w + mL + mR, h: bb.h + mT + mB }; applyView(); if (zbar) zbar.hidden = false;
    svg.style.maxHeight = "640px";
    svg.innerHTML = ""; brushEl = null;
    const root = el("g", { transform: `translate(${mL.toFixed(2)} ${mT.toFixed(2)})` }, svg);
    const Y = y => bb.h - y;
    const defs = el("defs", {}, svg); curDefs = defs;
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
    el("polygon", { class: "bedrim", points: poly, fill: "#8E7660", stroke: "#8E7660", "stroke-width": fs * 0.9, "stroke-linejoin": "round" }, root);
    // the sides people see the bed from: that part of the rim turns green (point at it for what it means)
    { const segs = window.Geo.viewEdges(bed);
      if (segs.length) el("path", { class: "bedrim viewedge ztip", "data-k": "view", "data-tip": "Seen from this side: short plants here, getting taller toward the back",
        d: segs.map(q => `M${q[0].toFixed(3)} ${Y(q[1]).toFixed(3)}L${q[2].toFixed(3)} ${Y(q[3]).toFixed(3)}`).join(""), fill: "none", stroke: VIEWC, "stroke-width": fs * 0.9, "stroke-linecap": "round", "pointer-events": "stroke" }, root); }
    el("polygon", { class: "soil", points: poly, fill: SOIL }, root);
    // sun zones: the whole bed in its starting light, then the painted cells (runs of the same zone merged per row)
    if (sun && sun.show) {
      const zg = el("g", { class: "zlayer", "clip-path": "url(#bedclip)" }, root), res = sun.res, cells = sun.cells || {}, zsub = {};
      const zgrp = v => zsub[v] || (zsub[v] = el("g", { class: "ztip", "data-z": v, "data-k": "sun", "data-tip": ZONE_TIP[v] }, zg));
      const nx = Math.ceil(bb.w / res), ny = Math.ceil(bb.h / res);
      for (let j = 0; j < ny; j++) {
        let i = 0;
        while (i < nx) {
          const v = cells[i + "," + j] || sun.base; let k = i + 1;
          while (k < nx && (cells[k + "," + j] || sun.base) === v) k++;
          if (v && ZONE[v]) el("rect", { x: i * res, y: Y((j + 1) * res) - 0.01, width: (k - i) * res + 0.01, height: res + 0.02, fill: ZONE[v] }, zgrp(v));
          i = k;
        }
      }
    }
    if (c.showGrid !== false) {
      const grid = el("g", { class: "glayer", "clip-path": "url(#bedclip)", stroke: sun && sun.show ? "rgba(70,55,40,.28)" : "#BBA388", "stroke-width": 0.035, "pointer-events": "none" }, root);
      for (let x = 1; x < bb.w; x++) el("line", { x1: x, y1: 0, x2: x, y2: bb.h }, grid);
      for (let y = 1; y < bb.h; y++) el("line", { x1: 0, y1: Y(y), x2: bb.w, y2: Y(y) }, grid);

    }
    // axis labels
    const step = bb.w > 30 ? 5 : bb.w > 16 ? 2 : 1;
    for (let x = 0; x <= bb.w + 0.01; x += step) el("text", { x, y: bb.h + fs * 1.5, "font-size": fs * 0.85, fill: "#7A7F70", "text-anchor": "middle", "font-family": "sans-serif" }, root, x + " ft");
    const ystep = bb.h > 24 ? 5 : bb.h > 12 ? 2 : 1;
    for (let y = 0; y <= bb.h + 0.01; y += ystep) el("text", { x: -fs * 0.6, y: Y(y) + fs * 0.3, "font-size": fs * 0.85, fill: "#7A7F70", "text-anchor": "end", "font-family": "sans-serif" }, root, y + "");

    // objects sit under the plants (plants may lean over a path or rock), and are only drawn inside the bed;
    // plants can spill over the edge, objects can't
    const olayer = el("g", { class: "olayer", "clip-path": "url(#bedclip)" }, root);
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
      if (view !== "photos") el("text", { x: p.x, y: Y(p.y) + fs * 0.35, "font-size": Math.min(fs * 1.05, r * 0.95, r * 1.7 / codeEm(pl.code)), fill: pl.txt }, g, pl.code);
      const kinds = badgeKinds(pl), br = Math.min(fs * 0.46, Math.max(r * 0.3, fs * 0.24)), step2 = br * 1.85;
      // sun needs alone above the circle; the other badges (native/favorite/daisy/deer/toxic) below it, same offset
      drawSunBadge(pl, g, br, "tx", 0, -r * 0.86, p.x, Y(p.y) - r * 0.86);
      kinds.forEach((k, bi) => { const ox = (bi - (kinds.length - 1) / 2) * step2, oy = r * 0.86; drawBadge(k, g, br, "tx", ox, oy, p.x + ox, Y(p.y) + oy); });
      if (p.lock) {
        // to the right at mid-height (same distance from center as before) so it clears the sun badge above and the badge row below
        const lr = Math.min(fs * 0.4, Math.max(r * 0.26, fs * 0.2)), ox = r * 1.02, oy = 0;
        const lg = el("g", { class: "tx", "data-ox": ox, "data-oy": oy, transform: `translate(${p.x + ox} ${Y(p.y) + oy})` }, g);
        el("circle", { cx: 0, cy: 0, r: lr, fill: "#5A5240", stroke: "#fff", "stroke-width": lr * 0.16 }, lg);
        const s = lr * 0.85 / 12;
        el("path", { d: "M3 6V4a3 3 0 1 1 6 0v2M2 6h8v5H2z", fill: "none", stroke: "#fff", "stroke-width": 1.4, "stroke-linejoin": "round", transform: `translate(${-lr * 0.5} ${-lr * 0.5}) scale(${s})` }, lg);
      }
    });
    // tree canopies float over the plants (see-through, not clickable)
    const canopy = el("g", { class: "clayer", "pointer-events": "none", "clip-path": "url(#bedclip)" }, root);
    objects.forEach(o => { if (o.t === "tree") el("circle", { cx: o.x, cy: Y(o.y), r: o.w / 2, fill: "#2F5A2A", "fill-opacity": 0.1, stroke: "#2F5A2A", "stroke-width": 0.06, "stroke-dasharray": "0.35 0.2" }, canopy); });
    // spotlight: the selected plant gets a name tag above it while the others fade back
    svg.classList.toggle("hasSel", selAll.length > 0);
    svg.classList.toggle("hasHover", !!(c.hoverId && !c.paint));
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
    // legend: a row of HTML under the plan (so the plan window holds just the bed), same badges and colors
    renderLegend(lgItems);
    // paint brush outline
    if (c.paint) { brushEl = el("circle", { class: "brushc", cx: -99, cy: -99, r: Math.max(0.25, c.paint.size / 2), fill: "none", stroke: "#2E3A2C", "stroke-width": 0.06, "stroke-dasharray": "0.15 0.1", "pointer-events": "none", visibility: "hidden" }, root); }
    svg.classList.toggle("placing", !!(c.armed || c.objArmed || c.pathDraw));
    svg.classList.toggle("painting", !!c.paint);
    svg.classList.remove("drawing");
    removeDrawUI();
  }

  // where the front and back are, in words, for the captions above and below the plan (and the PDF)
  const SIDE = { s: "bottom edge", n: "top edge", w: "left side", e: "right side", sw: "bottom left corner", se: "bottom right corner", nw: "top left corner", ne: "top right corner" };
  const OPP = { s: "n", n: "s", w: "e", e: "w", sw: "ne", ne: "sw", se: "nw", nw: "se" };
  const sidesList = vs => { const w = vs.map(v => SIDE[v]); return w.length < 3 ? w.join(" and ") : w.slice(0, -1).join(", ") + " and " + w[w.length - 1]; };
  function frontLabels(bed) {
    const vs = bed.views || [bed.front || (bed.mode === "island" ? "c" : "s")], f = vs[0];
    if (f === "c") return { bottom: "ALL SIDES ARE THE FRONT · tall plants in the middle", top: "" };
    if (vs.length > 1) return { bottom: "SEEN FROM THE " + sidesList(vs).toUpperCase() + " · short plants there, tallest farthest from them", top: "" };
    if (f === "s") return { bottom: "FRONT EDGE (lawn / path side)", top: "BACK (fence / house / trees)" };
    return { bottom: "FRONT: " + SIDE[f].toUpperCase() + " (lawn / path side) · short plants there, tall toward the " + SIDE[OPP[f]], top: "BACK: " + SIDE[OPP[f]].toUpperCase() + " (fence / house / trees)" };
  }
  // --------------- outline tool: click corners, close the shape, then drag, add or remove corners ---------------
  const SIZES = [[24, 14], [36, 20], [60, 34], [90, 50]];
  // Corner-cutting curve. sharp[i] keeps corner i as a crisp point (the edges on each side stay straight
  // into it), so one outline can mix curves with sharp corners, like a bed against a house.
  function chaikin(pts, it, sharp) {
    let p = pts.map((q, i) => ({ x: q[0], y: q[1], s: !!(sharp && sharp[i]) }));
    for (let k = 0; k < it; k++) {
      const q = [];
      for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length];
        if (a.s) q.push(a);
        q.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
      }
      p = q;
    }
    return p.map(q => [Math.round(q.x * 100) / 100, Math.round(q.y * 100) / 100]);
  }
  function startDraw(callbacks, opts) {
    opts = opts || {};
    mainView = view; view = { z: 1, fx: 0.5, fy: 0.5 };
    draw = { pts: [], sharp: [], closed: false, cur: null, W: 36, H: 20, drag: -1, smooth: !!opts.smooth, hist: [], done: callbacks.onDone, cancel: callbacks.onCancel };
    if (opts.pts && opts.pts.length >= 3) {
      const bb = window.Geo.bbox(opts.pts), need = [bb.w + 6, bb.h + 6], sz = SIZES.find(s => s[0] >= need[0] && s[1] >= need[1]) || [Math.ceil(need[0]), Math.ceil(need[1])];
      draw.W = sz[0]; draw.H = sz[1];
      draw.pts = opts.pts.map(q => [Math.round((q[0] - bb.x0 + 3) * 2) / 2, Math.round((q[1] - bb.y0 + 3) * 2) / 2]);
      draw.sharp = draw.pts.map((_, i) => opts.sharp && opts.sharp.length === draw.pts.length ? !!opts.sharp[i] : !opts.smooth);
      draw.closed = true;
    }
    ctx = ctx || {};
    makeDrawUI();
    renderDraw();
  }
  const snapv = v => Math.round(v * 2) / 2;
  function drawCoords(e) {
    const q = svgPt(e);
    const k = draw.W / 36;
    return { x: Math.max(0, Math.min(draw.W, snapv(q.x - 2 * k))), y: Math.max(0, Math.min(draw.H, snapv(draw.H - (q.y - 1.2 * k)))) };
  }
  // hold Shift for straight lines: snap the new corner to 45-degree steps from the last one
  function straighten(p, e) {
    const last = draw.pts[draw.pts.length - 1];
    if (!e.shiftKey || !last || draw.closed) return p;
    const dx = p.x - last[0], dy = p.y - last[1], len = Math.hypot(dx, dy), a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    return { x: Math.max(0, Math.min(draw.W, snapv(last[0] + Math.cos(a) * len))), y: Math.max(0, Math.min(draw.H, snapv(last[1] + Math.sin(a) * len))) };
  }
  const remember = () => { draw.hist.push({ pts: draw.pts.map(q => q.slice()), sharp: draw.sharp.slice(), closed: draw.closed }); if (draw.hist.length > 60) draw.hist.shift(); };
  // click a dot (without dragging) to switch it between a sharp corner and a curve
  function toggleCorner(i) { draw.sharp[i] = !draw.sharp[i]; }
  const anyCurve = () => draw.sharp.some(v => !v);
  function drawDown(e) {
    const t = e.target, k = draw.W / 36;
    if (t.classList.contains("dv")) {
      const i = +t.dataset.i;
      if (e.button === 2) { if (draw.closed && draw.pts.length > 3) { remember(); draw.pts.splice(i, 1); draw.sharp.splice(i, 1); renderDraw(); } e.preventDefault(); return; }
      if (!draw.closed && i === 0 && draw.pts.length >= 3) { remember(); draw.closed = true; renderDraw(); return; }
      remember(); draw.drag = i; draw.dragFrom = draw.pts[i].slice(); draw.dragMoved = false; svg.setPointerCapture(e.pointerId); e.preventDefault(); return;
    }
    if (t.classList.contains("dm")) {
      const i = +t.dataset.i, a = draw.pts[i], b = draw.pts[(i + 1) % draw.pts.length];
      remember(); draw.pts.splice(i + 1, 0, [snapv((a[0] + b[0]) / 2), snapv((a[1] + b[1]) / 2)]); draw.sharp.splice(i + 1, 0, !!draw.sharp[i]); draw.drag = i + 1; draw.dragMoved = true;
      svg.setPointerCapture(e.pointerId); renderDraw(); e.preventDefault(); return;
    }
    if (e.button !== 0) return;
    const p0 = drawCoords(e);
    if (draw.closed && window.Geo.pip(finalPoly(), p0.x, p0.y)) {   // inside the outline: move the whole shape
      remember(); draw.move = { from: p0, pts: draw.pts.map(q => q.slice()), moved: false };
      svg.setPointerCapture(e.pointerId); svg.classList.add("movingshape"); e.preventDefault(); return;
    }
    const r = viewRect();
    pan = { sx: e.clientX, sy: e.clientY, cx: r.cx, cy: r.cy, moved: false, click: draw.closed ? null : straighten(drawCoords(e), e) };
    svg.setPointerCapture(e.pointerId); e.preventDefault();
  }
  function addCorner(p) {
    const k = draw.W / 36;
    if (draw.pts.length >= 3 && Math.hypot(p.x - draw.pts[0][0], p.y - draw.pts[0][1]) < 0.9 * k) { remember(); draw.closed = true; renderDraw(); return; }
    const last = draw.pts[draw.pts.length - 1];
    if (last && last[0] === p.x && last[1] === p.y) return;
    remember(); draw.pts.push([p.x, p.y]); draw.sharp.push(true); renderDraw();
  }
  function drawMove(e) {
    if (draw.move) {
      const m = draw.move, p = drawCoords(e), xs = m.pts.map(q => q[0]), ys = m.pts.map(q => q[1]);
      const dx = Math.max(-Math.min(...xs), Math.min(draw.W - Math.max(...xs), p.x - m.from.x)), dy = Math.max(-Math.min(...ys), Math.min(draw.H - Math.max(...ys), p.y - m.from.y));
      if (dx || dy) m.moved = true;
      draw.pts = m.pts.map(q => [q[0] + dx, q[1] + dy]); renderDraw(); return;
    }
    if (pan) {
      if (view.z <= 1.001) return;   // at 100% the grid stays put
      if (!pan.moved && Math.hypot(e.clientX - pan.sx, e.clientY - pan.sy) < 4) return;
      if (!pan.moved) { pan.moved = true; svg.classList.add("panning"); draw.cur = null; }
      const m = svg.getScreenCTM();
      view.fx = (pan.cx - (e.clientX - pan.sx) / m.a) / base.w; view.fy = (pan.cy - (e.clientY - pan.sy) / m.d) / base.h;
      applyView(); return;
    }
    if (draw.drag >= 0) { const p = drawCoords(e); if (draw.dragFrom && (p.x !== draw.dragFrom[0] || p.y !== draw.dragFrom[1])) draw.dragMoved = true; if (draw.dragMoved) { draw.pts[draw.drag] = [p.x, p.y]; renderDraw(); } return; }
    draw.cur = draw.closed ? null : straighten(drawCoords(e), e); renderDraw();
  }
  function drawUp(e) {
    if (draw.move) { const m = draw.move; draw.move = null; try { svg.releasePointerCapture(e.pointerId); } catch (_) {} svg.classList.remove("movingshape"); if (!m.moved) draw.hist.pop(); renderDraw(); return; }
    if (pan) { const p = pan; pan = null; try { svg.releasePointerCapture(e.pointerId); } catch (_) {} svg.classList.remove("panning"); if (!p.moved && p.click) addCorner(p.click); return; }
    if (draw.drag >= 0) {
      const i = draw.drag; draw.drag = -1; try { svg.releasePointerCapture(e.pointerId); } catch (_) {}
      if (!draw.dragMoved && draw.closed) toggleCorner(i); else if (!draw.dragMoved) draw.hist.pop();
      renderDraw();
    }
  }
  function drawDbl(e) {
    const t = e.target;
    if (t.classList.contains("dv") && draw.closed) { if (draw.pts.length > 3) { const i = +t.dataset.i; remember(); draw.pts.splice(i, 1); draw.sharp.splice(i, 1); renderDraw(); } return; }
    if (!draw.closed && draw.pts.length >= 3) { draw.closed = true; renderDraw(); }
  }
  function finalPoly() { return anyCurve() ? chaikin(draw.pts, 3, draw.sharp) : draw.pts.map(q => q.slice()); }
  function finishDraw() {
    if (!draw || draw.pts.length < 3) { if (ui) ui.msg.textContent = "Click at least 3 corners first."; return false; }
    const out = { pts: draw.pts.map(q => q.slice()), poly: finalPoly(), smooth: anyCurve(), sharp: draw.sharp.slice() }, done = draw.done;
    draw = null; removeDrawUI(); svg.classList.remove("drawing"); view = mainView || { z: 1, fx: 0.5, fy: 0.5 };
    done && done(out);
    return true;
  }
  function cancelDraw() { if (draw) view = mainView || { z: 1, fx: 0.5, fy: 0.5 }; const c = draw && draw.cancel; draw = null; removeDrawUI(); svg.classList.remove("drawing"); c && c(); }
  function undoDraw() { if (!draw) return; const h = draw.hist.pop(); if (h) { draw.pts = h.pts; draw.sharp = h.sharp; draw.closed = h.closed; } else if (!draw.closed) { draw.pts.pop(); draw.sharp.pop(); } renderDraw(); }
  function clearDraw() { if (!draw) return; remember(); draw.pts = []; draw.sharp = []; draw.closed = false; renderDraw(); }
  function renderDraw() {
    svg.classList.add("drawing"); { const lg = document.getElementById("planLegend"); if (lg) lg.hidden = true; } if (zbar) zbar.hidden = false;
    const W = draw.W, H = draw.H, k = W / 36;
    base = { w: W + 3 * k, h: H + 3.2 * k }; applyView();
    svg.innerHTML = "";
    const root = el("g", { transform: `translate(${2 * k} ${1.2 * k})` }, svg);
    const ruleStep = W > 60 ? 10 : 5;
    el("rect", { x: 0, y: 0, width: W, height: H, fill: "#FBFAF4", stroke: "#DDD7C4", "stroke-width": 0.08 * k }, root);
    for (let x = 0; x <= W; x++) el("line", { x1: x, y1: 0, x2: x, y2: H, stroke: x % 5 === 0 ? "#D9D2BA" : "#EEE9D8", "stroke-width": (x % 5 === 0 ? 0.06 : 0.035) * k }, root);
    for (let y = 0; y <= H; y++) el("line", { x1: 0, y1: y, x2: W, y2: y, stroke: y % 5 === 0 ? "#D9D2BA" : "#EEE9D8", "stroke-width": (y % 5 === 0 ? 0.06 : 0.035) * k }, root);
    for (let x = 0; x <= W; x += ruleStep) el("text", { x, y: H + 1.1 * k, "font-size": 0.7 * k, fill: "#7A7F70", "text-anchor": "middle", "font-family": "sans-serif" }, root, x + " ft");
    for (let y = 0; y <= H; y += ruleStep) el("text", { x: -0.3 * k, y: H - y + 0.25 * k, "font-size": 0.7 * k, fill: "#7A7F70", "text-anchor": "end", "font-family": "sans-serif" }, root, y + "");
    const kd = k / view.z;
    const Yd = q => [q[0], H - q[1]];
    const pts = draw.pts.map(Yd);
    if (draw.closed) {
      const shape = finalPoly().map(Yd);
      el("polygon", { class: "dshape dtip", "data-k": "draw", "data-tip": "Drag to move the whole shape", cursor: "move", points: shape.map(q => q.join(",")).join(" "), fill: "rgba(166,140,114,.45)", stroke: "#3F6B3A", "stroke-width": 0.14 * kd, "stroke-linejoin": "round" }, root);
      if (anyCurve()) el("polygon", { points: pts.map(q => q.join(",")).join(" "), fill: "none", stroke: "#3F6B3A", "stroke-width": 0.05 * kd, "stroke-dasharray": `${0.25 * kd} ${0.18 * kd}` }, root);
    } else {
      const all = draw.cur ? pts.concat([Yd([draw.cur.x, draw.cur.y])]) : pts;
      if (pts.length >= 3) el("polygon", { points: pts.map(q => q.join(",")).join(" "), fill: "rgba(166,140,114,.3)", stroke: "none" }, root);
      if (all.length > 1) el("polyline", { points: all.map(q => q.join(",")).join(" "), fill: "none", stroke: "#3F6B3A", "stroke-width": 0.14 * kd, "stroke-linejoin": "round" }, root);
    }
    // side lengths
    const ring = draw.closed ? pts.concat([pts[0]]) : (draw.cur ? pts.concat([Yd([draw.cur.x, draw.cur.y])]) : pts);
    for (let i = 1; i < ring.length; i++) {
      const a = ring[i - 1], b = ring[i], len = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (len > 0.9 * kd) el("text", { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 - 0.3 * kd, "font-size": 0.62 * kd, fill: "#3F6B3A", "text-anchor": "middle", "font-family": "sans-serif", "font-weight": 700, "pointer-events": "none" }, root, len.toFixed(1) + " ft");
    }
    // midpoint + handles (closed shape only): click one to add a corner there
    if (draw.closed) pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1.2 * kd) return;
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, r = 0.26 * kd;
      el("circle", { class: "dm dtip", "data-i": i, "data-k": "draw", "data-tip": "Click to add a corner here, or drag to pull one out", cx: mx, cy: my, r, fill: "#fff", stroke: "#3F6B3A", "stroke-width": 0.05 * kd, cursor: "copy" }, root);
      el("path", { d: `M${mx - r * 0.55} ${my}H${mx + r * 0.55}M${mx} ${my - r * 0.55}V${my + r * 0.55}`, stroke: "#3F6B3A", "stroke-width": 0.06 * kd, "pointer-events": "none" }, root);
    });
    pts.forEach((q, i) => {
      const first = i === 0 && !draw.closed;
      const few = draw.pts.length <= 3;
      const tip = draw.closed ? (draw.sharp[i] ? "Sharp corner · Drag to move · Click to make it a curve" : "Curve · Drag to move · Click to make it a sharp corner") + (few ? "" : TOUCH ? " · Press and hold to remove" : " · Right-click to remove")
        : first && pts.length >= 3 ? "Click to close the shape" : "Corner · Drag to move · Click the orange dot to close the shape";
      if (draw.closed && draw.sharp[i]) {   // a sharp corner: a square dot (curves are round dots)
        const r = 0.28 * kd;
        el("rect", { class: "dv dtip", "data-i": i, "data-k": "draw", "data-tip": tip, x: q[0] - r, y: q[1] - r, width: 2 * r, height: 2 * r, fill: "#3F6B3A", stroke: "#fff", "stroke-width": 0.06 * kd, cursor: "move" }, root);
        return;
      }
      el("circle", { class: "dv dtip", "data-i": i, "data-k": "draw", "data-tip": tip, cx: q[0], cy: q[1], r: (first ? 0.36 : draw.closed ? 0.3 : 0.22) * kd, fill: first ? "#E58A00" : "#3F6B3A", stroke: "#fff", "stroke-width": 0.06 * kd, cursor: draw.closed ? "move" : first && pts.length >= 3 ? "pointer" : "move" }, root);
    });
    if (ui) {
      let m;
      if (draw.closed) {
        const fp = finalPoly(), bb = window.Geo.bbox(fp), A = window.Geo.area(fp);
        m = TOUCH ? `About ${bb.w.toFixed(1)} × ${bb.h.toFixed(1)} ft, ${Math.round(A)} sq ft. Drag a dot to move it, tap it to switch between a curve (round dot) and a sharp corner (square dot), press and hold it to remove it. Tap a + to add a corner. Drag inside the shape to move all of it. Pinch to zoom. Then Save shape.`
          : `About ${bb.w.toFixed(1)} × ${bb.h.toFixed(1)} ft, ${Math.round(A)} sq ft. Point at any dot for what it does: drag to move, click to switch between a curve (round dot) and a sharp corner (square dot), right-click to remove. Click a + to add a corner. Drag inside the shape to move all of it. Ctrl + scroll zooms. Then Save shape.`;
      } else m = pts.length < 3 ? "Click to place corners (they snap to the half foot). Hold Shift for straight lines." : "Keep clicking corners, then click the orange start point (or double-click) to close the shape.";
      ui.msg.textContent = m;
      ui.save.disabled = draw.pts.length < 3;
      ui.curves.disabled = ui.corners.disabled = !draw.closed;
      ui.size.value = draw.W + "x" + draw.H;
    }
  }
  function makeDrawUI() {
    removeDrawUI();
    const bar = document.createElement("div"); bar.className = "drawbar";
    const mk = (t, f, cls) => { const b = document.createElement("button"); b.type = "button"; b.className = "btn small " + (cls || ""); b.textContent = t; b.onclick = f; return b; };
    const msg = document.createElement("span"); msg.className = "tip";
    const save = mk("Save shape", finishDraw, "primary");
    const allc = (t, v, title) => { const b = mk(t, () => { if (!draw.closed) return; remember(); draw.sharp = draw.pts.map(() => v); renderDraw(); }); b.title = title; return b; };
    const curves = allc("All curves", false, "Make every corner a smooth curve"), corners = allc("All sharp", true, "Make every corner sharp");
    const size = document.createElement("select"); size.title = "Drawing area";
    SIZES.forEach(s => { const o = document.createElement("option"); o.value = s[0] + "x" + s[1]; o.textContent = `Area ${s[0]} × ${s[1]} ft`; size.appendChild(o); });
    size.onchange = () => { const [w, h] = size.value.split("x").map(Number); draw.W = w; draw.H = h; draw.pts = draw.pts.map(q => [Math.min(w, q[0]), Math.min(h, q[1])]); renderDraw(); };
    bar.append(save, mk("Undo", undoDraw), (() => { const c = mk("Clear shape", clearDraw); c.title = "Erase the outline and draw a new one from scratch"; return c; })(), mk("Cancel", cancelDraw), curves, corners, size, msg);
    wrap.appendChild(bar); ui = { bar, msg, save, curves, corners, size };
    if (!SIZES.some(s => s[0] === draw.W && s[1] === draw.H)) { const o = document.createElement("option"); o.value = draw.W + "x" + draw.H; o.textContent = `Area ${draw.W} × ${draw.H} ft`; size.appendChild(o); }
  }
  function removeDrawUI() { if (ui) { ui.bar.remove(); ui = null; } }

  function renderLegend(items) {
    const box = document.getElementById("planLegend"); if (!box) return;
    box.innerHTML = ""; box.hidden = !items.length;
    items.forEach(it => {
      const span = document.createElement("span"); span.className = "lg" + (it.k === "tox" ? " lg-tox" : "");
      if (it.k) { const sv = document.createElementNS(NS, "svg"); sv.setAttribute("viewBox", "-1.1 -1.1 2.2 2.2"); sv.setAttribute("class", "lgic"); drawBadge(it.k, sv, 1, "lgb", 0, 0, 0, 0); span.appendChild(sv); }
      else if (it.v) span.insertAdjacentHTML("beforeend", `<i class="lgline" style="background:${VIEWC}"></i>`);
      else span.insertAdjacentHTML("beforeend", `<i class="lgsq" style="background:${ZONE[it.z]}"></i>`);
      span.appendChild(document.createTextNode(it.t)); box.appendChild(span);
    });
  }
  function setHover(id) {
    if (!svg) return;
    svg.classList.toggle("hasHover", !!id);   // the bed and objects fade back while a plant is pointed at
    svg.querySelectorAll(".pl").forEach(g => { g.classList.toggle("hl", !!id && g.dataset.id === id); g.classList.toggle("dim", !!id && g.dataset.id !== id && !g.classList.contains("sel")); });
  }
  window.Plan = { init, render, clientToBed, pxPerFt, zonesForSun, zonesOff, movePl, startDraw, setHover, isDrawing: () => !!draw, touch: TOUCH, sidesList, resetView, zoomBy, cancelDraw, finishDraw, chaikin, frontLabels, ZONE, ZONE_LAB, ZONE_HRS, ZONE_TIP, sunNeed, sunTip };
})();
