// Shade Garden Planner: state, library, charts and wiring.
(function () {
  const PL = window.PLANTS, Geo = window.Geo, Ch = window.Charts;
  window.PHOTOS = window.PHOTOS || {};
  const byId = {}; PL.forEach(p => (byId[p.id] = p));
  const $ = s => document.querySelector(s);
  const LS = "shadeGardenPlanner.v1";
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // steps 1 to 4 fold down to a one-line summary once they're done; openSteps holds the ones opened again
  const STEPS_UI = { name: "#nameCard", kind: "#prefCard", avoid: "#avoidCard", bed: "#bedPanel", objects: "#objCard", sun: "#sunCard" };
  const openSteps = new Set();
  // Full-size photos (full.jpg in each plant's folder) load only when needed: enlarging a photo, making the PDF.
  // Everywhere else uses the quick 240 x 180 previews (preview.jpg).
  const fullWait = {};
  function loadFull(id) {
    if (window.PHOTO_FULL[id]) return Promise.resolve(window.PHOTO_FULL[id]);
    return fullWait[id] || (fullWait[id] = window.loadFullPhoto(id).then(u => { if (!u) delete fullWait[id]; return u; }));
  }
  const TOUCH = window.Plan.touch;   // phone or tablet: "press and hold" in place of right-click
  if (TOUCH) $("#toolsHint").textContent = "Tip: press and hold any plant, object or empty spot on the bed. Pinch to zoom.";
  // How full the bed is once grown. 100% = every plant at its recommended spacing in offset rows (circles as
  // wide as the spacing cover about 90.7% of the ground that way), so fewer plants read lower and plants set
  // closer than recommended read over 100%. Suggest a planting and Re-arrange aim for 100%.
  const FULL_AT = 0.907;
  // the ground there is to plant: the bed minus what paths, stones, birdbaths, shrubs and the like take up
  // (trees only take their trunk). Worked out on a half-foot grid and kept until the bed or objects change.
  let plantKey = "", plantArea = 0;
  function plantableArea() {
    const key = JSON.stringify([bed.poly.length, bed.area, S.objects]);
    if (key !== plantKey) {
      const res = 0.5, bb = bed.bb; let a = 0;
      for (let x = bb.x0 + res / 2; x < bb.x1; x += res) for (let y = bb.y0 + res / 2; y < bb.y1; y += res)
        if (Geo.pip(bed.poly, x, y) && !Geo.objHit(S.objects, x, y, 0.01, 1)) a += res * res;
      plantKey = key; plantArea = a || bed.area;
    }
    return plantArea;
  }
  const fullnessNow = () => Math.round(S.placements.reduce((s, p) => s + Math.PI * Math.pow(byId[p.id].spacing / 24, 2), 0) / (plantableArea() || 1) / FULL_AT * 100);
  const fullGoal = () => 100;   // Suggest a planting and Re-arrange always aim for a full bed
  const imgSrc = id => window.PHOTOS[id] || "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

  // The starter garden shown on first visit and after "Start over": a drawn (not rectangular) border that
  // bows out in the middle, with all three sun zones painted left to right (full sun, part shade, shade)
  // and a short hedge, a birdbath and a couple of stepping stones for structure. Plant picks are grouped by
  // zone and chosen from real "goes well with" companion pairings (from the plant folders) in that light.
  // The outline is stored the way the outline editor stores it: 10 handles (on its half-foot grid) smoothed
  // with the editor's own curve, so "Edit the outline" opens with a few easy-to-drag dots, not dozens.
  const DEFAULT_FREECTRL = [[0, 2], [5.5, 1], [11, 0], [16.5, 1], [22, 2], [22, 5], [16.5, 5.5], [11, 7], [5.5, 7.5], [0, 6.5]];
  const DEFAULT_FREEPOLY = window.Plan.chaikin(DEFAULT_FREECTRL, 3).map(q => [Math.round(q[0] * 100) / 100, Math.round(q[1] * 100) / 100]);
  const DEFAULT_OBJECTS = [
    { t: "hedge", x: 4.6, y: 6.2, w: 4, h: 1.2, rot: 0 },
    { t: "birdbath", x: 11, y: 3.6, w: 2, h: 2, rot: 0 },
    { t: "stone", x: 8.6, y: 1.7, w: 1.25, h: 1.25, rot: 0 },
    { t: "stone", x: 9.9, y: 2.4, w: 1.25, h: 1.25, rot: 0 }
  ];
  // full sun on the left third, shade on the right third; the middle third is left unpainted and
  // falls back to the bed's base zone (part shade), matching sunBase below
  function starterSunCells() {
    const cells = {}, res = 0.5, rows = 16;
    for (let i = 0; i < 44; i++) {
      const x = (i + 0.5) * res, z = x < 7 ? "full" : x >= 15 ? "shade" : null;
      if (!z) continue;
      for (let j = 0; j < rows; j++) cells[i + "," + j] = z;
    }
    return cells;
  }
  // the example garden's plants and how many of each come from the plant files ("example" in data/plants/<id>/plant.json)
  const EXAMPLE_PLANTS = window.EXAMPLE_PLANTS || [];

  // little icons with hover labels: sun needs (leading), native leaf, garden favorite, daisy family, toxic
  const deerEats = p => p.deer === "C" || p.deer === "D";
  const DEER = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 11V6.2M6 6.2 3.2 2M4.3 3.7 2 4.2M6 6.2 8.8 2M7.7 3.7 10 4.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>';
  const deerTip = p => (p.deer === "D" ? "Deer often eat this" : "Deer sometimes eat this") + (p.squirrels ? "; squirrels dig up the bulbs" : "");
  const LEAF = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M10.6 1.4C5.2 1.2 1.6 3.9 1.7 8c0 .9.3 1.7.7 2.3.5-2.6 2.3-4.6 4.9-5.8-2.1 1.5-3.6 3.4-4.2 6 .5.2 1.1.3 1.7.3 4 0 6-3.4 5.8-9.4z" fill="currentColor"/></svg>';
  // sun-needs icon: a white sun glyph on a badge colored (or, for a plant that spans more than one
  // light level, blended left-to-right) by every light level the plant tolerates, full sun to shade.
  const SUNCOL = { full: "#F2C40C", part: "#B5A153", shade: "#6E6E6E" };
  window.SUNCOL = SUNCOL;
  const SUNGLYPH = '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="2.5" fill="currentColor"/><path d="M6 .8V2.4M6 9.6v1.6M.8 6h1.6M9.6 6h1.6M2.3 2.3 3.4 3.4M8.6 8.6l1.1 1.1M2.3 9.7 3.4 8.6M8.6 3.4l1.1-1.1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
  const sunCats = p => ["full", "part", "shade"].filter(k => p.sun && p.sun.includes(k));
  const sunBg = p => { const c = sunCats(p); return c.length <= 1 ? SUNCOL[c[0] || "part"] : "linear-gradient(90deg, " + c.map(k => SUNCOL[k]).join(", ") + ")"; };
  function sunIcon(p) {
    if (!p.sun) return "";
    return '<span class="ic ic-sun" data-k="sun" style="background:' + sunBg(p) + '" data-tip="' + esc(window.Plan.sunTip(p) || "Light needs vary") + '">' + SUNGLYPH + "</span>";
  }
  function icons(p, off) {
    let h = sunIcon(p);
    h += p.native ? '<span class="ic ic-nat" data-k="nat" data-tip="Michigan native">' + LEAF + "</span>" : '<span class="ic ic-gar" data-k="gar" data-tip="Garden favorite (not native)">◆</span>';
    if (p.fam === "daisy") h += '<span class="ic ic-df" data-k="daisy" data-tip="Daisy family (related to ragweed)">✿</span>';
    if (deerEats(p)) h += '<span class="ic ic-deer" data-k="deer" data-tip="' + esc(deerTip(p)) + '">' + DEER + "</span>";
    if (p.toxic && p.toxic.length) h += '<span class="ic ic-tox" data-k="tox" data-tip="' + esc(window.toxLabel(p)) + '">!</span>';
    if (p.id && window.isTender(p)) h += '<span class="ic ic-cold" data-k="cold" data-tip="Not winter-hardy here: ' + esc(window.winterCare(p).short) + '">❄</span>';
    if (off) h += '<span class="ic ic-off" data-k="off" data-tip="Outside your garden choices">–</span>';
    return '<span class="ics">' + h + "</span>";
  }
  const SUNKEY = ["full", "part", "shade"].map(k => '<span class="ic ic-sun" data-k="sun" style="background:' + SUNCOL[k] + '" data-tip="' + window.Plan.ZONE_TIP[k] + '">' + SUNGLYPH + "</span> " + { full: "full sun", part: "part shade", shade: "shade" }[k]).join(" ");
  const KEY = () => '<span class="ickey">' + SUNKEY + " (blended if it takes more than one) " + icons({ native: true }).replace(/<\/?span class="ics">/g, "").replace(/<span class="ic ic-sun".*?<\/span>/, "") + ' native ' + icons({}).replace(/<\/?span class="ics">/g, "").replace(/<span class="ic ic-sun".*?<\/span>/, "") + ' garden favorite <span class="ic ic-df" data-k="daisy" data-tip="Daisy family (related to ragweed)">✿</span> daisy family <span class="ic ic-deer" data-k="deer" data-tip="Deer often or sometimes eat this">' + DEER + '</span> deer often eat <span class="ic ic-tox" data-k="tox" data-tip="Toxic plant">!</span> toxic <span class="ic ic-cold" data-k="cold" data-tip="Not winter-hardy here: needs winter care">❄</span> needs winter care</span>';
  window.plannerKey = KEY;
  document.querySelectorAll(".keyslot").forEach(e => (e.innerHTML = KEY()));
  { const tip = document.createElement("div"); tip.id = "ictip"; document.body.appendChild(tip);
    const SEL = ".ic, .cpill, .sunb, .ztip, .dtip";
    const place = (x, y) => { const tw = tip.offsetWidth; tip.style.left = Math.max(6, Math.min(window.innerWidth - tw - 6, x - tw / 2)) + "px"; tip.style.top = Math.max(6, y - tip.offsetHeight - 6) + "px"; };
    const show = (el, e) => { if (!el.dataset.tip) { tip.className = ""; return; } tip.textContent = el.dataset.tip; tip.className = "on k-" + el.dataset.k;
      // a painted sun zone is a big area, so its label sits by the pointer instead of above the whole zone
      if (el.classList.contains("ztip") && e) place(e.clientX, e.clientY - 12); else { const r = el.getBoundingClientRect(); place(r.left + r.width / 2, r.top); } };
    // no tips mid-drag or while painting sun, where they would just get in the way
    const quiet = (el, e) => e.buttons || (el.matches(".sunb, .ztip") && (el.closest("#plan.painting") || document.getElementById("plantMenu")));
    document.addEventListener("mouseover", e => { const el = e.target.closest && e.target.closest(SEL); if (el && !quiet(el, e)) show(el, e); else tip.className = ""; });
    document.addEventListener("mousemove", e => { if (!tip.classList.contains("on")) return; const el = e.target.closest && e.target.closest(".ztip"); if (el && !quiet(el, e)) place(e.clientX, e.clientY - 12); });
    document.addEventListener("touchstart", e => { const el = e.target.closest && e.target.closest(".ic, .cpill, .sunb"); if (el) { show(el); clearTimeout(tip.t); tip.t = setTimeout(() => (tip.className = ""), 2000); } }, { passive: true });
    window.addEventListener("scroll", () => (tip.className = ""), true); }

  let S, bed, selIdx = -1, extraSel = [], armed = null, hoverId = null, notice = "", noFit = [], lastUnplaced = {}; noFit = [];
  let objSel = -1, objArmed = null, paint = null, pathDraw = null;   // selected object, object waiting to be placed, sun-paint mode {brush, size}

  // A new garden (first visit, Start over) is an empty rectangle with nothing on it; the steps build it up.
  function freshState() {
    return { shape: "rect", dims: {}, freePoly: null, freeView: "border", placements: [], seed: 7, fill: true, view: "codes",
      filter: { q: "", height: "", month: "", sun: "" }, bloomFilter: "sel", bloomSort: "start",
      name: "", prefs: { sun: ["full", "part", "shade"], origin: ["nat", "gar"], kinds: ["clump", "fern", "grass", "mat", "bulb"], toxic: true, daisy: true, deer: true, tender: false, v2: true }, waiting: {}, showGrid: true,
      objects: [], sun: { res: 0.5, cells: {} }, sunBase: null, showSun: true, fillMode: "ground", compSkip: [], freeCtrl: null, freeSmooth: true, done: {} };
  }
  // The example garden ("Load an example garden" in step 1): the drawn border described above, finished.
  function exampleState() {
    return Object.assign(freshState(), { name: "Example Garden", shape: "free", freePoly: DEFAULT_FREEPOLY.map(q => q.slice()), freeCtrl: DEFAULT_FREECTRL.map(q => q.slice()),
      objects: DEFAULT_OBJECTS.map(o => Object.assign({}, o)), sun: { res: 0.5, cells: starterSunCells() }, sunBase: "part", done: { name: true, bed: true, objects: true, sun: true, kind: true, avoid: true } });
  }
  function load() { try { const t = localStorage.getItem(LS); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
  let saveT = 0;
  function save() { track(); clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} }, 200); }

  // ---------- undo / redo: every saved change to the bed is a step you can go back to ----------
  const HKEYS = ["shape", "dims", "freePoly", "freeCtrl", "freeSmooth", "freeSharp", "freeView", "front", "placements", "objects", "sun", "sunBase", "waiting", "waitAck", "removed"];
  let hist = [], fut = [], hcur = null;
  const snapState = () => JSON.stringify(HKEYS.map(k => S[k] === undefined ? null : S[k]));
  function track() {
    if (!S) return;
    const s = snapState(); if (hcur === null) { hcur = s; return; } if (s === hcur) return;
    hist.push(hcur); if (hist.length > 80) hist.shift(); fut = []; hcur = s; undoUI();
  }
  function undoUI() { const u = $("#btnUndo"), r = $("#btnRedo"); if (u) u.disabled = !hist.length; if (r) r.disabled = !fut.length; }
  function applySnap(snapStr) {
    const v = JSON.parse(snapStr); HKEYS.forEach((k, i) => { S[k] = v[i]; }); normalizeExtras(); hcur = snapStr;
    bed = Geo.buildBed(S); attachExtras(); clearSel(); objSel = -1; objArmed = null; pathDraw = null; armed = null; optMode = "idle"; notice = ""; noFit = [];
    fullRender();
  }
  function undo() { track(); if (!hist.length) { toast("Nothing to undo."); return; } fut.push(hcur); applySnap(hist.pop()); undoUI(); toast("Undone. Press Redo (Ctrl+Y) to put it back."); }
  function redo() { track(); if (!fut.length) { toast("Nothing to redo."); return; } hist.push(hcur); applySnap(fut.pop()); undoUI(); toast("Redone."); }

  // objects and sun zones: make sure saved plans have them in a usable shape, and hand them to the layout engine
  function normalizeExtras() {
    if (S.done && S.done.kind && S.done.avoid === undefined) S.done.avoid = true;   // plans saved before "Plants to watch out for" became its own step
    S.objects = Array.isArray(S.objects) ? S.objects.filter(o => o && Geo.OBJ[o.t] && isFinite(o.x) && isFinite(o.y) && o.w > 0).map(o => Object.assign({ t: o.t, x: +o.x, y: +o.y, w: +o.w, h: +(o.h || o.w), rot: +(o.rot || 0) }, Array.isArray(o.pts) && o.pts.length >= 2 && o.pts.every(q => Array.isArray(q) && isFinite(q[0]) && isFinite(q[1])) ? { pts: o.pts.map(q => [+q[0], +q[1]]) } : {})) : [];
    if (!S.sun || typeof S.sun !== "object" || !S.sun.cells) S.sun = { res: 0.5, cells: {} };
    S.sun.res = 0.5;
    if (S.sunBase && !["full", "part", "shade"].includes(S.sunBase)) S.sunBase = null;
    if (!Array.isArray(S.compSkip)) S.compSkip = [];
  }
  function sunBase() { if (S.sunBase) return S.sunBase; const s = (S.prefs && S.prefs.sun) || []; return s.length === 1 ? s[0] : s.includes("part") ? "part" : s[0] || "part"; }
  function sunActive() { return !!S.sunBase || Object.keys(S.sun.cells).length > 0; }
  function zoneAt(x, y) { if (!sunActive()) return null; const r = S.sun.res; return S.sun.cells[Math.floor(x / r) + "," + Math.floor(y / r)] || sunBase(); }
  function zonesPresent() { const z = new Set([sunBase()]); Object.keys(S.sun.cells).forEach(k => z.add(S.sun.cells[k])); return z; }
  function attachExtras() { if (!bed) return; bed.objects = S.objects; bed.lightAt = zoneAt; bed.lightZones = () => (sunActive() ? zonesPresent() : null); }
  // plants (by index) standing in light that doesn't suit them
  function lightBadIdx() {
    if (!sunActive()) return [];
    const zs = zonesPresent(), out = [];
    S.placements.forEach((p, i) => { const pl = byId[p.id]; if (p.c || !pl.sun.some(z => zs.has(z))) return; if (!pl.sun.includes(zoneAt(p.x, p.y))) out.push(i); });
    return out;
  }
  let dragOrig = null;   // where every plant stood when the current drag on the bed plan began
  // ---------- making room: neighbors step aside for a plant ----------
  // Starting from where every plant was (orig), the plants in `fixed` stay where they are and any plant they
  // crowd steps out of the way, and so on outward, but only as far as needed. Plants that were never crowded
  // stay exactly where they were, so while dragging, neighbors slide back once the plant moves past them.
  // Pushed plants stay inside the bed, off objects and in light that suits them; locked plants never move.
  // Returns the indexes of plants whose spot changed since the last call.
  function makeRoom(fixed, orig) {
    const P = S.placements, before = P.map(p => [p.x, p.y]);
    P.forEach((p, i) => { if (!fixed.has(i) && orig[i]) { p.x = orig[i].x; p.y = orig[i].y; } });
    const blocks = (S.objects || []).map(Geo.objBlock).filter(Boolean), zs = sunActive() ? zonesPresent() : null;
    const sp = i => Geo.spFt(byId[P[i].id]);
    const can = i => !fixed.has(i) && !P[i].lock && !P[i].c;
    const okAt = (i, x, y) => {
      const r = sp(i) / 2, pl = byId[P[i].id];
      if (!Geo.pip(bed.poly, x, y) || Geo.edgeDist(bed.poly, x, y) < r * 0.5) return false;
      for (const b of blocks) if (Geo.objDist(b, x, y) < r * 0.6) return false;
      if (zs && pl.sun && pl.sun.some(z => zs.has(z))) {      // never push a plant out of light it likes
        const was = orig[i] ? zoneAt(orig[i].x, orig[i].y) : null;
        if (pl.sun.includes(was) && !pl.sun.includes(zoneAt(x, y))) return false;
      }
      return true;
    };
    const need = (i, j) => { const A = byId[P[i].id], B = byId[P[j].id]; return (sp(i) + sp(j)) / 2 * (!!A.dormant !== !!B.dormant ? 0.3 : 0.85); };
    const active = new Set(fixed);
    for (let it = 0; it < 24; it++) {
      let any = false;
      for (const a of [...active]) {
        if (P[a].c) continue;
        for (let j = 0; j < P.length; j++) {
          if (j === a || P[j].c) continue;
          const dx = P[j].x - P[a].x, dy = P[j].y - P[a].y, d = Math.hypot(dx, dy), n = need(a, j);
          if (d >= n - 1e-3) continue;
          const m = can(j) ? j : can(a) ? a : -1; if (m < 0) continue;
          let ux = m === j ? dx : -dx, uy = m === j ? dy : -dy, L = Math.hypot(ux, uy);
          if (L < 1e-6) { ux = 1; uy = 0; L = 1; }
          ux /= L; uy /= L;
          const step = n - d + 0.02;
          for (const rot of [0, 0.5, -0.5, 1, -1, 1.5, -1.5]) {   // straight away first, then angled, to slip past edges and objects
            const c = Math.cos(rot), s = Math.sin(rot), x = P[m].x + (ux * c - uy * s) * step, y = P[m].y + (ux * s + uy * c) * step;
            if (okAt(m, x, y)) { P[m].x = x; P[m].y = y; active.add(m); any = true; break; }
          }
        }
      }
      if (!any) break;
    }
    const out = []; P.forEach((p, i) => { if (p.x !== before[i][0] || p.y !== before[i][1]) out.push(i); });
    return out;
  }
  // the best open spot for plant k inside sun zone z: as little crowding as possible, close to where the plant
  // was, at the right depth for its height
  function bestSpotIn(k, z) {
    const P = S.placements, q = P[k], pl = byId[q.id], r = Geo.spFt(pl) / 2;
    const blocks = (S.objects || []).map(Geo.objBlock).filter(Boolean), t = Geo.depthTargets(selected())[q.id];
    const bb = bed.bb, st = Math.max(0.25, r / 2);
    let best = null, bs = 1e9;
    for (let x = bb.x0 + st / 2; x < bb.x0 + bb.w; x += st) for (let y = bb.y0 + st / 2; y < bb.y0 + bb.h; y += st) {
      if (zoneAt(x, y) !== z || !Geo.pip(bed.poly, x, y) || Geo.edgeDist(bed.poly, x, y) < r * 0.75) continue;
      if (blocks.some(b => Geo.objDist(b, x, y) < r * 0.7)) continue;
      let crowd = 0;
      P.forEach((o, j) => {
        if (j === k || o.c) return;
        const B = byId[o.id], n = (Geo.spFt(pl) + Geo.spFt(B)) / 2 * (!!pl.dormant !== !!B.dormant ? 0.3 : 0.85), d = Math.hypot(o.x - x, o.y - y);
        if (d < n) crowd += (n - d) * (o.lock ? 4 : 1);
      });
      const sc = crowd * 4 + Math.hypot(x - q.x, y - q.y) * 0.15 + (t != null && bed.depth ? Math.abs(bed.depth(x, y) - t) * 2 : 0);
      if (sc < bs) { bs = sc; best = [x, y]; }
    }
    return best;
  }
  const ZONE_WORD = { full: "full sun", part: "part shade", shade: "shade" };
  // a plant's row dragged into another sun section of the Garden Timeline: move those plants into that light on
  // the bed plan, and let their new neighbors step aside
  function moveToZone(id, from, to) {
    const pl = byId[id]; notice = ""; noFit = [];
    S.placements = S.placements.filter(q => !q.c);
    const idxs = S.placements.map((q, i) => i).filter(i => S.placements[i].id === id && zoneAt(S.placements[i].x, S.placements[i].y) === from);
    const locked = idxs.filter(i => S.placements[i].lock).length;
    let moved = 0, failed = 0;
    idxs.filter(i => !S.placements[i].lock).forEach(k => {
      const spot = bestSpotIn(k, to); if (!spot) { failed++; return; }
      const orig = S.placements.map(p => ({ x: p.x, y: p.y }));
      S.placements[k].x = spot[0]; S.placements[k].y = spot[1];
      makeRoom(new Set([k]), orig); moved++;
    });
    recarpet(); refresh();
    const n = moved > 1 ? moved + " " : "";
    let msg = moved ? `Moved ${n}${pl.name} into ${ZONE_WORD[to]}. Nearby plants stepped aside to make room.` : `There's no open spot in ${ZONE_WORD[to]} for ${pl.name}.`;
    if (moved && !pl.sun.includes(to)) msg += ` ${pl.name} doesn't like that light, though.`;
    if (failed && moved) msg += ` ${failed} couldn't fit.`;
    if (locked) msg += ` ${locked} locked ${locked > 1 ? "ones stay" : "one stays"} put.`;
    toast(msg, 4000);
  }
  // dragging a plant's row between the sun sections of the Garden Timeline
  let rowDrag = null, eatRowClick = 0;
  function rowDragDown(e, r, p, zone) {
    if (e.button !== 0 || e.target.closest("button, a")) return;
    rowDrag = { r, p, zone, sx: e.clientX, sy: e.clientY, on: false, id: e.pointerId };
    const move = ev => {
      if (!rowDrag || ev.pointerId !== rowDrag.id) return;
      if (!rowDrag.on) {
        if (Math.hypot(ev.clientX - rowDrag.sx, ev.clientY - rowDrag.sy) < 6) return;
        rowDrag.on = true;
        const gh = document.createElement("div"); gh.className = "rowghost";
        gh.innerHTML = r.querySelector(".lab").innerHTML; document.body.appendChild(gh); rowDrag.gh = gh;
        r.classList.add("dragsrc"); document.body.classList.add("rowdragging");
        document.querySelectorAll("#bloomRows .zone-head").forEach(h => h.classList.toggle("zok", p.sun.includes(h.dataset.zone)));
        $("#bloomRows").classList.add("tl-drag");
      }
      ev.preventDefault();
      rowDrag.gh.style.left = ev.clientX + 12 + "px"; rowDrag.gh.style.top = ev.clientY + 8 + "px";
      const under = document.elementFromPoint(ev.clientX, ev.clientY), hit = under && under.closest("#bloomRows [data-zone]"), z = hit ? hit.dataset.zone : null;
      rowDrag.over = z;
      document.querySelectorAll("#bloomRows [data-zone]").forEach(el => el.classList.toggle("zhover", !!z && el.dataset.zone === z && z !== rowDrag.zone));
    };
    const up = ev => {
      document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
      const d = rowDrag; rowDrag = null; if (!d || !d.on) return;
      eatRowClick = Date.now();
      if (d.gh) d.gh.remove();
      document.body.classList.remove("rowdragging"); $("#bloomRows").classList.remove("tl-drag");
      document.querySelectorAll("#bloomRows .zhover, #bloomRows .zok, #bloomRows .dragsrc").forEach(el => el.classList.remove("zhover", "zok", "dragsrc"));
      if (ev.type === "pointerup" && d.over && d.over !== d.zone) moveToZone(d.p.id, d.zone, d.over);
    };
    document.addEventListener("pointermove", move, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
  }
  // how much of the bed the objects take up (trees only count their trunk)
  const polyLen = P => P.reduce((s, q, i) => s + (i ? Math.hypot(q[0] - P[i - 1][0], q[1] - P[i - 1][1]) : 0), 0);
  function objArea() { return S.objects.reduce((a, o) => a + (o.t === "tree" ? Math.PI * Geo.trunkR(o) ** 2 : o.t === "path" ? (o.pts ? o.w * polyLen(Geo.pathPts(o)) : o.w * o.h) : o.t === "rock" ? Math.PI * o.w * o.h / 4 : Math.PI * o.w * o.w / 4), 0); }
  const plantBed = () => Object.assign({}, bed, { area: Math.max(bed.area * 0.3, bed.area - objArea()) });
  function toast(msg, ms) { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), ms || 2600); }

  // counts include plants that are chosen but didn't fit in the bed ("waiting"), so they stay on the shopping list
  function counts(real) { const c = {}; S.placements.forEach(p => { if (real && p.c) return; c[p.id] = (c[p.id] || 0) + 1; }); const w = S.waiting || {}; Object.keys(w).forEach(id => { if (byId[id] && w[id] > 0) c[id] = (c[id] || 0) + w[id]; }); return c; }
  // plans saved before spring bulbs and the deer option existed: turn the new choices on
  function migratePrefs(raw) { const pr = S.prefs; if (!(raw && raw.v2)) { if (Array.isArray(pr.kinds) && !pr.kinds.includes("bulb")) pr.kinds.push("bulb"); if (pr.deer == null) pr.deer = true; pr.v2 = true; } if (pr.tender == null) pr.tender = false; }
  function cleanWaiting(w) { const o = {}; if (w && typeof w === "object") Object.keys(w).forEach(k => { const n = Math.floor(+w[k]); if (byId[k] && n > 0 && n < 500) o[k] = n; }); return o; }
  function placedCounts() { const c = {}; S.placements.forEach(p => { c[p.id] = (c[p.id] || 0) + 1; }); return c; }
  const waitTotal = () => Object.keys(S.waiting || {}).reduce((s, k) => s + (S.waiting[k] > 0 ? S.waiting[k] : 0), 0);
  function addWaiting(id, n) { S.waiting = S.waiting || {}; S.waiting[id] = (S.waiting[id] || 0) + n; S.waitAck = false; }
  // the groundcover used for the carpet: the smallest chosen filler plant that is also chosen on purpose
  function fillerId() {
    const rc = counts(true);
    const cand = PL.filter(p => p.filler && rc[p.id] > 0).sort((a, b) => a.spacing - b.spacing)[0];
    return cand ? cand.id : null;
  }
  function recarpet() { /* filler is now added only by the Fill the gaps button */ }
  function isGroundcover(p) { return !!p.c || !!(byId[p.id] && byId[p.id].filler); }
  // every selected plant: the main one plus any added with shift/ctrl
  function selAll() { const out = []; [selIdx].concat(extraSel).forEach(i => { if (i >= 0 && S.placements[i] && !out.includes(i)) out.push(i); }); return out; }
  // "Select more plants" (from a plant's menu) makes every tap add or remove a plant, for touch screens
  // where there's no Ctrl or Shift key. It ends with Done, Esc, or when nothing is selected any more.
  let multiTap = false;
  function clearSel() { selIdx = -1; extraSel = []; multiTap = false; }
  // Shift-click (or "Select all ..." in the menu): add every plant of that kind to what's picked; if they're all
  // picked already, take them all out again
  const sameKind = i => S.placements.map((q, j) => (q.id === S.placements[i].id && !q.c ? j : -1)).filter(j => j >= 0);
  function selectKind(i) {
    if (!S.placements[i]) return;
    const kind = sameKind(i), cur = selAll();
    const next = kind.every(j => cur.includes(j)) ? cur.filter(j => !kind.includes(j)) : cur.concat(kind.filter(j => !cur.includes(j)));
    const first = next.includes(i) ? i : next[next.length - 1];
    selIdx = first === undefined ? -1 : first; extraSel = next.filter(j => j !== selIdx);
    if (selIdx >= 0) optMode = "idle";
  }
  // kinds of plant in the current selection, and selecting every planted one of some kinds
  const selIds = () => { const s = []; selAll().forEach(i => { const id = S.placements[i] && S.placements[i].id; if (id && !s.includes(id)) s.push(id); }); return s; };
  // pick exactly these plants on the bed plan (the "Select them" buttons in the notes under the plan)
  function selectIdx(idx) { idx = idx.filter(i => S.placements[i]); selIdx = idx.length ? idx[0] : -1; extraSel = idx.slice(1); multiTap = false; objSel = -1; if (selIdx >= 0) optMode = "idle"; renderPlan(); }
  function selectIds(ids) {
    const idx = []; S.placements.forEach((p, i) => { if (ids.includes(p.id)) idx.push(i); });
    selIdx = idx.length ? idx[0] : -1; extraSel = idx.slice(1); if (selIdx >= 0) optMode = "idle";
  }
  // click in the bloom chart or Small to big: highlight that plant; Shift or Ctrl adds or removes it from the highlight
  function pickFromChart(id, add) {
    let ids = selIds();
    if (add) ids = ids.includes(id) ? ids.filter(x => x !== id) : ids.concat(id);
    else ids = ids.length === 1 && ids[0] === id ? [] : [id];
    if (ids.length && !S.placements.some(p => ids.includes(p.id))) toast("That plant doesn't fit in the bed yet, so there is nothing to highlight on the plan.");
    selectIds(ids); renderPlan();
  }
  const HLK = ["tox", "deer", "daisy", "nat", "gar"];
  function hlKind(p) { return p.toxic && p.toxic.length ? "tox" : deerEats(p) ? "deer" : p.fam === "daisy" ? "daisy" : p.native ? "nat" : "gar"; }
  window.plannerHlKind = hlKind;
  function markSel() { const ids = selIds(); document.querySelectorAll(".brow,.ocol,#shop tr[data-id]").forEach(e => { const on = ids.includes(e.dataset.id); e.classList.toggle("sel", on); HLK.forEach(k => e.classList.remove("hl-" + k)); if (on) { const p = PL.find(x => x.id === e.dataset.id); if (p) e.classList.add("hl-" + hlKind(p)); } }); }
  function stripFiller() { S.placements = S.placements.filter(p => !isGroundcover(p)); selIdx = -1; }
  function selected() { const c = counts(); return PL.filter(p => c[p.id] > 0); }

  // ---------- layout actions ----------
  function relayout(seedBump, items) {
    const c = counts(true);
    items = items || PL.filter(p => c[p.id] > 0).map(p => ({ plant: p, n: c[p.id] }));
    if (seedBump) S.seed = (S.seed * 7 + 13) % 100000;
    // locked plants keep their spot; only the rest get laid out again
    S.placements.forEach(p => { if (p.lock && !Geo.pip(bed.poly, p.x, p.y)) delete p.lock; });   // a locked plant left outside a reshaped bed is set free
    const locked = S.placements.filter(p => p.lock && !p.c), lockedCount = {};
    locked.forEach(p => { lockedCount[p.id] = (lockedCount[p.id] || 0) + 1; });
    const avoidPlants = []; const seen = {}; locked.forEach(p => { if (!seen[p.id]) { seen[p.id] = 1; avoidPlants.push(byId[p.id]); } });
    const remaining = items.map(it => ({ plant: it.plant, n: it.n - (lockedCount[it.plant.id] || 0), zones: it.zones })).filter(it => it.n > 0);
    if (!remaining.length) { S.placements = locked; S.waiting = {}; notice = ""; noFit = []; lastUnplaced = {}; selIdx = -1; return; }
    setZoneTargets(remaining.map(it => it.plant).concat(avoidPlants));
    // try several arrangements and keep the one that fits the most plants
    let r = null, seed = S.seed;
    for (let t = 0; t < 8; t++) {
      const cand = Geo.autoLayout(bed, remaining, seed, { fill: false, avoid: locked, avoidPlants }), miss = Object.keys(cand.unplaced).reduce((s, k) => s + cand.unplaced[k], 0);
      if (!r || miss < r.miss) { r = cand; r.miss = miss; r.seed = seed; }
      if (!miss) break;
      seed = (seed * 31 + 17) % 100000;
    }
    S.seed = r.seed;
    S.placements = locked.concat(r.placements); selIdx = -1;
    // painted sun zones: give any plant that still landed in the wrong light one more try somewhere that suits it
    // painted sun zones: any plant still in the wrong light gets one more try somewhere that suits it; if there's
    // no room in its light, it waits on the shopping list instead of going in the wrong spot
    lightBadIdx().map(i => S.placements[i]).forEach(pl => {
      if (pl.lock || moveToLight(pl)) return;
      S.placements.splice(S.placements.indexOf(pl), 1); r.unplaced[pl.id] = (r.unplaced[pl.id] || 0) + 1;
    });
    heightSort();
    lastUnplaced = r.unplaced;
    const missing = Object.keys(r.unplaced).reduce((s, k) => s + r.unplaced[k], 0);
    const before = waitTotal(); S.waiting = Object.assign({}, r.unplaced); if (missing && missing !== before) S.waitAck = false;
    notice = ""; noFit = [];
  }
  // Where each plant should sit front to back, by sun zone: plants that can grow in a zone are ranked by height
  // among themselves and spread over that zone's own front-to-back range (a shade zone that only covers the
  // back half of the bed still gets its short plants in front and tall ones behind). Without zones, the whole
  // bed is one range. Sets bed.targetAt for the layout engine and for heightSort.
  function setZoneTargets(plants) {
    if (!bed || !bed.depth) return;
    if (!sunActive() || !plants.length) { bed.targetAt = null; return; }
    const zs = zonesPresent(), bb = bed.bb, depths = {};
    for (let x = bb.x0 + 0.25; x < bb.x0 + bb.w; x += 0.5) for (let y = bb.y0 + 0.25; y < bb.y0 + bb.h; y += 0.5) {
      if (!Geo.pip(bed.poly, x, y)) continue; const z = zoneAt(x, y); (depths[z] = depths[z] || []).push(bed.depth(x, y));
    }
    const R = {};
    zs.forEach(z => {
      const d = (depths[z] || []).sort((p, q) => p - q); if (!d.length) return;
      const lo = d[Math.floor(d.length * 0.05)], hi = d[Math.min(d.length - 1, Math.floor(d.length * 0.95))];
      const fits = plants.filter(p => !p.sun || !p.sun.some(s => zs.has(s)) || p.sun.includes(z)), hs = fits.map(Geo.hMean);
      R[z] = { lo, hi, hmin: Math.min(...hs), hmax: Math.max(...hs) };
    });
    bed.targetAt = (id, x, y, fallback) => {
      const r = R[zoneAt(x, y)], p = byId[id]; if (!r || !p || !isFinite(r.hmin)) return fallback;
      const t = r.hmax > r.hmin ? (Geo.hMean(p) - r.hmin) / (r.hmax - r.hmin) : 0.5;
      return r.lo + (r.hi - r.lo) * (0.1 + 0.8 * t);
    };
  }
  function heightWrong() {
    if (!bed || !bed.depth) return 0;
    const P = S.placements.filter(q => !q.c), h = q => Geo.hMean(byId[q.id]), sp = q => Geo.spFt(byId[q.id]);
    let n = 0;
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const a = P[i], b = P[j];
      if (Math.abs(h(a) - h(b)) < 10 || Math.hypot(a.x - b.x, a.y - b.y) > (sp(a) + sp(b)) / 2 * 1.6) continue;
      const [tl, sh] = h(a) > h(b) ? [a, b] : [b, a];
      if (bed.depth(tl.x, tl.y) - bed.depth(sh.x, sh.y) < -0.05) n++;
    }
    return n;
  }
  // A stronger height pass, run once at the end of Re-arrange and Suggest a planting: for each taller plant that
  // stands in front of a shorter neighbor, swap the two and let the plants around them step aside (the same
  // push as dragging). The swap is kept only if the bed as a whole ends up better ordered by height, with no
  // new crowding and nobody in the wrong light.
  function heightPolish() {
    if (!bed || !bed.depth) return;
    const P = S.placements, t = Geo.depthTargets(selected()), zs = sunActive() ? zonesPresent() : null;
    const h = i => Geo.hMean(byId[P[i].id]), sp = i => Geo.spFt(byId[P[i].id]);
    const want = i => { const f = t[P[i].id] != null ? t[P[i].id] : 0.5; return bed.targetAt ? bed.targetAt(P[i].id, P[i].x, P[i].y, f) : f; };
    const total = () => { let s = 0; P.forEach((q, i) => { if (!q.c) s += Math.abs(bed.depth(q.x, q.y) - want(i)); }); return s; };
    const lightOk = i => { const pl = byId[P[i].id]; return !zs || !pl.sun || !pl.sun.some(z => zs.has(z)) || pl.sun.includes(zoneAt(P[i].x, P[i].y)); };
    const wrongPairs = () => {
      const out = [];
      for (let i = 0; i < P.length; i++) for (let j = 0; j < P.length; j++) {
        if (i === j || P[i].c || P[j].c || P[i].lock || P[j].lock || P[i].id === P[j].id || h(i) - h(j) < 10) continue;
        if (Math.hypot(P[i].x - P[j].x, P[i].y - P[j].y) > (sp(i) + sp(j)) / 2 * 1.8) continue;
        const dd = bed.depth(P[i].x, P[i].y) - bed.depth(P[j].x, P[j].y);   // i is the taller one
        if (dd < -0.04) out.push([i, j, dd]);
      }
      return out.sort((a, b) => a[2] - b[2]);
    };
    let tries = 0;
    for (let pass = 0; pass < 6 && tries < 400; pass++) {
      let any = false;
      for (const [i, j] of wrongPairs()) {
        if (++tries > 400) break;
        const snap = P.map(q => ({ x: q.x, y: q.y })), base = total(), baseO = overlapPairs().length;
        P[i].x = snap[j].x; P[i].y = snap[j].y; P[j].x = snap[i].x; P[j].y = snap[i].y;
        if (lightOk(i) && lightOk(j)) {
          makeRoom(new Set([i, j]), snap);
          if (total() < base - 0.03 && overlapPairs().length <= baseO) { any = true; continue; }
        }
        P.forEach((q, k) => { q.x = snap[k].x; q.y = snap[k].y; });
      }
      if (!any) break;
    }
  }
  // Height order: after a layout, swap pairs of plants whenever that puts the taller one farther back (and the
  // shorter one farther forward), as long as both still sit in light they like, stay inside the bed, off
  // objects and properly spaced. A small pull keeps each plant near others of its kind, so drifts hold together.
  function heightSort() {
    if (!bed || !bed.depth) return;
    const P = S.placements, idx = P.map((q, i) => i).filter(i => !P[i].c && !P[i].lock), t = Geo.depthTargets(selected());
    const blocks = (S.objects || []).map(Geo.objBlock).filter(Boolean), zs = sunActive() ? zonesPresent() : null;
    const sp = i => Geo.spFt(byId[P[i].id]);
    const depthCost = (i, x, y) => { const f = t[P[i].id] != null ? t[P[i].id] : 0.5; return Math.abs(bed.depth(x, y) - (bed.targetAt ? bed.targetAt(P[i].id, x, y, f) : f)); };
    const kin = (i, x, y, skip) => {   // distance to the nearest other plant of the same kind, beyond a comfortable gap
      let m = Infinity; P.forEach((q, j) => { if (j !== i && j !== skip && !q.c && q.id === P[i].id) m = Math.min(m, Math.hypot(q.x - x, q.y - y)); });
      return m === Infinity ? 0 : Math.max(0, m - sp(i) * 1.5);
    };
    const cost = (i, x, y, skip) => depthCost(i, x, y) + kin(i, x, y, skip) * 0.03;
    const okAt = (i, x, y, skip) => {
      const pl = byId[P[i].id], r = sp(i) / 2;
      if (!Geo.pip(bed.poly, x, y) || Geo.edgeDist(bed.poly, x, y) < r * 0.6) return false;
      for (const b of blocks) if (Geo.objDist(b, x, y) < r * 0.65) return false;
      if (zs && pl.sun && pl.sun.some(z => zs.has(z)) && !pl.sun.includes(zoneAt(x, y))) return false;
      for (let j = 0; j < P.length; j++) {
        if (j === i || j === skip || P[j].c) continue;
        const B = byId[P[j].id], f = !!pl.dormant !== !!B.dormant ? 0.3 : 0.74;
        if (Math.hypot(P[j].x - x, P[j].y - y) < (sp(i) + sp(j)) / 2 * f) return false;
      }
      return true;
    };
    for (let pass = 0; pass < 8; pass++) {
      let any = false;
      for (let u = 0; u < idx.length; u++) for (let v = u + 1; v < idx.length; v++) {
        const a = idx[u], b = idx[v], A = P[a], B = P[b];
        if (A.id === B.id) continue;
        const ax = A.x, ay = A.y, bx = B.x, by = B.y;
        const gain = cost(a, ax, ay, b) + cost(b, bx, by, a) - cost(a, bx, by, b) - cost(b, ax, ay, a);
        if (gain < 0.03) continue;
        if (!okAt(a, bx, by, b) || !okAt(b, ax, ay, a)) continue;
        A.x = bx; A.y = by; B.x = ax; B.y = ay; any = true;
      }
      if (!any) break;
    }
  }
  function rebuildBed(keepLayout) {
    bed = Geo.buildBed(S); attachExtras();
    bringObjectsInside();
    if (!keepLayout) relayout(false);
  }
  // Objects are only drawn inside the bed. One whose middle ends up outside (the bed was made smaller or
  // reshaped) moves to the nearest spot inside, keeping clear of the edge when it can.
  function moveInside(o) {
    const bb = bed.bb, want = Math.min(o.w, o.h || o.w) / 2 * 0.6;
    for (const m of [want, 0.05]) {
      let best = null, bd = Infinity;
      for (let x = bb.x0; x <= bb.x1; x += 0.25) for (let y = bb.y0; y <= bb.y1; y += 0.25) {
        if (!Geo.pip(bed.poly, x, y) || Geo.edgeDist(bed.poly, x, y) < m) continue;
        const d = Math.hypot(x - o.x, y - o.y); if (d < bd) { bd = d; best = [x, y]; }
      }
      if (best) { const dx = best[0] - o.x, dy = best[1] - o.y; if (o.pts) o.pts = o.pts.map(q => [q[0] + dx, q[1] + dy]); o.x = best[0]; o.y = best[1]; return true; }
    }
    return false;
  }
  function bringObjectsInside() { let n = 0; (S.objects || []).forEach(o => { if (!Geo.pip(bed.poly, o.x, o.y) && moveInside(o)) n++; }); return n; }
  function addMany(id, n) {
    let added = 0;
    for (let i = 0; i < n; i++) if (addOne(id, true)) added++;
    if (added < n) addWaiting(id, n - added);
    return added;
  }
  function addOne(id, quiet) {
    S.placements = S.placements.filter(q => !q.c);
    const sel = selected(); if (!sel.some(p => p.id === id)) sel.push(byId[id]);
    const t = Geo.depthTargets(sel);
    const p = Geo.placeOne(bed, byId, S.placements, id, t, 0);
    if (p) S.placements.push(p);
    recarpet();
    if (!p) { if (!quiet) addWaiting(id, 1); return false; }
    return true;
  }
  function removeOne(id) {
    if (S.waiting && S.waiting[id] > 0) { S.waiting[id]--; if (!S.waiting[id]) delete S.waiting[id]; return; }
    for (let i = S.placements.length - 1; i >= 0; i--) if (S.placements[i].id === id && !S.placements[i].c) { S.placements.splice(i, 1); selIdx = -1; recarpet(); return; }
  }
  function removePlant(id) { S.placements = S.placements.filter(p => p.id !== id); if (S.waiting) delete S.waiting[id]; selIdx = -1; if (armed === id) armed = null; recarpet(); }
  function togglePlant(id) {
    notice = ""; noFit = [];
    if (S.removed) delete S.removed[id];
    if (counts()[id] > 0) removePlant(id); else addOne(id);   // + Add puts in one plant; use + for more
    refresh();
  }
  function setQty(id, d) {
    notice = ""; noFit = [];
    if (d > 0) addOne(id); else if (counts()[id] > 0) removeOne(id);
    refresh();
  }

  // ---------- library ----------
  const KINDS = [["all", "All"], ["clump", "Flowers"], ["fern", "Ferns"], ["grass", "Grasses & sedges"], ["mat", "Groundcovers"], ["bulb", "Spring bulbs"]];
  function renderShapesPanel() {
    const box = $("#shapes"); box.innerHTML = ""; $("#bedPanel").classList.toggle("isdrawing", window.Plan.isDrawing());
    ["rect", "circle", "free"].forEach(k => {
      const sh = Geo.SHAPES[k]; let poly;
      if (k === "free") poly = [[0, 0], [9, 1], [11, 5], [7, 7], [3, 6], [0, 4]];
      else { const d = {}; sh.params.forEach(q => (d[q.k] = q.def)); poly = Geo.buildBed({ shape: k, dims: d }).poly; }
      const bb = Geo.bbox(poly), s = Math.min(40 / bb.w, 26 / bb.h), ox = (44 - bb.w * s) / 2, oy = (30 - bb.h * s) / 2;
      const pts = poly.map(q => `${(ox + (q[0] - bb.x0) * s).toFixed(1)},${(oy + (bb.y1 - q[1]) * s).toFixed(1)}`).join(" ");
      const b = document.createElement("button");
      const cur = window.Plan.isDrawing() ? "free" : S.shape;   // while drawing, Draw your own is the pick
      b.className = "shape" + (cur === k ? " on" : ""); b.type = "button";
      b.innerHTML = `<svg viewBox="0 0 44 30"><polygon points="${pts}" fill="#C9AE92" stroke="#8E7660" stroke-width="1.6" stroke-linejoin="round"/></svg>${sh.label}`;
      b.onclick = () => { shapeClicked(k); };
      box.appendChild(b);
    });
    $("#shapeHint").textContent = window.Plan.isDrawing() ? "Reshape your bed on the plan: drag the dots, click a + to add a corner, or drag inside to move it. \"Clear shape\" starts from scratch." : S.shape === "free" ? (S.freePoly ? "Your own outline. Click Edit the outline to reshape it on the plan." : "Click points to outline any shape you like.") : Geo.SHAPES[S.shape].hint;
  }
  // what's on the bed right now, for the shape-change question
  function bedContents() {
    const n = S.placements.filter(p => !p.c).length, m = S.objects.length, parts = [];
    if (n) parts.push(n + " plant" + (n === 1 ? "" : "s"));
    if (m) parts.push(m + " object" + (m === 1 ? "" : "s") + " (like paths and birdbaths)");
    return { any: S.placements.length > 0 || m > 0, one: n + m === 1, text: parts.join(" and ") || "groundcover filler" };
  }
  // empty the bed for a fresh start: plants, objects and painted sun zones all go (Undo brings them back)
  function clearBedAll() {
    S.placements = []; S.waiting = {}; S.objects = []; S.sun = { res: (S.sun && S.sun.res) || 0.5, cells: {} };
    selIdx = -1; extraSel = []; objSel = -1; notice = ""; noFit = [];
  }
  // a rectangle or island sized like the bed you have now, so the plants you keep fit about the same
  function matchedDims(k) {
    const sh = Geo.SHAPES[k], d = {}; sh.params.forEach(q => (d[q.k] = q.def));
    if (!bed || !bed.bb) return d;
    const lim = (q, v) => Math.max(q.min, Math.min(q.max, Math.round(v * 2) / 2));
    if (k === "rect") { d.w = lim(sh.params[0], bed.bb.w); d.d = lim(sh.params[1], bed.bb.h); }
    if (k === "circle") d.dia = lim(sh.params[0], 2 * Math.sqrt(bed.area / Math.PI));
    return d;
  }
  // a pop-up with a short explanation and a few choices (the first is the main one), plus Cancel
  function askChoice(title, lines, choices) {
    openModal(title, ({ top, bottom }) => {
      const d = document.createElement("div"); d.className = "fp-desc"; d.innerHTML = lines.map(l => "<p>" + esc(l) + "</p>").join(""); top.appendChild(d);
      const acts = document.createElement("div"); acts.className = "po-acts";
      const btn = (label, cls, fn) => { const b = document.createElement("button"); b.type = "button"; b.className = cls; b.textContent = label; b.onclick = () => { closeModal(); fn && fn(); }; acts.appendChild(b); };
      choices.forEach(([label, fn], i) => btn(label, i === 0 ? "btn primary" : "btn", fn));
      btn("Cancel", "btn small", null);
      bottom.appendChild(acts);
    }, { fp: true });
  }
  // the shape-change question: keep what's on the bed (re-fit to the new shape) or clear it and start over
  function askShape(title, lines, keepLabel, onKeep, onClear) {
    askChoice(title, lines, (onKeep ? [[keepLabel, onKeep]] : []).concat([["Clear the bed and start over", onClear]]));
  }
  function shapeClicked(k) {
    // picking a shape while the outline editor is open closes it first (as if Cancel was pressed), so the
    // bed you pick is what you see
    if (window.Plan.isDrawing()) window.Plan.cancelDraw();
    clearSel(); objSel = -1;
    const c = bedContents(), label = Geo.SHAPES[k].label.toLowerCase(), now = `There ${c.one ? "is" : "are"} ${c.text} on the bed now.`;
    if (k === "free") {
      // Draw your own always opens the outline editor; the question is only whether to keep what's planted
      if (!c.any) { startDraw(); return; }   // starts from the bed you have now; "Clear shape" gives a blank canvas
      askShape("Draw your own outline", [now,
        "Keep them and I'll open your current outline so you can reshape it. When you save, your plants are re-arranged to fit the new shape.",
        "Or clear the bed and draw a brand-new outline from scratch. You can undo either one."],
        "Keep my plants", () => startDraw(), () => startDraw({ fresh: true }));
      return;
    }
    if (S.shape === k) {
      if (!c.any) { toast("This is already a " + label + ", and the bed is empty."); return; }
      askShape("Start this bed over?", [now, `Clearing removes them, plus any mapped sun zones, and leaves an empty ${label} the same size as now. You can undo this.`],
        null, null, () => { clearBedAll(); rebuildBed(); fullRender(); toast("Bed cleared. Ready for new plants."); });
      return;
    }
    if (!c.any) { applyShape(k, true); return; }
    askShape(`Switch to a ${label}?`, [now,
      `Keep them and I'll size the ${label} to match your bed and re-arrange your plants to fit it.`,
      `Or clear the bed (plants, objects and mapped sun zones) and start fresh with an empty ${label}. You can undo either one.`],
      "Keep my plants", () => { applyShape(k, true); toast(`Switched to a ${label} and re-arranged your plants to fit.`); },
      () => { clearBedAll(); applyShape(k, false); toast(`Started over with an empty ${label}.`); });
  }
  function applyShape(k, match) {
    const dims = match ? matchedDims(k) : (() => { const d = {}; Geo.SHAPES[k].params.forEach(q => (d[q.k] = q.def)); return d; })();
    S.shape = k; S.dims = dims; delete S.front; S.freeView = "border"; rebuildBed(); fullRender();
  }
  // ---------- step 2: the size of the bed ----------
  // Rectangle and island get plain-language sizes with big - and + buttons; a drawn bed gets its outline
  // button and a plain choice of which side people see it from. A summary line always shows the size.
  const DIMLAB = { w: ["Length", "along the front edge"], d: ["Depth", "front to back"], dia: ["Across", "edge to edge"] };
  let dimT = 0;
  function renderDims() {
    const sh = Geo.SHAPES[S.shape], box = $("#dims"); box.innerHTML = ""; box.className = "dims dims-" + S.shape;
    const applySoon = () => { clearTimeout(dimT); dimT = setTimeout(() => { rebuildBed(); refresh(); }, 350); };
    sh.params.forEach(q => {
      const row = document.createElement("div"); row.className = "dimrow";
      const [nm, sub] = DIMLAB[q.k] || [q.label, ""];
      row.innerHTML = `<div class="dimlab"><b>${nm}</b><span>${sub}</span></div>`;
      const st = document.createElement("div"); st.className = "stepper";
      const mk = (t, title) => { const b = document.createElement("button"); b.type = "button"; b.className = "stbtn"; b.textContent = t; b.title = title; return b; };
      const minus = mk("−", "1 ft smaller"), plus = mk("+", "1 ft bigger");
      const i = document.createElement("input"); i.type = "number"; i.min = q.min; i.max = q.max; i.step = 0.5; i.inputMode = "decimal"; i.setAttribute("aria-label", nm + " in feet");
      const unit = document.createElement("span"); unit.className = "stunit"; unit.textContent = "ft";
      const cur = () => (S.dims[q.k] != null ? S.dims[q.k] : q.def);
      const show = () => { const v = cur(); if (document.activeElement !== i) i.value = v; minus.disabled = v <= q.min; plus.disabled = v >= q.max; };
      const set = (v, typing) => { if (!isFinite(v)) return; v = Math.max(q.min, Math.min(q.max, Math.round(v * 2) / 2)); S.dims[q.k] = v; if (!typing) i.value = v; show(); renderBedSummary(); applySoon(); };
      minus.onclick = () => set(cur() - 1); plus.onclick = () => set(cur() + 1);
      i.oninput = () => set(parseFloat(i.value), true);
      i.onchange = () => { set(parseFloat(i.value)); i.value = cur(); };
      i.onkeydown = e => { if (e.key === "Enter") i.blur(); };
      st.append(minus, i, unit, plus); row.appendChild(st); box.appendChild(row); show();
    });
    if (S.shape === "free") {
      const draw = document.createElement("button"); draw.type = "button"; draw.className = "btn primary bp-draw"; draw.id = "btnDraw";
      draw.textContent = S.freePoly ? "Edit the outline" : "Draw the outline"; draw.onclick = () => startDraw(); box.appendChild(draw);
    }
    renderFront(box);
    renderBedSummary();
  }
  // Where the bed is seen from: a 3 x 3 pad around a little bed, with arrows pointing in from each edge and
  // corner. Pick one or more: short plants go along every side people look from, getting taller toward the
  // spot farthest from all of them. The middle means seen from all sides (an island), tallest in the middle.
  const FRONT_NAME = { s: "the bottom edge", n: "the top edge", w: "the left side", e: "the right side", sw: "the bottom left corner", se: "the bottom right corner", nw: "the top left corner", ne: "the top right corner" };
  const viewWords = vs => window.Plan.sidesList(vs);   // "bottom edge and left side"
  function renderFront(box) {
    const cur = bed ? (bed.views || [bed.front]) : ["s"];
    const lab = document.createElement("div"); lab.className = "bp-lab"; lab.innerHTML = "Seen from <small>pick one or more sides</small>"; box.appendChild(lab);
    const row = document.createElement("div"); row.className = "frontrow";
    const pad = document.createElement("div"); pad.className = "frontpad"; pad.setAttribute("role", "group"); pad.setAttribute("aria-label", "Where the bed is seen from");
    const ARROW = { nw: "↘", n: "↓", ne: "↙", w: "→", c: "", e: "←", sw: "↗", s: "↑", se: "↖" };   // pointing in toward the bed
    ["nw", "n", "ne", "w", "c", "e", "sw", "s", "se"].forEach(v => {
      const on = cur.includes(v), b = document.createElement("button"); b.type = "button"; b.className = "fp-" + v + (on ? " on" : "");
      b.innerHTML = v === "c" ? "<span>All<br>sides</span>" : ARROW[v];
      b.title = v === "c" ? "Seen from all sides: tallest plants in the middle" : (on ? "Seen from " : "Also seen from ") + FRONT_NAME[v] + (on ? " (click to drop it)" : "");
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.onclick = () => {
        let next;
        if (v === "c") { if (on) return; next = ["c"]; }
        else if (on) { next = cur.filter(x => x !== v); if (!next.length) { toast("Keep at least one side the bed is seen from."); return; } }
        else next = cur.filter(x => x !== "c").concat(v);
        S.front = next.length === 1 ? next[0] : next; S.freeView = next[0] === "c" ? "island" : "border";
        rebuildBed(); refresh(); renderDims();
        if (S.placements.some(p => !p.c)) toast("Plants re-arranged short to tall for the new view. Undo takes it back.", 3500);
      };
      pad.appendChild(b);
    });
    const say = document.createElement("p"); say.className = "frontsay";
    say.innerHTML = cur[0] === "c" ? "Short plants around the edge, the tallest in the middle."
      : "Short plants go along the sides it's seen from (green on the plan), the tallest farthest from them.";
    row.append(pad, say); box.appendChild(row);
  }
  // e.g. "22 × 7 ft · 154 sq ft": straight from the numbers for a rectangle or island, so it updates as you click
  function renderBedSummary() {
    const el = $("#bedSummary"); if (!el) return;
    const d = {}, fmt = v => (Math.round(v * 10) / 10).toString();
    (Geo.SHAPES[S.shape].params || []).forEach(q => (d[q.k] = S.dims && S.dims[q.k] != null ? S.dims[q.k] : q.def));
    let size, area;
    if (S.shape === "rect") { size = `${fmt(d.w)} × ${fmt(d.d)} ft`; area = d.w * d.d; }
    else if (S.shape === "circle") { size = `${fmt(d.dia)} ft across`; area = Math.PI * Math.pow(d.dia / 2, 2); }
    else { size = bed ? `About ${fmt(bed.bb.w)} × ${fmt(bed.bb.h)} ft` : ""; area = bed ? bed.area : 0; }
    el.innerHTML = size ? `<b>${size}</b><span>${Math.round(area)} sq ft</span>` : "";
    renderSteps();
  }

  // Open the outline editor. It starts from the bed you have now (a drawn outline as drawn; a rectangle as
  // its corners; an island as a smooth 8-point loop) unless opts.fresh, which starts blank and clears the bed
  // when the new outline is saved. Nothing changes if the editor is cancelled.
  function startDraw(opts) {
    opts = opts || {};
    armed = null; selIdx = -1; extraSel = []; objSel = -1; objArmed = null; pathDraw = null; paint = null; renderPaintBar();
    if (innerWidth > 1050) $("#planCard").scrollIntoView({ behavior: "smooth", block: "start" });
    let seed = null, seedSharp = null, smooth = !!S.freeSmooth;
    if (!opts.fresh) {
      if (S.shape === "free" && S.freePoly) { seed = S.freeCtrl || S.freePoly; if (S.freeCtrl) seedSharp = S.freeSharp; }
      else if (bed && bed.poly) {
        const P = bed.poly;
        if (P.length <= 12) { seed = P; smooth = false; }
        else { seed = []; for (let i = 0; i < 8; i++) seed.push(P[Math.floor(i * P.length / 8)]); smooth = true; }
      }
    } else smooth = false;
    window.Plan.startDraw({
      onDone: out => {
        if (opts.fresh) clearBedAll();
        const bb = Geo.bbox(out.poly), sh = q => [Math.round((q[0] - bb.x0) * 100) / 100, Math.round((q[1] - bb.y0) * 100) / 100];
        S.freePoly = out.poly.map(sh); S.freeCtrl = out.pts.map(sh); S.freeSmooth = !!out.smooth; S.freeSharp = out.sharp || null; S.shape = "free"; S.dims = {};
        rebuildBed(); fullRender();
        toast(opts.fresh ? "Bed shape saved." : S.placements.length ? "Shape saved. Your plants were re-arranged to fit." : "Shape saved.");
      },
      onCancel: () => { if (S.shape === "free" && !S.freePoly) { S.shape = "rect"; S.dims = { w: 16, d: 6 }; rebuildBed(); } fullRender(); }
    }, { pts: seed, smooth, sharp: seedSharp });
    renderShapesPanel();
    // the line under the plan describes the outline being drawn, not the old bed
    $("#stats").innerHTML = "<span><b>Drawing your own outline</b> · Save shape when you're done (or press Done in step 2)</span>";
    showPlanTools();
    $("#notice").style.display = "none";
  }

  // does a plant fit the step-2 choices?
  function matchesPrefs(p) {
    const pr = S.prefs;
    if (!p.sun.some(x => pr.sun.includes(x))) return false;
    if (!pr.origin.includes(p.native ? "nat" : "gar")) return false;
    if (!pr.kinds.includes(p.kind)) return false;
    if (p.toxic && !pr.toxic) return false;
    if (p.fam === "daisy" && pr.daisy === false) return false;
    if (deerEats(p) && pr.deer === false) return false;
    if (window.isTender(p) && pr.tender === false) return false;
    return true;
  }
  function passes(p) {
    const f = S.filter, h = Geo.hMean(p);
    if (!matchesPrefs(p) && !(counts()[p.id] > 0)) return false;
    if (f.sun && !(p.sun && p.sun.includes(f.sun))) return false;   // the light filter: plants that grow in that light
    if (f.height === "low" && !(p.hHi < 12)) return false;
    if (f.height === "mid" && !(h >= 12 && h <= 30)) return false;
    if (f.height === "tall" && !(p.hHi >= 30)) return false;
    if (f.month) { const m = +f.month; if (!p.bloom || Math.min(p.bloom[1], m + 1) - Math.max(p.bloom[0], m) < 0.35) return false; }
    if (f.q) { const q = f.q.toLowerCase(); if (!(p.name + " " + p.latin + " " + p.color).toLowerCase().includes(q)) return false; }
    return true;
  }
  const SUNS = [["full", "Full sun (6+ hours)"], ["part", "Part shade (3–6 hours)"], ["shade", "Shade (under 3 hours)"]];
  const ORIGINS = [["nat", "Michigan natives"], ["gar", "Garden favorites ◆"]];
  function prefChanged() {
    renderChips(); renderLibrary(); renderBloom(); renderName(); save();
    const c = counts(), bad = PL.filter(p => c[p.id] > 0 && !matchesPrefs(p));
    const old = document.getElementById("prefAsk"); if (old) old.remove();
    if (!bad.length) {
      const back = PL.filter(p => S.removed && S.removed[p.id] > 0 && !(c[p.id] > 0) && matchesPrefs(p));
      if (!back.length) return;
      const n = back.reduce((s, p) => s + S.removed[p.id], 0), names = back.map(p => esc(p.name) + " (" + S.removed[p.id] + ")").join(", ");
      const ov2 = document.createElement("div"); ov2.id = "prefAsk"; ov2.className = "modalov";
      ov2.innerHTML = `<div class="modalbox" role="dialog" aria-modal="true"><h3>Put your plants back?</h3><p>You removed ${n === 1 ? "this plant" : "these plants"} when you changed your choices: <b>${names}</b>.</p><p>They match again. Would you like to put ${n === 1 ? "it" : "them"} back in your planner?</p><div class="askbtns"><button class="btn" id="paBack" type="button">Put ${n === 1 ? "it" : "them"} back</button> <button class="btn" id="paNo" type="button">No thanks</button></div></div>`;
      document.body.appendChild(ov2);
      $("#paNo").onclick = () => { back.forEach(p => delete S.removed[p.id]); save(); ov2.remove(); };
      $("#paBack").onclick = () => { notice = ""; noFit = []; back.forEach(p => { addMany(p.id, S.removed[p.id]); delete S.removed[p.id]; }); ov2.remove(); refresh(); save(); toast("Put back " + back.map(p => p.name).join(", ") + "."); };
      return;
    }
    const ov = document.createElement("div"); ov.id = "prefAsk"; ov.className = "modalov";
    const names = bad.map(p => esc(p.name) + " (" + c[p.id] + ")").join(", ");
    ov.innerHTML = `<div class="modalbox" role="dialog" aria-modal="true"><h3>Remove these plants?</h3><p>${bad.length === 1 ? "This plant doesn't" : "These plants don't"} match your new choices: <b>${names}</b>.</p><p>Would you like to remove ${bad.length === 1 ? "it" : "them"} from your planner? If you keep ${bad.length === 1 ? "it" : "them"}, nothing changes.</p><div class="askbtns"><button class="btn" id="paYes" type="button">Remove ${bad.length === 1 ? "it" : "them"}</button> <button class="btn" id="paNo" type="button">Keep ${bad.length === 1 ? "it" : "them"}</button></div></div>`;
    document.body.appendChild(ov);
    $("#paNo").onclick = () => ov.remove();
    $("#paYes").onclick = () => { S.removed = S.removed || {}; bad.forEach(p => { const n = c[p.id]; removePlant(p.id); S.removed[p.id] = n; }); ov.remove(); refresh(); save(); toast("Removed " + bad.map(p => p.name).join(", ") + "."); };
  }
  // ---------- steps 1 to 4 fold down when done ----------
  function stepSummary(k) {
    const pr = S.prefs, lab = window.Plan.ZONE_LAB;
    if (k === "name") return (S.name || "").trim() ? "<b>" + esc(S.name.trim()) + "</b>" : "No name yet";
    if (k === "bed") { const t = $("#bedSummary"); return "<b>" + esc(Geo.SHAPES[S.shape].label) + "</b>" + (t && t.textContent ? " · " + t.innerHTML.replace(/<\/?b>/g, "").replace("</span>", "").replace("<span>", " · ") : "") + (bed ? " · seen from " + (bed.front === "c" ? "all sides" : viewWords(bed.views || [bed.front])) : ""); }
    if (k === "objects") { const c = {}; S.objects.forEach(o => (c[o.t] = (c[o.t] || 0) + 1)); const l = Object.keys(c).map(t => objPlural(t, c[t])); return l.length ? "<b>" + l.join(", ") + "</b>" : "None"; }
    if (k === "sun") return "<b>" + pr.sun.map(z => lab[z]).join(", ") + "</b>" + (Object.keys(S.sun.cells).length ? " · sun zones mapped" : "");
    const org = pr.origin.length === 2 ? "Natives and garden favorites" : pr.origin[0] === "nat" ? "Michigan natives" : "Garden favorites";
    const nk = pr.kinds.length, kinds = nk === KINDS.length - 1 ? "all kinds" : nk + " kind" + (nk === 1 ? "" : "s");
    if (k === "kind") return "<b>" + org + "</b>, " + kinds;
    const out = AVOID.filter(a => pr[a.key] === false).map(a => ({ toxic: "toxic plants", deer: "deer favorites", tender: "plants needing winter care", daisy: "daisy family" }[a.key]));
    return (out.length ? "Leaving out <b>" + out.join(", ") + "</b>" : "<b>Nothing left out</b>") + " · " + PL.filter(matchesPrefs).length + " plants match";
  }
  // Only one step is open at a time: the one you opened with Edit, or else the first one not done yet. On a
  // wide screen an open step floats over the page (its slot keeps the folded size), so nothing shifts.
  const FLOAT = () => !(window.matchMedia && window.matchMedia("(max-width: 1050px)").matches);
  function curStep() { return Object.keys(STEPS_UI).find(n => !(S.done && S.done[n])); }
  // Your bed, Add objects and How much sun? change the bed plan, so on a wide screen they open in the left
  // column beside it (where the Plants list is; Plants comes back on Done). Their box in the grid stays folded.
  const SIDE = new Set(["bed", "objects", "sun"]), HOME = {}, PH = {};
  function renderSteps() {
    const cur = curStep(), float = FLOAT(), side = $("#sideStep");
    let sideOn = false;
    Object.keys(STEPS_UI).forEach(k => {
      const card = $(STEPS_UI[k]); if (!card) return;
      if (!HOME[k]) HOME[k] = card.parentElement;
      const slot = HOME[k], done = !!(S.done && S.done[k]), open = openSteps.has(k) || (!openSteps.size && k === cur);
      const toSide = !!(side && float && open && SIDE.has(k));
      if (toSide) { if (card.parentElement !== side) side.appendChild(card); }
      else if (card.parentElement !== slot) slot.appendChild(card);
      if (!PH[k]) { PH[k] = document.createElement("div"); PH[k].className = "card step-ph"; PH[k].onclick = () => card.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
      if (toSide) {
        PH[k].innerHTML = `<div class="stephead"><h2>${esc(card.querySelector(".stephead h2").textContent.replace("✓", "").trim())}</h2></div><div class="ph-tag">Open beside the bed plan</div>`;
        if (PH[k].parentElement !== slot) slot.insertBefore(PH[k], slot.firstChild);
      } else PH[k].remove();
      sideOn = sideOn || toSide;
      card.classList.toggle("done", done);
      card.querySelector(".stepsum").innerHTML = done ? stepSummary(k) : "Not done yet";
      const tog = card.querySelector(".steptog");
      card.classList.remove("open"); tog.textContent = "Edit"; tog.className = "steptog btn"; tog.hidden = false;
      let fh = 0;
      if (!toSide) { slot.classList.remove("open"); slot.style.height = ""; fh = card.offsetHeight; }
      card.classList.toggle("open", open);
      if (open) { tog.textContent = "Done"; tog.className = "steptog btn primary"; tog.hidden = !done; }
      const fl = open && float && !toSide;
      slot.classList.toggle("open", fl); slot.style.height = fl ? fh + "px" : "";
    });
    const lib = $("#libCard"); if (lib) lib.hidden = sideOn;
  }
  let stepResizeT = null;
  window.addEventListener("resize", () => { clearTimeout(stepResizeT); stepResizeT = setTimeout(() => renderSteps(), 150); });
  // Leaving step 2 while the outline editor is open saves the outline for you (it needs 3 corners);
  // leaving step 3 mid-path finishes the path. Returns false if the step can't be left yet.
  function settleBed() {
    if (!window.Plan.isDrawing()) return true;
    if (window.Plan.finishDraw()) return true;
    toast("Click at least 3 corners on the bed plan to draw your bed, or pick Rectangle or Round island.", 4500);
    return false;
  }
  function settleObjects2() {
    if (pathDraw && pathDraw.pts.length >= 2) finishPath();
    if (pathDraw || objArmed) { pathDraw = null; objArmed = null; renderPlan(); }
    return true;
  }
  function completeStep(k, scroll) {
    if (k === "bed" && !settleBed()) return false;
    if (k === "objects") settleObjects2();
    if (k === "sun") endSunStep();
    S.done = S.done || {}; S.done[k] = true; openSteps.delete(k); save(); renderSteps();
    if (scroll) {
      // on a phone the steps are stacked, so bring the next one into view; on a wide screen they all sit in one row
      // at the top and the page stays where it is
      const next = Object.keys(STEPS_UI).find(n => !S.done[n]); const el = next ? $(STEPS_UI[next]) : $("#libCard"); if (el && !FLOAT()) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      if (next === "sun") startSunStep();   // moving on to step 4 opens the sun palette on the plan
    }
    return true;
  }
  // Step 4 works on the plan: opening it opens the sun palette ("Map sun zones"), and its Done (or the
  // palette's Done) saves the zones, ticks any light you mapped in step 4's list, and closes the palette.
  function startSunStep() {
    if (paint || window.Plan.isDrawing()) return;
    togglePaint(true); if (paint) paint.fromStep = true;
    toast("Map where the sun falls: pick a light on the palette above the plan and drag across the bed. Press Done when you're finished.", 5000);
  }
  function endSunStep() {
    if (!paint) return;
    paint = null; save(); renderPaintBar(); renderPlan(); syncSunPrefs();
    toast("Sun zones saved.", 2000);
  }
  // step 3: objects to place before the plants go in
  const objPlural = (t, n) => { const l = Geo.OBJ[t].label.toLowerCase().replace("hedge / shrub row", "hedge"); return n + " " + (n === 1 ? l : l + "s"); };
  function renderObjStep() {
    const grid = $("#objGrid"); if (!grid) return;
    grid.innerHTML = "";
    Object.keys(Geo.OBJ).forEach(t => {
      const b = document.createElement("button"); b.type = "button"; b.className = "objbtn" + (objArmed === t || (t === "path" && pathDraw) ? " on" : "");
      b.innerHTML = `${objIcon(t)}<b>${esc(Geo.OBJ[t].label.replace(" / shrub row", ""))}</b><span>${objSize(t)}</span>`;
      b.title = Geo.OBJ[t].note || ""; b.onclick = () => { armObject(t); $("#planCard").scrollIntoView({ behavior: "smooth", block: "start" });
        toast(t === "path" ? "Click points along the bed for the path, then Finish (or double-click)." : "Now click the bed where the " + Geo.OBJ[t].label.toLowerCase().replace(" / shrub row", "") + " goes.", 3500); };
      grid.appendChild(b);
    });
    const c = {}; S.objects.forEach(o => (c[o.t] = (c[o.t] || 0) + 1));
    const have = Object.keys(c).map(t => objPlural(t, c[t]));
    $("#objList").innerHTML = have.length ? `<b>On the bed:</b> ${have.join(", ")}. Click one on the plan to move, resize or remove it.` : "Nothing yet. Skip this step if there's nothing in the bed.";
  }
  function openStep(k) { openSteps.add(k); renderSteps(); }
  Object.keys(STEPS_UI).forEach(k => {
    const card = $(STEPS_UI[k]);
    card.querySelector(".stepdone").onclick = () => completeStep(k, true);
    const toggle = () => {
      const done = !!(S.done && S.done[k]), isOpen = card.classList.contains("open");
      if (isOpen) {
        if (!done) return;   // a step not done yet closes with its Done button
        if (k === "bed" && !settleBed()) return; openSteps.delete(k); if (k === "sun") endSunStep();
      } else {
        // opening a step closes the open one: a finished step as if you'd pressed its Done, an unfinished one just folds
        const cur = curStep(), others = [...openSteps].concat(!openSteps.size && cur && cur !== k ? [cur] : []);
        for (const o of others) {
          if (o === k || !STEPS_UI[o]) continue;
          if (S.done && S.done[o]) { if (!completeStep(o)) return; }
          else { if (o === "bed" && !settleBed()) return; if (o === "objects") settleObjects2(); if (o === "sun") endSunStep(); openSteps.delete(o); }
        }
        openSteps.add(k); if (k === "sun" && !Tour.on) startSunStep();
      }
      renderSteps();
    };
    card.querySelector(".steptog").onclick = e => { e.stopPropagation(); toggle(); };
    // a folded step opens from a click anywhere on its box; an open one only folds from its title
    card.addEventListener("click", e => { if (e.target.closest(".stepfoot, .steptog")) return; if (!card.classList.contains("open") || e.target.closest(".stephead")) toggle(); });
  });
  // the example garden: a finished plan to look around, with every step already done
  function loadExample() {
    const go = () => {
      if (Tour.on) Tour.end("quiet");
      S = exampleState(); init(true, true); heightPolish(); refresh();
      toast("Here's an example garden. Click Edit on any step to change it, or Start over for an empty bed.", 4500);
    };
    if (S.placements.length || S.objects.length) askChoice("Load the example garden?", ["The example replaces your current plan, including the bed, plants and choices.", "If you want to keep this plan, press Cancel and use Save plan first."], [["Load the example", go]]);
    else go();
  }
  $("#btnExample").addEventListener("click", loadExample);
  $("#gName").addEventListener("keydown", e => { if (e.key === "Enter" && !document.body.classList.contains("touring")) { e.preventDefault(); e.target.blur(); completeStep("name", true); } });
  $("#btnPaintSun").addEventListener("click", () => { if (!paint) togglePaint(); if (innerWidth > 1050) $("#planCard").scrollIntoView({ behavior: "smooth", block: "start" }); });
  // ---------- steps 4 to 6: how much sun, what kind of garden, and plants to watch out for ----------
  // Sun as three rows in the planner's sun colors, what to include as tiles and chips, and what to leave out as
  // plain switches (with the full explanation one click away). A counter shows how many plants match.
  const AVOID = [
    { key: "toxic", label: "Plants toxic to pets or people", why: "If pets or small children chew on plants", icon: '<span class="ic ic-tox">!</span>', more: th => {
      th.append("Toxic plants are marked with a red ! icon (hover it to see who it is toxic to) and a red Toxic tag in the PDF guide. Keep them away from pets and children who chew on plants. These labels are my own starting point, so check the ");
      const ln = document.createElement("a"); ln.href = "https://www.aspca.org/pet-care/animal-poison-control/toxic-and-non-toxic-plants"; ln.target = "_blank"; ln.rel = "noopener"; ln.textContent = "ASPCA toxic and non-toxic plant list";
      th.append(ln, " before you buy. For a person who has eaten a plant, call Poison Control at 1-800-222-1222 (free, 24 hours; online at ");
      const pl = document.createElement("a"); pl.href = "https://poisonhelp.org/"; pl.target = "_blank"; pl.rel = "noopener"; pl.textContent = "poisonhelp.org";
      th.append(pl, "). If someone is unconscious, having trouble breathing or having a seizure, call 911 first."); } },
    { key: "deer", label: "Plants deer like to eat", why: "If deer visit your yard", icon: () => '<span class="ic ic-deer">' + DEER + "</span>", more: th => th.append("Plants marked with the antler icon are ones deer often or sometimes eat, based on the Rutgers University deer-resistance ratings. No plant is deer-proof: hungry deer eat almost anything, and rabbits nibble many young plants too. If deer visit your yard, leave these out or plan on fencing or repellent.") },
    { key: "tender", label: "Plants that need winter care here", why: "Not hardy in zone 6B: they're dug up in fall, brought indoors, or replanted each year", icon: '<span class="ic ic-cold">❄</span>',
      more: th => th.append("These plants (marked ❄) can't survive a Michigan zone 6B winter in the ground on their own. Each one's card and the Garden Timeline say what it needs: dig up and store it after the first frost and replant in May, bring it indoors in a pot, or plant a new one each year. Plants hardy only to 6B itself get a winter-mulch reminder instead, and aren't left out here.") },
    { key: "daisy", label: "Daisy-family plants", why: "If someone has ragweed allergies", icon: '<span class="ic ic-df">✿</span>', more: th => th.append("Daisy-family plants (marked ✿) are related to ragweed. Most are pollinated by insects, so they shed far less pollen than ragweed, but people with ragweed allergies can still react, often to handling them. If allergies are a concern, leave them out or check with a doctor.") }
  ];
  const whyOpen = new Set();
  function renderChips() {
    const pr = S.prefs;
    const toggleIn = (key, k) => {   // multi-choice lists: at least one has to stay on
      const on = pr[key].includes(k);
      if (on && pr[key].length === 1) { toast("Keep at least one choice here."); return; }
      pr[key] = on ? pr[key].filter(x => x !== k) : pr[key].concat(k); prefChanged();
    };
    const n = PL.filter(matchesPrefs).length;
    $("#prefCount").innerHTML = $("#avoidCount").innerHTML = `<b>${n}</b> of ${PL.length} plants match<i style="width:${Math.round(n / PL.length * 100)}%"></i>`;
    // sun: three rows in the sun colors, with hours
    const sunBox = $("#pSun"); sunBox.innerHTML = "";
    ["full", "part", "shade"].forEach(k => {
      const on = pr.sun.includes(k), b = document.createElement("button"); b.type = "button"; b.className = "optrow" + (on ? " on" : "");
      const cnt = PL.filter(p => p.sun.includes(k)).length;
      b.innerHTML = `<span class="ic ic-sun optsw" style="background:${SUNCOL[k]}">${SUNGLYPH}</span><span class="optt"><b>${window.Plan.ZONE_LAB[k]}</b><span>${window.Plan.ZONE_HRS[k]} of direct sun a day</span></span><small>${cnt} plants</small><span class="optck">${on ? "✓" : ""}</span>`;
      b.onclick = () => toggleIn("sun", k); sunBox.appendChild(b);
    });
    // include: natives / garden favorites
    const oBox = $("#pOrigin"); oBox.innerHTML = "";
    [["nat", "Michigan natives", "grow wild here, feed wildlife", '<span class="ic ic-nat">' + LEAF + "</span>"], ["gar", "Garden favorites", "proven non-natives", '<span class="ic ic-gar">◆</span>']].forEach(([k, t, sub, ic]) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "seg2btn ck" + (pr.origin.includes(k) ? " on" : "");
      b.innerHTML = `<b>${ic} ${t}</b><span>${sub}</span>`; b.onclick = () => toggleIn("origin", k); oBox.appendChild(b);
    });
    // include: kinds of plants
    const kBox = $("#pKind"); kBox.innerHTML = "";
    KINDS.filter(k => k[0] !== "all").forEach(([k, l]) => {
      const on = pr.kinds.includes(k), b = document.createElement("button"); b.type = "button"; b.className = "kchip" + (on ? " on" : "");
      b.innerHTML = `<span class="kck">${on ? "✓" : ""}</span>${esc(l)}`; b.onclick = () => toggleIn("kinds", k); kBox.appendChild(b);
    });
    // plants to watch out for: each row says plainly "Include" or "Leave out", with a one-line reason and the full story behind "Why?"
    const aBox = $("#pAvoid"); aBox.innerHTML = "";
    AVOID.forEach(a => {
      const out = pr[a.key] === false, row = document.createElement("div"); row.className = "avrow" + (out ? " on" : "");
      const txt = document.createElement("div"); txt.className = "avt";
      const ic = typeof a.icon === "function" ? a.icon() : a.icon;
      txt.innerHTML = `<b>${ic}${esc(a.label)}</b><span>${esc(a.why)}. <button type="button" class="whybtn">${whyOpen.has(a.key) ? "Hide" : "Why?"}</button></span>`;
      txt.querySelector(".whybtn").onclick = e => { e.stopPropagation(); if (whyOpen.has(a.key)) whyOpen.delete(a.key); else whyOpen.add(a.key); renderChips(); };
      const seg = document.createElement("div"); seg.className = "inout"; seg.setAttribute("role", "radiogroup"); seg.setAttribute("aria-label", a.label);
      [["in", "Include"], ["out", "Leave out"]].forEach(([v, t]) => {
        const b = document.createElement("button"); b.type = "button"; const sel = (v === "out") === out;
        b.className = "io-" + v + (sel ? " on" : ""); b.textContent = t; b.setAttribute("role", "radio"); b.setAttribute("aria-checked", sel ? "true" : "false");
        b.title = (v === "out" ? "Leave out " : "Include ") + a.label.toLowerCase();
        b.onclick = () => { if (sel) return; pr[a.key] = v === "in"; prefChanged(); };
        seg.appendChild(b);
      });
      row.append(txt, seg);
      if (whyOpen.has(a.key)) { const m = document.createElement("p"); m.className = "avmore"; a.more(m); row.appendChild(m); }
      aBox.appendChild(row);
    });
    renderSteps();
  }
  // ---------- dragging a plant in from the Plants list ----------
  // Press and drag a plant (on a phone, press and hold first): the pointer becomes the plant's circle, drawn at
  // its real size over the bed plan, and the sun zones that suit it light up. Let go on the bed plan to plant it
  // right there (neighbors step aside), or on the Garden Timeline to have it placed for you, short to tall.
  let libDrag = null, eatLibClick = 0;
  function libDragDown(e, p) {
    if (e.button !== 0 || e.target.closest("button, .pc-qty")) return;
    const touch = e.pointerType === "touch", d = { p, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, on: false, id: e.pointerId, over: null };
    libDrag = d;
    const start = () => {
      if (d.on || libDrag !== d) return;
      d.on = true;
      const g = document.createElement("div"); g.className = "libghost"; g.textContent = p.code;
      g.style.background = p.hex; g.style.color = p.txt || "#2E3A2C"; document.body.appendChild(g); d.g = g;
      document.body.classList.add("libdragging");
      if (window.Plan.zonesForSun) window.Plan.zonesForSun(p.sun);
      place();
    };
    // while the circle is over the bed, the plants it crowds step aside, and slide back once it moves on
    let pushOrig = null, tmpIdx = -1;
    const pushAt = (bx, by) => {
      if (!pushOrig) { pushOrig = S.placements.map(q => ({ x: q.x, y: q.y })); S.placements.push({ id: p.id, x: bx, y: by, tmp: 1 }); tmpIdx = S.placements.length - 1; pushOrig.push({ x: bx, y: by }); }
      S.placements[tmpIdx].x = bx; S.placements[tmpIdx].y = by; pushOrig[tmpIdx] = { x: bx, y: by };
      makeRoom(new Set([tmpIdx]), pushOrig).forEach(i => { if (i !== tmpIdx) window.Plan.movePl(i); });
    };
    const unpush = () => {
      if (!pushOrig) return;
      S.placements.splice(tmpIdx, 1); pushOrig.pop();
      S.placements.forEach((q, i) => { if (q.x !== pushOrig[i].x || q.y !== pushOrig[i].y) { q.x = pushOrig[i].x; q.y = pushOrig[i].y; window.Plan.movePl(i); } });
      pushOrig = null; tmpIdx = -1;
    };
    const place = () => {
      if (!d.g) return;
      const under = document.elementFromPoint(d.x, d.y);
      d.over = under && under.closest("#planWrap svg") ? "plan" : under && under.closest("#bloomCard") ? "timeline" : null;
      const size = d.over === "plan" ? Math.max(18, Geo.spFt(p) * window.Plan.pxPerFt()) : 42;
      d.g.style.width = d.g.style.height = size + "px"; d.g.style.fontSize = Math.max(9, Math.min(15, size / 3.4)) + "px";
      d.g.style.left = d.x + "px"; d.g.style.top = d.y + "px";
      d.g.classList.toggle("nowhere", !d.over);
      $("#bloomCard").classList.toggle("dropok", d.over === "timeline");
      if (d.over === "plan") { const pt = window.Plan.clientToBed(d.x, d.y); if (Geo.pip(bed.poly, pt.x, pt.y)) pushAt(pt.x, pt.y); else unpush(); }
      else unpush();
    };
    const hold = touch ? setTimeout(start, 350) : null;
    const noScroll = ev => { if (d.on) ev.preventDefault(); };
    const move = ev => {
      if (ev.pointerId !== d.id) return;
      d.x = ev.clientX; d.y = ev.clientY;
      if (!d.on) {
        const dist = Math.hypot(d.x - d.sx, d.y - d.sy);
        if (touch) { if (dist > 8) finish(null); return; }   // a swipe before the hold is a scroll
        if (dist < 6) return;
        start();
      }
      ev.preventDefault(); place();
    };
    const finish = ev => {
      clearTimeout(hold);
      document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", finish); document.removeEventListener("pointercancel", finish);
      document.removeEventListener("touchmove", noScroll);
      if (libDrag === d) libDrag = null;
      if (!d.on) return;
      unpush();   // everyone back where they were; the drop below lays them out the same way for good
      eatLibClick = Date.now();
      if (d.g) d.g.remove();
      document.body.classList.remove("libdragging"); $("#bloomCard").classList.remove("dropok");
      if (window.Plan.zonesOff) window.Plan.zonesOff();
      if (!ev || ev.type !== "pointerup") return;
      if (d.over === "plan") { const pt = window.Plan.clientToBed(d.x, d.y); dropPlantAt(p.id, pt.x, pt.y); }
      else if (d.over === "timeline") dropPlantAuto(p.id);
    };
    document.addEventListener("pointermove", move, { passive: false }); document.addEventListener("pointerup", finish); document.addEventListener("pointercancel", finish);
    document.addEventListener("touchmove", noScroll, { passive: false });
  }
  // dropped on the bed plan: right where it was let go, and the plants around it step aside. Off the bed or on
  // top of an object, it goes to the nearest open spot instead.
  function dropPlantAt(id, x, y) {
    const pl = byId[id], r = Geo.spFt(pl) / 2; notice = ""; noFit = [];
    S.placements = S.placements.filter(q => !q.c);
    const blocks = (S.objects || []).map(Geo.objBlock).filter(Boolean);
    const inside = Geo.pip(bed.poly, x, y) && Geo.edgeDist(bed.poly, x, y) >= r * 0.4 && !blocks.some(b => Geo.objDist(b, x, y) < r * 0.5);
    if (inside) {
      const orig = S.placements.map(q => ({ x: q.x, y: q.y })).concat([{ x, y }]);
      S.placements.push({ id, x, y }); makeRoom(new Set([S.placements.length - 1]), orig);
    } else {
      const q = Geo.placeAt(bed, byId, S.placements, id, x, y);
      if (!q) { toast(`No room for ${pl.name} near there. Try another spot.`); refresh(); return; }
      S.placements.push(q);
    }
    if (S.removed) delete S.removed[id];
    recarpet(); refresh();
    const last = S.placements[S.placements.length - 1], z = zoneAt(last.x, last.y);
    toast(`Added ${pl.name}.` + (z && pl.sun && !pl.sun.includes(z) && pl.sun.some(s => zonesPresent().has(s)) ? ` It doesn't like ${({ full: "full sun", part: "part shade", shade: "shade" })[z]} there, though.` : ""), 2600);
  }
  // dropped on the Garden Timeline: placed for you, short plants in front and tall ones behind, in light it likes
  function dropPlantAuto(id) {
    const pl = byId[id]; notice = ""; noFit = [];
    if (S.removed) delete S.removed[id];
    const ok = addOne(id, true); if (!ok) addWaiting(id, 1);
    refresh();
    toast(ok ? `Added ${pl.name}, placed by height in light it likes.` : `No room left for ${pl.name} in light it likes. It's on the shopping list.`, 3000);
  }
  // ---------- the Plants list ----------
  // Two tabs (everything that fits, or just what's in the bed), search, filters and a sort. Each plant shows
  // "+ Add", or a - count + stepper once it's in the bed. Every matching plant is listed; the column scrolls.
  let showKey = false;
  function renderLibrary() {
    const c = counts(), f = S.filter, tab = f.tab === "bed" ? "bed" : "all";
    const nMatch = PL.filter(matchesPrefs).length, inBed = PL.filter(p => c[p.id] > 0), outside = inBed.filter(p => !matchesPrefs(p)).length;
    $("#libLede").innerHTML = `Click a plant to add it to your bed, and use − and + to change how many. <button type="button" class="whybtn" id="keyBtn">${showKey ? "Hide the icon key" : "What do the icons mean?"}</button>` +
      (outside ? `<span class="liboff"><span class="ic ic-off" data-k="off" data-tip="Outside your garden choices">–</span> ${outside} plant${outside > 1 ? "s" : ""} in your bed ${outside > 1 ? "don't" : "doesn't"} fit your garden choices.</span>` : "");
    $("#keyBtn").onclick = () => { showKey = !showKey; renderLibrary(); };
    const key = $("#libKey"); key.hidden = !showKey; key.innerHTML = showKey ? KEY() : "";
    // tabs
    const tabs = $("#libTabs"); tabs.innerHTML = "";
    [["all", "All that fit", nMatch], ["bed", "In your bed", inBed.length]].forEach(([v, t, n]) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "libtab" + (tab === v ? " on" : ""); b.innerHTML = `${t} <span>${n}</span>`;
      b.onclick = () => { S.filter.tab = v; renderLibrary(); save(); }; tabs.appendChild(b);
    });
    // which plants, in what order
    let list = tab === "bed" ? inBed.filter(p => passes(p)) : PL.filter(passes);
    const sorters = { name: (a, b) => a.name.localeCompare(b.name), height: (a, b) => Geo.hMean(a) - Geo.hMean(b) || a.name.localeCompare(b.name), bloom: (a, b) => (a.bloom ? a.bloom[0] : 99) - (b.bloom ? b.bloom[0] : 99) || a.name.localeCompare(b.name) };
    list.sort(sorters[f.sort] || sorters.name);
    $("#libN").textContent = list.length + (list.length === 1 ? " plant" : " plants");
    $("#fReset").disabled = !(f.q || f.height || f.month || f.sun);
    const box = $("#lib"); box.style.minHeight = box.offsetHeight + "px"; box.innerHTML = "";
    requestAnimationFrame(() => { box.style.minHeight = ""; });
    if (!list.length) {
      box.innerHTML = `<div class="empty">${tab === "bed" && !inBed.length ? "Nothing in your bed yet. Switch to <b>All that fit</b> and add some plants." : "No plants match. Try clearing the search or the height and month filters."}</div>`;
      return;
    }
    list.forEach(p => {
      const n = c[p.id] || 0, on = n > 0, d = document.createElement("div");
      d.className = "pcard" + (on ? " on" : ""); d.dataset.id = p.id;
      d.innerHTML = `<img src="${imgSrc(p.id)}" alt=""><div class="pc-main"><div class="nm">${esc(p.name)}${icons(p, !matchesPrefs(p))}</div><div class="meta">${Ch.heightText(p)} · ${esc(Ch.bloomText(p))}</div></div>` +
        (on ? `<div class="pc-qty"><button type="button" class="q-" title="One fewer">−</button><b title="${n} in the bed">${n}</b><button type="button" class="q+" title="One more">+</button></div>` : `<button type="button" class="pc-add" title="Add ${esc(p.name)} to the bed">+ Add</button>`);
      d.onclick = e => { if (e.target.closest(".pc-qty")) return; if (eatLibClick && Date.now() - eatLibClick < 400) return; if (!on) togglePlant(p.id); };
      d.addEventListener("pointerdown", e => libDragDown(e, p)); d.addEventListener("dragstart", e => e.preventDefault());   // no browser image-drag
      if (on) { d.querySelector(".q-").onclick = e => { e.stopPropagation(); setQty(p.id, -1); }; d.querySelector(".q\\+").onclick = e => { e.stopPropagation(); setQty(p.id, 1); }; }
      d.title = on ? `${n} in the bed. Use − and + to change how many.` : `Click to add ${p.name}`;
      // pointing at a plant shades the parts of the bed whose light doesn't suit it
      d.onmouseenter = () => { setHover(p.id); if (!libDrag && window.Plan.zonesForSun) window.Plan.zonesForSun(p.sun, true); };
      d.onmouseleave = () => { setHover(null); if (!libDrag && window.Plan.zonesOff) window.Plan.zonesOff(); };
      box.appendChild(d);
    });
  }
  const refreshLibSort = bindSelectBtn("libSort",
    () => [{ value: "name", label: "A to Z" }, { value: "height", label: "Short to tall" }, { value: "bloom", label: "First to bloom" }],
    () => S.filter.sort || "name",
    v => { S.filter.sort = v; renderLibrary(); save(); });

  // ---------- bloom chart ----------
  // placements of a chosen plant actually sitting in each painted sun zone, e.g. {full: 2, part: 1}
  function plantZoneCounts(id) {
    const m = {}; S.placements.forEach(p => { if (p.id !== id) return; const z = zoneAt(p.x, p.y); if (z) m[z] = (m[z] || 0) + 1; });
    return m;
  }
  function renderBloom() {
    const c = counts();
    $("#monthsHead").innerHTML = Ch.MONTHS.map(m => `<div>${m}</div>`).join("");
    renderGardenCare();
    let list = PL.slice();
    if (S.bloomFilter === "sel") list = list.filter(p => c[p.id] > 0);
    else list = list.filter(p => matchesPrefs(p) || c[p.id] > 0);
    const sorters = { start: (a, b) => (a.bloom ? a.bloom[0] : 99) - (b.bloom ? b.bloom[0] : 99) || a.name.localeCompare(b.name), name: (a, b) => a.name.localeCompare(b.name), height: (a, b) => Geo.hMean(a) - Geo.hMean(b) };
    list.sort(sorters[S.bloomSort] || sorters.start);
    const box = $("#bloomRows"); box.innerHTML = "";
    if (!list.length) { box.innerHTML = '<div class="empty">Nothing chosen yet. Switch to "All plants" and click + Add on some rows.</div>'; }
    else {
      const badN = {}; lightBadIdx().forEach(i => { const id = S.placements[i].id; badN[id] = (badN[id] || 0) + 1; });
      const row = (p, qty, zone) => {
        const on = c[p.id] > 0, r = document.createElement("div");
        // a plant set in light it doesn't like (the dotted gold edge on the bed plan) is marked here too
        const bad = on && (zone ? qty > 0 && !p.sun.includes(zone) : badN[p.id] > 0), badQ = zone ? qty : badN[p.id];
        r.className = "brow" + (on ? "" : " off") + (bad ? " badlight" : ""); r.dataset.id = p.id;
        let bar;
        if (p.bloom) { const a = Ch.pct(p.bloom[0]), b = Ch.pct(p.bloom[1]); bar = `<div class="bar" style="left:${a}%;width:${b - a}%;background:${p.hex}" title="${esc(Ch.bloomText(p))}: ${esc(p.color)}"></div>`; }
        else bar = `<div class="bar leaf" style="left:2%;width:96%" title="Foliage plant, green all season"></div>`;
        bar += carePills(p);
        r.innerHTML = `<div class="lab"><img src="${imgSrc(p.id)}" alt=""><div class="nm">${esc(p.name)}${icons(p)}<small>${on ? "×" + qty + " · " : ""}${esc(Ch.bloomText(p))}</small>${bad ? `<em class="badl" title="It is planted where the light doesn't suit it. Move it on the bed plan, or use Move it under the plan.">${badQ > 1 ? badQ + " in" : "In"} the wrong light</em>` : ""}</div></div><div class="track">${bar}</div>`;
        r.onclick = e => { if (e.target.closest(".addbtn")) return; if (eatRowClick && Date.now() - eatRowClick < 400) return; if (on) pickFromChart(p.id, e.ctrlKey || e.metaKey); };
        if (zone) { r.dataset.zone = zone; if (on && qty > 0) { r.classList.add("canmove"); r.title = "Drag into another sun section to move it there on the bed plan"; r.addEventListener("pointerdown", e => rowDragDown(e, r, p, zone)); } }
        if (!on) { const ab = document.createElement("button"); ab.type = "button"; ab.className = "addbtn"; ab.textContent = "+ Add"; ab.onclick = () => togglePlant(p.id); r.querySelector(".nm").appendChild(ab); }
        r.onmouseenter = () => setHover(p.id); r.onmouseleave = () => setHover(null);
        return r;
      };
      // when the bed has more than one painted sun zone, split the timeline into a section per zone:
      // a chosen plant shows under the zone(s) it's actually planted in (with that zone's own count);
      // an unchosen plant shows under every zone it tolerates, so it's clear where it could go.
      const zones = sunActive() ? zonesPresent() : null;
      const zoneOrder = ["full", "part", "shade"].filter(z => zones && zones.has(z));
      if (zoneOrder.length > 1) {
        zoneOrder.forEach(z => {
          const rows = [];
          list.forEach(p => {
            if (c[p.id] > 0) { const qty = plantZoneCounts(p.id)[z] || 0; if (qty) rows.push({ p, qty }); }
            else if (p.sun && p.sun.includes(z)) rows.push({ p, qty: 0 });
          });
          if (!rows.length) return;
          const head = document.createElement("div"); head.className = "zone-head"; head.dataset.zone = z; head.innerHTML = `<i style="background:${SUNCOL[z]}"></i>${{ full: "Full sun", part: "Part shade", shade: "Shade" }[z]}<span class="zh-hrs">${window.Plan.ZONE_TIP[z].replace(/^[^:]+: /, "")}</span>`;
          box.appendChild(head);
          rows.forEach(({ p, qty }) => box.appendChild(row(p, qty, z)));
        });
      } else {
        list.forEach(p => box.appendChild(row(p, c[p.id] || 0)));
      }
    }
    // coverage of chosen plants
    const cov = Ch.bloomCounts(selected()), mx = Math.max(1, ...cov);
    $("#cover").innerHTML = cov.map(n => `<div class="covcell" style="background:${n === 0 ? "#D9A09A" : Ch.shade("#6E9A5B", 1.25 - 0.55 * (n / mx))}">${n}</div>`).join("");
    const gaps = Ch.MONTHS.filter((m, i) => cov[i] === 0 && i < 7);
    $("#coverNote").textContent = !selected().length ? "" : gaps.length ? `Gap: nothing chosen is in bloom in ${gaps.join(", ")}. Look for plants with a bar there, or lean on the foliage plants.` : "Something is in bloom in every month from April to October.";
  }

  // ---------- care timing ----------
  const SPROUT = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 11V6.5M6 6.8C6 4.2 4.2 2.8 1.6 3c0 2.4 1.8 3.8 4.4 3.8zM6 6.2c0-2.6 1.8-4 4.4-3.8 0 2.4-1.8 3.8-4.4 3.8z" fill="currentColor" stroke="currentColor" stroke-width=".8" stroke-linejoin="round"/></svg>';
  const CARE_ICON = { prep: SPROUT, cut: "✂", trim: "✂", divide: "↔", bulbs: "●", mulch: "≋", lift: "↑", replant: "↓", dig: "↑" };
  const CARE_LAB = { prep: "Prep", cut: "Cut back", trim: "Optional trim", lift: "Dig up", replant: "Replant", mulch: "Winter mulch" };
  function pill(k, w, tip, label, top) {
    const a = Ch.pct(w.a), b = Ch.pct(w.b);
    return `<span class="cpill k-${k}${label ? " big" : ""}" data-k="${k}" data-tip="${esc(tip)}" style="left:${a}%;width:${Math.max(1.2, b - a)}%${top == null ? "" : ";top:" + top + "px"}"><i>${CARE_ICON[k]}</i>${label ? "<b>" + esc(label) + "</b>" : ""}</span>`;
  }
  // every care mark sits on one line through the middle of the bloom bar; marks whose dates overlap stack up
  // (two or more lines), still centered on that middle line
  function carePills(p) {
    const c = window.Care.careFor(p), items = [];
    ["prep", "cut", "trim"].forEach(k => { if (c[k]) items.push([k, c[k], CARE_LAB[k] + ": " + c[k].text + (k === "prep" || (k === "cut" && !c.prep) ? " " + c.divide : "")]); });
    if (c.divideW) items.push(["divide", c.divideW, "Divide: " + c.divideW.text]);
    ["lift", "replant", "mulch"].forEach(k => { if (c[k]) items.push([k, c[k], (c.winter.how === "annual" && k === "replant" ? "Plant new" : c.winter.how === "pot" && k === "lift" ? "Bring indoors" : CARE_LAB[k]) + ": " + c[k].text]); });
    items.sort((x, y) => x[1].a - y[1].a);
    const ends = [];                                   // where each stacked line is busy until, in % across the track
    items.forEach(it => {
      const pa = Ch.pct(it[1].a), pb = Math.max(Ch.pct(it[1].b), pa + 1.2);
      let ln = ends.findIndex(e => pa >= e - 0.01); if (ln < 0) { ln = ends.length; ends.push(0); }
      ends[ln] = pb; it.push(ln);
    });
    const n = Math.max(1, ends.length), H = 11, GAP = 1, mid = 19, top0 = mid - (n * H + (n - 1) * GAP) / 2;
    return items.map(it => pill(it[0], it[1], it[2], null, +(top0 + it[3] * (H + GAP)).toFixed(1))).join("");
  }
  function renderGardenCare() {
    // the care timing is drawn on each plant's own row; this is just the key
    const box = $("#gardenCare"); if (!box) return;
    box.innerHTML = `<div class="gc-key"><b>Care on each plant (hover or tap a bar):</b> <span class="cpill k-prep"><i>${SPROUT}</i></span> prep <span class="cpill k-cut"><i>✂</i></span> cut back <span class="cpill k-trim"><i>✂</i></span> optional trim for more flowers <span class="cpill k-divide"><i>↔</i></span> divide <span class="cpill k-lift"><i>↑</i></span> dig up / bring in <span class="cpill k-replant"><i>↓</i></span> replant <span class="cpill k-mulch"><i>≋</i></span> winter mulch</div>`;
  }

  // ---------- small to big chart ----------
  function renderOrder() {
    const sel = selected().sort((a, b) => Geo.hMean(a) - Geo.hMean(b) || a.name.localeCompare(b.name));
    const host = $("#ochart"); host.innerHTML = '<div class="okey">' + KEY() + "</div>";
    if (!sel.length) { host.innerHTML = '<div class="empty" style="padding:18px">Choose some plants and they will line up here from smallest to biggest.</div>'; return; }
    // one scale for every row (like the PDF), so 1 ft is the same height everywhere
    const maxH = Math.max(...sel.map(p => p.hHi)), k = Math.max(1.6, Math.min(3.2, 230 / maxH));
    const colW = p => Math.max(Math.max(14, p.spacing * k) + 8, 96) + 6;
    const avail = Math.max(300, host.clientWidth - 70);
    const rows = []; let row = [], used = 0;
    sel.forEach(p => { const cw = colW(p); if (row.length && used + cw > avail) { rows.push(row); row = []; used = 0; } row.push(p); used += cw; });
    if (row.length) rows.push(row);
    rows.forEach((list, ri) => {
      const tall = Math.max(...list.map(p => Math.max(14, p.hHi * k))), top = 34, plotH = Math.ceil(tall) + top;
      const rw = document.createElement("div"); rw.className = "orow";
      if (ri === 0) { const t = document.createElement("div"); t.className = "otitle"; t.innerHTML = "SIDE VIEW <span>(heights to scale)</span>"; rw.appendChild(t); }
      const grid = document.createElement("div"); grid.className = "gridlines"; grid.style.height = plotH + "px";
      for (let ft = 1; ft * 12 * k <= tall + 2; ft++) { const l = document.createElement("div"); l.style.top = (plotH - ft * 12 * k) + "px"; l.innerHTML = `<span>${ft} ft</span>`; grid.appendChild(l); }
      rw.appendChild(grid);
      const ground = document.createElement("div"); ground.className = "oground"; ground.style.top = (plotH - 1) + "px"; rw.appendChild(ground);
      const cols = document.createElement("div"); cols.className = "orow-cols";
      list.forEach(p => {
        const w = Math.max(14, p.spacing * k), H = Math.max(14, p.hHi * k), col = document.createElement("div");
        col.className = "ocol"; col.dataset.id = p.id; col.style.width = (colW(p) - 6) + "px";
        col.innerHTML = `<div class="oplot" style="height:${plotH}px"><div class="oh-top" style="top:${Math.max(0, plotH - H - 17)}px">${Ch.heightText(p)}</div>${Ch.silSVG(p, k)}</div>`
          + `<div class="dim" style="width:${w}px"><i></i><b>${p.spacing} in apart</b></div>`
          + `<img src="${imgSrc(p.id)}" alt=""><div class="on">${esc(p.name)}${icons(p)}</div>`;
        col.onclick = e => pickFromChart(p.id, e.ctrlKey || e.metaKey);
        col.onmouseenter = () => setHover(p.id); col.onmouseleave = () => setHover(null);
        cols.appendChild(col);
      });
      rw.appendChild(cols); host.appendChild(rw);
    });
    const bar = document.createElement("div"); bar.className = "ofrontback";
    bar.innerHTML = "<span>FRONT <small>(lawn / path side)</small></span><i></i><span>BACK <small>(fence / house / trees)</small></span>";
    host.appendChild(bar);
  }
  let orderResizeT = null;
  window.addEventListener("resize", () => { clearTimeout(orderResizeT); orderResizeT = setTimeout(() => { if (typeof renderOrder === "function" && $("#ochart")) renderOrder(); }, 200); });

  // ---------- shopping list ----------
  function renderShop() {
    const sel = selected().sort((a, b) => Geo.hMean(a) - Geo.hMean(b)), c = counts();
    const t = $("#shop");
    if (!sel.length) { t.innerHTML = '<tbody><tr><td class="empty">No plants chosen yet.</td></tr></tbody>'; return; }
    t.innerHTML = `<thead><tr><th>Plant</th><th>How many</th><th>Spacing</th><th>Height</th><th>Blooms</th></tr></thead><tbody>` +
      sel.map(p => `<tr data-id="${p.id}"><td class="shp"><img src="${imgSrc(p.id)}" alt=""><span class="shn"><b>${esc(p.name)}</b>${icons(p)}<small class="lat">${esc(p.latin)}</small>${S.waiting && S.waiting[p.id] > 0 ? `<small class="wfit">${S.waiting[p.id]} won't fit in the bed yet</small>` : ""}</span></td>
        <td><div class="stepper"><button type="button" data-d="-1">−</button><span>${c[p.id]}</span><button type="button" data-d="1">+</button></div>${p.clump ? `<small class="bulbn">spots, about ${c[p.id] * p.clump} bulbs</small>` : ""}</td>
        <td>${p.spacing} in</td><td>${Ch.heightText(p)}</td><td>${esc(Ch.bloomText(p))}</td></tr>`).join("") +
      `</tbody><tfoot><tr><td>Total</td><td>${S.placements.length + waitTotal()} plants</td><td colspan="3"></td></tr></tfoot>`;
    t.querySelectorAll("tr[data-id]").forEach(tr => {
      const id = tr.dataset.id;
      tr.querySelectorAll("button").forEach(b => b.onclick = () => setQty(id, +b.dataset.d));
      tr.onclick = e => { if (e.target.closest("button") || e.target.tagName === "IMG" || e.target.closest("a")) return; pickFromChart(id, e.ctrlKey || e.metaKey); };
      tr.onmouseenter = () => setHover(id); tr.onmouseleave = () => setHover(null);
    });
  }

  // ---------- plan ----------
  function planCtx() {
    return { bed, placements: S.placements, byId, view: S.view, selIdx, selAll: selAll(), hoverId, armed, showGrid: S.showGrid !== false,
      objects: S.objects, objSel, objArmed, pathDraw, paint, lightBad: paint ? [] : lightBadIdx(),
      sun: { show: !!paint || (sunActive() && S.showSun !== false), res: S.sun.res, cells: S.sun.cells, base: sunBase() } };
  }
  function renderPlan() {
    renderObjStep();
    if (selIdx < 0) extraSel = [];
    if (objSel >= S.objects.length) objSel = -1;
    window.Plan.render(planCtx());
    markSel();
    const cv = S.placements.reduce((s, p) => s + Math.PI * Math.pow(byId[p.id].spacing / 24, 2), 0) / (bed.area || 1);
    const bb = bed.bb, kinds = Object.keys(counts()).length;
    $("#stats").innerHTML = `<span><b>${bed.label}</b> · ${bb.w.toFixed(1).replace(/\.0$/, "")} × ${bb.h.toFixed(1).replace(/\.0$/, "")} ft</span><span><b>${Math.round(bed.area)}</b> sq ft</span><span><b>${S.placements.length}</b> plants, ${kinds} kinds</span>` + (S.objects.length ? `<span><b>${S.objects.length}</b> object${S.objects.length > 1 ? "s" : ""}</span>` : "") + `<span><span title="100% means every plant is at its recommended spacing, so the bed fills in once grown"${fullnessNow() > 100 ? ' class="overfull"' : ""}>Full when grown <b>${fullnessNow()}%</b></span>`;
    const bad = window.Plan.lastBad || 0;
    const msgs = [];
    if (notice) msgs.push(notice);
    { const fn = fullnessNow(); if (fn > 102) msgs.push(`The bed is ${fn}% full once grown: some plants are closer than their recommended spacing, so expect crowding, more mildew and earlier dividing. Remove a few plants, or use Re-arrange (in Plan it) to bring it back to about 100%.`); }
    const n = document.querySelector("#plan .pl.bad") ? document.querySelectorAll("#plan .pl.bad").length : 0;
    if (n) msgs.push(`${n} plant${n > 1 ? "s are" : " is"} drawn with a dashed red edge because ${n > 1 ? "they are" : "it is"} closer to another plant than the spacing allows, or sitting on an object. Drag ${n > 1 ? "them" : "it"} clear, or remove one.`);
    const box = $("#notice"); box.style.display = msgs.length ? "block" : "none"; box.innerHTML = msgs.map(esc).join("<br>");
    if (n) {
      const ovIdx = [...document.querySelectorAll("#plan .pl.bad")].map(g => +g.dataset.idx);
      box.insertAdjacentHTML("beforeend", ` <button class="btn small" id="ovFix" type="button">Fix it</button> <button class="btn small" id="ovSel" type="button">Select ${n > 1 ? "them" : "it"}</button>`);
      $("#ovFix").onclick = openOverlapFix; $("#ovSel").onclick = () => selectIdx(ovIdx);
    }
    const outObjs = S.objects.filter(o => !Geo.pip(bed.poly, o.x, o.y));
    if (outObjs.length) {
      box.style.display = "block";
      box.insertAdjacentHTML("beforeend", (box.innerHTML ? "<br>" : "") + `${outObjs.length === 1 ? "The " + esc(Geo.OBJ[outObjs[0].t].label.toLowerCase()) + " sits" : outObjs.length + " objects sit"} outside the bed, so ${outObjs.length === 1 ? "it's" : "they're"} hidden. <button class="btn small" id="outIn" type="button">Move ${outObjs.length === 1 ? "it" : "them"} back in</button> <button class="btn small" id="outRm" type="button">Remove ${outObjs.length === 1 ? "it" : "them"}</button>`);
      $("#outIn").onclick = () => { const n = outObjs.filter(moveInside).length; const r = settleObjects(); refresh(); toast(n ? `Moved ${n === 1 ? "it" : n + " objects"} back into the bed.` + settleNote(r) : "There's no room inside the bed for it."); };
      $("#outRm").onclick = () => { S.objects = S.objects.filter(o => !outObjs.includes(o)); objSel = -1; attachExtras(); refresh(); toast("Removed. Undo brings " + (outObjs.length === 1 ? "it" : "them") + " back."); };
    }
    const lb = paint ? [] : lightBadIdx();
    if (lb.length) {
      const kinds2 = {}; lb.forEach(i => { const id = S.placements[i].id; kinds2[id] = (kinds2[id] || 0) + 1; });
      const nm = Object.keys(kinds2).map(id => byId[id].name + (kinds2[id] > 1 ? " ×" + kinds2[id] : "")).join(", ");
      box.style.display = "block";
      box.insertAdjacentHTML("beforeend", (box.innerHTML ? "<br>" : "") + `${lb.length} plant${lb.length > 1 ? "s sit" : " sits"} in light that doesn't suit ${lb.length > 1 ? "them" : "it"} (dotted gold edge): ${esc(nm)}. <button class="btn small" id="lbFix" type="button">Move ${lb.length > 1 ? "them" : "it"}</button> <button class="btn small" id="lbSel" type="button">Select ${lb.length > 1 ? "them" : "it"}</button>`);
      $("#lbSel").onclick = () => selectIdx(lb);
      $("#lbFix").onclick = () => {
        let moved = 0, stuck = 0;
        lb.map(i => S.placements[i]).forEach(pl => { if (pl.lock) { stuck++; return; } if (moveToLight(pl)) moved++; else stuck++; });
        refresh(); toast(moved ? `Moved ${moved} plant${moved > 1 ? "s" : ""} into light that suits ${moved > 1 ? "them" : "it"}.` + (stuck ? ` ${stuck} couldn't find a spot (locked plants stay put).` : "") : "No open spot with the right light. Map more of the bed in that light, or make room.", 4500);
      };
    }
    const wt = waitTotal();
    if (wt) {
      const ids = Object.keys(S.waiting).filter(k => S.waiting[k] > 0), names = ids.map(k => byId[k].name + (S.waiting[k] > 1 ? " ×" + S.waiting[k] : "")).join(", ");
      box.style.display = "block";
      box.insertAdjacentHTML("beforeend", (msgs.length ? "<br>" : "") + `<div class="askrow"><b>${wt} plant${wt > 1 ? "s don't" : " doesn't"} fit in the bed right now: ${esc(names)}.</b> They stay on your shopping list and will be placed if the bed gets bigger or you make room.` +
        (S.waitAck ? ` <button class="btn small" id="nfYes" type="button">Remove them</button>` : `<div class="askbtns">Remove them from the plan? <button class="btn small" id="nfYes" type="button">Yes</button> <button class="btn small" id="nfNo" type="button">No, keep them</button></div>`) + "</div>");
      $("#nfYes").onclick = () => { S.waiting = {}; S.waitAck = false; save(); refresh(); toast("Removed " + names + "."); };
      if ($("#nfNo")) $("#nfNo").onclick = () => { S.waitAck = true; save(); refresh(); };
    }
    renderSelCard();
    const a = $("#armed");
    if (armed) { a.classList.add("on"); a.innerHTML = `Placing <b>${esc(byId[armed].name)}</b>: click the bed <button class="btn small" id="armOff" type="button">Stop</button>`; $("#armOff").onclick = () => { armed = null; refreshPlanOnly(); }; }
    else if (pathDraw) {
      a.classList.add("on"); const n = pathDraw.pts.length;
      a.innerHTML = `Drawing a <b>path</b>: click along the bed to lay it out${n >= 2 ? "" : " (at least 2 points)"}. <button class="btn small primary" id="pdDone" type="button"${n >= 2 ? "" : " disabled"}>Finish</button> <button class="btn small" id="pdUndo" type="button"${n ? "" : " disabled"}>Undo point</button> <button class="btn small" id="pdOff" type="button">Cancel</button>`;
      $("#pdDone").onclick = finishPath; $("#pdUndo").onclick = () => { pathDraw.pts.pop(); renderPlan(); }; $("#pdOff").onclick = () => { pathDraw = null; renderPlan(); };
    }
    else if (multiTap && selAll().length) { a.classList.add("on"); a.innerHTML = `Selecting <b>${selAll().length} plant${selAll().length > 1 ? "s" : ""}</b>: tap plants to add or drop them <button class="btn small primary" id="mtDone" type="button">Done</button>`; $("#mtDone").onclick = () => { multiTap = false; renderPlan(); }; }
    else if (objArmed) { a.classList.add("on"); a.innerHTML = `Placing a <b>${esc(Geo.OBJ[objArmed].label.toLowerCase())}</b>: click the bed where it goes <button class="btn small" id="armOff" type="button">Stop</button>`; $("#armOff").onclick = () => { objArmed = null; pathDraw = null; refreshPlanOnly(); }; }
    else a.classList.remove("on");
    undoUI();
    $("#mSun").classList.toggle("on", !!paint);
    if (multiTap && !selAll().length) multiTap = false;
    $("#toolsHint").hidden = !!(armed || pathDraw || objArmed || (multiTap && selAll().length));
  }
  function refreshPlanOnly() { renderPlan(); }
  // plants closer together than their spacing allows (early-dormant plants may tuck in among later ones)
  function overlapPairs() {
    const out = [], P = S.placements;
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const A = byId[P[i].id], B = byId[P[j].id], mix = !!A.dormant !== !!B.dormant;
      if (Math.hypot(P[i].x - P[j].x, P[i].y - P[j].y) < (A.spacing + B.spacing) / 24 * (mix ? 0.2 : 0.72)) out.push([P[i], P[j]]);
    }
    return out;
  }
  // plants sitting on an object: [plant, object]
  function objOverlaps() {
    const out = []; if (!S.objects.length) return out;
    S.placements.forEach(p => { if (p.c) return; const o = Geo.objHit(S.objects, p.x, p.y, byId[p.id].spacing / 24, 0.5); if (o) out.push([p, o]); });
    return out;
  }
  // move a plant somewhere whose painted light suits it
  function moveToLight(pl) {
    const rest = S.placements.filter(q => q !== pl && !q.c), t = Geo.depthTargets(selected());
    for (let k = 0; k < 4; k++) {
      const np = Geo.placeOne(bed, byId, rest, pl.id, t, 0);
      if (np && byId[pl.id].sun.includes(zoneAt(np.x, np.y))) { pl.x = np.x; pl.y = np.y; return true; }
    }
    return false;
  }
  // after an object is placed, moved or resized: groundcover under it goes, other plants step aside
  function settleObjects() {
    let moved = 0, stuck = 0;
    S.placements = S.placements.filter(p => !(p.c && Geo.objHit(S.objects, p.x, p.y, byId[p.id].spacing / 24, 0.7)));
    S.placements.forEach(p => { if (p.c || p.lock || !Geo.objHit(S.objects, p.x, p.y, byId[p.id].spacing / 24, 0.7)) return; if (movePlacement(p)) moved++; else stuck++; });
    return { moved, stuck };
  }
  function settleNote(r) { return (r.moved ? ` Moved ${r.moved} plant${r.moved > 1 ? "s" : ""} out of the way.` : "") + (r.stuck ? ` ${r.stuck} plant${r.stuck > 1 ? "s" : ""} couldn't find another spot and ${r.stuck > 1 ? "are" : "is"} marked in red.` : ""); }
  function movePlacement(pl) {
    const rest = S.placements.filter(q => q !== pl && !q.c), sel = selected(), t = Geo.depthTargets(sel);
    const np = Geo.placeBeside(bed, byId, rest, pl.id, pl.x, pl.y, t, pl.id) || Geo.placeOne(bed, byId, rest, pl.id, t, 0);
    if (!np) return false;
    pl.x = np.x; pl.y = np.y; return true;
  }
  function openOverlapFix() {
    const old = document.getElementById("ovAsk"); if (old) old.remove();
    const pairs = overlapPairs(), opairs = objOverlaps(); if (!pairs.length && !opairs.length) return;
    const ov = document.createElement("div"); ov.id = "ovAsk"; ov.className = "modalov";
    ov.innerHTML = `<div class="modalbox" role="dialog" aria-modal="true"><h3>Move an overlapping plant</h3><p>Pick one plant from each pair to move to the nearest open spot where it fits.</p><div class="ovlist"></div><div class="askbtns"><button class="btn" id="ovDone" type="button">Done</button></div></div>`;
    document.body.appendChild(ov);
    const list = ov.querySelector(".ovlist");
    pairs.forEach(([a, b]) => {
      const row = document.createElement("div"); row.className = "ovrow";
      row.innerHTML = `<span>${esc(byId[a.id].name)} and ${esc(byId[b.id].name)}</span>`;
      [a, b].forEach(pl => { const bt = document.createElement("button"); bt.type = "button"; bt.className = "btn small"; bt.textContent = "Move " + byId[pl.id].name;
        bt.onclick = () => { if (pl.lock) { toast("That plant is locked. Unlock it first, or move the other one."); return; } S.placements = S.placements.filter(q => !q.c); if (movePlacement(pl)) { refresh(); toast("Moved " + byId[pl.id].name + "."); ov.remove(); if (overlapPairs().length || objOverlaps().length) openOverlapFix(); } else toast("There's no open spot big enough for " + byId[pl.id].name + " right now. Try the other plant, or make room."); };
        row.appendChild(bt); });
      list.appendChild(row);
    });
    opairs.forEach(([pl, o]) => {
      const row = document.createElement("div"); row.className = "ovrow";
      row.innerHTML = `<span>${esc(byId[pl.id].name)} is on the ${esc(Geo.OBJ[o.t].label.toLowerCase())}</span>`;
      const bt = document.createElement("button"); bt.type = "button"; bt.className = "btn small"; bt.textContent = "Move " + byId[pl.id].name;
      bt.onclick = () => { if (pl.lock) { toast("That plant is locked. Unlock it first, or move the other one."); return; } S.placements = S.placements.filter(q => !q.c); if (movePlacement(pl)) { refresh(); toast("Moved " + byId[pl.id].name + "."); ov.remove(); if (overlapPairs().length || objOverlaps().length) openOverlapFix(); } else toast("There's no open spot big enough for " + byId[pl.id].name + " right now."); };
      row.appendChild(bt); list.appendChild(row);
    });
    ov.querySelector("#ovDone").onclick = () => ov.remove();
  }
  function setHover(id) {
    hoverId = id;
    document.querySelectorAll(".brow,.ocol,.pcard").forEach(e => e.classList.toggle("hl", !!id && e.dataset.id === id));
    window.Plan.setHover(id);
  }
  function refresh() { renderLibrary(); renderBloom(); renderOrder(); renderShop(); renderPlan(); save(); }
  function fullRender() { renderShapesPanel(); renderDims(); renderChips(); refresh(); }

  // ---------- menus: one look for every dropdown and right-click menu ----------
  // items: { label, icon (html), hint, check (true/false shows a check mark column), danger, disabled, keep (stays
  // open and redraws, for on/off settings), fn } | { head: "section title" } | { sep: true }. pos: an element to drop
  // below, or { x, y } on screen. items may be a function so a kept-open menu can redraw with fresh checks.
  // closing a plant's or object's right-click menu brings its card back
  function closePlantMenu() { const m = document.getElementById("plantMenu"); if (m) { m.remove(); if (m.dataset.ctx) renderSelCard(); } }
  // a menu closes as soon as you press anywhere outside it (pressing on the plan redraws it, which can swallow a click);
  // the toolbar buttons toggle their own menus
  document.addEventListener("pointerdown", e => { const m = document.getElementById("plantMenu"); if (m && !m.contains(e.target) && !(e.target.closest && e.target.closest(".tmenu, .selbtn, [id='freeView'], [id='fHeight'], [id='fMonth'], [id='bloomSort']"))) closePlantMenu(); }, true);
  function showMenu(items, pos, cls, forId) {
    closePlantMenu();
    const m = document.createElement("div"); m.id = "plantMenu"; m.className = "ctxmenu" + (cls ? " " + cls : ""); if (forId) m.dataset.for = forId;
    const build = () => {
      m.innerHTML = "";
      (typeof items === "function" ? items() : items).forEach(it => {
        if (it.head) { const h = document.createElement("div"); h.className = "ctxhead"; h.textContent = it.head; m.appendChild(h); return; }
        if (it.sep) { const h = document.createElement("div"); h.className = "ctxsep"; m.appendChild(h); return; }
        const b = document.createElement("button"); b.type = "button"; b.className = "ctxitem" + (it.danger ? " danger" : "") + (it.check ? " on" : ""); b.disabled = !!it.disabled;
        b.innerHTML = (it.check !== undefined ? '<span class="check">✓</span>' : "") + `<span class="ctxl">${it.icon || ""}${esc(it.label)}</span>` + (it.hint ? `<small>${esc(it.hint)}</small>` : "");
        b.onclick = e => { e.stopPropagation(); if (it.keep) { it.fn(); build(); } else { closePlantMenu(); it.fn(); } };
        m.appendChild(b);
      });
    };
    build(); document.body.appendChild(m);
    const tipEl = document.getElementById("ictip"); if (tipEl) tipEl.className = "";
    const r = pos.getBoundingClientRect ? pos.getBoundingClientRect() : null, x = r ? r.left : pos.x, y = r ? r.bottom + 4 : pos.y;
    m.style.left = Math.max(6, Math.min(x, window.innerWidth - m.offsetWidth - 10)) + "px";
    m.style.top = Math.max(6, Math.min(y, window.innerHeight - m.offsetHeight - 10)) + "px";
    setTimeout(() => document.addEventListener("click", closePlantMenu, { once: true }), 0);
    return m;
  }
  // what you can do with the selected plant(s); used by the right-click menu and the card beside the plant
  function plantActions(group) {
    const n = group.length, names = [...new Set(group.map(q => byId[q.id].name))], what = n === 1 ? names[0] : n + " plants", allLocked = group.every(q => q.lock);
    return [
      { label: allLocked ? (n > 1 ? "Unlock all " + n : "Unlock (let Re-arrange move it)") : (n > 1 ? "Lock all " + n + " in place" : "Lock in place"), short: allLocked ? "Unlock" : "Lock", fn: () => {
        const v = !allLocked; group.forEach(q => { if (v) q.lock = true; else delete q.lock; });
        save(); renderPlan(); toast((v ? "Locked " : "Unlocked ") + what + (v ? ". Locked plants can't be dragged, moved or removed until you unlock them." : "."), 3500); } },
      { label: n > 1 ? "Move all " + n + " to open spots" : "Move to an open spot", short: "Move", fn: () => {
        let moved = 0, stuck = 0, locked = 0;
        group.forEach(q => { if (q.lock) { locked++; return; } if (movePlacement(q)) moved++; else stuck++; });
        if (moved) refresh();
        toast(moved ? "Moved " + moved + (moved > 1 ? " plants." : " plant.") + (stuck ? " " + stuck + " had no open spot." : "") + (locked ? " " + locked + " locked stayed put." : "") : locked ? "Locked plants stay put. Unlock first." : "No open spot nearby."); } },
      { label: n > 1 ? "Duplicate all " + n : "Duplicate " + names[0], short: "Duplicate", fn: () => {
        notice = ""; noFit = []; let ok = 0; group.forEach(q => { if (addOne(q.id, true)) ok++; });
        refresh(); toast(ok ? "Added " + ok + " more plant" + (ok > 1 ? "s" : "") + "." : "No room left for more."); } },
      { label: n > 1 ? "Remove all " + n : "Remove this " + names[0], short: n > 1 ? "Remove all" : "Remove", danger: true, fn: () => {
        const del = group.filter(q => !q.lock), kept = n - del.length;
        if (!del.length) { toast("Locked plants can't be removed. Unlock first."); return; }
        S.placements = S.placements.filter(q => !del.includes(q)); clearSel(); refresh();
        toast((del.length === 1 ? names[0] + " removed." : del.length + " plants removed.") + (kept ? " " + kept + " locked plant" + (kept > 1 ? "s" : "") + " stayed." : "") + " Undo brings " + (del.length === 1 ? "it" : "them") + " back."); } }
    ];
  }
  function openPlantMenu(idx, cx, cy) {
    closePlantMenu(); closeAddCard();
    if (!S.placements[idx]) return;
    if (!selAll().includes(idx)) { selIdx = idx; extraSel = []; }
    optMode = "idle"; renderPlan();
    const group = selAll().map(i => S.placements[i]).filter(Boolean), n = group.length;
    const more = { label: multiTap ? "Stop selecting more" : "Select more plants…", hint: multiTap || TOUCH ? "" : "or Ctrl-click", fn: () => { multiTap = !multiTap; renderPlan(); if (multiTap) toast("Tap other plants to add them to the selection. Tap one again to drop it. Done when finished.", 4000); } };
    const kind = sameKind(idx), all = kind.length > 1 && !kind.every(j => selAll().includes(j))
      ? [{ label: "Select all " + byId[S.placements[idx].id].name + " (" + kind.length + ")", hint: TOUCH ? "" : "or Shift-click", fn: () => { selectKind(idx); renderPlan(); } }] : [];
    const m = showMenu((n > 1 ? [{ head: n + " plants selected" }] : [{ head: byId[group[0].id].name }]).concat([more], all, [{ sep: true }], plantActions(group)), { x: cx, y: cy });
    m.dataset.ctx = "1"; renderSelCard();   // just the menu while it's open, not the card as well
  }
  // what you can do with a placed object
  function objActions(oi) {
    const o = S.objects[oi], d = Geo.OBJ[o.t], out = [];
    out.push({ label: "Duplicate " + d.label.toLowerCase(), short: "Duplicate", fn: () => {
      const c = Object.assign({}, o), step = (d.shape === "circ" ? o.w : Math.max(o.w, o.h)) / 2 + 0.6;
      if (o.pts) { const off = o.w + 0.4, np = o.pts.map(q => [q[0] + off, q[1]]); const ok = np.every(q => Geo.pip(bed.poly, q[0], q[1])); const np2 = ok ? np : o.pts.map(q => [q[0] - off, q[1]]); c.pts = np2.every(q => Geo.pip(bed.poly, q[0], q[1])) ? np2 : o.pts.map(q => [q[0], q[1]]); c.x = c.pts.reduce((s2, q) => s2 + q[0], 0) / c.pts.length; c.y = c.pts.reduce((s2, q) => s2 + q[1], 0) / c.pts.length; S.objects.push(c); objSel = S.objects.length - 1; refresh(); toast("Added another path."); return; }
      const spots = [[step, 0], [-step, 0], [0, step], [0, -step]].map(([dx, dy]) => [o.x + dx, o.y + dy]).filter(q => Geo.pip(bed.poly, q[0], q[1]));
      if (spots.length) { c.x = spots[0][0]; c.y = spots[0][1]; }
      S.objects.push(c); objSel = S.objects.length - 1; const r = settleObjects(); refresh(); toast("Added another " + d.label.toLowerCase() + "." + settleNote(r)); } });
    if (d.rot && !o.pts) out.push({ label: "Turn 90°", short: "Turn 90°", fn: () => { o.rot = ((o.rot || 0) + 90) % 360; const r = settleObjects(); refresh(); if (r.moved || r.stuck) toast(settleNote(r).trim()); } });
    out.push({ label: "Remove this " + d.label.toLowerCase(), short: "Remove", danger: true, fn: () => { S.objects.splice(oi, 1); objSel = -1; refresh(); toast(d.label + " removed. Undo brings it back."); } });
    return out;
  }
  function openObjMenu(oi, cx, cy) {
    closePlantMenu(); closeAddCard();
    const o = S.objects[oi]; if (!o) return;
    const m = showMenu([{ head: Geo.OBJ[o.t].label }].concat(objActions(oi)), { x: cx, y: cy });
    m.dataset.ctx = "1"; renderSelCard();   // just the menu while it's open, not the card as well
  }
  const OBJ_ICON = { path: "▭", stone: "●", stump: "◎", rock: "⬬", birdbath: "◉", shrub: "✺", hedge: "▤", tree: "♣" };
  const objIcon = t => `<i class="oic oic-${t}">${OBJ_ICON[t] || "•"}</i>`;
  const objSize = t => { const d = Geo.OBJ[t]; return t === "path" ? "draw it" : d.shape === "circ" ? d.w + " ft" : d.w + " × " + d.h + " ft"; };
  const PLANT_ICON = '<i class="oic oic-plant">✿</i>';
  // put an object down at a spot on the bed (a path starts there and you click along to lay it out)
  function addObjectAt(t, x, y) {
    if (!Geo.pip(bed.poly, x, y)) { toast("Click inside the bed."); return; }
    armed = null; paint = null; renderPaintBar(); clearSel(); closeAddCard();
    if (t === "path") { objArmed = null; objSel = -1; pathDraw = { pts: [[x, y]], w: Geo.OBJ.path.w }; renderPlan(); toast("Path started. Click more points along the bed, then Finish (or double-click).", 4500); return; }
    const d = Geo.OBJ[t]; S.objects.push({ t, x, y, w: d.w, h: d.h, rot: 0 });
    objArmed = null; pathDraw = null; objSel = S.objects.length - 1;
    const r = settleObjects(); refresh(); toast(`Added the ${d.label.toLowerCase()}.` + settleNote(r) + " Drag it to move it; drag a white dot to resize it.", 4000);
  }
  // pick an object from the Add menu, then click the bed where it goes
  function armObject(t) {
    objArmed = t; pathDraw = null; if (t === "path") { objArmed = null; pathDraw = { pts: [], w: Geo.OBJ.path.w }; }
    armed = null; paint = null; renderPaintBar(); clearSel(); objSel = -1; closeAddCard(); renderPlan();
  }
  // right-click an empty spot on the bed
  function openSpotMenu(x, y, cx, cy) {
    clearSel(); objSel = -1; closeAddCard(); renderPlan();
    const z = zoneAt(x, y), items = [];
    if (z) items.push({ head: "This spot: " + window.Plan.ZONE_LAB[z].toLowerCase() + ", " + window.Plan.ZONE_HRS[z] });
    items.push({ label: "Add a plant here…", icon: PLANT_ICON, hint: z ? "suits this light" : "", fn: () => openAddCard({ x, y, cx, cy }) });
    items.push({ head: "Add an object here" });
    Object.keys(Geo.OBJ).forEach(t => items.push({ label: Geo.OBJ[t].label + (t === "path" ? " (starts here)" : ""), icon: objIcon(t), hint: objSize(t), fn: () => addObjectAt(t, x, y) }));
    showMenu(items, { x: cx, y: cy }, "objmenu");
  }
  // ---------- the toolbar menus above the plan ----------
  function toggleMenu(id, open) { return e => { e.stopPropagation(); const m = document.getElementById("plantMenu"); if (m && m.dataset.for === id) { closePlantMenu(); return; } open(); }; }
  // phones and tablets: the editor's buttons or the sun palette sit just above the plan; bring them into view
  function showPlanTools() {
    if (innerWidth > 1050) return;
    requestAnimationFrame(() => { const w = $("#planWrap"); if (!w) return; const y = w.getBoundingClientRect().top + scrollY - 8; scrollTo({ top: y, behavior: "smooth" }); });
  }
  function togglePaint(quiet) {
    paint = paint ? null : { brush: sunBase() === "shade" ? "full" : "shade", size: 2 };
    objArmed = null; pathDraw = null; armed = null; clearSel(); objSel = -1; closeAddCard(); renderPaintBar(); renderPlan();
    if (paint) showPlanTools();
    if (paint && !quiet) toast("Pick a light, then drag across the bed to map where it falls. Press Done " + (TOUCH ? "" : "or Esc ") + "when you're finished.", 4500);
  }
  function suggestClicked() {
    clearSel(); objSel = -1; renderPlan();
    const c = counts(true), mine = PL.filter(p => c[p.id] > 0);   // the gap-filler carpet doesn't count as a pick
    if (!mine.length) { doSuggestPlanting(false); return; }
    askChoice("Suggest a planting", [
      "I'll pick plants for each part of the bed, matched to its light, and lay them out so the bed is full once grown (every plant at its recommended spacing): plants that go well together, flowers from spring into fall, and short, middle and tall plants in the right places. Only plants that fit your garden choices are used.",
      `Build around the ${mine.length} kind${mine.length === 1 ? "" : "s"} of plant you have now, adding others that suit them, or start fresh with a whole new mix. Locked plants always stay. Each click gives a different planting, and you can undo it.`],
      [["Build around my plants", () => doSuggestPlanting(true)], ["Start fresh", () => doSuggestPlanting(false)]]);
  }
  function arrangeClicked() { if (!S.placements.some(p => !p.c)) { toast("Add some plants to the bed first."); return; } clearSel(); objSel = -1; renderPlan(); openConfirmModal("arrange"); }
  function fillClicked() { if (!S.placements.length) { toast("Add some plants to the bed first."); return; } clearSel(); objSel = -1; renderPlan(); openFillModal(); }
  function clearClicked() { if (!S.placements.length) { toast("The bed is already empty."); return; } clearSel(); objSel = -1; renderPlan(); openConfirmModal("clear"); }
  $("#mAdd").addEventListener("click", toggleMenu("mAdd", () => {
    const items = [{ label: "A plant…", icon: PLANT_ICON, hint: "pick from a list", fn: () => openAddCard(null) }, { head: "Objects: pick one, then click the bed" }];
    Object.keys(Geo.OBJ).forEach(t => items.push({ label: Geo.OBJ[t].label, icon: objIcon(t), hint: objSize(t), fn: () => armObject(t) }));
    showMenu(items, $("#mAdd"), "objmenu", "mAdd");
  }));
  $("#mSun").addEventListener("click", toggleMenu("mSun", () => {
    const L = window.Plan.ZONE_LAB, H = window.Plan.ZONE_HRS;
    showMenu(() => [
      { label: paint ? "Stop mapping sun" : "Map sun zones…", hint: paint ? "" : "drag across the bed", fn: () => togglePaint() },
      { head: "The rest of the bed gets" }
    ].concat(["full", "part", "shade"].map(k => ({ label: L[k], hint: H[k], check: sunBase() === k, keep: true, fn: () => { S.sunBase = k; save(); renderPaintBar(); renderPlan(); } })))
      .concat([{ sep: true }, { label: "Clear all mapped sun zones", disabled: !sunActive(), fn: () => { S.sun.cells = {}; S.sunBase = null; save(); renderPaintBar(); renderPlan(); toast("Sun zones cleared. Undo brings them back."); } }]), $("#mSun"), "", "mSun");
  }));
  $("#mPlan").addEventListener("click", toggleMenu("mPlan", () => showMenu([
    { label: "Suggest a planting…", hint: "picks plants for you", fn: suggestClicked },
    { label: "Re-arrange…", hint: "same plants, new layout", fn: arrangeClicked },
    { label: "Fill gaps…", hint: "groundcover or companions", fn: fillClicked },
    { sep: true },
    { label: "Clear bed…", hint: "remove all plants", danger: true, fn: clearClicked }
  ], $("#mPlan"), "", "mPlan")));
  $("#mView").addEventListener("click", toggleMenu("mView", () => showMenu(() => [
    { head: "Show plants as" },
    { label: "Letters", check: S.view !== "photos", keep: true, fn: () => { S.view = "codes"; renderPlan(); save(); } },
    { label: "Photos", check: S.view === "photos", keep: true, fn: () => { S.view = "photos"; renderPlan(); save(); } },
    { sep: true },
    { label: "Grid (1 ft squares)", check: S.showGrid !== false, keep: true, fn: () => { S.showGrid = S.showGrid === false; renderPlanOnly(); save(); } },
    { label: "Sun colors", check: sunActive() && S.showSun !== false, disabled: !sunActive(), hint: sunActive() ? "" : "map sun first", keep: true, fn: () => { S.showSun = S.showSun === false; renderPlanOnly(); save(); } }
  ], $("#mView"), "", "mView")));

  // ---------- popup "select" buttons: a dropdown list like the rest of the app, instead of a native selection box ----------
  function bindSelectBtn(id, getOptions, getValue, onChange) {
    const btn = $("#" + id);
    function current() { const opts = getOptions(), v = String(getValue()); return opts.find(o => String(o.value) === v) || opts[0]; }
    function refreshLabel() { const o = current(); btn.textContent = o ? o.label : ""; }
    btn.addEventListener("click", e => {
      e.stopPropagation();
      if (document.querySelector(".selmenu")) { closePlantMenu(); return; }
      closePlantMenu();
      const opts = getOptions(), cur = String(getValue());
      const r = btn.getBoundingClientRect(), m = document.createElement("div"); m.id = "plantMenu"; m.className = "ctxmenu selmenu";
      opts.forEach(o => {
        const b = document.createElement("button"); b.type = "button"; b.className = "ctxitem" + (String(o.value) === cur ? " on" : "");
        b.innerHTML = `<span class="check">✓</span><span>${esc(o.label)}</span>`;
        b.onclick = ev => { ev.stopPropagation(); closePlantMenu(); onChange(o.value); refreshLabel(); };
        m.appendChild(b);
      });
      document.body.appendChild(m);
      const vw = window.innerWidth, vh = window.innerHeight, mw = Math.max(170, btn.offsetWidth);
      m.style.minWidth = mw + "px";
      m.style.left = Math.min(r.left, vw - mw - 10) + "px";
      m.style.top = Math.min(r.bottom + 4, vh - m.offsetHeight - 10) + "px";
      setTimeout(() => document.addEventListener("click", closePlantMenu, { once: true }), 0);
    });
    return refreshLabel;
  }
  const refreshHeight = bindSelectBtn("fHeight",
    () => [{ value: "", label: "Any height" }, { value: "low", label: "Low (under 12 in)" }, { value: "mid", label: "Medium (12–30 in)" }, { value: "tall", label: "Tall (30 in and up)" }],
    () => S.filter.height || "",
    v => { S.filter.height = v; renderLibrary(); save(); });
  const refreshSun = bindSelectBtn("fSun",
    () => [{ value: "", label: "Any light" }, { value: "full", label: "Full sun" }, { value: "part", label: "Part shade" }, { value: "shade", label: "Shade" }],
    () => S.filter.sun || "",
    v => { S.filter.sun = v; renderLibrary(); save(); });
  const refreshMonth = bindSelectBtn("fMonth",
    () => [{ value: "", label: "Any bloom month" }].concat(Ch.MONTHS.map((m, i) => ({ value: String(4 + i), label: "Blooms in " + m }))),
    () => S.filter.month || "",
    v => { S.filter.month = v; renderLibrary(); save(); });
  const refreshBloomSort = bindSelectBtn("bloomSort",
    () => [{ value: "start", label: "by first bloom" }, { value: "name", label: "by name" }, { value: "height", label: "by height" }],
    () => S.bloomSort || "start",
    v => { S.bloomSort = v; renderBloom(); save(); });

  // size fields for the selected object, shown in its card
  function objFields(o) {
    const d = Geo.OBJ[o.t], row = document.createElement("div"); row.className = "sc-fields";
    const field = (label, key, min, max, step) => {
      const l = document.createElement("label"); l.textContent = label;
      const i = document.createElement("input"); i.type = "number"; i.min = min; i.max = max; i.step = step; i.value = Math.round((o[key] || 0) * 100) / 100;
      i.onchange = () => {
        let v = parseFloat(i.value); if (!isFinite(v)) return; v = Math.max(min, Math.min(max, v));
        if (key === "rot") v = ((v % 360) + 360) % 360;
        o[key] = v; if (d.shape === "circ" && key === "w") o.h = v;
        const r = settleObjects(); refresh(); if (r.moved || r.stuck) toast(settleNote(r).trim());
      };
      l.appendChild(i); row.appendChild(l);
    };
    if (o.pts) field("Width, ft", "w", d.min, d.max, 0.25);
    else if (d.shape === "circ") field(o.t === "tree" ? "Canopy width, ft" : "Width, ft", "w", d.min, d.max, 0.25);
    else { field("Width, ft", "w", d.min, d.max, 0.25); field(o.t === "path" ? "Length, ft" : "Depth, ft", "h", d.min, d.max, 0.25); field("Turn, °", "rot", 0, 359, 15); }
    return row;
  }

  // ---------- sun painting ----------
  function paintAt(x, y) {
    const res = S.sun.res, r = Math.max(paint.size / 2, res * 0.72), cells = S.sun.cells;
    for (let i = Math.floor((x - r) / res); i <= Math.floor((x + r) / res); i++) for (let j = Math.floor((y - r) / res); j <= Math.floor((y + r) / res); j++) {
      const cx = (i + 0.5) * res, cy = (j + 0.5) * res;
      if (i < 0 || j < 0 || Math.hypot(cx - x, cy - y) > r || !Geo.pip(bed.poly, cx, cy)) continue;
      if (paint.brush === "erase") delete cells[i + "," + j]; else cells[i + "," + j] = paint.brush;
    }
  }
  // The lights actually on the bed: every painted cell, plus the rest-of-bed light if any spot is left unpainted.
  function sunInBed() {
    const z = new Set(), r = S.sun.res, cells = S.sun.cells, P = bed.poly; let open = false;
    const xs = P.map(q => q[0]), ys = P.map(q => q[1]);
    for (let i = Math.floor(Math.min(...xs) / r); i <= Math.floor(Math.max(...xs) / r); i++) for (let j = Math.floor(Math.min(...ys) / r); j <= Math.floor(Math.max(...ys) / r); j++) {
      if (i < 0 || j < 0 || !Geo.pip(P, (i + 0.5) * r, (j + 0.5) * r)) continue;
      const c = cells[i + "," + j]; if (c) z.add(c); else open = true;
    }
    if (open || !z.size) z.add(sunBase());
    return z;
  }
  // Painting a light that step 4 leaves out ticks it there too, so there are plants for that spot.
  // exact (used when the guided tour leaves its sun step) makes step 4 match the bed exactly.
  function syncSunPrefs(exact) {
    if (!sunActive()) return;
    const have = sunInBed(), cur = S.prefs.sun;
    const next = ["full", "part", "shade"].filter(k => have.has(k) || (!exact && cur.includes(k)));
    if (next.join() === cur.join()) return;
    const added = next.filter(k => !cur.includes(k));
    S.prefs.sun = next; prefChanged();
    if (added.length) toast("Step 4 now includes " + added.map(k => window.Plan.ZONE_LAB[k].toLowerCase()).join(" and ") + " plants, to match the sun you mapped.", 3500);
  }
  // the sun-painting palette floats at the top of the bed plan while painting
  function renderPaintBar() {
    document.body.classList.toggle("painting", !!paint);
    const bar = $("#paintBar"); if (!bar) return;
    if (!paint) { bar.hidden = true; bar.innerHTML = ""; return; }
    bar.hidden = false; bar.innerHTML = "";
    const Z = window.Plan.ZONE, L = window.Plan.ZONE_LAB, H = window.Plan.ZONE_HRS;
    const btn = (html, cls, title, fn) => { const b = document.createElement("button"); b.type = "button"; b.className = cls; b.innerHTML = html; b.title = title; b.onclick = fn; bar.appendChild(b); return b; };
    const lab = t => { const s2 = document.createElement("span"); s2.className = "pb-lab"; s2.textContent = t; bar.appendChild(s2); };
    const sep = () => { const s2 = document.createElement("span"); s2.className = "pb-sep"; bar.appendChild(s2); };
    bar.title = "Drag on the bed to map the light. Esc or Done when you're finished.";
    ["full", "part", "shade", "erase"].forEach(k => btn(k === "erase" ? '<i class="zsw zerase"></i>Eraser' : `<i class="zsw" style="background:${Z[k]}"></i>${L[k]} <span class="zhrs">${H[k]}</span>`,
      "pb-btn" + (paint.brush === k ? " on" : ""), k === "erase" ? "Set back to the rest of the bed's light" : window.Plan.ZONE_TIP[k], () => { paint.brush = k; renderPaintBar(); }));
    sep();
    [[1, "S"], [2, "M"], [4, "L"]].forEach(([n, t]) => btn(`<i class="pb-dot" style="width:${4 + n * 2}px;height:${4 + n * 2}px"></i>`, "pb-btn pb-size" + (paint.size === n ? " on" : ""), n + " ft brush", () => { paint.size = n; renderPaintBar(); renderPlanOnly(); }));
    sep();
    const sel = document.createElement("select"); sel.title = "The light in every spot you haven't mapped";
    ["full", "part", "shade"].forEach(k => { const o = document.createElement("option"); o.value = k; o.textContent = "Rest of bed: " + L[k].toLowerCase(); sel.appendChild(o); });
    sel.value = sunBase(); sel.onchange = () => { S.sunBase = sel.value; save(); renderPaintBar(); renderPlan(); syncSunPrefs(); }; bar.appendChild(sel);
    const sp = document.createElement("span"); sp.className = "pb-grow"; bar.appendChild(sp);
    const clr = btn("Clear", "btn small", "Clear all mapped sun zones", () => { S.sun.cells = {}; S.sunBase = null; save(); renderPaintBar(); renderPlan(); toast("Sun zones cleared. Undo brings them back."); }); clr.disabled = !sunActive();
    btn("Done", "btn small primary", "Save the sun zones and stop mapping (Esc)", () => {
      if (paint.fromStep && !Tour.on && !(S.done && S.done.sun)) { completeStep("sun", true); return; }   // step 4's palette: Done finishes the step too
      endSunStep(); if (S.done && S.done.sun) { openSteps.delete("sun"); renderSteps(); }
    });
  }

  // ---------- plan callbacks ----------
  window.Plan.init($("#plan"), {
    onSelect(i, add, kind) {
      objSel = -1;
      if (i < 0) { clearSel(); }
      else if (kind) selectKind(i);
      else if (add) {
        const cur = selAll();
        if (cur.includes(i)) { const rest = cur.filter(x => x !== i); selIdx = rest.length ? rest[rest.length - 1] : -1; extraSel = rest.slice(0, -1); }
        else { selIdx = i; extraSel = cur; }
      } else { const cur = selAll(); if (!cur.includes(i) || cur.length === 1) { selIdx = i; extraSel = []; } else { selIdx = i; extraSel = cur.filter(x => x !== i); } }   // clicking inside a group keeps the group
      if (selIdx >= 0) optMode = "idle";
      renderPlan();
    },
    onDragStart() { dragOrig = S.placements.map(p => ({ x: p.x, y: p.y })); const c = $("#selCard"); if (c) c.hidden = true; },
    onDragPush(idx) { return dragOrig ? makeRoom(new Set([idx]), dragOrig) : []; },
    onMoved() { dragOrig = null; save(); renderPlan(); if (sunActive()) renderBloom(); },   // a plant dragged into another sun zone moves to that zone's section of the Garden Timeline
    isMulti() { return multiTap; },
    isOnlySelected(i) { const s = selAll(); return s.length === 1 && s[0] === i; },
    // the card beside a selection follows the plant when the plan is zoomed or moved around
    onPanStart() { const c = $("#selCard"); if (c) c.style.visibility = "hidden"; },
    onView() { const c = $("#selCard"); if (c) c.style.visibility = ""; renderSelCard(); },
    onPlace(x, y) {
      if (!armed) return;
      if (!Geo.pip(bed.poly, x, y)) { toast("Click inside the bed."); return; }
      S.placements.push({ id: armed, x, y }); notice = ""; noFit = []; refresh();
    },
    onHover(id) { if (id !== hoverId) setHover(id); },
    onContextMenu(idx, x, y) { openPlantMenu(idx, x, y); },
    onObjSelect(i) { objSel = i; clearSel(); optMode = "idle"; renderPlan(); },
    onObjMenu(i, x, y) { openObjMenu(i, x, y); },
    onLockedDrag() { toast("Locked in place. " + (TOUCH ? "Press and hold it" : "Right-click it") + " and choose Unlock to move it.", 2500); },
    onObjChange() { renderPlanOnly(); },
    onObjDone() { const r = settleObjects(); refresh(); if (r.moved || r.stuck) toast(settleNote(r).trim(), 3500); },
    onPathPoint(x, y) {
      if (!pathDraw) return;
      if (!Geo.pip(bed.poly, x, y)) { toast("Click inside the bed."); return; }
      const l = pathDraw.pts[pathDraw.pts.length - 1]; if (l && Math.hypot(l[0] - x, l[1] - y) < 0.4) return;
      pathDraw.pts.push([x, y]); renderPlan();
    },
    onPathFinish() { finishPath(); },
    onObjPlace(x, y) { if (objArmed) addObjectAt(objArmed, x, y); },
    onSpotMenu(x, y, cx, cy) { openSpotMenu(x, y, cx, cy); },
    onPaintStart() {},
    onPaint(x, y) { paintAt(x, y); renderPlanOnly(); },
    onPaintEnd() { save(); renderPlan(); renderPaintBar(); syncSunPrefs(); }
  });
  function finishPath() {
    if (!pathDraw) return;
    if (pathDraw.pts.length < 2) { toast("Click at least two points along the bed, then Finish."); return; }
    const P = pathDraw.pts.map(q => [q[0], q[1]]), cx = P.reduce((s, q) => s + q[0], 0) / P.length, cy = P.reduce((s, q) => s + q[1], 0) / P.length;
    S.objects.push({ t: "path", x: cx, y: cy, w: pathDraw.w, h: pathDraw.w, rot: 0, pts: P });
    pathDraw = null; objSel = S.objects.length - 1; clearSel();
    const r = settleObjects(); refresh(); toast("Path added." + settleNote(r) + " Drag the white dots to reshape it, the orange dot for width.", 4500);
  }
  function renderPlanOnly() { window.Plan.render(planCtx()); }

  // ---------- toolbar / buttons ----------
  const fileDate = () => { const d = new Date(), z = n => String(n).padStart(2, "0"); return z(d.getFullYear() % 100) + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate()); };
  const gardenName = () => (S.name || "").trim() || "My Garden";
  const safeFile = t => t.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim() || "My Garden";
  function renderName() {
    const nm = (S.name || "").trim(), pr = S.prefs || {};
    const sunL = { full: "Full sun", part: "Part shade", shade: "Shade" };
    const list = (arr, map) => (arr || []).map(k => map[k]).filter(Boolean).join(", ");
    const sun = list(pr.sun, sunL);
    $("#hdrTitle").textContent = nm ? nm + " Planner" : "Perennial Bed Planner";
    $("#hdrSub").textContent = [sun, "All perennials", "Zone 6B", "Southern Michigan"].filter(Boolean).join(" · ");
    if ($("#gName").value !== (S.name || "")) $("#gName").value = S.name || "";
    renderSteps(); }
  $("#gName").addEventListener("input", e => { S.name = e.target.value; renderName(); save(); });
  $("#btnSave").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ app: "perennial-garden-planner", version: 2, plan: S }, null, 1)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = fileDate() + " " + safeFile(gardenName()) + " plan.json";
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast("Plan saved to your Downloads folder.");
  });
  $("#fileOpen").addEventListener("change", e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const j = JSON.parse(r.result), plan = j.plan || j;
        if (!plan || !Array.isArray(plan.placements) || !plan.shape) throw new Error("not a planner file");
        plan.placements = plan.placements.filter(p => byId[p.id]);
        S = Object.assign(freshState(), plan); S.prefs = Object.assign(freshState().prefs, plan.prefs || {}); S.waiting = cleanWaiting(S.waiting); migratePrefs(plan.prefs);
        init(false); save(); toast("Opened " + gardenName() + ".");
      } catch (err) { toast("That file isn't a saved garden plan.", 5000); }
      e.target.value = "";
    };
    r.readAsText(f);
  });
  $("#q").addEventListener("input", e => { S.filter.q = e.target.value; renderLibrary(); save(); });
  // one click puts the Plants filters back to showing everything (the sort order stays)
  $("#fReset").onclick = () => { Object.assign(S.filter, { q: "", height: "", month: "", sun: "" }); $("#q").value = ""; refreshHeight(); refreshMonth(); refreshSun(); renderLibrary(); save(); };
  $("#bloomFilter").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; S.bloomFilter = b.dataset.f; document.querySelectorAll("#bloomFilter button").forEach(x => x.classList.toggle("on", x === b)); renderBloom(); save(); });
  // groundcovers to offer: low plants that suit the step-2 choices (sun, origin, safety)
  function groundcovers() {
    const pr = S.prefs, low = p => p.filler || (p.kind === "mat" && p.hHi <= 12);
    return PL.filter(p => low(p) && p.sun.some(x => pr.sun.includes(x)) && pr.origin.includes(p.native ? "nat" : "gar") && !(p.toxic && !pr.toxic) && !(p.fam === "daisy" && pr.daisy === false) && !(deerEats(p) && pr.deer === false))
      .sort((a, b) => (b.filler ? 1 : 0) - (a.filler ? 1 : 0) || a.name.localeCompare(b.name));
  }
  // companions of the plants in the bed: { plantId: [companion ids] } (skipping any the user left out) and the full list
  function compCandidates() {
    const c = counts(true), pairs = {}, all = {};
    PL.filter(p => c[p.id] > 0).forEach(p => {
      const list = companionsFor(p.id).map(x => x.id);
      list.forEach(id => { all[id] = 1; });
      pairs[p.id] = list.filter(id => !S.compSkip.includes(id));
    });
    return { pairs, all: Object.keys(all).map(id => byId[id]).sort((a, b) => Geo.hMean(a) - Geo.hMean(b) || a.name.localeCompare(b.name)) };
  }
  function fillCompanions() {
    S.placements = S.placements.filter(p => !p.c);
    const { pairs, all } = compCandidates(), sel = selected();
    all.forEach(p => { if (!sel.some(q => q.id === p.id)) sel.push(p); });
    S.seed = (S.seed * 7 + 13) % 100000;
    const added = Geo.fillCompanions(bed, byId, S.placements, pairs, Geo.depthTargets(sel), S.seed, 60);
    clearSel(); optMode = "idle"; refresh(); closeModal();
    if (!added.length) { toast("There are no gaps big enough for a companion plant right now.", 4000); return; }
    const tally = {}; added.forEach(q => { tally[q.id] = (tally[q.id] || 0) + 1; });
    toast(`Added ${added.length} plant${added.length > 1 ? "s" : ""}: ` + Object.keys(tally).map(id => byId[id].name + (tally[id] > 1 ? " ×" + tally[id] : "")).join(", ") + ". Press Undo to take them back.", 6000);
  }
  function fillWith(ids) {
    S.seed = (S.seed * 7 + 13) % 100000;
    Geo.refillCarpet(bed, byId, S.placements, ids, S.seed); selIdx = -1; refresh();
    toast("Gaps filled with " + ids.map(i => byId[i].name).join(", ") + ". Click Fill again for a different spread.");
    if (curModalRerender) curModalRerender();
  }

  // ---------- generic pop-up window, used for confirmations and the Fill gaps picker ----------
  let curModalRerender = null;
  function modalEsc(e) { if (e.key === "Escape") closeModal(); }
  function closeModal() {
    const ov = document.getElementById("modalOverlay"); if (ov) ov.remove();
    curModalRerender = null; document.removeEventListener("keydown", modalEsc);
  }
  // Every pop-up window has a fixed header and (when build uses them) a fixed top section and a fixed
  // button row at the bottom; only the middle "scroll" section scrolls. build(regions, rerender) fills
  // regions.top / regions.scroll / regions.bottom; a builder that only needs one region can ignore the rest.
  function openModal(title, build, opts) {
    closeModal();
    const ov = document.createElement("div"); ov.className = "overlay on"; ov.id = "modalOverlay";
    const box = document.createElement("div"); box.className = "modal" + (opts && opts.wide ? " wide" : "");
    const head = document.createElement("div"); head.className = "modal-head";
    const h2 = document.createElement("h2"); h2.textContent = title;
    const x = document.createElement("button"); x.type = "button"; x.className = "modal-x"; x.setAttribute("aria-label", "Close"); x.innerHTML = "&times;"; x.onclick = closeModal;
    head.appendChild(h2); head.appendChild(x); box.appendChild(head);
    const fp = opts && opts.fp ? " fillpick" : "";
    const top = document.createElement("div"); top.className = "modal-top" + fp;
    const scroll = document.createElement("div"); scroll.className = "modal-scroll" + fp;
    const bottom = document.createElement("div"); bottom.className = "modal-bottom" + fp;
    box.appendChild(top); box.appendChild(scroll); box.appendChild(bottom);
    ov.appendChild(box);
    ov.addEventListener("mousedown", e => { if (e.target === ov) closeModal(); });
    document.body.appendChild(ov);
    document.addEventListener("keydown", modalEsc);
    const regions = { top, scroll, bottom };
    const rerender = () => { top.innerHTML = ""; scroll.innerHTML = ""; bottom.innerHTML = ""; build(regions, rerender); };
    curModalRerender = rerender;
    rerender();
  }
  let optMode = "idle";
  // ---------- the card beside a selected plant or object ----------
  // Everything about what you clicked shows right next to it: what it is, how much sun it needs, what you can
  // do with it, and (for one plant) the plants that go well with it.
  function cardHead(card, html, onClose) {
    const h = document.createElement("div"); h.className = "sc-head"; h.innerHTML = html;
    const x = document.createElement("button"); x.type = "button"; x.className = "sc-x"; x.setAttribute("aria-label", "Close"); x.title = "Close (Esc)"; x.innerHTML = "&times;"; x.onclick = onClose;
    h.appendChild(x); card.appendChild(h);
    // drag the card by its top to move it out of the way; it stays there while you keep selecting
    h.title = "Drag to move this card";
    h.addEventListener("pointerdown", e => {
      if (e.button !== 0 || e.target.closest("button, a, input")) return;
      const wr = $("#planWrap").getBoundingClientRect(), gx = e.clientX - wr.left - card.offsetLeft, gy = e.clientY - wr.top - card.offsetTop;
      h.setPointerCapture(e.pointerId); e.preventDefault();
      const move = ev => { const x = Math.round(Math.max(0, Math.min(wr.width - card.offsetWidth, ev.clientX - wr.left - gx))), y = Math.round(Math.max(0, Math.min(wr.height - card.offsetHeight, ev.clientY - wr.top - gy)));
        card.style.left = x + "px"; card.style.top = y + "px"; card.dataset.pin = x + "," + y; };
      const up = () => { h.removeEventListener("pointermove", move); h.removeEventListener("pointerup", up); h.removeEventListener("pointercancel", up); };
      h.addEventListener("pointermove", move); h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up);
    });
    return h;
  }
  function cardTip(card, t) { const d = document.createElement("div"); d.className = "sc-tip"; d.textContent = t; card.appendChild(d); }
  function cardActs(card, acts) {
    const row = document.createElement("div"); row.className = "sc-acts";
    acts.forEach(a => { const b = document.createElement("button"); b.type = "button"; b.className = "btn small" + (a.danger ? " danger" : ""); b.textContent = a.short || a.label; b.title = a.label; b.onclick = e => { e.stopPropagation(); a.fn(); }; row.appendChild(b); });
    card.appendChild(row);
  }
  const deselect = () => { clearSel(); objSel = -1; renderPlan(); };
  function buildPlantCard(card, idxs) {
    const groups = {}; idxs.forEach(i => { const id = S.placements[i].id; (groups[id] = groups[id] || []).push(i); });
    const ids = Object.keys(groups), cnt = counts(), group = idxs.map(i => S.placements[i]);
    if (idxs.length === 1) {
      const pl = byId[ids[0]], tox = pl.toxic && pl.toxic.length ? window.toxLabel(pl) : "", p0 = group[0];
      cardHead(card, `<img src="${imgSrc(pl.id)}" alt=""><div><div class="sc-name">${esc(pl.name)}${icons(pl)}</div><div class="sc-sub">${esc(pl.latin)}</div></div>`, deselect);
      const f = document.createElement("div"); f.className = "sc-facts";
      f.innerHTML = `<span>${esc(Ch.heightText(pl))} tall</span><span>${pl.spacing} in apart</span><span>${cnt[pl.id] || 0} in the bed</span>` +
        `<div class="sc-sun"><i class="zsw" style="background:${window.Plan.sunTip ? (pl.sun.length > 1 ? "linear-gradient(90deg," + ["full", "part", "shade"].filter(z => pl.sun.includes(z)).map(z => window.Plan.ZONE[z]).join(",") + ")" : window.Plan.ZONE[pl.sun[0]]) : ""}"></i>${esc(window.Plan.sunNeed(pl))}</div>` +
        (tox ? `<div class="sc-tox">${esc(tox)}</div>` : "") +
        (window.winterCare(pl) ? `<div class="sc-cold">${window.isTender(pl) ? "❄ Not winter-hardy here: " : "Winter: "}${esc(window.winterCare(pl).short)}</div>` : "") + (p0.lock ? '<div class="sc-lock">Locked in place</div>' : "");
      card.appendChild(f);
      cardActs(card, plantActions(group));
      cardCompanions(card, idxs[0]);
      cardTip(card, TOUCH ? "To pick several, press and hold a plant and choose Select more plants." : "Ctrl-click more plants to select several, or Shift-click to select every plant of a kind.");
    } else {
      cardHead(card, `<div><div class="sc-name">${idxs.length} plants selected</div><div class="sc-sub">${ids.length} kind${ids.length > 1 ? "s" : ""}. Click a name to remove it from the selection.</div></div>`, deselect);
      const chips = document.createElement("div"); chips.className = "sc-chips";
      ids.forEach(id => { const b = document.createElement("button"); b.type = "button"; b.className = "sc-chip"; b.innerHTML = `<span class="sc-cn">${esc(byId[id].name)} <b>×${groups[id].length}</b></span><span class="sc-rm">Remove</span>`; b.title = "Remove " + byId[id].name + " from the selection (it stays in the bed)";
        b.onclick = e => { e.stopPropagation(); const rest = idxs.filter(i => S.placements[i].id !== id); if (!rest.length) clearSel(); else { selIdx = rest[rest.length - 1]; extraSel = rest.slice(0, -1); } renderPlan(); }; chips.appendChild(b); });
      card.appendChild(chips);
      cardActs(card, plantActions(group));
      cardTip(card, TOUCH || multiTap ? "Tap plants to add or remove them" + (multiTap ? "" : " (press and hold one, then Select more plants)") + ". Drag the card by its top to move it out of the way." : "Ctrl-click plants to add or remove them; Shift-click to add or remove every plant of a kind. While you hold the key this card fades, so you can click plants under it. You can also drag the card by its top.");
    }
  }
  // researched good neighbors for the selected plant; click one to plant it right beside
  function companionsFor(id) {
    return (window.COMPANIONS && window.COMPANIONS[id] || []).filter(c => byId[c.id] && (matchesPrefs(byId[c.id]) || counts()[c.id] > 0));
  }
  function plantBeside(anchor, id) {
    const pl = byId[id];
    S.placements = S.placements.filter(q => !q.c || q === anchor);
    const keepIdx = S.placements.indexOf(anchor), sel = selected(); if (!sel.some(p => p.id === id)) sel.push(pl);
    const p = Geo.placeBeside(bed, byId, S.placements, id, anchor.x, anchor.y, Geo.depthTargets(sel), anchor.id) || Geo.placeOne(bed, byId, S.placements, id, Geo.depthTargets(sel), 0);
    if (!p) { toast(`No room left beside ${byId[anchor.id].name}.`); return; }
    S.placements.push(p); selIdx = keepIdx; extraSel = []; refresh();
    toast(`Planted ${pl.name} beside ${byId[anchor.id].name}.`);
  }
  function cardCompanions(card, idx) {
    const anchor = S.placements[idx], src = window.COMPANION_SOURCES || [], cnt = counts(), list = companionsFor(anchor.id).slice(0, 6);
    const box = document.createElement("div"); box.className = "sc-comp";
    box.innerHTML = `<div class="sc-comp-h"><b>Goes well with</b>${list.length ? " <span>click one to plant it beside</span>" : " <span>no researched pairings yet</span>"}</div>`;
    const why = document.createElement("div"); why.className = "sc-why";
    const showWhy = c => { const s2 = c && c.src.map(i => src[i]).filter(Boolean)[0]; why.innerHTML = c ? `<b>${esc(byId[c.id].name)}:</b> ${esc(c.why)}` + (s2 ? ` <a href="${esc(s2.url)}" target="_blank" rel="noopener">Source</a>` : "") : ""; };
    list.forEach(c => {
      const pl = byId[c.id], r = document.createElement("button"); r.type = "button"; r.className = "sc-row";
      r.innerHTML = `<img src="${imgSrc(c.id)}" alt=""><span class="sc-rn">${esc(pl.name)}${icons(pl)}</span><small>${cnt[c.id] ? cnt[c.id] + " in bed" : "+ Add"}</small>`;
      r.onmouseenter = () => { showWhy(c); setHover(c.id); }; r.onmouseleave = () => setHover(null);
      r.onclick = e => { e.stopPropagation(); plantBeside(anchor, c.id); };
      box.appendChild(r);
    });
    if (list.length) box.appendChild(why);
    card.appendChild(box); showWhy(list[0]);
  }
  function buildObjCard(card) {
    const o = S.objects[objSel], d = Geo.OBJ[o.t];
    cardHead(card, `<span class="sc-oic">${objIcon(o.t)}</span><div><div class="sc-name">${esc(o.pts ? "Path" : d.label)}</div><div class="sc-sub">${esc(o.pts ? "Plants are kept off it but can lean over its edges." : d.note)}</div></div>`, deselect);
    const f = document.createElement("div"); f.className = "sc-facts sc-hint";
    f.textContent = o.pts ? "Drag it to move it, the white dots to reshape it, the orange dot to change its width." : "Drag it to move it" + (d.shape === "circ" && o.t !== "tree" ? "" : "") + ", a white dot to resize it" + (d.rot && !o.pts ? ", the orange dot to turn it." : ".");
    card.appendChild(f);
    card.appendChild(objFields(o));
    if (o.t === "path") {   // a path people walk on counts as a side the bed is seen from; a work path doesn't
      const lab = document.createElement("label"); lab.className = "sc-check";
      lab.innerHTML = `<input type="checkbox"${o.view !== false ? " checked" : ""}> People walk and look here <small>short plants beside it, taller farther away</small>`;
      lab.querySelector("input").onchange = e => {
        if (e.target.checked) delete o.view; else o.view = false;
        relayout(false); refresh();
        toast(e.target.checked ? "Plants re-arranged: short beside the path, taller farther away. Undo takes it back." : "Work path: plants just stay off it now. Undo takes it back.", 3500);
      };
      card.appendChild(lab);
    }
    cardActs(card, objActions(objSel));
  }
  // set a floating card beside a rectangle on screen (or a point), inside the plan area
  function placeCard(card, r) {
    const wr = $("#planWrap").getBoundingClientRect(), cw = card.offsetWidth, ch = card.offsetHeight, gap = 14;
    let x = r.right - wr.left + gap;
    if (x + cw > wr.width - 6) x = r.left - wr.left - gap - cw;
    if (x < 6) x = Math.max(6, Math.min(wr.width - cw - 6, r.left - wr.left));
    const y = Math.max(6, Math.min(r.top - wr.top - 8, wr.height - ch - 6));
    card.style.left = Math.round(x) + "px"; card.style.top = Math.round(y) + "px";
  }
  function renderSelCard() {
    const card = $("#selCard"); if (!card) return;
    const isObj = objSel >= 0 && S.objects[objSel], idxs = selAll();
    const ctxOpen = document.getElementById("plantMenu"), busy = paint || armed || objArmed || pathDraw || window.Plan.isDrawing() || !$("#addCard").hidden || (ctxOpen && ctxOpen.dataset.ctx)
      || (multiTap && innerWidth <= 1050);   // on a phone the card would cover the plants you're tapping
    if (busy || (!isObj && !idxs.length)) { card.hidden = true; card.innerHTML = ""; if (!isObj && !idxs.length) delete card.dataset.pin; return; }
    card.innerHTML = ""; card.hidden = false;
    if (isObj) buildObjCard(card); else buildPlantCard(card, idxs);
    if (card.dataset.pin) { const [px, py] = card.dataset.pin.split(",").map(Number), wr = $("#planWrap").getBoundingClientRect();
      card.style.left = Math.max(0, Math.min(px, wr.width - card.offsetWidth)) + "px"; card.style.top = Math.max(0, Math.min(py, wr.height - card.offsetHeight)) + "px"; return; }
    const els = [...document.querySelectorAll(isObj ? `#plan .ob[data-oi="${objSel}"]` : idxs.map(i => `#plan .pl[data-idx="${i}"] circle.pc`).join(","))];
    if (!els.length) { card.style.left = "8px"; card.style.top = "8px"; return; }
    const r = els.map(e => e.getBoundingClientRect()).reduce((a, b) => ({ left: Math.min(a.left, b.left), right: Math.max(a.right, b.right), top: Math.min(a.top, b.top), bottom: Math.max(a.bottom, b.bottom) }));
    placeCard(card, r);
  }

  // ---------- "Add a plant here": a short list of plants that suit the spot ----------
  let addSpot = null;
  function closeAddCard() { const c = $("#addCard"); if (c && !c.hidden) { c.hidden = true; c.innerHTML = ""; addSpot = null; renderSelCard(); } }
  function openAddCard(spot) {
    closePlantMenu(); clearSel(); objSel = -1; paint = null; armed = null; objArmed = null; pathDraw = null; renderPaintBar();
    addSpot = spot; const card = $("#addCard"); card.hidden = false; card.innerHTML = "";
    renderPlan();
    const z = spot ? zoneAt(spot.x, spot.y) : null;
    cardHead(card, `<span class="sc-oic">${PLANT_ICON}</span><div><div class="sc-name">${spot ? "Add a plant here" : "Add a plant"}</div><div class="sc-sub">${z ? "Plants that suit " + esc(window.Plan.ZONE_LAB[z].toLowerCase()) + " here (" + esc(window.Plan.ZONE_HRS[z]) + " of direct sun)" : spot ? "Plants that fit your choices" : "Placed where it suits best. Right-click the bed to choose a spot."}</div></div>`, closeAddCard);
    const q = document.createElement("input"); q.type = "search"; q.className = "sc-search"; q.placeholder = "Search by name"; card.appendChild(q);
    const list = document.createElement("div"); list.className = "sc-list"; card.appendChild(list);
    q.oninput = () => renderAddList(list, q.value);
    q.onkeydown = e => { if (e.key === "Escape") { e.stopPropagation(); closeAddCard(); } else if (e.key === "Enter") { const b = list.querySelector(".sc-row"); if (b) b.click(); } };
    renderAddList(list, "");
    if (spot) placeCard(card, { left: spot.cx, right: spot.cx, top: spot.cy, bottom: spot.cy }); else { card.style.left = "8px"; card.style.top = "8px"; }
    setTimeout(() => q.focus(), 0);
  }
  function renderAddList(list, query) {
    const spot = addSpot, z = spot ? zoneAt(spot.x, spot.y) : null, cnt = counts(true), qq = query.trim().toLowerCase();
    const pool = PL.filter(p => (matchesPrefs(p) || cnt[p.id] > 0) && (!z || p.sun.includes(z)) && (!qq || (p.name + " " + p.latin).toLowerCase().includes(qq)));
    // plants within a few feet of the spot, and the plants that go well with them
    const near = spot ? [...new Set(S.placements.filter(p => !p.c && Math.hypot(p.x - spot.x, p.y - spot.y) < 4).map(p => p.id))] : [];
    const goes = {}; near.forEach(nid => (window.COMPANIONS[nid] || []).forEach(c => { if (!goes[c.id]) goes[c.id] = byId[nid].name; }));
    const sec1 = pool.filter(p => goes[p.id]), sec2 = pool.filter(p => !goes[p.id] && cnt[p.id] > 0), sec3 = pool.filter(p => !goes[p.id] && !(cnt[p.id] > 0)).sort((a, b) => a.name.localeCompare(b.name));
    list.innerHTML = "";
    const section = (title, arr, note) => {
      if (!arr.length) return;
      const h = document.createElement("div"); h.className = "sc-sec"; h.textContent = title; list.appendChild(h);
      arr.forEach(p => {
        const r = document.createElement("button"); r.type = "button"; r.className = "sc-row";
        r.innerHTML = `<img src="${imgSrc(p.id)}" alt=""><span class="sc-rn">${esc(p.name)}${icons(p)}<em>${esc(note(p))}</em></span><small>+ Add</small>`;
        r.onmouseenter = () => setHover(p.id); r.onmouseleave = () => setHover(null);
        r.onclick = e => { e.stopPropagation(); addPlantHere(p.id); };
        list.appendChild(r);
      });
    };
    section("Go well with plants nearby", sec1, p => "goes with " + goes[p.id]);
    section("Already in your bed", sec2, p => cnt[p.id] + " in the bed · " + Ch.heightText(p));
    section(sec1.length || sec2.length ? "More plants" : "Plants", sec3, p => Ch.heightText(p) + " · " + p.spacing + " in apart");
    if (!pool.length) list.innerHTML = `<div class="sc-empty">${qq ? "No match. Try another name." : "No plants match your choices for this light. Try widening them in What kind of garden?, Plants to watch out for or How much sun?"}</div>`;
  }
  function addPlantHere(id) {
    const pl = byId[id], spot = addSpot; notice = ""; noFit = [];
    S.placements = S.placements.filter(q => !q.c);
    const sel = selected(); if (!sel.some(p => p.id === id)) sel.push(pl);
    const p = spot ? Geo.placeAt(bed, byId, S.placements, id, spot.x, spot.y) : Geo.placeOne(bed, byId, S.placements, id, Geo.depthTargets(sel), 0);
    if (!p) { toast(spot ? `No room for ${pl.name} near this spot. Try another spot, or make room.` : `No room left for ${pl.name}.`); return; }
    S.placements.push(p); if (S.removed) delete S.removed[id];
    refresh(); toast(`Added ${pl.name}. Pick another, or close this list.`, 2500);
    const list = document.querySelector("#addCard .sc-list"), q = document.querySelector("#addCard .sc-search"); if (list) renderAddList(list, q ? q.value : "");
  }
  // explain what a tool will do, then ask to confirm or cancel, in a pop-up window
  function openConfirmModal(mode) {
    const have = S.placements.filter(p => !p.c).length, hasFill = S.placements.some(isGroundcover);
    let title, lines;
    if (mode === "reset") {
      title = "Start over";
      lines = [
        "I will clear everything and go back to an empty bed: your plants, objects and mapped sun zones, the garden name, the bed size and shape, and your sun and garden choices.",
        "If you want to keep this plan, press Cancel and use Save plan first."
      ];
    } else if (mode === "clear") {
      title = "Clear bed";
      lines = [
        `I will remove all ${S.placements.length} plants from the bed, including any groundcover filler.`,
        "The plant list on the left stays as it is, so you can add plants again afterward." + (S.objects.length ? " Objects like paths and birdbaths stay; " + (TOUCH ? "press and hold" : "right-click") + " one to remove it." : "")
      ];
    } else {
      title = "Re-arrange";
      lines = [
        `I will keep the same kinds of plants and set them out again in a new natural-looking layout, adding or taking out a few of them so the bed is about 100% full once grown (every plant at its recommended spacing). Locked plants stay where they are.`,
        "Where each plant sits now will be replaced" + (hasFill ? ", and any groundcover filler will be cleared (you can fill the gaps again afterward)." : "."),
        "Not happy with the result? Click Re-arrange again for a different layout."
      ];
    }
    openModal(title, ({ top, bottom }) => {
      const d = document.createElement("div"); d.className = "fp-desc"; d.innerHTML = lines.map(l => "<p>" + esc(l) + "</p>").join(""); top.appendChild(d);
      const acts = document.createElement("div"); acts.className = "po-acts";
      const ok = document.createElement("button"); ok.type = "button"; ok.className = "btn primary"; ok.textContent = "Confirm";
      ok.onclick = () => { closeModal(); if (mode === "reset") { S = freshState(); init(true); Tour.start(); } else if (mode === "clear") doClear(); else doArrange(); };
      const no = document.createElement("button"); no.type = "button"; no.className = "btn small"; no.textContent = "Cancel";
      no.onclick = closeModal;
      acts.appendChild(ok); acts.appendChild(no); bottom.appendChild(acts);
    }, { fp: true });
  }
  // Fill gaps pop-up window: two ways to fill, a low groundcover carpet or companions of the neighboring plants
  function openFillModal() {
    openModal("Fill gaps", ({ top, scroll, bottom }, rerender) => {
      const modeRow = document.createElement("div"); modeRow.className = "fp-full fp-moderow";
      modeRow.innerHTML = `<span class="fp-lab">Fill gaps with</span><div class="seg"><button type="button" data-m="ground" class="${S.fillMode !== "comp" ? "on" : ""}">Groundcover</button><button type="button" data-m="comp" class="${S.fillMode === "comp" ? "on" : ""}">Companion plants</button></div>`;
      modeRow.querySelectorAll("button").forEach(b => { b.onclick = () => { S.fillMode = b.dataset.m; save(); rerender(); }; });
      top.appendChild(modeRow);
      if (S.fillMode === "comp") { renderCompFillBody(top, scroll, bottom); return; }
      renderGroundFillBody(top, scroll, bottom);
    }, { wide: true, fp: true });
  }
  function renderGroundFillBody(top, scroll, bottom) {
    const list = groundcovers();
    S.fillPicks = (S.fillPicks || []).filter(id => list.some(p => p.id === id));
    if (!list.length) {
      const lab = document.createElement("span"); lab.className = "fp-lab"; lab.textContent = "No groundcover matches your choices. Try adding more sun or origin choices.";
      top.appendChild(lab);
    } else {
      const lab = document.createElement("div"); lab.className = "fp-lab fp-full"; lab.innerHTML = "<span class=\"fp-hint\">I will tuck a low groundcover into the empty spaces between your plants, in light that suits it. Click a name to pick one or more, then confirm. Click a photo to enlarge it.</span>";
      top.appendChild(lab);
      const tiles = document.createElement("div"); tiles.className = "fp-tiles";
      list.forEach(p => {
        const on = S.fillPicks.includes(p.id), t = document.createElement("div"); t.className = "fp-tile" + (on ? " on" : ""); t.title = p.latin + ": " + p.hLo + "–" + p.hHi + " in tall";
        t.innerHTML = `<img src="${imgSrc(p.id)}" alt=""><div class="fp-tn">${on ? "✓ " : ""}${esc(p.name)}${icons(p)}</div><small>${Ch.heightText(p)}</small>`;
        t.onclick = () => { S.fillPicks = on ? S.fillPicks.filter(i => i !== p.id) : S.fillPicks.concat(p.id); save(); if (curModalRerender) curModalRerender(); };
        tiles.appendChild(t);
      });
      scroll.appendChild(tiles);
    }
    const acts = document.createElement("div"); acts.className = "po-acts";
    if (list.length) {
      const go = document.createElement("button"); go.type = "button"; go.className = "btn fillgo"; go.textContent = "Fill with selected groundcover"; go.disabled = !S.fillPicks.length;
      go.onclick = () => fillWith(S.fillPicks.slice()); acts.appendChild(go);
    }
    const un = document.createElement("button"); un.type = "button"; un.className = "btn small"; un.textContent = "Remove all groundcover"; un.title = "Takes all groundcover back out of the bed"; un.disabled = !S.placements.some(isGroundcover);
    un.onclick = () => { stripFiller(); refresh(); toast("Groundcover removed from the bed."); if (curModalRerender) curModalRerender(); }; acts.appendChild(un);
    const cn = document.createElement("button"); cn.type = "button"; cn.className = "btn small"; cn.textContent = "Cancel"; cn.onclick = closeModal; acts.appendChild(cn);
    bottom.appendChild(acts);
  }
  function renderCompFillBody(top, scroll, bottom) {
    const { all } = compCandidates();
    const lab = document.createElement("div"); lab.className = "fp-lab fp-full";
    lab.innerHTML = `<span class="fp-hint">For each empty spot I look at the nearest plant and tuck in one of its researched companions that fits there: short ones toward the front, tall ones toward the back, and only in light that suits it. Any groundcover filler is cleared first; you can add it back afterward. Click a plant to leave it out.</span>`;
    top.appendChild(lab);
    if (!all.length) {
      const e = document.createElement("span"); e.className = "fp-lab"; e.textContent = "None of the plants in your bed have researched companions that match your garden choices yet.";
      top.appendChild(e);
    } else {
      const tiles = document.createElement("div"); tiles.className = "fp-tiles";
      all.forEach(p => {
        const on = !S.compSkip.includes(p.id), t = document.createElement("div"); t.className = "fp-tile" + (on ? " on" : ""); t.title = p.latin + ": " + Ch.heightText(p);
        t.innerHTML = `<img src="${imgSrc(p.id)}" alt=""><div class="fp-tn">${on ? "✓ " : ""}${esc(p.name)}${icons(p)}</div><small>${Ch.heightText(p)}</small>`;
        t.onclick = () => { S.compSkip = on ? S.compSkip.concat(p.id) : S.compSkip.filter(i => i !== p.id); save(); if (curModalRerender) curModalRerender(); };
        tiles.appendChild(t);
      });
      scroll.appendChild(tiles);
    }
    const acts = document.createElement("div"); acts.className = "po-acts";
    const go = document.createElement("button"); go.type = "button"; go.className = "btn fillgo"; go.textContent = "Fill with companions"; go.disabled = !all.some(p => !S.compSkip.includes(p.id));
    go.onclick = fillCompanions; acts.appendChild(go);
    const cn = document.createElement("button"); cn.type = "button"; cn.className = "btn small"; cn.textContent = "Cancel"; cn.onclick = closeModal; acts.appendChild(cn);
    bottom.appendChild(acts);
  }
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape" || document.getElementById("modalOverlay") || window.Plan.isDrawing()) return;
    if (document.getElementById("plantMenu")) { closePlantMenu(); return; }
    if (!$("#addCard").hidden) { closeAddCard(); return; }
    if (paint) { endSunStep(); return; }
    if (armed || objArmed || pathDraw) { armed = null; objArmed = null; pathDraw = null; renderPlan(); return; }
    if (multiTap) { multiTap = false; renderPlan(); return; }
    if (selAll().length || objSel >= 0) { if (/INPUT|SELECT|TEXTAREA/.test((e.target && e.target.tagName) || "")) e.target.blur(); deselect(); }
  });
  { const passThru = on => { const c = $("#selCard"), a = document.activeElement; if (c) c.classList.toggle("passthru", on && !(a && c.contains(a) && a.tagName === "INPUT")); };
    const multiKey = e => e.ctrlKey || e.metaKey || e.shiftKey;
    document.addEventListener("keydown", e => { if (e.key === "Control" || e.key === "Meta" || e.key === "Shift") passThru(true); });
    document.addEventListener("keyup", e => { if (e.key === "Control" || e.key === "Meta" || e.key === "Shift") passThru(multiKey(e)); });
    document.addEventListener("mousemove", e => passThru(multiKey(e)), { passive: true });
    window.addEventListener("blur", () => passThru(false)); }
  $("#plan").addEventListener("pointerdown", e => { if (e.target.closest(".pl, .ob, .obh")) { const c = $("#selCard"); if (c) c.hidden = true; } }, true);
  $("#btnUndo").addEventListener("click", undo);
  $("#btnRedo").addEventListener("click", redo);
  // Re-arrange: the same kinds of plants in a new layout, with a few more or fewer of them so the bed ends
  // up about 100% full once grown. Locked plants stay where they are.
  function doArrange() {
    const q = counts(true), lockN = {}; S.placements.forEach(p => { if (p.lock && !p.c) lockN[p.id] = (lockN[p.id] || 0) + 1; });
    const items = () => Object.keys(q).filter(id => q[id] > 0 && byId[id]).map(id => ({ plant: byId[id], n: q[id] }));
    // build three layouts and keep the best one: fewest plants left waiting first, then the best height order
    const q0 = Object.assign({}, q); let best = null;
    for (let k = 0; k < 3; k++) {
      Object.keys(q).forEach(id => delete q[id]); Object.assign(q, q0);
      relayout(true, items()); fitToFull(q, items, lockN); heightPolish();
      const sc = waitTotal() * 1000 + heightWrong();
      if (!best || sc < best.sc) best = { sc, placements: S.placements.map(p => Object.assign({}, p)), waiting: Object.assign({}, S.waiting), seed: S.seed, q: Object.assign({}, q), un: Object.assign({}, lastUnplaced) };
    }
    S.placements = best.placements; S.waiting = best.waiting; S.seed = best.seed; lastUnplaced = best.un;
    Object.keys(q).forEach(id => delete q[id]); Object.assign(q, best.q);
    refresh();
    toast("New arrangement, " + fullnessNow() + "% full once grown. Click Re-arrange again for another.", 3500);
  }
  // ---------- Suggest a planting ----------
  // Picks the plants as well as how many of each, the way the starter garden was put together: plants matched
  // to the light in each part of the bed (more kinds where there is more room), favoring real "goes well with"
  // pairings, filling months when nothing else blooms, mixing short, middle and tall plants sized to the bed,
  // and only from plants that fit the garden choices (kind of garden, plants to watch out for, sun). A little randomness makes each click a different but
  // still sensible planting. keepIds are plants to build around; locked plants are always kept.
  function zoneAreas() {   // planting room in each light, skipping spots taken by objects
    const res = 0.5, bb = bed.bb, out = {};
    for (let x = bb.x0 + res / 2; x < bb.x1; x += res) for (let y = bb.y0 + res / 2; y < bb.y1; y += res) {
      if (!Geo.pip(bed.poly, x, y) || Geo.objHit(S.objects, x, y, 0.01, 1)) continue;
      const z = zoneAt(x, y) || sunBase(); out[z] = (out[z] || 0) + res * res;
    }
    return out;
  }
  const COMP = window.COMPANIONS || {};
  const goesWith = (a, b) => (COMP[a.id] || []).some(c => c.id === b.id) || (COMP[b.id] || []).some(c => c.id === a.id);
  const MONTHS = [4, 5, 6, 7, 8, 9, 10];
  const bloomsIn = (p, m) => p.bloom && Math.min(p.bloom[1], m + 1) - Math.max(p.bloom[0], m) >= 0.35;
  const tierOf = p => { const h = Geo.hMean(p); return h < 14 ? 0 : h < 30 ? 1 : 2; };   // front, middle, back
  // how many of each in one light zone: the room is shared out with bigger plants getting a bit more of it;
  // small and medium plants go in odd-numbered groups of at least 3 so they read as drifts, big ones can
  // stand alone; aims for a full bed once grown (100% = every plant at its recommended spacing)
  function zoneQuantities(area, plants) {
    const fp = p => Math.PI * Math.pow(Geo.spFt(p) / 2, 2), big = p => p.spacing >= 24;
    const goal = FULL_AT * fullGoal() / 100;
    const w = plants.map(p => Math.sqrt(fp(p))), tw = w.reduce((a, b) => a + b, 0), budget = area * goal * 1.1, out = {};
    plants.forEach((p, i) => { const n = budget * w[i] / tw / fp(p); out[p.id] = Math.max(big(p) ? 1 : 3, n < 1.5 ? 1 : Math.round((n - 1) / 2) * 2 + 1); });
    const cov = () => plants.reduce((s, p) => s + out[p.id] * fp(p), 0) / area;
    for (let guard = 60; cov() > goal + 0.1 && guard--;) {
      const c = plants.filter(p => out[p.id] > (big(p) ? 1 : 3)).sort((a, b) => out[b.id] * fp(b) - out[a.id] * fp(a))[0];
      if (!c) break; out[c.id] -= out[c.id] > 3 ? 2 : 1;
    }
    return out;
  }
  function planPlanting(keepIds, seed) {
    const rnd = Geo.mulberry32(seed), areas = zoneAreas();
    const zones = ["full", "part", "shade"].filter(z => areas[z] >= 2);
    if (!zones.length) return null;
    // tallest plant should be no more than about the bed's depth (a border) or half its width (an island)
    const depthIn = ((bed.viewDepthFt && bed.viewDepthFt()) || bed.depthFt || (bed.mode === "island" ? Math.min(bed.bb.w, bed.bb.h) / 2 : bed.bb.h)) * 12;
    const picks = {}; zones.forEach(z => (picks[z] = []));
    const target = z => Math.max(2, Math.min(9, Math.round(Math.sqrt(areas[z]))));
    // plants to build around go to the light that suits them (the zone with the most room left)
    keepIds.forEach(id => {
      const p = byId[id]; if (!p) return;
      const fit = zones.filter(z => p.sun && p.sun.includes(z));
      const z = (fit.length ? fit : zones).slice().sort((a, b) => (target(b) - picks[b].length) - (target(a) - picks[a].length))[0];
      picks[z].push(p);
    });
    zones.forEach(z => {
      const chosen = picks[z], k = target(z);
      const pool = PL.filter(p => p.sun && p.sun.includes(z) && matchesPrefs(p));
      const wantTier = [0.4, 0.35, 0.25];
      while (chosen.length < k) {
        const taken = new Set(chosen.map(p => p.id));
        const covered = new Set(MONTHS.filter(m => chosen.some(p => bloomsIn(p, m))));
        const tiers = [0, 0, 0]; chosen.forEach(p => tiers[tierOf(p)]++);
        let best = null, bestS = -Infinity;
        pool.forEach(p => {
          if (taken.has(p.id)) return;
          let sc = 0;
          const links = chosen.filter(q => goesWith(p, q)).length;
          sc += chosen.length ? 2 * Math.min(links, 3) : 0.25 * pool.filter(q => goesWith(p, q)).length;   // pairs well / a well-connected first pick
          sc += 0.6 * MONTHS.filter(m => !covered.has(m) && bloomsIn(p, m)).length;                         // blooms when nothing else does
          const t = tierOf(p); sc += 1.2 * Math.max(-1, Math.min(1.5, wantTier[t] * k - tiers[t]));        // keeps front / middle / back in balance
          if ((p.kind === "grass" || p.kind === "fern") && !chosen.some(q => q.kind === p.kind)) sc += 0.8;   // a fern or grass for texture
          if (p.kind === "bulb" && chosen.some(q => q.kind === "bulb")) sc -= 3;
          if (p.kind === "mat" && chosen.filter(q => q.kind === "mat").length >= 1) sc -= 1.5;
          if (p.hHi > depthIn * 0.8) sc -= 2.5;                                                           // too tall for this bed
          sc -= 1.2 * zones.filter(z2 => z2 !== z && picks[z2].some(q2 => q2.id === p.id)).length;        // variety between zones
          if (p.native) sc += 0.2;
          sc += rnd() * 1.6;
          if (sc > bestS) { bestS = sc; best = p; }
        });
        if (!best) break;
        chosen.push(best);
      }
    });
    // how many of each: each zone's plants share that zone's room
    const q = {};
    zones.forEach(z => { if (!picks[z].length) return; const qz = zoneQuantities(areas[z], picks[z]); picks[z].forEach(p => (q[p.id] = (q[p.id] || 0) + qz[p.id])); });
    return { q, zones, picks };
  }
  // Bring the bed to about 100% full once grown: if it came out short, add more of the plants that still
  // fit (smallest first); if it came out over, take a couple out of the biggest groups. q is how many of
  // each, items() turns it into what relayout lays out, lockN the locked plants that must stay.
  function fitToFull(q, items, lockN) {
    const fp = id => Math.PI * Math.pow(byId[id].spacing / 24, 2), full = new Set();
    for (let g = 0; g < 16 && fullnessNow() < fullGoal() - 4; g++) {
      const ok = Object.keys(q).filter(k => q[k] > 0 && !full.has(k)).sort((a, b) => fp(a) - fp(b)), id = ok[g % 3] || ok[0];
      if (!id) break;
      const add = byId[id].spacing >= 24 ? 1 : 2; q[id] += add; relayout(false, items());
      if ((lastUnplaced[id] || 0) > 0 || lightBadIdx().some(i => S.placements[i].id === id)) { q[id] -= add; full.add(id); relayout(false, items()); }
    }
    for (let g = 0; g < 14 && fullnessNow() > fullGoal() + 2; g++) {
      const id = Object.keys(q).filter(k => q[k] - (lockN[k] || 0) > (byId[k].spacing >= 24 ? 1 : 3)).sort((a, b) => q[b] * fp(b) - q[a] * fp(a))[0];
      if (!id) break;
      q[id] -= q[id] > 3 ? 2 : 1; relayout(false, items());
    }
  }
  function doSuggestPlanting(build) {
    const locked = [...new Set(S.placements.filter(p => p.lock && !p.c).map(p => p.id))];
    const mine = counts(true), keep = [...new Set((build ? PL.filter(p => mine[p.id] > 0).map(p => p.id) : []).concat(locked))];
    const plan = planPlanting(keep, (Date.now() % 100000) + 1);
    if (!plan || !Object.keys(plan.q).length) { toast("No plants match your choices for the light in this bed. Try widening them in What kind of garden?, Plants to watch out for or How much sun?"); return; }
    // never fewer than the locked plants of a kind already on the bed
    const lockN = {}; S.placements.forEach(p => { if (p.lock && !p.c) lockN[p.id] = (lockN[p.id] || 0) + 1; });
    Object.keys(lockN).forEach(id => (plan.q[id] = Math.max(plan.q[id] || 0, lockN[id])));
    // lay it out; if something doesn't fit, trim that plant and try again
    // each plant stays in the light zone(s) it was picked for
    const zonesOf = {}; plan.zones.forEach(z => plan.picks[z].forEach(p => (zonesOf[p.id] = (zonesOf[p.id] || []).concat(z))));
    const q = plan.q, items = () => Object.keys(q).filter(id => q[id] > 0).map(id => ({ plant: byId[id], n: q[id], zones: zonesOf[id] }));
    S.placements = S.placements.filter(p => p.lock && !p.c); S.waiting = {};
    let first = true;
    for (let pass = 0; pass < 10; pass++) {
      relayout(first, items()); first = false;
      // anything that didn't fit, or only fit in light it can't take, gets trimmed and the layout runs again
      const over = Object.assign({}, lastUnplaced);
      lightBadIdx().forEach(i => { const p = S.placements[i]; if (!p.lock) over[p.id] = (over[p.id] || 0) + 1; });
      const ids = Object.keys(over); if (!ids.length) break;
      let changed = false;
      ids.forEach(id => { const cut = Math.min(over[id], q[id] - (lockN[id] || 0)); if (cut > 0) { q[id] -= cut; changed = true; } });
      if (!changed) break;
    }
    fitToFull(q, items, lockN); heightPolish();
    notice = ""; noFit = []; selIdx = -1; extraSel = [];
    refresh();
    const kinds = Object.keys(q).filter(id => q[id] > 0).length, n = S.placements.filter(p => !p.c).length;
    const light = plan.zones.map(z => window.Plan.ZONE_LAB[z].toLowerCase());
    toast(`Suggested ${kinds} kinds, ${n} plants, for ${light.length > 1 ? light.slice(0, -1).join(", ") + " and " + light[light.length - 1] : light[0]}. Click again for a different planting.`);
  }
  function doClear() { S.placements = []; S.waiting = {}; selIdx = -1; notice = ""; noFit = []; refresh(); toast("Bed cleared."); }
  $("#btnReset").addEventListener("click", () => { clearSel(); objSel = -1; renderPlan(); $("#planCard").scrollIntoView({ behavior: "smooth", block: "start" }); openConfirmModal("reset"); });
  // Build the guide PDF; returns the jsPDF document
  function buildPdf() {
    const sel = selected();
    return window.PDFExport.make({ plants: sel, bed, placements: S.placements, waiting: Object.assign({}, S.waiting || {}), byId, name: gardenName(), prefs: S.prefs,
      objects: S.objects, sun: sunActive() ? { res: S.sun.res, zoneAt, zones: zonesPresent() } : null }, (f, m) => { const bar = $("#busyBar"), txt = $("#busyText"); bar.style.width = Math.round(f * 100) + "%"; txt.textContent = m; });
  }
  // ---------- PDF preview: look it over, then Download or Print (nothing is saved until asked) ----------
  let pvUrl = null, pvBlob = null, pvName = "", pvFrame = null, pvPrev = null;
  function loadScript(src) { return new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => no(new Error("Couldn't load " + src)); document.head.appendChild(s); }); }
  function closePreview() {
    const box = $("#pvw"); box.hidden = true; $("#pvBody").innerHTML = ""; pvFrame = null;
    if (pvUrl) { URL.revokeObjectURL(pvUrl); pvUrl = null; } pvBlob = null;
    document.body.style.overflow = ""; if (pvPrev && pvPrev.focus) pvPrev.focus();
  }
  function openPreview(doc, fname) {
    pvBlob = doc.output("blob"); pvName = fname; if (pvUrl) URL.revokeObjectURL(pvUrl); pvUrl = URL.createObjectURL(pvBlob);
    const box = $("#pvw"), body = $("#pvBody"); pvPrev = document.activeElement; body.innerHTML = ""; $("#pvName").textContent = fname; box.hidden = false; document.body.style.overflow = "hidden";
    $("#pvSave").focus();
    // computers: the browser's own PDF viewer; phones and tablets can't show a PDF inside a page, so draw the pages (PDF.js)
    const phone = window.matchMedia("(pointer: coarse)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
    if (!phone && navigator.pdfViewerEnabled !== false) { const f = document.createElement("iframe"); f.title = "PDF guide preview"; f.src = pvUrl; body.appendChild(f); pvFrame = f; return; }
    const msg = document.createElement("div"); msg.className = "pvw-msg"; msg.textContent = "Getting your guide ready\u2026"; body.appendChild(msg);
    const url = pvUrl;
    (window.pdfjsLib ? Promise.resolve() : loadScript("lib/pdf.min.js")).then(() => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "lib/pdf.worker.min.js";
      return pvBlob.arrayBuffer();
    }).then(buf => pdfjsLib.getDocument({ data: buf }).promise).then(async pdf => {
      if (pvUrl !== url) return; body.innerHTML = "";
      const w = Math.min(body.clientWidth - 16, 900), dpr = Math.min(window.devicePixelRatio || 1, 2);
      for (let i = 1; i <= pdf.numPages; i++) {
        if (pvUrl !== url) return;
        const pg = await pdf.getPage(i), v0 = pg.getViewport({ scale: 1 }), sc = w / v0.width * dpr, v = pg.getViewport({ scale: sc });
        const c = document.createElement("canvas"); c.width = Math.floor(v.width); c.height = Math.floor(v.height); c.style.width = Math.floor(v.width / dpr) + "px";
        body.appendChild(c); await pg.render({ canvasContext: c.getContext("2d"), viewport: v }).promise;
      }
    }).catch(err => { console.error(err); if (pvUrl === url) body.innerHTML = '<div class="pvw-msg">Sorry, the preview could not be shown here. You can still use Download or Print.</div>'; });
  }
  function pvDownload() {
    if (!pvBlob) return; const a = document.createElement("a"); a.href = pvUrl; a.download = pvName; document.body.appendChild(a); a.click(); a.remove();
    toast("Saved \u201c" + pvName + "\u201d to your Downloads folder.", 4000);
  }
  function pvPrintIt() {
    if (!pvBlob) return;
    const viaFrame = f => { try { f.contentWindow.focus(); f.contentWindow.print(); return true; } catch (e) { return false; } };
    if (pvFrame && viaFrame(pvFrame)) return;
    // phones: print from a hidden copy; if the browser won't, open the PDF so its own Print/Share menu can be used
    const h = document.createElement("iframe"); h.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;"; h.src = pvUrl; document.body.appendChild(h);
    h.onload = () => { setTimeout(() => { if (!viaFrame(h)) window.open(pvUrl, "_blank"); setTimeout(() => h.remove(), 60000); }, 300); };
  }
  $("#pvBack").addEventListener("click", closePreview); $("#pvSave").addEventListener("click", pvDownload); $("#pvPrint").addEventListener("click", pvPrintIt);
  window.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#pvw").hidden) { e.preventDefault(); e.stopImmediatePropagation(); closePreview(); } }, true);
  $("#btnPdf").addEventListener("click", () => {
    if (!S.placements.length) { toast("Add some plants to the bed first."); return; }
    const busy = $("#busy"), bar = $("#busyBar"), txt = $("#busyText"); busy.classList.add("on"); bar.style.width = "3%";
    txt.textContent = "Getting the photos…";
    const ids = [...new Set(S.placements.map(p => p.id))];
    Promise.all(ids.map(loadFull)).then(() => setTimeout(() => {
      try {
        const doc = buildPdf();
        bar.style.width = "100%"; txt.textContent = "Opening the preview…";
        const fname = fileDate() + " " + safeFile(gardenName()) + ".pdf";
        openPreview(doc, fname);
        setTimeout(() => busy.classList.remove("on"), 300);
      } catch (err) { console.error(err); busy.classList.remove("on"); toast("Sorry, the PDF could not be made: " + err.message, 6000); }
    }, 60));
  });
  window.addEventListener("keydown", e => {
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (window.Plan.isDrawing()) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if ((e.ctrlKey || e.metaKey) && (k === "y" || (k === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }
    if (pathDraw && !/INPUT|SELECT|TEXTAREA/.test((e.target && e.target.tagName) || "")) { if (e.key === "Enter") { e.preventDefault(); finishPath(); return; } if (e.key === "Backspace") { e.preventDefault(); pathDraw.pts.pop(); renderPlan(); return; } }
    if ((e.key === "Delete" || e.key === "Backspace") && objSel >= 0 && S.objects[objSel]) { e.preventDefault(); S.objects.splice(objSel, 1); objSel = -1; refresh(); return; }
    if ((e.key === "Delete" || e.key === "Backspace") && selAll().length) { e.preventDefault(); const dl = selAll().filter(i => !S.placements[i].lock); if (!dl.length) { toast("Locked plants cannot be removed. Unlock first."); return; } dl.sort((a, b) => b - a).forEach(i => S.placements.splice(i, 1)); clearSel(); refresh(); }
    // Esc is handled once, a step at a time (menu, then card or list, then painting/placing, then the selection)
  });

  function init(fresh, example) {
    normalizeExtras(); objSel = -1; objArmed = null; pathDraw = null; paint = null; renderPaintBar(); openSteps.clear();
    bed = Geo.buildBed(S); attachExtras();
    if (fresh && example) {
      // sunny plants first, then part shade, then shade (as the bed's sun zones run), each group in name order
      const sunRank = p => ({ full: 0, part: 1, shade: 2 })[p.sun[0]];
      const items = EXAMPLE_PLANTS.filter(([id]) => byId[id]).map(([id, n]) => ({ plant: byId[id], n })).sort((a, b) => sunRank(a.plant) - sunRank(b.plant));
      relayout(false, items);
    }
    armed = null; selIdx = -1; hoverId = null;
    document.querySelectorAll("#bloomFilter button").forEach(x => x.classList.toggle("on", x.dataset.f === S.bloomFilter));
    refreshBloomSort(); $("#q").value = S.filter.q || ""; refreshHeight(); refreshMonth(); refreshSun(); refreshLibSort();
    renderName();
    fullRender();
  }


  // ---------- magnifier + big picture ----------
  (function () {
    const mag = document.createElement("button"); mag.className = "magbtn"; mag.type = "button"; mag.setAttribute("aria-label", "Enlarge photo");
    mag.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21M10.5 7.5v6M7.5 10.5h6"/></svg>';
    document.body.appendChild(mag);
    const lb = document.createElement("div"); lb.className = "lightbox";
    lb.innerHTML = '<figure><img alt=""><figcaption></figcaption><a class="btn primary lbmore" hidden>More info</a></figure><button class="lbx" type="button" aria-label="Close">×</button>';
    document.body.appendChild(lb);
    let cur = null, hideT = 0;
    const idOf = src => Object.keys(window.PHOTOS).find(k => window.PHOTOS[k] === src);
    // Any plant photo, anywhere on the page or in a pop-up window, enlarges on click — except a
    // "goes well with" companion tile (.comp), where the photo click plants it instead.
    const zoomable = el => el && el.tagName === "IMG" && !el.closest(".lightbox") && window.PHOTOS && idOf(el.src);
    function showMag(img) {
      clearTimeout(hideT); cur = img; const r = img.getBoundingClientRect();
      mag.style.left = (r.right - 24) + "px"; mag.style.top = (r.top + 4) + "px"; mag.classList.add("on");
    }
    function hideMag() { hideT = setTimeout(() => { mag.classList.remove("on"); cur = null; }, 120); }
    function open(img) { openId(idOf(img.src), img.src); }
    function openId(id, src) {
      const p = byId[id]; if (!p) return;
      const big = lb.querySelector("img"); big.src = src || window.PHOTOS[id]; big.dataset.id = id; lb.querySelector("figcaption").textContent = p.name + " · " + p.latin;
      // every plant has its own page (plant.html?id=<id>): a More info button
      const more = lb.querySelector(".lbmore"), hasPage = (window.PLANT_PAGES || []).includes(id);
      more.hidden = !hasPage; if (hasPage) { more.href = "plant.html?id=" + encodeURIComponent(id); more.setAttribute("aria-label", "More info about " + p.name); }
      lb.classList.add("on");
      loadFull(id).then(u => { if (u && big.dataset.id === id && lb.classList.contains("on")) big.src = u; });   // sharpen to the full photo
    }
    function close() { lb.classList.remove("on"); }
    document.addEventListener("mouseover", e => { if (zoomable(e.target)) showMag(e.target); else if (e.target !== mag && !mag.contains(e.target)) { if (cur) hideMag(); } });
    mag.addEventListener("mouseenter", () => clearTimeout(hideT)); mag.addEventListener("mouseleave", hideMag);
    mag.addEventListener("click", e => { e.stopPropagation(); if (cur) open(cur); });
    document.addEventListener("click", e => { if (zoomable(e.target)) { e.stopPropagation(); e.preventDefault(); open(e.target); } }, true);
    // More info: remember where the planner was scrolled and which photo was open, so "Back to the planner" returns to the same spot
    const RET = "perennialBedPlanner.return";
    lb.querySelector(".lbmore").addEventListener("click", e => {
      e.stopPropagation();
      try { sessionStorage.setItem(RET, JSON.stringify({ x: window.scrollX, y: window.scrollY, id: lb.querySelector("img").dataset.id, t: Date.now() })); } catch (err) { /* private mode: just go */ }
    });
    const restore = () => {
      let r = null;
      try { r = JSON.parse(sessionStorage.getItem(RET) || "null"); sessionStorage.removeItem(RET); } catch (err) { r = null; }
      if (!r || Date.now() - r.t > 2 * 3600 * 1000) return;
      if ("scrollRestoration" in history) history.scrollRestoration = "manual";
      // after the planner has drawn itself, so the page is its full height again
      requestAnimationFrame(() => setTimeout(() => { window.scrollTo(r.x || 0, r.y || 0); if (r.id && window.PHOTOS[r.id]) openId(r.id); }, 60));
    };
    if (document.readyState === "complete") restore(); else window.addEventListener("load", restore);
    // coming back through the browser's Back (page kept in memory): the spot is already right; just forget the note
    window.addEventListener("pageshow", e => { if (e.persisted) { try { sessionStorage.removeItem(RET); } catch (err) { /* ignore */ } } });
    lb.addEventListener("click", close);
    document.addEventListener("keydown", e => { if (e.key === "Escape" && lb.classList.contains("on")) { close(); e.stopPropagation(); } }, true);
    window.addEventListener("scroll", () => { mag.classList.remove("on"); }, true);
  })();

  // ---------- guided tour: on a first visit and after Start over, light up one step at a time ----------
  // A dark veil covers the page with holes cut over the parts in use; only the holes can be clicked.
  const Tour = (function () {
    const NS = "http://www.w3.org/2000/svg";
    let on = false, idx = 0, raf = 0, veil, path, ring, coach;
    const STEP_UNDER = { bed: "#bedPanel", objects: "#objCard", sun: "#sunCard" };
    const STEPS = [
      { key: "name", title: "Name your garden", holes: [["#nameCard"]], example: true,
        text: "Give your garden a name, like <i>Backyard Shade Garden</i>. It goes at the top of the planner and on your PDF guide. It's optional, so you can skip it.<br><br>Just looking around? Load the example garden to see a finished plan and skip the other steps.",
        enter() { setTimeout(() => { const i = $("#gName"); if (i) i.focus(); }, 350); } },
      { key: "kind", title: "What kind of garden?", holes: [["#prefCard"]],
        text: "Choose Michigan natives, garden favorites or both, and which kinds of plants you like. The counter shows how many plants match." },
      { key: "avoid", title: "Plants to watch out for", holes: [["#avoidCard"]],
        text: "Leave out plants that are toxic to pets or people, that deer eat, that need winter care here, or that bother ragweed allergies. Or include them: they're marked with an icon so you know." },
      { key: "bed", title: "Build your bed", holes: [["#bedPanel"], ["#planWrap"]],
        text: "Pick a shape: a rectangle, a round island, or draw your own. Then set the size with <b>−</b> and <b>+</b>. The bed plan beside it changes as you go." },
      { key: "objects", title: "Add objects", holes: [["#objCard"], ["#planWrap"]],
        text: "Add anything that's in the bed or going into it: a path, stepping stones, rocks, a birdbath, shrubs, a hedge or trees. Plants are then laid out around them. Click one, then click the bed. Drag it to move it, and drag the white dots to resize. Nothing to add? Just click Next." },
      { key: "sun", title: "Add the sun", holes: [["#planWrap"], ["#sunCard"]], primary: 0,
        text: "Map where the sun falls. Pick a light, then drag across the bed: <b>full sun</b> is 6+ hours of direct sun a day, <b>part shade</b> 3 to 6, <b>shade</b> under 3. <b>Rest of bed</b> sets the light everywhere you don't paint. The list of lights in this step follows what you map, or you can just tick the lights there.",
        enter() { if (!paint) togglePaint(true); },
        leave(fwd) { if (paint) { paint = null; renderPaintBar(); renderPlan(); } if (fwd) syncSunPrefs(true); } },
      { key: "plants", title: "Pick your plants", holes: [["#libCard"]], last: true,
        text: "Click <b>+ Add</b> on any plant and it's placed in the bed for you. Or let the planner choose: <b>Suggest a planting</b> picks plants that suit each part of the bed and go well together." }
    ];
    function build() {
      veil = document.createElementNS(NS, "svg"); veil.id = "tourVeil"; veil.setAttribute("aria-hidden", "true");
      path = document.createElementNS(NS, "path"); path.setAttribute("class", "tv-dim"); path.setAttribute("fill-rule", "evenodd");
      ring = document.createElementNS(NS, "path"); ring.setAttribute("class", "tv-ring");
      veil.append(path, ring);
      coach = document.createElement("div"); coach.id = "tourCoach"; coach.setAttribute("role", "dialog"); coach.setAttribute("aria-live", "polite");
      document.body.append(veil, coach);
    }
    // a hole is the box around one or more elements, trimmed to what's visible (the left column scrolls by itself)
    function rectOf(sels) {
      let L = Infinity, T = Infinity, R = -Infinity, B = -Infinity;
      sels.forEach(sel => { const el = document.querySelector(sel); if (!el || !el.offsetParent) return; const r = el.getBoundingClientRect(); L = Math.min(L, r.left); T = Math.min(T, r.top); R = Math.max(R, r.right); B = Math.max(B, r.bottom); });
      if (!isFinite(L)) return null;
      const el = document.querySelector(sels[0]), sc = el.closest(".left"), hdr = $(".top");
      let top = hdr ? hdr.getBoundingClientRect().bottom : 0, bot = innerHeight, lft = 0, rgt = innerWidth;
      if (sc && getComputedStyle(sc).overflowY !== "visible") { const c = sc.getBoundingClientRect(); top = Math.max(top, c.top); bot = Math.min(bot, c.bottom); lft = Math.max(lft, c.left); rgt = Math.min(rgt, c.right + 6); }
      const pad = 6; L -= pad; T -= pad; R += pad; B += pad;
      const r = { l: Math.max(L, lft - 2), t: Math.max(T, top - 2), r: Math.min(R, rgt + 2), b: Math.min(B, bot + 2) };
      return r.r - r.l > 8 && r.b - r.t > 8 ? r : null;
    }
    const rr = (r, k) => `M${r.l + k} ${r.t}H${r.r - k}Q${r.r} ${r.t} ${r.r} ${r.t + k}V${r.b - k}Q${r.r} ${r.b} ${r.r - k} ${r.b}H${r.l + k}Q${r.l} ${r.b} ${r.l} ${r.b - k}V${r.t + k}Q${r.l} ${r.t} ${r.l + k} ${r.t}Z`;
    function frame() {
      if (!on) return;
      const st = STEPS[idx], W = innerWidth, H = innerHeight;
      const rects = st.holes.map(rectOf);
      const holes = rects.filter(Boolean).map(r => rr(r, Math.min(12, (r.r - r.l) / 2, (r.b - r.t) / 2)));
      veil.setAttribute("viewBox", `0 0 ${W} ${H}`); veil.setAttribute("width", W); veil.setAttribute("height", H);
      path.setAttribute("d", `M0 0H${W}V${H}H0Z` + holes.join(""));
      ring.setAttribute("d", holes.join(""));
      place(rects[st.primary || 0] || rects.find(Boolean), rects.filter(Boolean), st);
      raf = requestAnimationFrame(frame);
    }
    // the coach card sits beside the main hole, on whichever side has room and doesn't cover another hole
    function place(r, all, st) {
      // steps that open in the left column: the box goes right under the step, in that column
      const side = st && STEP_UNDER[st.key] && document.querySelector("#sideStep " + STEP_UNDER[st.key]);
      if (side && innerWidth >= 640) {
        const sr = side.getBoundingClientRect(), cw = coach.offsetWidth, ch = coach.offsetHeight, y = sr.bottom + 12;
        if (y + ch <= innerHeight - 10 && sr.bottom > 0) { coach.style.left = Math.round(Math.max(10, sr.left + (sr.width - cw) / 2)) + "px"; coach.style.top = Math.round(y) + "px"; return; }
      }
      if (innerWidth < 640) { coach.style.left = "10px"; coach.style.top = Math.round(innerHeight - coach.offsetHeight - 10) + "px"; return; }   // phone: along the bottom
      const cw = coach.offsetWidth, ch = coach.offsetHeight, W = innerWidth, H = innerHeight, g = 14, top0 = ($(".top") ? $(".top").getBoundingClientRect().bottom : 0) + 8;
      const clampY = y => Math.max(top0, Math.min(H - ch - 10, y)), clampX = x => Math.max(10, Math.min(W - cw - 10, x));
      let pos = null;
      if (r) {
        const cands = [[r.r + g, clampY(r.t)], [clampX(r.l), r.b + g], [clampX(r.l), r.t - ch - g], [r.l - cw - g, clampY(r.t)]];
        const hits = (x, y) => all.some(h => x < h.r && x + cw > h.l && y < h.b && y + ch > h.t);
        pos = cands.find(([x, y]) => x >= 10 && y >= top0 - 1 && x + cw <= W - 10 && y + ch <= H - 10 && !hits(x, y));
      }
      if (!pos) pos = [W - cw - 18, H - ch - 18];   // no room beside it: bottom right corner
      coach.style.left = Math.round(pos[0]) + "px"; coach.style.top = Math.round(pos[1]) + "px";
    }
    function show() {
      const st = STEPS[idx];
      coach.innerHTML = `<div class="tc-kick">${st.last ? "Your plants" : "Step " + (idx + 1) + " of " + (STEPS.length - 1)}<span class="tc-dots">${STEPS.map((_, i) => `<i class="${i === idx ? "on" : i < idx ? "done" : ""}"></i>`).join("")}</span></div><h3>${st.title}</h3><p>${st.text}</p><div class="tc-acts"></div><button type="button" class="tc-skip">Skip the tour</button>`;
      const acts = coach.querySelector(".tc-acts");
      const b = (t, cls, fn) => { const x = document.createElement("button"); x.type = "button"; x.className = "btn " + cls; x.textContent = t; x.onclick = fn; acts.appendChild(x); return x; };
      if (idx > 0) b("Back", "small tc-back", () => go(idx - 1));
      if (st.example) b("Load the example", "small", () => loadExample());
      if (st.last) {
        b("I'll pick my own", "small", () => end(true));
        b("Suggest a planting", "primary small", () => { end(true); suggestClicked(); });
      } else b("Next", "primary small tc-next", () => go(idx + 1));
      coach.querySelector(".tc-skip").onclick = () => end(false);
      // bring the step into view
      const first = document.querySelector(st.holes[st.primary || 0][0]);
      const phone = innerWidth < 640;
      if (first) first.scrollIntoView({ behavior: "smooth", block: phone ? "start" : first.closest(".left") ? "nearest" : "center" });
      if (!phone && st.holes.some(h => h[0] === "#planWrap" || h[0] === "#planCard") && !st.holes.every(h => /plan/.test(h[0]))) {
        const sideEl = document.querySelector(st.holes.find(h => !/plan/.test(h[0]))[0]); if (sideEl) sideEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      if (S.done && S.done[st.key]) openStep(st.key);
      if (st.enter) st.enter();
    }
    // Next folds the step just finished down to its summary; Back opens the earlier step again
    function go(n) {
      const st = STEPS[idx];
      if (n > idx && STEPS_UI[st.key] && !completeStep(st.key)) return;
      if (st.leave) st.leave(n > idx);
      idx = Math.max(0, Math.min(STEPS.length - 1, n)); show();
    }
    function start() {
      if (!veil) build();
      closePlantMenu(); closeAddCard(); if (paint) { paint = null; renderPaintBar(); }
      armed = null; objArmed = null; pathDraw = null; deselect();
      scrollTo({ top: 0 }); const lc = $(".left"); if (lc) lc.scrollTop = 0;
      on = true; idx = 0; document.body.classList.add("touring"); veil.style.display = coach.style.display = "";
      show(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
    }
    function end(done) {
      if (!on) return;
      const st = STEPS[idx]; if (st.leave) st.leave(false);
      on = false; cancelAnimationFrame(raf); document.body.classList.remove("touring");
      veil.style.display = coach.style.display = "none";
      if (done === "quiet") return;
      toast(done ? "You're all set. Click Guided tour at the top any time to see these steps again." : "Tour closed. Click Guided tour at the top any time to start it again.", 4000);
    }
    // Enter in the name box moves on; Esc closes the tour once nothing else is open
    document.addEventListener("keydown", e => {
      if (!on) return;
      if (e.key === "Enter" && e.target && e.target.id === "gName") { e.preventDefault(); e.target.blur(); go(idx + 1); return; }
      if (e.key !== "Escape") return;
      if (document.getElementById("modalOverlay") || document.getElementById("prefAsk") || document.getElementById("plantMenu") || !$("#addCard").hidden || paint || window.Plan.isDrawing() || document.querySelector(".lightbox.on")) return;
      end(false);
    });
    return { start, end, get on() { return on; } };
  })();
  $("#btnTour").addEventListener("click", () => Tour.start());
  const saved = load();
  // a plant whose folder has been deleted is taken out of the saved garden; the rest of the garden stays
  const gone = saved && Array.isArray(saved.placements) ? [...new Set(saved.placements.filter(p => !byId[p.id]).map(p => p.id))] : [];
  if (saved && gone.length) saved.placements = saved.placements.filter(p => byId[p.id]);
  if (saved && saved.placements && saved.shape) { S = Object.assign(freshState(), saved); S.prefs = Object.assign(freshState().prefs, saved.prefs || {}); S.waiting = cleanWaiting(S.waiting); migratePrefs(saved.prefs); init(false); if (gone.length) { save(); toast(gone.length === 1 ? "One plant in your garden is no longer on the site, so it was taken out." : gone.length + " plants in your garden are no longer on the site, so they were taken out.", 5000); } }
  else { S = freshState(); init(true); Tour.start(); }
  window.__app = { get S() { return S; }, get bed() { return bed; } };
})();
