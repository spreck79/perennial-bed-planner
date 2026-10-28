// Interactive bed plan: SVG drawing, dragging, placing, and the outline drawing tool.
(function () {
  const NS = "http://www.w3.org/2000/svg";
  let svg, wrap, cb = {}, ctx = null, drag = null, draw = null, ui = null;
  const sp = p => p.spacing / 12;

  function el(name, attrs, parent, text) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function toBed(evt) {
    const m = svg.getScreenCTM().inverse();
    const pt = svg.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY;
    const q = pt.matrixTransform(m);
    return { x: q.x - ctx.ox, y: ctx.H - (q.y - ctx.oy) }; // bed coordinates (feet), y up
  }

  function init(svgEl, callbacks) {
    svg = svgEl; wrap = svg.parentElement; cb = callbacks;
    svg.addEventListener("pointerdown", onDown);
    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerup", onUp);
    svg.addEventListener("pointercancel", onUp);
    svg.addEventListener("dblclick", () => { if (draw) finishDraw(); });
    svg.addEventListener("pointerover", e => { const g = e.target.closest && e.target.closest(".pl"); cb.onHover && cb.onHover(g ? g.dataset.id : null); });
    svg.addEventListener("pointerleave", () => cb.onHover && cb.onHover(null));
    svg.addEventListener("contextmenu", e => { if (e.target.closest && e.target.closest(".pl")) e.preventDefault(); });
  }

  function onDown(e) {
    if (!ctx) return;
    if (draw) { addDrawPoint(e); return; }
    const g = e.target.closest && e.target.closest(".pl");
    const pt = toBed(e);
    if (g && e.button === 2) { cb.onSelect && cb.onSelect(+g.dataset.idx, false); e.preventDefault(); return; }
    if (g) {
      const idx = +g.dataset.idx, p = ctx.placements[idx];
      cb.onSelect && cb.onSelect(idx, e.shiftKey || e.ctrlKey || e.metaKey);
      drag = { idx, dx: p.x - pt.x, dy: p.y - pt.y, moved: false, g, sx: e.clientX, sy: e.clientY };
      svg.setPointerCapture(e.pointerId);
      e.preventDefault();
    } else if (ctx.armed) {
      cb.onPlace && cb.onPlace(pt.x, pt.y);
    } else {
      if (!(e.shiftKey || e.ctrlKey || e.metaKey)) cb.onSelect && cb.onSelect(-1);
    }
  }
  function onMove(e) {
    if (draw) { updateDrawCursor(e); return; }
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 3) return;
    drag.moved = true; svg.querySelectorAll(".sellab").forEach(e => { e.style.display = "none"; });
    const pt = toBed(e), p = ctx.placements[drag.idx];
    let nx = pt.x + drag.dx, ny = pt.y + drag.dy;
    if (window.Geo.pip(ctx.bed.poly, nx, ny)) { p.x = nx; p.y = ny; }
    else {
      // slide along the edge: try each axis on its own
      if (window.Geo.pip(ctx.bed.poly, nx, p.y)) p.x = nx; else if (window.Geo.pip(ctx.bed.poly, p.x, ny)) p.y = ny;
    }
    const c = drag.g.querySelector("circle.pc"), t = drag.g.querySelector("text:not(.tx)");
    c.setAttribute("cx", p.x); c.setAttribute("cy", ctx.H - p.y);
    if (t) { t.setAttribute("x", p.x); t.setAttribute("y", ctx.H - p.y + ctx.fs * 0.35); }
    drag.g.querySelectorAll(".tx").forEach(e => { const ox = +e.dataset.ox, oy = +e.dataset.oy; if (e.tagName === "circle") { e.setAttribute("cx", p.x + ox); e.setAttribute("cy", ctx.H - p.y + oy); } else { e.setAttribute("x", p.x + ox); e.setAttribute("y", ctx.H - p.y + oy); } });
  }
  function onUp(e) {
    if (drag) {
      const d = drag; drag = null;
      try { svg.releasePointerCapture(e.pointerId); } catch (_) {}
      if (d.moved) cb.onMoved && cb.onMoved(d.idx);
    }
  }

  // --------------- main render ---------------
  function render(c) {
    ctx = c;
    if (draw) return renderDraw();
    const { bed, placements, byId, view, selIdx, hoverId } = c, selAll = c.selAll || (selIdx >= 0 ? [selIdx] : []);
    const bb = bed.bb, fs = Math.max(0.26, Math.max(bb.w, bb.h) / 46);
    const mL = fs * 4.2, mR = fs * 1.6, mT = fs * 3.2, mB = fs * 5;
    c.H = bb.h; c.ox = mL; c.oy = mT; c.fs = fs;
    svg.setAttribute("viewBox", `0 0 ${(bb.w + mL + mR).toFixed(2)} ${(bb.h + mT + mB).toFixed(2)}`);
    svg.style.maxHeight = "640px";
    svg.innerHTML = "";
    const root = el("g", { transform: `translate(${mL.toFixed(2)} ${mT.toFixed(2)})` }, svg);
    const Y = y => bb.h - y;
    const defs = el("defs", {}, svg);
    // photo patterns (only the plants in the bed)
    if (view === "photos") {
      const seen = {};
      placements.forEach(p => {
        if (seen[p.id] || !window.PHOTOS[p.id]) return; seen[p.id] = 1;
        const r = sp(byId[p.id]) / 2, pat = el("pattern", { id: "ph-" + p.id, patternUnits: "objectBoundingBox", width: 1, height: 1 }, defs);
        el("image", { href: window.PHOTOS[p.id], x: 0, y: 0, width: 1, height: 1, preserveAspectRatio: "xMidYMid slice" }, pat);
        pat.firstChild.setAttribute("width", 1); pat.firstChild.setAttribute("height", 1);
        pat.setAttribute("patternContentUnits", "objectBoundingBox");
        pat.firstChild.setAttribute("x", 0); pat.firstChild.setAttribute("y", 0);
      });
    }
    const poly = bed.poly.map(q => `${q[0].toFixed(3)},${Y(q[1]).toFixed(3)}`).join(" ");
    const clip = el("clipPath", { id: "bedclip" }, defs); el("polygon", { points: poly }, clip);
    el("polygon", { points: poly, fill: "#8E7660", stroke: "#8E7660", "stroke-width": fs * 0.9, "stroke-linejoin": "round" }, root);
    el("polygon", { points: poly, fill: "#A68C72" }, root);
    const grid = el("g", { "clip-path": "url(#bedclip)", stroke: "#BBA388", "stroke-width": 0.035 }, root);
    for (let x = 1; x < bb.w; x++) el("line", { x1: x, y1: 0, x2: x, y2: bb.h }, grid);
    for (let y = 1; y < bb.h; y++) el("line", { x1: 0, y1: Y(y), x2: bb.w, y2: Y(y) }, grid);
    // axis labels
    const step = bb.w > 30 ? 5 : bb.w > 16 ? 2 : 1;
    for (let x = 0; x <= bb.w + 0.01; x += step) el("text", { x, y: bb.h + fs * 1.5, "font-size": fs * 0.85, fill: "#7A7F70", "text-anchor": "middle", "font-family": "sans-serif" }, root, x + " ft");
    const ystep = bb.h > 24 ? 5 : bb.h > 12 ? 2 : 1;
    for (let y = 0; y <= bb.h + 0.01; y += ystep) el("text", { x: -fs * 0.6, y: Y(y) + fs * 0.3, "font-size": fs * 0.85, fill: "#7A7F70", "text-anchor": "end", "font-family": "sans-serif" }, root, y + "");
    el("text", { x: bb.w / 2, y: bb.h + fs * 3.4, "font-size": fs * 0.9, fill: "#4b5244", "text-anchor": "middle", "font-weight": 700, "font-family": "sans-serif" }, root,
      bed.mode === "island" ? "ALL SIDES ARE THE FRONT · tall plants in the middle" : "FRONT EDGE (lawn / path side)");
    if (bed.mode !== "island") el("text", { x: bb.w, y: -fs * 0.9, "font-size": fs * 0.9, fill: "#4b5244", "text-anchor": "end", "font-weight": 700, "font-family": "sans-serif" }, root, "BACK (fence / house / trees)");

    // overlaps
    const bad = new Set();
    for (let i = 0; i < placements.length; i++) for (let j = i + 1; j < placements.length; j++) {
      const a = placements[i], b = placements[j];
      const mix = !!byId[a.id].dormant !== !!byId[b.id].dormant;   // an early-dormant plant tucked among later ones is fine
      const need = (sp(byId[a.id]) + sp(byId[b.id])) / 2 * (mix ? 0.2 : 0.72);
      if (Math.hypot(a.x - b.x, a.y - b.y) < need) { bad.add(i); bad.add(j); }
    }
    ctx.badCount = bad.size;
    const order = placements.map((p, i) => i).sort((a, b) => sp(byId[placements[b].id]) - sp(byId[placements[a].id]));
    selAll.forEach(si => { const k = order.indexOf(si); if (k >= 0) { order.splice(k, 1); order.push(si); } });
    const layer = el("g", {}, root); let anyTox = false;
    order.forEach(i => {
      const p = placements[i], pl = byId[p.id], r = sp(pl) / 2 * 0.96;
      const cls = ["pl"]; if (bad.has(i)) cls.push("bad"); if (selAll.includes(i)) cls.push("sel");
      if (hoverId && !selAll.includes(i)) cls.push(hoverId === p.id ? "hl" : "dim");
      const g = el("g", { class: cls.join(" "), "data-idx": i, "data-id": p.id }, layer);
      const fill = view === "photos" && window.PHOTOS[p.id] ? `url(#ph-${p.id})` : pl.hex;
      el("circle", { class: "pc", cx: p.x, cy: Y(p.y), r, fill }, g);
      if (view !== "photos") el("text", { x: p.x, y: Y(p.y) + fs * 0.35, "font-size": Math.min(fs * 1.05, r * 0.95), fill: pl.txt }, g, pl.code);
      if (pl.toxic && pl.toxic.length) {
        el("circle", { class: "tx", "data-ox": 0, "data-oy": 0, cx: p.x, cy: Y(p.y), r: r + 0.04, fill: "none", stroke: "#B8392E", "stroke-width": 0.16 }, g);
        const bx = p.x + r * 0.72, by = Y(p.y) - r * 0.72, br = Math.max(fs * 0.5, 0.3);
        el("circle", { class: "tx", "data-ox": r * 0.72, "data-oy": -r * 0.72, cx: bx, cy: by, r: br, fill: "#B8392E", stroke: "#fff", "stroke-width": 0.05 }, g);
        el("text", { class: "tx", "data-ox": r * 0.72, "data-oy": -r * 0.72 + fs * 0.3, x: bx, y: by + fs * 0.3, "font-size": fs * 0.85, fill: "#fff", "text-anchor": "middle", "font-weight": 800, "font-family": "sans-serif" }, g, "!");
        anyTox = true;
      }
    });
    // spotlight: the selected plant gets a name tag above it while the others fade back
    svg.classList.toggle("hasSel", selAll.length > 0);
    if (selAll.length === 1 && placements[selAll[0]]) {
      const p = placements[selAll[0]], pl = byId[p.id], r = sp(pl) / 2 * 0.96, tox = pl.toxic && pl.toxic.length;
      const txt = pl.name + (pl.native ? "" : " ◆") + (pl.fam === "daisy" ? " ✿" : ""), fsz = fs * 0.95, w = txt.length * fsz * 0.6 + fsz * 1.4, h = fsz * 1.9;
      let cx = Math.max(w / 2, Math.min(bb.w - w / 2, p.x)), cy = Y(p.y) - r - h * 0.5 - fsz * 0.45;
      if (cy - h / 2 < -mT * 0.9) cy = Y(p.y) + r + h * 0.5 + fsz * 0.45;
      const lg = el("g", { class: "sellab", "pointer-events": "none" }, root);
      el("rect", { x: cx - w / 2, y: cy - h / 2, width: w, height: h, rx: h / 2, fill: tox ? "#B8392E" : "#2E3A2C", stroke: "#fff", "stroke-width": 0.06 }, lg);
      el("text", { x: cx, y: cy + fsz * 0.34, "font-size": fsz, fill: "#fff", "text-anchor": "middle", "font-weight": 700, "font-family": "sans-serif" }, lg, txt);
    }
    if (anyTox) {
      const lgd = el("g", { "pointer-events": "none" }, root); root.insertBefore(lgd, layer);
      const lx = fs * 0.4, ly = -fs * 0.9;
      el("circle", { cx: lx, cy: ly - fs * 0.3, r: fs * 0.5, fill: "#B8392E" }, lgd);
      el("text", { x: lx, y: ly - fs * 0.3 + fs * 0.3, "font-size": fs * 0.85, fill: "#fff", "text-anchor": "middle", "font-weight": 800, "font-family": "sans-serif" }, lgd, "!");
      el("text", { x: lx + fs * 0.9, y: ly, "font-size": fs * 0.9, fill: "#B8392E", "font-weight": 700, "font-family": "sans-serif" }, lgd, "= Toxic plant");
    }
    svg.classList.toggle("placing", !!c.armed);
    svg.classList.remove("drawing");
    removeDrawUI();
  }

  // --------------- freehand outline tool ---------------
  const CANVAS = { w: 36, h: 20, snap: 0.5 };
  function startDraw(callbacks) {
    draw = { pts: [], cur: null, done: callbacks.onDone, cancel: callbacks.onCancel };
    ctx = ctx || {};
    makeDrawUI();
    renderDraw();
  }
  function snap(v) { return Math.round(v / CANVAS.snap) * CANVAS.snap; }
  function drawCoords(e) {
    const m = svg.getScreenCTM().inverse(), pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const q = pt.matrixTransform(m);
    return { x: Math.max(0, Math.min(CANVAS.w, snap(q.x - 2))), y: Math.max(0, Math.min(CANVAS.h, snap(CANVAS.h - (q.y - 1.2)))) };
  }
  function addDrawPoint(e) {
    const p = drawCoords(e);
    if (draw.pts.length >= 3 && Math.hypot(p.x - draw.pts[0][0], p.y - draw.pts[0][1]) < 0.9) return finishDraw();
    const last = draw.pts[draw.pts.length - 1];
    if (last && last[0] === p.x && last[1] === p.y) return;
    draw.pts.push([p.x, p.y]); renderDraw();
  }
  function updateDrawCursor(e) { draw.cur = drawCoords(e); renderDraw(); }
  function finishDraw() {
    if (!draw || draw.pts.length < 3) { if (ui) ui.msg.textContent = "Click at least 3 points first."; return; }
    const pts = draw.pts.slice(), done = draw.done; draw = null; removeDrawUI(); svg.classList.remove("drawing");
    done && done(pts);
  }
  function cancelDraw() { const c = draw && draw.cancel; draw = null; removeDrawUI(); svg.classList.remove("drawing"); c && c(); }
  function undoDraw() { if (draw) { draw.pts.pop(); renderDraw(); } }
  function renderDraw() {
    svg.classList.add("drawing");
    const W = CANVAS.w, H = CANVAS.h;
    svg.setAttribute("viewBox", `0 0 ${W + 3} ${H + 3.2}`);
    svg.innerHTML = "";
    const root = el("g", { transform: "translate(2 1.2)" }, svg);
    el("rect", { x: 0, y: 0, width: W, height: H, fill: "#FBFAF4", stroke: "#DDD7C4", "stroke-width": 0.08 }, root);
    for (let x = 0; x <= W; x++) el("line", { x1: x, y1: 0, x2: x, y2: H, stroke: x % 5 === 0 ? "#D9D2BA" : "#EEE9D8", "stroke-width": x % 5 === 0 ? 0.06 : 0.035 }, root);
    for (let y = 0; y <= H; y++) el("line", { x1: 0, y1: y, x2: W, y2: y, stroke: y % 5 === 0 ? "#D9D2BA" : "#EEE9D8", "stroke-width": y % 5 === 0 ? 0.06 : 0.035 }, root);
    for (let x = 0; x <= W; x += 5) el("text", { x, y: H + 1.1, "font-size": 0.7, fill: "#7A7F70", "text-anchor": "middle", "font-family": "sans-serif" }, root, x + " ft");
    for (let y = 0; y <= H; y += 5) el("text", { x: -0.3, y: H - y + 0.25, "font-size": 0.7, fill: "#7A7F70", "text-anchor": "end", "font-family": "sans-serif" }, root, y + "");
    const pts = draw.pts.map(q => [q[0], H - q[1]]);
    const all = draw.cur ? pts.concat([[draw.cur.x, H - draw.cur.y]]) : pts;
    if (pts.length >= 3) el("polygon", { points: pts.map(q => q.join(",")).join(" "), fill: "rgba(166,140,114,.35)", stroke: "none" }, root);
    if (all.length > 1) el("polyline", { points: all.map(q => q.join(",")).join(" "), fill: "none", stroke: "#3F6B3A", "stroke-width": 0.14, "stroke-linejoin": "round" }, root);
    for (let i = 1; i < all.length; i++) {
      const a = all[i - 1], b = all[i], len = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (len > 0.9) el("text", { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 - 0.3, "font-size": 0.62, fill: "#3F6B3A", "text-anchor": "middle", "font-family": "sans-serif", "font-weight": 700 }, root, len.toFixed(1) + " ft");
    }
    pts.forEach((q, i) => el("circle", { cx: q[0], cy: q[1], r: i === 0 ? 0.32 : 0.2, fill: i === 0 ? "#E58A00" : "#3F6B3A" }, root));
    if (ui) ui.msg.textContent = pts.length < 3 ? "Click to place corners (each click snaps to a half foot)." : "Click the orange start point (or double-click) to finish.";
  }
  function makeDrawUI() {
    removeDrawUI();
    const bar = document.createElement("div");
    bar.style.cssText = "position:absolute;left:10px;top:10px;display:flex;gap:6px;align-items:center;background:#fff;border:1px solid #DDD7C4;border-radius:10px;padding:6px 8px;box-shadow:0 4px 14px rgba(0,0,0,.12);z-index:3;flex-wrap:wrap;max-width:calc(100% - 20px)";
    const mk = (t, f, cls) => { const b = document.createElement("button"); b.className = "btn small " + (cls || ""); b.textContent = t; b.onclick = f; return b; };
    const msg = document.createElement("span"); msg.className = "tip"; msg.style.maxWidth = "300px";
    bar.append(mk("Finish shape", finishDraw, "primary"), mk("Undo point", undoDraw), mk("Cancel", cancelDraw), msg);
    wrap.appendChild(bar); ui = { bar, msg };
  }
  function removeDrawUI() { if (ui) { ui.bar.remove(); ui = null; } }

  function setHover(id) {
    if (!svg) return;
    svg.querySelectorAll(".pl").forEach(g => { g.classList.toggle("hl", !!id && g.dataset.id === id); g.classList.toggle("dim", !!id && g.dataset.id !== id && !g.classList.contains("sel")); });
  }
  window.Plan = { init, render, startDraw, setHover, isDrawing: () => !!draw };
})();
