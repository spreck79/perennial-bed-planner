// Shade Garden Planner: state, library, charts and wiring.
(function () {
  const PL = window.PLANTS, Geo = window.Geo, Ch = window.Charts;
  window.PHOTOS = window.PHOTOS || {};
  const byId = {}; PL.forEach(p => (byId[p.id] = p));
  const $ = s => document.querySelector(s);
  const LS = "shadeGardenPlanner.v1";
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const imgSrc = id => window.PHOTOS[id] || "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

  // The 15 plants and counts from the original guide
  const DEFAULT_COUNTS = { sedge: 4, foam: 5, phlox: 3, jacobs: 3, bluebells: 3, fern: 3, geranium: 1, goldenrod: 3, aster: 3, turtle: 3, coral: 3, forestgrass: 2, brunnera: 2, rozanne: 1, astilbe: 3 };

  // little icons with hover labels: native leaf, garden favorite, daisy family, toxic
  const deerEats = p => p.deer === "C" || p.deer === "D";
  const DEER = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 11V6.2M6 6.2 3.2 2M4.3 3.7 2 4.2M6 6.2 8.8 2M7.7 3.7 10 4.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>';
  const deerTip = p => (p.deer === "D" ? "Deer often eat this" : "Deer sometimes eat this") + (p.id === "tulip" ? "; squirrels dig up the bulbs" : "");
  const LEAF = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M10.6 1.4C5.2 1.2 1.6 3.9 1.7 8c0 .9.3 1.7.7 2.3.5-2.6 2.3-4.6 4.9-5.8-2.1 1.5-3.6 3.4-4.2 6 .5.2 1.1.3 1.7.3 4 0 6-3.4 5.8-9.4z" fill="currentColor"/></svg>';
  function icons(p, off) {
    let h = p.native ? '<span class="ic ic-nat" data-k="nat" data-tip="Michigan native">' + LEAF + "</span>" : '<span class="ic ic-gar" data-k="gar" data-tip="Garden favorite (not native)">◆</span>';
    if (p.fam === "daisy") h += '<span class="ic ic-df" data-k="daisy" data-tip="Daisy family (related to ragweed)">✿</span>';
    if (deerEats(p)) h += '<span class="ic ic-deer" data-k="deer" data-tip="' + esc(deerTip(p)) + '">' + DEER + "</span>";
    if (p.toxic && p.toxic.length) h += '<span class="ic ic-tox" data-k="tox" data-tip="' + esc(window.toxLabel(p)) + '">!</span>';
    if (off) h += '<span class="ic ic-off" data-k="off" data-tip="Outside your step 2 choices">–</span>';
    return '<span class="ics">' + h + "</span>";
  }
  const KEY = () => '<span class="ickey">' + icons({ native: true }).replace(/<\/?span class="ics">/g, "") + ' native ' + icons({}).replace(/<\/?span class="ics">/g, "") + ' garden favorite <span class="ic ic-df" data-k="daisy" data-tip="Daisy family (related to ragweed)">✿</span> daisy family <span class="ic ic-deer" data-k="deer" data-tip="Deer often or sometimes eat this">' + DEER + '</span> deer often eat <span class="ic ic-tox" data-k="tox" data-tip="Toxic plant">!</span> toxic</span>';
  window.plannerKey = KEY;
  document.querySelectorAll(".keyslot").forEach(e => (e.innerHTML = KEY()));
  { const tip = document.createElement("div"); tip.id = "ictip"; document.body.appendChild(tip);
    const show = el => { tip.textContent = el.dataset.tip; tip.className = "on k-" + el.dataset.k; const r = el.getBoundingClientRect(), tw = tip.offsetWidth;
      tip.style.left = Math.max(6, Math.min(window.innerWidth - tw - 6, r.left + r.width / 2 - tw / 2)) + "px"; tip.style.top = Math.max(6, r.top - tip.offsetHeight - 6) + "px"; };
    document.addEventListener("mouseover", e => { const el = e.target.closest && e.target.closest(".ic, .cpill"); if (el) show(el); else tip.className = ""; });
    document.addEventListener("touchstart", e => { const el = e.target.closest && e.target.closest(".ic, .cpill"); if (el) { show(el); clearTimeout(tip.t); tip.t = setTimeout(() => (tip.className = ""), 2000); } }, { passive: true });
    window.addEventListener("scroll", () => (tip.className = ""), true); }

  let S, bed, selIdx = -1, extraSel = [], armed = null, hoverId = null, notice = "", noFit = [], lastUnplaced = {}; noFit = [];
  let objSel = -1, objArmed = null, paint = null, pathDraw = null;   // selected object, object waiting to be placed, sun-paint mode {brush, size}

  function freshState() {
    return { shape: "rect", dims: { w: 16, d: 6 }, freePoly: null, freeView: "border", placements: [], seed: 7, fill: true, view: "codes",
      filter: { q: "", height: "", month: "" }, bloomFilter: "sel", bloomSort: "start",
      name: "", prefs: { sun: ["full", "part", "shade"], origin: ["nat", "gar"], kinds: ["clump", "fern", "grass", "mat", "bulb"], toxic: true, daisy: true, deer: true, v2: true }, waiting: {}, north: 0, showGrid: true,
      objects: [], sun: { res: 0.5, cells: {} }, sunBase: null, showSun: true, fillMode: "ground", compSkip: [], freeCtrl: null, freeSmooth: false };
  }
  function load() { try { const t = localStorage.getItem(LS); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
  let saveT = 0;
  function save() { track(); clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} }, 200); }

  // ---------- undo / redo: every saved change to the bed is a step you can go back to ----------
  const HKEYS = ["shape", "dims", "freePoly", "freeCtrl", "freeSmooth", "freeView", "placements", "objects", "sun", "sunBase", "waiting", "waitAck", "north", "removed"];
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
  // how much of the bed the objects take up (trees only count their trunk)
  const polyLen = P => P.reduce((s, q, i) => s + (i ? Math.hypot(q[0] - P[i - 1][0], q[1] - P[i - 1][1]) : 0), 0);
  function objArea() { return S.objects.reduce((a, o) => a + (o.t === "tree" ? Math.PI * Geo.trunkR(o) ** 2 : o.t === "path" ? (o.pts ? o.w * polyLen(Geo.pathPts(o)) : o.w * o.h) : o.t === "rock" ? Math.PI * o.w * o.h / 4 : Math.PI * o.w * o.w / 4), 0); }
  const plantBed = () => Object.assign({}, bed, { area: Math.max(bed.area * 0.3, bed.area - objArea()) });
  function toast(msg, ms) { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), ms || 2600); }

  // counts include plants that are chosen but didn't fit in the bed ("waiting"), so they stay on the shopping list
  function counts(real) { const c = {}; S.placements.forEach(p => { if (real && p.c) return; c[p.id] = (c[p.id] || 0) + 1; }); const w = S.waiting || {}; Object.keys(w).forEach(id => { if (byId[id] && w[id] > 0) c[id] = (c[id] || 0) + w[id]; }); return c; }
  // plans saved before spring bulbs and the deer option existed: turn the new choices on
  function migratePrefs(raw) { const pr = S.prefs; if (!(raw && raw.v2)) { if (Array.isArray(pr.kinds) && !pr.kinds.includes("bulb")) pr.kinds.push("bulb"); if (pr.deer == null) pr.deer = true; pr.v2 = true; } }
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
  function clearSel() { selIdx = -1; extraSel = []; }
  // kinds of plant in the current selection, and selecting every planted one of some kinds
  const selIds = () => { const s = []; selAll().forEach(i => { const id = S.placements[i] && S.placements[i].id; if (id && !s.includes(id)) s.push(id); }); return s; };
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
  const defaultQty = p => (p.spacing >= 24 ? 1 : p.spacing >= 15 ? 3 : 5);

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
    const remaining = items.map(it => ({ plant: it.plant, n: it.n - (lockedCount[it.plant.id] || 0) })).filter(it => it.n > 0);
    if (!remaining.length) { S.placements = locked; S.waiting = {}; notice = ""; noFit = []; lastUnplaced = {}; selIdx = -1; return; }
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
    lightBadIdx().map(i => S.placements[i]).forEach(pl => { if (!pl.lock) moveToLight(pl); });
    lastUnplaced = r.unplaced;
    const missing = Object.keys(r.unplaced).reduce((s, k) => s + r.unplaced[k], 0);
    const before = waitTotal(); S.waiting = Object.assign({}, r.unplaced); if (missing && missing !== before) S.waitAck = false;
    notice = ""; noFit = [];
  }
  function rebuildBed(keepLayout) {
    bed = Geo.buildBed(S); attachExtras();
    if (!keepLayout) relayout(false);
  }
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
    if (counts()[id] > 0) removePlant(id); else addMany(id, defaultQty(byId[id]));
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
    const box = $("#shapes"); box.innerHTML = "";
    ["rect", "circle", "free"].forEach(k => {
      const sh = Geo.SHAPES[k]; let poly;
      if (k === "free") poly = [[0, 0], [9, 1], [11, 5], [7, 7], [3, 6], [0, 4]];
      else { const d = {}; sh.params.forEach(q => (d[q.k] = q.def)); poly = Geo.buildBed({ shape: k, dims: d }).poly; }
      const bb = Geo.bbox(poly), s = Math.min(40 / bb.w, 26 / bb.h), ox = (44 - bb.w * s) / 2, oy = (30 - bb.h * s) / 2;
      const pts = poly.map(q => `${(ox + (q[0] - bb.x0) * s).toFixed(1)},${(oy + (bb.y1 - q[1]) * s).toFixed(1)}`).join(" ");
      const b = document.createElement("button");
      b.className = "shape" + (S.shape === k ? " on" : ""); b.type = "button";
      b.innerHTML = `<svg viewBox="0 0 44 30"><polygon points="${pts}" fill="#C9AE92" stroke="#8E7660" stroke-width="1.6" stroke-linejoin="round"/></svg>${sh.label}`;
      b.onclick = () => { setShape(k); };
      box.appendChild(b);
    });
    $("#shapeHint").textContent = Geo.SHAPES[S.shape].hint;
  }
  function setShape(k) {
    S.shape = k; S.dims = {};
    Geo.SHAPES[k].params.forEach(q => (S.dims[q.k] = q.def));
    if (k === "free" && !S.freePoly) { startDraw(); return; }
    rebuildBed(); fullRender();
  }
  function renderDims() {
    const sh = Geo.SHAPES[S.shape], box = $("#dims"); box.innerHTML = "";
    sh.params.forEach(q => {
      const l = document.createElement("label"); l.textContent = q.label;
      const i = document.createElement("input"); i.type = "number"; i.min = q.min; i.max = q.max; i.step = 0.5; i.value = S.dims[q.k] != null ? S.dims[q.k] : q.def;
      let t = 0;
      i.oninput = () => { clearTimeout(t); t = setTimeout(() => {
        let v = parseFloat(i.value); if (!isFinite(v)) return; v = Math.max(q.min, Math.min(q.max, v)); S.dims[q.k] = v; rebuildBed(); refresh(); }, 350); };
      l.appendChild(i); box.appendChild(l);
    });
    $("#freeBox").style.display = S.shape === "free" ? "block" : "none";
    $("#freeView").value = S.freeView || "border";
    $("#btnDraw").textContent = S.freePoly ? "Edit the outline" : "Draw the outline";
    if (S.shape === "free") { const bb = bed.bb; const d = document.createElement("div"); d.className = "hint"; d.style.gridColumn = "1 / -1"; d.textContent = `Outline is about ${bb.w.toFixed(1)} ft by ${bb.h.toFixed(1)} ft, ${Math.round(bed.area)} sq ft.`; box.appendChild(d); }
  }
  function startDraw() {
    armed = null; selIdx = -1; extraSel = []; objSel = -1; objArmed = null; pathDraw = null; paint = null; renderPaintBar();
    $("#planCard").scrollIntoView({ behavior: "smooth", block: "start" });
    const existing = S.shape === "free" && S.freePoly ? (S.freeCtrl || S.freePoly) : null;
    window.Plan.startDraw({
      onDone: out => {
        const bb = Geo.bbox(out.poly), sh = q => [Math.round((q[0] - bb.x0) * 100) / 100, Math.round((q[1] - bb.y0) * 100) / 100];
        S.freePoly = out.poly.map(sh); S.freeCtrl = out.pts.map(sh); S.freeSmooth = !!out.smooth; S.shape = "free"; S.dims = {};
        rebuildBed(); fullRender();
        toast("Shape saved. Your plants were re-arranged to fit.");
      },
      onCancel: () => { if (S.shape === "free" && !S.freePoly) { S.shape = "rect"; S.dims = { w: 16, d: 6 }; rebuildBed(); } fullRender(); }
    }, { pts: existing, smooth: S.freeSmooth });
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
    return true;
  }
  function passes(p) {
    const f = S.filter, h = Geo.hMean(p);
    if (!matchesPrefs(p) && !(counts()[p.id] > 0)) return false;
    if (f.height === "low" && !(p.hHi < 12)) return false;
    if (f.height === "mid" && !(h >= 12 && h <= 30)) return false;
    if (f.height === "tall" && !(p.hHi >= 30)) return false;
    if (f.month) { const m = +f.month; if (!p.bloom || Math.min(p.bloom[1], m + 1) - Math.max(p.bloom[0], m) < 0.35) return false; }
    if (f.q) { const q = f.q.toLowerCase(); if (!(p.name + " " + p.latin + " " + p.color).toLowerCase().includes(q)) return false; }
    return true;
  }
  const SUNS = [["full", "Full sun (6+ hours)"], ["part", "Part shade (3–6 hours)"], ["shade", "Full shade (under 3 hours)"]];
  const ORIGINS = [["nat", "Michigan natives"], ["gar", "Garden favorites ◆"]];
  function prefChanged() {
    renderChips(); renderLibrary(); renderBloom(); save();
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
  function renderChips() {
    const pr = S.prefs;
    const multi = (box, opts, key) => {
      const el = $(box); el.innerHTML = "";
      opts.forEach(([k, l]) => {
        const b = document.createElement("button"); b.type = "button"; b.className = "chip" + (key === "origin" ? " o-" + k : key === "kinds" ? " o-kind" : key === "sun" ? " o-sun" : "") + (pr[key].includes(k) ? " on" : ""); b.textContent = (pr[key].includes(k) ? "✓ " : "") + l; if (key === "origin" && k === "nat") b.insertAdjacentHTML("beforeend", " " + LEAF);
        b.onclick = () => {
          const on = pr[key].includes(k);
          if (on && pr[key].length === 1) { toast("Keep at least one choice here."); return; }
          pr[key] = on ? pr[key].filter(x => x !== k) : pr[key].concat(k);
          prefChanged();
        };
        el.appendChild(b);
      });
    };
    multi("#pSun", SUNS, "sun"); multi("#pOrigin", ORIGINS, "origin"); multi("#pKind", KINDS.filter(k => k[0] !== "all"), "kinds");
    const t = $("#pTox"); t.innerHTML = "";
    { const b = document.createElement("button"); b.type = "button"; b.className = "chip tox" + (pr.toxic ? " on" : ""); b.textContent = (pr.toxic ? "✓ " : "") + "Also show toxic plants"; b.insertAdjacentHTML("beforeend", ' <span class="ic ic-tox chipic">!</span>');
      b.onclick = () => { pr.toxic = !pr.toxic; prefChanged(); };
      t.appendChild(b); }
    const dz = $("#pDaisy"); dz.innerHTML = "";
    { const b = document.createElement("button"); b.type = "button"; b.className = "chip daisy" + (pr.daisy !== false ? " on" : ""); b.textContent = (pr.daisy !== false ? "✓ " : "") + "Also show daisy-family plants ✿";
      b.onclick = () => { pr.daisy = pr.daisy === false; prefChanged(); };
      dz.appendChild(b); }
    $("#daisyHint").textContent = pr.daisy === false ? "" : "Daisy-family plants (marked \u273F) are related to ragweed. Most are pollinated by insects, so they shed far less pollen than ragweed, but people with ragweed allergies can still react, often to handling them. If allergies are a concern, skip them or check with a doctor.";
    const dr = $("#pDeer"); dr.innerHTML = "";
    { const b = document.createElement("button"); b.type = "button"; b.className = "chip deer" + (pr.deer !== false ? " on" : ""); b.textContent = (pr.deer !== false ? "✓ " : "") + "Also show plants deer like to eat"; b.insertAdjacentHTML("beforeend", ' <span class="ic ic-deer chipic">' + DEER + "</span>");
      b.onclick = () => { pr.deer = pr.deer === false; prefChanged(); };
      dr.appendChild(b); }
    $("#deerHint").textContent = pr.deer === false ? "" : "Plants marked with the antler icon are ones deer often or sometimes eat, based on the Rutgers University deer-resistance ratings. No plant is deer-proof: hungry deer eat almost anything, and rabbits nibble many young plants too. If deer visit your yard, skip these or plan on fencing or repellent.";
    { const th = $("#toxHint"); th.textContent = ""; if (pr.toxic) { th.append("Toxic plants are marked with a red ! icon here (hover it to see who it is toxic to) and a red Toxic tag in the PDF guide. Keep them away from pets and children who chew on plants. These labels are my own starting point, so check the "); const ln = document.createElement("a"); ln.href = "https://www.aspca.org/pet-care/animal-poison-control/toxic-and-non-toxic-plants"; ln.target = "_blank"; ln.rel = "noopener"; ln.textContent = "ASPCA toxic and non-toxic plant list"; th.append(ln, " before you buy. For a person who has eaten a plant, call Poison Control at 1-800-222-1222 (free, 24 hours; online at "); const pl = document.createElement("a"); pl.href = "https://poisonhelp.org/"; pl.target = "_blank"; pl.rel = "noopener"; pl.textContent = "poisonhelp.org"; th.append(pl, "). If someone is unconscious, having trouble breathing or having a seizure, call 911 first."); } }
  }
  function renderLibrary() {
    const c = counts(), list = PL.filter(passes).sort((a, b) => a.name.localeCompare(b.name));
    const sel = Object.keys(c).length;
    const nMatch = PL.filter(matchesPrefs).length, outside = selected().filter(p => !matchesPrefs(p)).length;
    $("#libLede").innerHTML = `${nMatch} of ${PL.length} plants fit your garden, ${sel} chosen so far. Click a plant to add or remove it. ` + KEY() + (outside ? ` ${outside} chosen plant${outside > 1 ? "s don't" : " doesn't"} fit your step 2 choices (marked <span class="ic ic-off" data-k="off" data-tip="Outside your step 2 choices">–</span>).` : "");
    const box = $("#lib"); box.style.minHeight = box.offsetHeight + "px"; box.innerHTML = "";
    requestAnimationFrame(() => { box.style.minHeight = ""; });
    if (!list.length) { box.innerHTML = '<div class="empty">No plants match those filters.</div>'; return; }
    list.forEach(p => {
      const on = c[p.id] > 0, d = document.createElement("div");
      d.className = "pcard" + (on ? " on" : ""); d.dataset.id = p.id;
      d.innerHTML = `<img src="${imgSrc(p.id)}" alt=""><div><div class="nm">${esc(p.name)}${icons(p, !matchesPrefs(p))}</div><div class="meta">${Ch.heightText(p)} · ${esc(Ch.bloomText(p))}${on ? " · <b>×" + c[p.id] + "</b>" : ""}</div></div><div class="tick">${on ? "✓" : ""}</div>`;
      d.onclick = () => togglePlant(p.id);
      d.onmouseenter = () => setHover(p.id); d.onmouseleave = () => setHover(null);
      box.appendChild(d);
    });
  }

  // ---------- bloom chart ----------
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
    if (!list.length) box.innerHTML = '<div class="empty">Nothing chosen yet. Switch to "All plants" and click + Add on some rows.</div>';
    list.forEach(p => {
      const on = c[p.id] > 0, r = document.createElement("div");
      r.className = "brow" + (on ? "" : " off"); r.dataset.id = p.id;
      let bar;
      if (p.bloom) { const a = Ch.pct(p.bloom[0]), b = Ch.pct(p.bloom[1]); bar = `<div class="bar" style="left:${a}%;width:${b - a}%;background:${p.hex}" title="${esc(Ch.bloomText(p))}: ${esc(p.color)}"></div>`; }
      else bar = `<div class="bar leaf" style="left:2%;width:96%" title="Foliage plant, green all season"></div>`;
      bar += carePills(p);
      r.innerHTML = `<div class="lab"><img src="${imgSrc(p.id)}" alt=""><div class="nm">${esc(p.name)}${icons(p)}<small>${on ? "×" + c[p.id] + " · " : ""}${esc(Ch.bloomText(p))}</small></div></div><div class="track">${bar}</div>`;
      r.onclick = e => { if (e.target.closest(".addbtn")) return; if (on) pickFromChart(p.id, e.ctrlKey || e.metaKey); };
      if (!on) { const ab = document.createElement("button"); ab.type = "button"; ab.className = "addbtn"; ab.textContent = "+ Add"; ab.onclick = () => togglePlant(p.id); r.querySelector(".nm").appendChild(ab); }
      r.onmouseenter = () => setHover(p.id); r.onmouseleave = () => setHover(null);
      box.appendChild(r);
    });
    // coverage of chosen plants
    const cov = Ch.bloomCounts(selected()), mx = Math.max(1, ...cov);
    $("#cover").innerHTML = cov.map(n => `<div class="covcell" style="background:${n === 0 ? "#D9A09A" : Ch.shade("#6E9A5B", 1.25 - 0.55 * (n / mx))}">${n}</div>`).join("");
    const gaps = Ch.MONTHS.filter((m, i) => cov[i] === 0 && i < 7);
    $("#coverNote").textContent = !selected().length ? "" : gaps.length ? `Gap: nothing chosen is in bloom in ${gaps.join(", ")}. Look for plants with a bar there, or lean on the foliage plants.` : "Something is in bloom in every month from April to October.";
  }

  // ---------- care timing ----------
  const SPROUT = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 11V6.5M6 6.8C6 4.2 4.2 2.8 1.6 3c0 2.4 1.8 3.8 4.4 3.8zM6 6.2c0-2.6 1.8-4 4.4-3.8 0 2.4-1.8 3.8-4.4 3.8z" fill="currentColor" stroke="currentColor" stroke-width=".8" stroke-linejoin="round"/></svg>';
  const CARE_ICON = { prep: SPROUT, cut: "✂", trim: "✂", divide: "↔", bulbs: "●", mulch: "≋" };
  const CARE_LAB = { prep: "Prep", cut: "Cut back", trim: "Optional trim" };
  function pill(k, w, tip, label) {
    const a = Ch.pct(w.a), b = Ch.pct(w.b);
    return `<span class="cpill k-${k}${label ? " big" : ""}" data-k="${k}" data-tip="${esc(tip)}" style="left:${a}%;width:${Math.max(1.2, b - a)}%"><i>${CARE_ICON[k]}</i>${label ? "<b>" + esc(label) + "</b>" : ""}</span>`;
  }
  function carePills(p) {
    const c = window.Care.careFor(p); let h = "";
    ["prep", "cut", "trim"].forEach(k => { if (c[k]) h += pill(k, c[k], CARE_LAB[k] + ": " + c[k].text + (k === "prep" || (k === "cut" && !c.prep) ? " " + c.divide : "")); });
    return h;
  }
  function renderGardenCare() {
    const box = $("#gardenCare"); if (!box) return;
    const tasks = window.Care.gardenTasks(selected());
    const lane = n => tasks.filter(t => t.lane === n).map(t => pill(t.k, t, t.label + ": " + t.text, t.label)).join("");
    box.innerHTML = `<div class="gc-lab"><b>Whole garden</b><small>Michigan zone 6B. Hover or tap for details.</small></div><div class="gc-track"><div class="gc-lane">${lane(0)}</div><div class="gc-lane">${lane(1)}</div></div>`
      + `<div class="gc-key"><span class="cpill k-prep"><i>${SPROUT}</i></span> prep <span class="cpill k-cut"><i>✂</i></span> cut back <span class="cpill k-trim"><i>✂</i></span> optional trim for more flowers <span class="cpill k-divide"><i>↔</i></span> divide <span class="cpill k-bulbs"><i>●</i></span> plant bulbs</div>`;
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
      sel.map(p => `<tr data-id="${p.id}"><td><img src="${imgSrc(p.id)}" alt=""><b>${esc(p.name)}</b>${icons(p)}${S.waiting && S.waiting[p.id] > 0 ? `<small class="wfit">${S.waiting[p.id]} won't fit in the bed yet</small>` : ""}</td>
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
    return { bed, placements: S.placements, byId, view: S.view, selIdx, selAll: selAll(), hoverId, armed, north: S.north || 0, showGrid: S.showGrid !== false,
      objects: S.objects, objSel, objArmed, pathDraw, paint, lightBad: paint ? [] : lightBadIdx(),
      sun: { show: !!paint || (sunActive() && S.showSun !== false), res: S.sun.res, cells: S.sun.cells, base: sunBase() } };
  }
  function renderPlan() {
    if (selIdx < 0) extraSel = [];
    if (objSel >= S.objects.length) objSel = -1;
    window.Plan.render(planCtx());
    markSel();
    const cv = S.placements.reduce((s, p) => s + Math.PI * Math.pow(byId[p.id].spacing / 24, 2), 0) / (bed.area || 1);
    const bb = bed.bb, kinds = Object.keys(counts()).length;
    $("#stats").innerHTML = `<span><b>${bed.label}</b> · ${bb.w.toFixed(1).replace(/\.0$/, "")} × ${bb.h.toFixed(1).replace(/\.0$/, "")} ft</span><span><b>${Math.round(bed.area)}</b> sq ft</span><span><b>${S.placements.length}</b> plants, ${kinds} kinds</span>` + (S.objects.length ? `<span><b>${S.objects.length}</b> object${S.objects.length > 1 ? "s" : ""}</span>` : "") + `<span>Full-grown coverage <b>${Math.round(cv * 100)}%</b></span>`;
    const bad = window.Plan.lastBad || 0;
    const msgs = [];
    if (notice) msgs.push(notice);
    const n = document.querySelector("#plan .pl.bad") ? document.querySelectorAll("#plan .pl.bad").length : 0;
    if (n) msgs.push(`${n} plant${n > 1 ? "s are" : " is"} drawn with a dashed red edge because ${n > 1 ? "they are" : "it is"} closer to another plant than the spacing allows, or sitting on an object. Drag ${n > 1 ? "them" : "it"} clear, or remove one.`);
    const box = $("#notice"); box.style.display = msgs.length ? "block" : "none"; box.innerHTML = msgs.map(esc).join("<br>");
    if (n) { box.insertAdjacentHTML("beforeend", ` <button class="btn small" id="ovFix" type="button">Fix it</button>`); $("#ovFix").onclick = openOverlapFix; }
    const outObjs = S.objects.filter(o => !Geo.pip(bed.poly, o.x, o.y));
    if (outObjs.length) {
      box.style.display = "block";
      box.insertAdjacentHTML("beforeend", (box.innerHTML ? "<br>" : "") + `${outObjs.length === 1 ? "The " + esc(Geo.OBJ[outObjs[0].t].label.toLowerCase()) + " sits" : outObjs.length + " objects sit"} outside the bed now (shown faded). Drag ${outObjs.length === 1 ? "it" : "them"} back in, or <button class="btn small" id="outRm" type="button">Remove ${outObjs.length === 1 ? "it" : "them"}</button>`);
      $("#outRm").onclick = () => { S.objects = S.objects.filter(o => !outObjs.includes(o)); objSel = -1; attachExtras(); refresh(); toast("Removed. Undo brings " + (outObjs.length === 1 ? "it" : "them") + " back."); };
    }
    const lb = paint ? [] : lightBadIdx();
    if (lb.length) {
      const kinds2 = {}; lb.forEach(i => { const id = S.placements[i].id; kinds2[id] = (kinds2[id] || 0) + 1; });
      const nm = Object.keys(kinds2).map(id => byId[id].name + (kinds2[id] > 1 ? " ×" + kinds2[id] : "")).join(", ");
      box.style.display = "block";
      box.insertAdjacentHTML("beforeend", (box.innerHTML ? "<br>" : "") + `${lb.length} plant${lb.length > 1 ? "s sit" : " sits"} in light that doesn't suit ${lb.length > 1 ? "them" : "it"} (dotted gold edge): ${esc(nm)}. <button class="btn small" id="lbFix" type="button">Move ${lb.length > 1 ? "them" : "it"}</button>`);
      $("#lbFix").onclick = () => {
        let moved = 0, stuck = 0;
        lb.map(i => S.placements[i]).forEach(pl => { if (pl.lock) { stuck++; return; } if (moveToLight(pl)) moved++; else stuck++; });
        refresh(); toast(moved ? `Moved ${moved} plant${moved > 1 ? "s" : ""} into light that suits ${moved > 1 ? "them" : "it"}.` + (stuck ? ` ${stuck} couldn't find a spot (locked plants stay put).` : "") : "No open spot with the right light. Paint more of that light, or make room.", 4500);
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
    renderFillPick();
    const a = $("#armed");
    if (armed) { a.classList.add("on"); a.innerHTML = `Placing <b>${esc(byId[armed].name)}</b>: click the bed <button class="btn small" id="armOff" type="button">Stop</button>`; $("#armOff").onclick = () => { armed = null; refreshPlanOnly(); }; }
    else if (pathDraw) {
      a.classList.add("on"); const n = pathDraw.pts.length;
      a.innerHTML = `Drawing a <b>path</b>: click along the bed to lay it out${n >= 2 ? "" : " (at least 2 points)"}. <button class="btn small primary" id="pdDone" type="button"${n >= 2 ? "" : " disabled"}>Finish</button> <button class="btn small" id="pdUndo" type="button"${n ? "" : " disabled"}>Undo point</button> <button class="btn small" id="pdOff" type="button">Cancel</button>`;
      $("#pdDone").onclick = finishPath; $("#pdUndo").onclick = () => { pathDraw.pts.pop(); renderPlan(); }; $("#pdOff").onclick = () => { pathDraw = null; renderPlan(); };
    }
    else if (objArmed) { a.classList.add("on"); a.innerHTML = `Placing a <b>${esc(Geo.OBJ[objArmed].label.toLowerCase())}</b>: click the bed where it goes <button class="btn small" id="armOff" type="button">Stop</button>`; $("#armOff").onclick = () => { objArmed = null; pathDraw = null; refreshPlanOnly(); }; }
    else a.classList.remove("on");
    const sw = $("#sunToggleWrap"); if (sw) { sw.hidden = !sunActive(); $("#chkSun").checked = S.showSun !== false; }
    undoUI();
    document.querySelectorAll("#viewSeg button").forEach(b => b.classList.toggle("on", b.dataset.v === S.view));
    if ($("#chkGrid")) $("#chkGrid").checked = S.showGrid !== false;
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

  // ---------- right-click plant menu ----------
  function closePlantMenu() { const m = document.getElementById("plantMenu"); if (m) m.remove(); }
  function openPlantMenu(idx, cx, cy) {
    closePlantMenu();
    if (!S.placements[idx]) return;
    if (!selAll().includes(idx)) { selIdx = idx; extraSel = []; }
    optMode = "idle"; renderPlan();
    const group = selAll().map(i => S.placements[i]).filter(Boolean), n = group.length;
    const names = [...new Set(group.map(q => byId[q.id].name))];
    const what = n === 1 ? names[0] : n + " plants";
    const m = document.createElement("div"); m.id = "plantMenu"; m.className = "ctxmenu";
    const item = (label, fn) => { const b = document.createElement("button"); b.type = "button"; b.className = "ctxitem"; b.textContent = label; b.onclick = e => { e.stopPropagation(); fn && fn(); }; m.appendChild(b); return b; };
    if (n > 1) { const h = document.createElement("div"); h.className = "ctxhead"; h.textContent = n + " plants selected"; m.appendChild(h); }
    const allLocked = group.every(q => q.lock);
    item(allLocked ? (n > 1 ? "Unlock all " + n : "Unlock (let Re-arrange move it)") : (n > 1 ? "Lock all " + n + " in place" : "Lock in place"), () => {
      const v = !allLocked; group.forEach(q => { if (v) q.lock = true; else delete q.lock; });
      closePlantMenu(); save(); renderPlan(); toast((v ? "Locked " : "Unlocked ") + what + (v ? ". Locked plants can't be dragged, moved or removed until you unlock them." : "."), 3500);
    });
    item(n > 1 ? "Move all " + n + " to open spots" : "Move to an open spot", () => {
      closePlantMenu(); let moved = 0, stuck = 0, locked = 0;
      group.forEach(q => { if (q.lock) { locked++; return; } if (movePlacement(q)) moved++; else stuck++; });
      if (moved) refresh();
      toast(moved ? "Moved " + moved + (moved > 1 ? " plants." : " plant.") + (stuck ? " " + stuck + " had no open spot." : "") + (locked ? " " + locked + " locked stayed put." : "") : locked ? "Locked plants stay put. Unlock first." : "No open spot nearby.");
    });
    item(n > 1 ? "Duplicate all " + n : "Duplicate " + names[0], () => {
      closePlantMenu(); notice = ""; noFit = []; let ok = 0;
      group.forEach(q => { if (addOne(q.id, true)) ok++; });
      refresh(); toast(ok ? "Added " + ok + " more plant" + (ok > 1 ? "s" : "") + "." : "No room left for more.");
    });
    item(n > 1 ? "Remove all " + n : "Remove this " + names[0], () => {
      closePlantMenu(); const del = group.filter(q => !q.lock), kept = n - del.length;
      if (!del.length) { toast("Locked plants can't be removed. Unlock first."); return; }
      S.placements = S.placements.filter(q => !del.includes(q)); clearSel(); refresh();
      if (kept) toast(kept + " locked plant" + (kept > 1 ? "s" : "") + " stayed.");
    });
    document.body.appendChild(m);
    const vw = window.innerWidth, vh = window.innerHeight, mw = 220;
    m.style.left = Math.min(cx, vw - mw - 10) + "px"; m.style.top = Math.min(cy, vh - m.offsetHeight - 10) + "px";
    setTimeout(() => document.addEventListener("click", closePlantMenu, { once: true }), 0);
  }

  // ---------- objects: add, right-click menu, sizing ----------
  function openObjMenu(oi, cx, cy) {
    closePlantMenu();
    const o = S.objects[oi]; if (!o) return;
    const d = Geo.OBJ[o.t], m = document.createElement("div"); m.id = "plantMenu"; m.className = "ctxmenu";
    const item = (label, fn) => { const b = document.createElement("button"); b.type = "button"; b.className = "ctxitem"; b.textContent = label; b.onclick = e => { e.stopPropagation(); closePlantMenu(); fn(); }; m.appendChild(b); };
    item("Duplicate " + d.label.toLowerCase(), () => {
      const c = Object.assign({}, o), step = (d.shape === "circ" ? o.w : Math.max(o.w, o.h)) / 2 + 0.6;
      if (o.pts) { const off = o.w + 0.4, np = o.pts.map(q => [q[0] + off, q[1]]); const ok = np.every(q => Geo.pip(bed.poly, q[0], q[1])); const np2 = ok ? np : o.pts.map(q => [q[0] - off, q[1]]); c.pts = np2.every(q => Geo.pip(bed.poly, q[0], q[1])) ? np2 : o.pts.map(q => [q[0], q[1]]); c.x = c.pts.reduce((s, q) => s + q[0], 0) / c.pts.length; c.y = c.pts.reduce((s, q) => s + q[1], 0) / c.pts.length; S.objects.push(c); objSel = S.objects.length - 1; refresh(); toast("Added another path."); return; }
      const spots = [[step, 0], [-step, 0], [0, step], [0, -step]].map(([dx, dy]) => [o.x + dx, o.y + dy]).filter(q => Geo.pip(bed.poly, q[0], q[1]));
      if (spots.length) { c.x = spots[0][0]; c.y = spots[0][1]; }
      S.objects.push(c); objSel = S.objects.length - 1; const r = settleObjects(); refresh(); toast("Added another " + d.label.toLowerCase() + "." + settleNote(r));
    });
    if (d.rot && !o.pts) item("Turn 90°", () => { o.rot = ((o.rot || 0) + 90) % 360; const r = settleObjects(); refresh(); if (r.moved || r.stuck) toast(settleNote(r).trim()); });
    item("Remove this " + d.label.toLowerCase(), () => { S.objects.splice(oi, 1); objSel = -1; refresh(); toast(d.label + " removed."); });
    document.body.appendChild(m);
    m.style.left = Math.min(cx, window.innerWidth - 210) + "px"; m.style.top = Math.min(cy, window.innerHeight - m.offsetHeight - 10) + "px";
    setTimeout(() => document.addEventListener("click", closePlantMenu, { once: true }), 0);
  }
  function openObjPicker() {
    closePlantMenu();
    const btn = $("#btnObj"), r = btn.getBoundingClientRect(), m = document.createElement("div"); m.id = "plantMenu"; m.className = "ctxmenu objmenu";
    const ICON = { path: "▭", stone: "●", stump: "◎", rock: "⬬", birdbath: "◉", shrub: "✺", tree: "♣" };
    Object.keys(Geo.OBJ).forEach(t => {
      const d = Geo.OBJ[t], b = document.createElement("button"); b.type = "button"; b.className = "ctxitem";
      b.innerHTML = `<span><i class="oic oic-${t}">${ICON[t]}</i>${esc(d.label)}</span><small>${t === "path" ? "draw it" : d.shape === "circ" ? d.w + " ft" : d.w + " × " + d.h + " ft"}</small>`;
      b.onclick = e => { e.stopPropagation(); closePlantMenu(); objArmed = t; pathDraw = null; if (t === "path") { objArmed = null; pathDraw = { pts: [], w: Geo.OBJ.path.w }; } armed = null; paint = null; renderPaintBar(); clearSel(); objSel = -1; renderPlan(); };
      m.appendChild(b);
    });
    document.body.appendChild(m);
    m.style.left = Math.min(r.left, window.innerWidth - 230) + "px"; m.style.top = (r.bottom + 4) + "px";
    setTimeout(() => document.addEventListener("click", closePlantMenu, { once: true }), 0);
  }
  // the selection bar for a selected object: what it is, and its size
  function renderObjOptions(box) {
    const o = S.objects[objSel], d = Geo.OBJ[o.t];
    const lab = document.createElement("div"); lab.className = "fp-lab fp-full";
    if (o.pts) lab.innerHTML = `Path <span class="fp-hint">Drag the path to move it, the white dots to reshape the curve, and the orange dot to change its width. Plants are kept off the path but can lean over its edges. Right-click it to duplicate or remove it.</span>`;
    else lab.innerHTML = `${esc(d.label)} <span class="fp-hint">${esc(d.note)} Drag it to move it, drag the white dots to resize${d.rot ? " and the orange dot to turn it" : ""}. Right-click it to duplicate or remove it.</span>`;
    box.appendChild(lab);
    const row = document.createElement("div"); row.className = "objfields";
    const field = (label, key, min, max, step) => {
      const l = document.createElement("label"); l.className = "field"; l.textContent = label;
      const i = document.createElement("input"); i.type = "number"; i.min = min; i.max = max; i.step = step; i.value = Math.round((o[key] || 0) * 100) / 100;
      i.onchange = () => {
        let v = parseFloat(i.value); if (!isFinite(v)) return; v = Math.max(min, Math.min(max, v));
        if (key === "rot") v = ((v % 360) + 360) % 360;
        o[key] = v; if (d.shape === "circ" && key === "w") o.h = v;
        const r = settleObjects(); refresh(); if (r.moved || r.stuck) toast(settleNote(r).trim());
      };
      l.appendChild(i); row.appendChild(l);
    };
    if (o.pts) field("Width (ft)", "w", d.min, d.max, 0.25);
    else if (d.shape === "circ") field(o.t === "tree" ? "Canopy width (ft)" : "Width (ft)", "w", d.min, d.max, 0.25);
    else { field("Width (ft)", "w", d.min, d.max, 0.25); field(o.t === "path" ? "Length (ft)" : "Depth (ft)", "h", d.min, d.max, 0.25); field("Turn (degrees)", "rot", 0, 359, 15); }
    box.appendChild(row);
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
  function renderPaintBar() {
    const bar = $("#paintBar"); if (!bar) return;
    $("#btnPaint").classList.toggle("on", !!paint);
    if (!paint) { bar.hidden = true; bar.innerHTML = ""; return; }
    bar.hidden = false; bar.innerHTML = "";
    const Z = window.Plan.ZONE, L = window.Plan.ZONE_LAB;
    const grp = (title) => { const g = document.createElement("div"); g.className = "pb-grp"; if (title) { const t = document.createElement("span"); t.className = "pb-lab"; t.textContent = title; g.appendChild(t); } bar.appendChild(g); return g; };
    const g1 = grp("Paint:");
    [["full"], ["part"], ["shade"], ["erase"]].forEach(([k]) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "btn small zbtn" + (paint.brush === k ? " on" : "");
      b.innerHTML = k === "erase" ? '<i class="zsw zerase"></i>Eraser' : `<i class="zsw" style="background:${Z[k]}"></i>${L[k]}`;
      b.title = k === "erase" ? "Paint back to the rest of the bed's light" : "Paint spots that get " + L[k].toLowerCase();
      b.onclick = () => { paint.brush = k; renderPaintBar(); }; g1.appendChild(b);
    });
    const g2 = grp("Brush:");
    [1, 2, 4].forEach(n => { const b = document.createElement("button"); b.type = "button"; b.className = "btn small" + (paint.size === n ? " on" : ""); b.textContent = n + " ft"; b.onclick = () => { paint.size = n; renderPaintBar(); renderPlanOnly(); }; g2.appendChild(b); });
    const g3 = grp("Rest of the bed:");
    const sel = document.createElement("select");
    ["full", "part", "shade"].forEach(k => { const o = document.createElement("option"); o.value = k; o.textContent = L[k] + (!S.sunBase && sunBase() === k ? " (from step 2)" : ""); sel.appendChild(o); });
    sel.value = sunBase(); sel.onchange = () => { S.sunBase = sel.value; save(); renderPaintBar(); renderPlan(); };
    g3.appendChild(sel);
    const g4 = grp(""); g4.classList.add("pb-right");
    const clr = document.createElement("button"); clr.type = "button"; clr.className = "btn small"; clr.textContent = "Clear painting"; clr.disabled = !sunActive();
    clr.onclick = () => { S.sun.cells = {}; S.sunBase = null; save(); renderPaintBar(); renderPlan(); toast("Sun zones cleared. Undo brings them back."); };
    const done = document.createElement("button"); done.type = "button"; done.className = "btn small primary"; done.textContent = "Done";
    done.onclick = () => { paint = null; renderPaintBar(); renderPlan(); };
    g4.append(clr, done);
    const hint = document.createElement("p"); hint.className = "pb-hint";
    hint.textContent = "Drag across the bed to mark spots that get more or less sun than the rest (use the north arrow to line the plan up with your yard). New plants, Re-arrange and Fill gaps put each plant in light that suits it; plants already in the wrong light get a dotted gold edge.";
    bar.appendChild(hint);
  }

  // ---------- plan callbacks ----------
  window.Plan.init($("#plan"), {
    onSelect(i, add) {
      objSel = -1;
      if (i < 0) { clearSel(); }
      else if (add) {
        const cur = selAll();
        if (cur.includes(i)) { const rest = cur.filter(x => x !== i); selIdx = rest.length ? rest[rest.length - 1] : -1; extraSel = rest.slice(0, -1); }
        else { selIdx = i; extraSel = cur; }
      } else { const cur = selAll(); if (!cur.includes(i) || cur.length === 1) { selIdx = i; extraSel = []; } else { selIdx = i; extraSel = cur.filter(x => x !== i); } }   // clicking inside a group keeps the group
      if (selIdx >= 0) optMode = "idle";
      renderPlan();
    },
    onMoved() { save(); renderPlan(); },
    onPlace(x, y) {
      if (!armed) return;
      if (!Geo.pip(bed.poly, x, y)) { toast("Click inside the bed."); return; }
      S.placements.push({ id: armed, x, y }); notice = ""; noFit = []; refresh();
    },
    onHover(id) { if (id !== hoverId) setHover(id); },
    onNorthMove(ang) { S.north = ang; renderPlanOnly(); },
    onNorthDone() { save(); },
    onContextMenu(idx, x, y) { openPlantMenu(idx, x, y); },
    onObjSelect(i) { objSel = i; clearSel(); optMode = "idle"; renderPlan(); },
    onObjMenu(i, x, y) { openObjMenu(i, x, y); },
    onLockedDrag() { toast("Locked in place. Right-click it and choose Unlock to move it.", 2500); },
    onObjChange() { renderPlanOnly(); },
    onObjDone() { const r = settleObjects(); refresh(); if (r.moved || r.stuck) toast(settleNote(r).trim(), 3500); },
    onPathPoint(x, y) {
      if (!pathDraw) return;
      if (!Geo.pip(bed.poly, x, y)) { toast("Click inside the bed."); return; }
      const l = pathDraw.pts[pathDraw.pts.length - 1]; if (l && Math.hypot(l[0] - x, l[1] - y) < 0.4) return;
      pathDraw.pts.push([x, y]); renderPlan();
    },
    onPathFinish() { finishPath(); },
    onObjPlace(x, y) {
      if (!objArmed) return;
      if (!Geo.pip(bed.poly, x, y)) { toast("Click inside the bed."); return; }
      const d = Geo.OBJ[objArmed]; S.objects.push({ t: objArmed, x, y, w: d.w, h: d.h, rot: 0 });
      objArmed = null; pathDraw = null; objSel = S.objects.length - 1; clearSel();
      const r = settleObjects(); refresh(); toast(`Placed the ${d.label.toLowerCase()}.` + settleNote(r) + " Drag the white dot to resize it.", 4000);
    },
    onPaintStart() {},
    onPaint(x, y) { paintAt(x, y); renderPlanOnly(); },
    onPaintEnd() { save(); renderPlan(); renderPaintBar(); }
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
    const sunL = { full: "Full sun", part: "Part shade", shade: "Full shade" };
    const list = (arr, map) => (arr || []).map(k => map[k]).filter(Boolean).join(", ");
    const sun = list(pr.sun, sunL);
    $("#hdrTitle").textContent = nm ? nm + " Planner" : "Perennial Bed Planner";
    $("#hdrSub").textContent = [sun, "All perennials", "Zone 6B", "Southern Michigan"].filter(Boolean).join(" · ");
    if ($("#gName").value !== (S.name || "")) $("#gName").value = S.name || ""; }
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
  $("#fHeight").addEventListener("change", e => { S.filter.height = e.target.value; renderLibrary(); save(); });
  $("#fMonth").innerHTML = '<option value="">Any bloom month</option>' + Ch.MONTHS.map((m, i) => `<option value="${4 + i}">Blooms in ${m}</option>`).join("");
  $("#fMonth").addEventListener("change", e => { S.filter.month = e.target.value; renderLibrary(); save(); });
  $("#viewSeg").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; S.view = b.dataset.v; renderPlan(); save(); });
  $("#chkGrid") && $("#chkGrid").addEventListener("change", e => { S.showGrid = e.target.checked; renderPlanOnly(); save(); });
  $("#bloomFilter").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; S.bloomFilter = b.dataset.f; document.querySelectorAll("#bloomFilter button").forEach(x => x.classList.toggle("on", x === b)); renderBloom(); save(); });
  $("#bloomSort").addEventListener("change", e => { S.bloomSort = e.target.value; renderBloom(); save(); });
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
    clearSel(); optMode = "idle"; refresh();
    if (!added.length) { toast("There are no gaps big enough for a companion plant right now.", 4000); return; }
    const tally = {}; added.forEach(q => { tally[q.id] = (tally[q.id] || 0) + 1; });
    toast(`Added ${added.length} plant${added.length > 1 ? "s" : ""}: ` + Object.keys(tally).map(id => byId[id].name + (tally[id] > 1 ? " ×" + tally[id] : "")).join(", ") + ". Press Undo to take them back.", 6000);
  }
  function fillWith(ids) {
    S.seed = (S.seed * 7 + 13) % 100000;
    Geo.refillCarpet(bed, byId, S.placements, ids, S.seed); selIdx = -1; refresh();
    toast("Gaps filled with " + ids.map(i => byId[i].name).join(", ") + ". Click Fill again for a different spread.");
    renderFillPick();
  }
  let optMode = "idle";
  // options for the selected plant(s): photos on top, actions below
  function renderPlantOptions(box) {
    const idxs = selAll(), groups = {}; idxs.forEach(i => { const id = S.placements[i].id; (groups[id] = groups[id] || []).push(i); });
    const ids = Object.keys(groups), cnt = counts();
    const lab = document.createElement("div"); lab.className = "fp-lab fp-full";
    if (idxs.length === 1) {
      const pl = byId[ids[0]], tox = pl.toxic && pl.toxic.length ? window.toxLabel(pl) : "";
      lab.textContent = `${pl.latin} · ${Ch.heightText(pl)} · ${pl.spacing} in apart · ${cnt[pl.id] || 0} in the bed` + (tox ? " · " + tox : "");
    } else lab.innerHTML = `<b>${idxs.length} plants selected</b> from ${ids.length} kind${ids.length > 1 ? "s" : ""} `;
    box.appendChild(lab);
    const tiles = document.createElement("div"); tiles.className = "fp-tiles";
    ids.forEach(id => {
      const pl = byId[id], tox = pl.toxic && pl.toxic.length, t = document.createElement("div"); t.className = "fp-tile on" + (tox ? " tox" : ""); t.title = pl.name + (tox ? ": " + window.toxLabel(pl) : "");
      t.innerHTML = `<img src="${imgSrc(id)}" alt=""><div class="fp-tn">${esc(pl.name)}${icons(pl)}</div><small>${groups[id].length} of ${cnt[id] || 0} selected</small>`;
      t.onclick = () => { if (idxs.length === groups[id].length) { clearSel(); } else { const rest = idxs.filter(i => S.placements[i].id !== id); selIdx = rest[rest.length - 1]; extraSel = rest.slice(0, -1); } renderPlan(); };
      tiles.appendChild(t);
    });
    box.appendChild(tiles);
    if (idxs.length === 1) renderCompanions(tiles, box, idxs[0]);
  }
  // researched good neighbors for the selected plant; click one to plant it right beside
  function companionsFor(id) {
    return (window.COMPANIONS && window.COMPANIONS[id] || []).filter(c => byId[c.id] && (matchesPrefs(byId[c.id]) || counts()[c.id] > 0));
  }
  function renderCompanions(row, box, idx) {
    const anchor = S.placements[idx], src = window.COMPANION_SOURCES || [], cnt = counts();
    const list = companionsFor(anchor.id).slice(0, 6);
    const wrapC = document.createElement("div"); wrapC.className = "po-comp";
    const head = document.createElement("div"); head.className = "po-comp-h";
    head.innerHTML = list.length ? "<b>Goes well with</b> <span>click one to plant it right beside</span>" : "<b>Goes well with</b> <span>no researched pairings for this plant yet</span>";
    wrapC.appendChild(head);
    const why = document.createElement("div"); why.className = "po-why";
    const showWhy = c => {
      if (!c) { why.innerHTML = ""; return; }
      const s = c.src.map(i => src[i]).filter(Boolean)[0];
      why.innerHTML = `<b>${esc(byId[c.id].name)}:</b> ${esc(c.why)}` + (s ? ` <a href="${esc(s.url)}" target="_blank" rel="noopener">Source</a>` : "");
    };
    const ct = document.createElement("div"); ct.className = "po-comp-tiles";
    list.forEach(c => {
      const pl = byId[c.id], t = document.createElement("div"); t.className = "fp-tile comp" + (pl.toxic && pl.toxic.length ? " tox" : "");
      t.title = "Plant " + pl.name + " beside it";
      t.innerHTML = `<img src="${imgSrc(c.id)}" alt=""><div class="fp-tn">${esc(pl.name)}${icons(pl)}</div><small>${cnt[c.id] ? cnt[c.id] + " in bed" : "+ add"}</small>`;
      t.onmouseenter = () => { showWhy(c); setHover(c.id); };
      t.onmouseleave = () => setHover(null);
      t.querySelector("img").onclick = t.onclick = ev => {
        ev.stopPropagation();
        S.placements = S.placements.filter(q => !q.c || q === anchor);
        const keepIdx = S.placements.indexOf(anchor);
        const sel = selected(); if (!sel.some(p => p.id === c.id)) sel.push(pl);
        const p = Geo.placeBeside(bed, byId, S.placements, c.id, anchor.x, anchor.y, Geo.depthTargets(sel), anchor.id) || Geo.placeOne(bed, byId, S.placements, c.id, Geo.depthTargets(sel), 0);
        if (!p) { toast(`No room left beside ${byId[anchor.id].name}.`); return; }
        S.placements.push(p); selIdx = keepIdx; extraSel = []; refresh();
        toast(`Planted ${pl.name} beside ${byId[anchor.id].name}.`);
      };
      ct.appendChild(t);
    });
    wrapC.appendChild(ct); wrapC.appendChild(why); row.appendChild(wrapC);
    showWhy(list[0]);
  }
  // explain what a tool will do, then ask to confirm or cancel
  function renderConfirm(box) {
    const have = S.placements.filter(p => !p.c).length, hasFill = S.placements.some(isGroundcover);
    let title, lines;
    if (optMode === "suggest") {
      const sel = selected(), q = Geo.suggestQuantities(plantBed(), sel), total = sel.reduce((n, p) => n + (q[p.id] || 0), 0);
      title = "Suggest quantities";
      lines = [
        `I will pick how many of each of your ${sel.length} chosen kind${sel.length === 1 ? "" : "s"} of plant to set out so the bed looks full once they are grown (about ${total} plants, compared with ${have} in the bed now).`,
        "Then I will lay them out again in natural drifts, with short plants toward the front and tall ones toward the back.",
        "Where each plant sits now will be replaced" + (hasFill ? ", and any groundcover filler will be cleared (you can fill the gaps again afterward)." : ".") + " You can still use + and − to change any number afterward."
      ];
    } else if (optMode === "reset") {
      title = "Start over";
      lines = [
        "I will go back to the original 15-plant bed and throw away your current plan, including the garden name, bed size and shape, and your garden-kind choices.",
        "If you want to keep this plan, press Cancel and use Save plan first."
      ];
    } else if (optMode === "clear") {
      title = "Clear bed";
      lines = [
        `I will remove all ${S.placements.length} plants from the bed, including any groundcover filler.`,
        "The plant list on the left stays as it is, so you can add plants again afterward." + (S.objects.length ? " Objects like paths and birdbaths stay; right-click one to remove it." : "")
      ];
    } else {
      title = "Re-arrange";
      lines = [
        `I will keep the same ${have} plants and the same number of each kind, and set them out again in a new natural-looking layout.`,
        "Where each plant sits now will be replaced" + (hasFill ? ", and any groundcover filler will be cleared (you can fill the gaps again afterward)." : "."),
        "Not happy with the result? Click Re-arrange again for a different layout."
      ];
    }
    const lab = document.createElement("div"); lab.className = "fp-lab fp-full"; lab.textContent = title; box.appendChild(lab);
    const d = document.createElement("div"); d.className = "fp-desc"; d.innerHTML = lines.map(l => "<p>" + esc(l) + "</p>").join(""); box.appendChild(d);
    const acts = document.createElement("div"); acts.className = "po-acts";
    const ok = document.createElement("button"); ok.type = "button"; ok.className = "btn small"; ok.textContent = "Confirm";
    ok.onclick = () => { const m = optMode; optMode = "idle"; if (m === "suggest") doSuggest(); else if (m === "reset") { S = freshState(); init(true); } else if (m === "clear") doClear(); else doArrange(); };
    const no = document.createElement("button"); no.type = "button"; no.className = "btn small"; no.textContent = "Cancel";
    no.onclick = () => { optMode = "idle"; renderFillPick(); };
    acts.appendChild(ok); acts.appendChild(no); box.appendChild(acts);
  }
  function renderFillPick() {
    const box = $("#fillPick"); box.hidden = false; box.innerHTML = "";
    if (objSel >= 0 && S.objects[objSel]) { renderObjOptions(box); return; }
    if (selAll().length) { renderPlantOptions(box); return; }
    if (optMode === "suggest" || optMode === "arrange" || optMode === "clear" || optMode === "reset") { renderConfirm(box); return; }
    if (optMode !== "fill") {
      const lab = document.createElement("span"); lab.className = "fp-lab idle"; lab.textContent = "Selection bar: click a plant or object on the bed to see it here. Right-click one for more choices. The buttons above the plan add objects, paint sun zones, fill gaps, suggest quantities or re-arrange.";
      box.appendChild(lab); return;
    }
    // two ways to fill: a low groundcover carpet, or companions of the neighboring plants
    const modeRow = document.createElement("div"); modeRow.className = "fp-full fp-moderow";
    modeRow.innerHTML = `<span class="fp-lab">Fill gaps with</span><div class="seg"><button type="button" data-m="ground" class="${S.fillMode !== "comp" ? "on" : ""}">Groundcover</button><button type="button" data-m="comp" class="${S.fillMode === "comp" ? "on" : ""}">Companion plants</button></div>`;
    modeRow.querySelectorAll("button").forEach(b => { b.onclick = () => { S.fillMode = b.dataset.m; save(); renderFillPick(); }; });
    box.appendChild(modeRow);
    if (S.fillMode === "comp") { renderCompFill(box); return; }
    const list = groundcovers();
    S.fillPicks = (S.fillPicks || []).filter(id => list.some(p => p.id === id));
    if (!list.length) {
      const lab = document.createElement("span"); lab.className = "fp-lab"; lab.textContent = "No groundcover matches your garden choices in step 2. Try adding more sun or origin choices.";
      box.appendChild(lab);
    } else {
      const lab = document.createElement("div"); lab.className = "fp-lab fp-full"; lab.innerHTML = "<span class=\"fp-hint\">I will tuck a low groundcover into the empty spaces between your plants, in light that suits it. Click a name to pick one or more, then confirm. Click a photo to enlarge it.</span>";
      box.appendChild(lab);
      const tiles = document.createElement("div"); tiles.className = "fp-tiles";
      list.forEach(p => {
        const on = S.fillPicks.includes(p.id), t = document.createElement("div"); t.className = "fp-tile" + (on ? " on" : ""); t.title = p.latin + ": " + p.hLo + "–" + p.hHi + " in tall";
        t.innerHTML = `<img src="${imgSrc(p.id)}" alt=""><div class="fp-tn">${on ? "✓ " : ""}${esc(p.name)}${icons(p)}</div><small>${Ch.heightText(p)}</small>`;
        t.onclick = () => { S.fillPicks = on ? S.fillPicks.filter(i => i !== p.id) : S.fillPicks.concat(p.id); save(); renderFillPick(); };
        tiles.appendChild(t);
      });
      box.appendChild(tiles);
    }
    const acts = document.createElement("div"); acts.className = "po-acts";
    if (list.length) {
      const go = document.createElement("button"); go.type = "button"; go.className = "btn fillgo"; go.textContent = "Fill with selected groundcover"; go.disabled = !S.fillPicks.length;
      go.onclick = () => fillWith(S.fillPicks.slice()); acts.appendChild(go);
    }
    const un = document.createElement("button"); un.type = "button"; un.className = "btn small"; un.textContent = "Remove all groundcover"; un.title = "Takes all groundcover back out of the bed"; un.disabled = !S.placements.some(isGroundcover);
    un.onclick = () => { stripFiller(); refresh(); toast("Groundcover removed from the bed."); }; acts.appendChild(un);
    const cn = document.createElement("button"); cn.type = "button"; cn.className = "btn small"; cn.textContent = "Cancel"; cn.onclick = () => { optMode = "idle"; renderFillPick(); }; acts.appendChild(cn);
    box.appendChild(acts);
  }
  function renderCompFill(box) {
    const { all } = compCandidates();
    const lab = document.createElement("div"); lab.className = "fp-lab fp-full";
    lab.innerHTML = `<span class="fp-hint">For each empty spot I look at the nearest plant and tuck in one of its researched companions that fits there: short ones toward the front, tall ones toward the back, and only in light that suits it. Any groundcover filler is cleared first; you can add it back afterward. Click a plant to leave it out.</span>`;
    box.appendChild(lab);
    if (!all.length) {
      const e = document.createElement("span"); e.className = "fp-lab"; e.textContent = "None of the plants in your bed have researched companions that match your step 2 choices yet.";
      box.appendChild(e);
    } else {
      const tiles = document.createElement("div"); tiles.className = "fp-tiles";
      all.forEach(p => {
        const on = !S.compSkip.includes(p.id), t = document.createElement("div"); t.className = "fp-tile" + (on ? " on" : ""); t.title = p.latin + ": " + Ch.heightText(p);
        t.innerHTML = `<img src="${imgSrc(p.id)}" alt=""><div class="fp-tn">${on ? "✓ " : ""}${esc(p.name)}${icons(p)}</div><small>${Ch.heightText(p)}</small>`;
        t.onclick = () => { S.compSkip = on ? S.compSkip.concat(p.id) : S.compSkip.filter(i => i !== p.id); save(); renderFillPick(); };
        tiles.appendChild(t);
      });
      box.appendChild(tiles);
    }
    const acts = document.createElement("div"); acts.className = "po-acts";
    const go = document.createElement("button"); go.type = "button"; go.className = "btn fillgo"; go.textContent = "Fill with companions"; go.disabled = !all.some(p => !S.compSkip.includes(p.id));
    go.onclick = fillCompanions; acts.appendChild(go);
    const cn = document.createElement("button"); cn.type = "button"; cn.className = "btn small"; cn.textContent = "Cancel"; cn.onclick = () => { optMode = "idle"; renderFillPick(); }; acts.appendChild(cn);
    box.appendChild(acts);
  }
  $("#btnFill").addEventListener("click", () => {
    if (!S.placements.length) { toast("Add some plants to the bed first."); return; }
    optMode = "fill"; clearSel(); objSel = -1; renderPlan();
  });
  $("#btnUndo").addEventListener("click", undo);
  $("#btnRedo").addEventListener("click", redo);
  $("#btnObj").addEventListener("click", e => { e.stopPropagation(); if (document.querySelector(".objmenu")) { closePlantMenu(); return; } openObjPicker(); });
  $("#btnPaint").addEventListener("click", () => { paint = paint ? null : { brush: sunBase() === "shade" ? "full" : "shade", size: 2 }; objArmed = null; pathDraw = null; armed = null; clearSel(); objSel = -1; renderPaintBar(); renderPlan(); });
  $("#chkSun").addEventListener("change", e => { S.showSun = e.target.checked; renderPlanOnly(); save(); });
  $("#freeView").addEventListener("change", e => { S.freeView = e.target.value; rebuildBed(); refresh(); });
  $("#btnDraw").addEventListener("click", startDraw);
  function doArrange() { relayout(true); refresh(); toast("New arrangement. Click Re-arrange again for another."); }
  function doSuggest() {
    const sel = selected(); if (!sel.length) { toast("Choose some plants first."); return; }
    const q = Geo.suggestQuantities(plantBed(), sel); let first = true;
    for (let pass = 0; pass < 8; pass++) {
      relayout(first, sel.map(p => ({ plant: p, n: q[p.id] }))); first = false;
      const ids = Object.keys(lastUnplaced); if (!ids.length) break;
      let changed = false;
      ids.forEach(id => { const cut = Math.min(lastUnplaced[id], q[id] - 1); if (cut > 0) { q[id] -= cut; changed = true; } });
      if (!changed) break;
    }
    refresh();
    toast("Quantities set to fill the bed. Use + and − to adjust.");
  }
  // clicking a tool explains it in the options bar first; nothing changes until you confirm
  $("#btnArrange").addEventListener("click", () => {
    if (!S.placements.some(p => !p.c)) { toast("Add some plants to the bed first."); return; }
    optMode = "arrange"; clearSel(); renderPlan();
  });
  $("#btnSuggest").addEventListener("click", () => {
    if (!selected().length) { toast("Choose some plants first."); return; }
    optMode = "suggest"; clearSel(); renderPlan();
  });
  function doClear() { S.placements = []; S.waiting = {}; selIdx = -1; notice = ""; noFit = []; refresh(); toast("Bed cleared."); }
  $("#btnClear").addEventListener("click", () => { if (!S.placements.length) { toast("The bed is already empty."); return; } optMode = "clear"; clearSel(); renderPlan(); });
  $("#btnReset").addEventListener("click", () => { optMode = "reset"; clearSel(); renderPlan(); $("#planCard").scrollIntoView({ behavior: "smooth", block: "start" }); });
  // Build the guide PDF; returns the jsPDF document
  function buildPdf() {
    const sel = selected();
    return window.PDFExport.make({ plants: sel, bed, placements: S.placements, waiting: Object.assign({}, S.waiting || {}), byId, name: gardenName(), prefs: S.prefs,
      objects: S.objects, north: S.north || 0, sun: sunActive() ? { res: S.sun.res, zoneAt, zones: zonesPresent() } : null }, (f, m) => { const bar = $("#busyBar"), txt = $("#busyText"); bar.style.width = Math.round(f * 100) + "%"; txt.textContent = m; });
  }
  $("#btnPdf").addEventListener("click", () => {
    if (!S.placements.length) { toast("Add some plants to the bed first."); return; }
    const busy = $("#busy"), bar = $("#busyBar"), txt = $("#busyText"); busy.classList.add("on"); bar.style.width = "3%";
    setTimeout(() => {
      try {
        const doc = buildPdf();
        bar.style.width = "100%"; txt.textContent = "Saving…";
        const fname = fileDate() + " " + safeFile(gardenName()) + ".pdf";
        doc.save(fname);
        setTimeout(() => { busy.classList.remove("on"); toast("Saved \u201c" + fname + "\u201d to your Downloads folder.", 4000); }, 400);
      } catch (err) { console.error(err); busy.classList.remove("on"); toast("Sorry, the PDF could not be made: " + err.message, 6000); }
    }, 60);
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
    if (e.key === "Escape") { armed = null; objArmed = null; pathDraw = null; objSel = -1; closePlantMenu(); if (paint) { paint = null; renderPaintBar(); } clearSel(); renderPlan(); }
  });

  function init(fresh) {
    normalizeExtras(); objSel = -1; objArmed = null; pathDraw = null; paint = null; renderPaintBar();
    if (fresh) {
      S = S || freshState();
      bed = Geo.buildBed(S); attachExtras();
      const items = Object.keys(DEFAULT_COUNTS).map(id => ({ plant: byId[id], n: DEFAULT_COUNTS[id] }));
      relayout(false, items);
    } else { bed = Geo.buildBed(S); attachExtras(); }
    armed = null; selIdx = -1; hoverId = null;
    document.querySelectorAll("#bloomFilter button").forEach(x => x.classList.toggle("on", x.dataset.f === S.bloomFilter));
    $("#bloomSort").value = S.bloomSort || "start"; $("#q").value = S.filter.q || ""; $("#fHeight").value = S.filter.height || ""; $("#fMonth").value = S.filter.month || "";
    renderName();
    fullRender();
  }


  // ---------- magnifier + big picture ----------
  (function () {
    const mag = document.createElement("button"); mag.className = "magbtn"; mag.type = "button"; mag.setAttribute("aria-label", "Enlarge photo");
    mag.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21M10.5 7.5v6M7.5 10.5h6"/></svg>';
    document.body.appendChild(mag);
    const lb = document.createElement("div"); lb.className = "lightbox";
    lb.innerHTML = '<figure><img alt=""><figcaption></figcaption></figure><button class="lbx" type="button" aria-label="Close">×</button>';
    document.body.appendChild(lb);
    let cur = null, hideT = 0;
    const idOf = src => Object.keys(window.PHOTOS).find(k => window.PHOTOS[k] === src);
    const zoomable = el => el && el.tagName === "IMG" && el.closest("#lib, #bloomRows, #ochart, #shop, #fillPick") && !el.closest(".comp") && window.PHOTOS && idOf(el.src);
    function showMag(img) {
      clearTimeout(hideT); cur = img; const r = img.getBoundingClientRect();
      mag.style.left = (r.right - 24) + "px"; mag.style.top = (r.top + 4) + "px"; mag.classList.add("on");
    }
    function hideMag() { hideT = setTimeout(() => { mag.classList.remove("on"); cur = null; }, 120); }
    function open(img) {
      const id = idOf(img.src), p = byId[id]; if (!p) return;
      lb.querySelector("img").src = img.src; lb.querySelector("figcaption").textContent = p.name + " · " + p.latin;
      lb.classList.add("on");
    }
    function close() { lb.classList.remove("on"); }
    document.addEventListener("mouseover", e => { if (zoomable(e.target)) showMag(e.target); else if (e.target !== mag && !mag.contains(e.target)) { if (cur) hideMag(); } });
    mag.addEventListener("mouseenter", () => clearTimeout(hideT)); mag.addEventListener("mouseleave", hideMag);
    mag.addEventListener("click", e => { e.stopPropagation(); if (cur) open(cur); });
    document.addEventListener("click", e => { if (zoomable(e.target)) { e.stopPropagation(); e.preventDefault(); open(e.target); } }, true);
    lb.addEventListener("click", close);
    document.addEventListener("keydown", e => { if (e.key === "Escape" && lb.classList.contains("on")) { close(); e.stopPropagation(); } }, true);
    window.addEventListener("scroll", () => { mag.classList.remove("on"); }, true);
  })();
  const saved = load();
  if (saved && saved.placements && saved.shape && saved.placements.every(p => byId[p.id])) { S = Object.assign(freshState(), saved); S.prefs = Object.assign(freshState().prefs, saved.prefs || {}); S.waiting = cleanWaiting(S.waiting); migratePrefs(saved.prefs); init(false); }
  else { S = freshState(); init(true); }
  window.__app = { get S() { return S; }, get bed() { return bed; } };
})();
