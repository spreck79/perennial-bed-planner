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

  let S, bed, selIdx = -1, extraSel = [], armed = null, hoverId = null, notice = "", noFit = [], lastUnplaced = {}; noFit = [];

  function freshState() {
    return { shape: "rect", dims: { w: 16, d: 6 }, freePoly: null, freeView: "border", placements: [], seed: 7, fill: true, view: "codes",
      filter: { q: "", height: "", month: "" }, bloomFilter: "sel", bloomSort: "start",
      name: "", prefs: { sun: ["full", "part", "shade"], origin: ["nat", "gar"], kinds: ["clump", "fern", "grass", "mat"], toxic: true, daisy: true } };
  }
  function load() { try { const t = localStorage.getItem(LS); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
  let saveT = 0;
  function save() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} }, 200); }
  function toast(msg, ms) { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), ms || 2600); }

  function counts(real) { const c = {}; S.placements.forEach(p => { if (real && p.c) return; c[p.id] = (c[p.id] || 0) + 1; }); return c; }
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
  function stripFiller() { S.placements = S.placements.filter(p => !isGroundcover(p)); selIdx = -1; }
  function selected() { const c = counts(); return PL.filter(p => c[p.id] > 0); }
  const defaultQty = p => (p.spacing >= 24 ? 1 : p.spacing >= 15 ? 3 : 5);

  // ---------- layout actions ----------
  function relayout(seedBump, items) {
    const c = counts(true);
    items = items || PL.filter(p => c[p.id] > 0).map(p => ({ plant: p, n: c[p.id] }));
    if (seedBump) S.seed = (S.seed * 7 + 13) % 100000;
    if (!items.length) { S.placements = []; notice = ""; noFit = []; lastUnplaced = {}; return; }
    // try several arrangements and keep the one that fits the most plants
    let r = null, seed = S.seed;
    for (let t = 0; t < 8; t++) {
      const cand = Geo.autoLayout(bed, items, seed, { fill: false }), miss = Object.keys(cand.unplaced).reduce((s, k) => s + cand.unplaced[k], 0);
      if (!r || miss < r.miss) { r = cand; r.miss = miss; r.seed = seed; }
      if (!miss) break;
      seed = (seed * 31 + 17) % 100000;
    }
    S.seed = r.seed;
    S.placements = r.placements; selIdx = -1;
    lastUnplaced = r.unplaced;
    const missing = Object.keys(r.unplaced).reduce((s, k) => s + r.unplaced[k], 0);
    notice = missing ? `${missing} plant${missing > 1 ? "s" : ""} didn't fit (${Object.keys(r.unplaced).map(k => byId[k].name).join(", ")}). Try a bigger bed or fewer plants.` : ""; noFit = missing ? Object.keys(r.unplaced) : [];
  }
  function rebuildBed(keepLayout) {
    bed = Geo.buildBed(S);
    if (!keepLayout) relayout(false);
  }
  function addMany(id, n) {
    let added = 0;
    for (let i = 0; i < n; i++) if (addOne(id, true)) added++;
    if (added < n) notice = `Only ${added} of ${n} ${byId[id].name} fit. The bed is getting full.`, noFit = [id];
    return added;
  }
  function addOne(id, quiet) {
    S.placements = S.placements.filter(q => !q.c);
    const sel = selected(); if (!sel.some(p => p.id === id)) sel.push(byId[id]);
    const t = Geo.depthTargets(sel);
    const p = Geo.placeOne(bed, byId, S.placements, id, t, 0);
    if (p) S.placements.push(p);
    recarpet();
    if (!p) { if (!quiet) { notice = `No room left for another ${byId[id].name}.`; noFit = [id]; } return false; }
    if (!quiet) notice = ""; noFit = []; return true;
  }
  function removeOne(id) {
    for (let i = S.placements.length - 1; i >= 0; i--) if (S.placements[i].id === id && !S.placements[i].c) { S.placements.splice(i, 1); selIdx = -1; recarpet(); return; }
  }
  function removePlant(id) { S.placements = S.placements.filter(p => p.id !== id); selIdx = -1; if (armed === id) armed = null; recarpet(); }
  function togglePlant(id) {
    notice = ""; noFit = [];
    if (counts()[id] > 0) removePlant(id); else addMany(id, defaultQty(byId[id]));
    refresh();
  }
  function setQty(id, d) {
    notice = ""; noFit = [];
    if (d > 0) addOne(id); else if (counts()[id] > 0) removeOne(id);
    refresh();
  }

  // ---------- library ----------
  const KINDS = [["all", "All"], ["clump", "Flowers"], ["fern", "Ferns"], ["grass", "Grasses & sedges"], ["mat", "Groundcovers"]];
  function renderShapesPanel() {
    const box = $("#shapes"); box.innerHTML = "";
    Object.keys(Geo.SHAPES).forEach(k => {
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
    if (S.shape === "free") { const bb = bed.bb; const d = document.createElement("div"); d.className = "hint"; d.style.gridColumn = "1 / -1"; d.textContent = `Outline is about ${bb.w.toFixed(1)} ft by ${bb.h.toFixed(1)} ft, ${Math.round(bed.area)} sq ft.`; box.appendChild(d); }
  }
  function startDraw() {
    armed = null; selIdx = -1;
    $("#planCard").scrollIntoView({ behavior: "smooth", block: "start" });
    window.Plan.startDraw({
      onDone: pts => {
        const bb = Geo.bbox(pts); S.freePoly = pts.map(q => [q[0] - bb.x0, q[1] - bb.y0]); S.shape = "free"; S.dims = {};
        rebuildBed(); fullRender(); toast("Shape saved. Your plants were re-arranged to fit.");
      },
      onCancel: () => { if (S.shape === "free" && !S.freePoly) { S.shape = "rect"; S.dims = { w: 16, d: 6 }; rebuildBed(); } fullRender(); }
    });
  }

  // does a plant fit the step-2 choices?
  function matchesPrefs(p) {
    const pr = S.prefs;
    if (!p.sun.some(x => pr.sun.includes(x))) return false;
    if (!pr.origin.includes(p.native ? "nat" : "gar")) return false;
    if (!pr.kinds.includes(p.kind)) return false;
    if (p.toxic && !pr.toxic) return false;
    if (p.fam === "daisy" && pr.daisy === false) return false;
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
  function renderChips() {
    const pr = S.prefs;
    const multi = (box, opts, key) => {
      const el = $(box); el.innerHTML = "";
      opts.forEach(([k, l]) => {
        const b = document.createElement("button"); b.type = "button"; b.className = "chip" + (key === "origin" ? " o-" + k : key === "kinds" ? " o-kind" : key === "sun" ? " o-sun" : "") + (pr[key].includes(k) ? " on" : ""); b.textContent = (pr[key].includes(k) ? "✓ " : "") + l;
        b.onclick = () => {
          const on = pr[key].includes(k);
          if (on && pr[key].length === 1) { toast("Keep at least one choice here."); return; }
          pr[key] = on ? pr[key].filter(x => x !== k) : pr[key].concat(k);
          renderChips(); renderLibrary(); renderBloom(); save();
        };
        el.appendChild(b);
      });
    };
    multi("#pSun", SUNS, "sun"); multi("#pOrigin", ORIGINS, "origin"); multi("#pKind", KINDS.filter(k => k[0] !== "all"), "kinds");
    const t = $("#pTox"); t.innerHTML = "";
    { const b = document.createElement("button"); b.type = "button"; b.className = "chip tox" + (pr.toxic ? " on" : ""); b.textContent = (pr.toxic ? "✓ " : "") + "Also show toxic plants";
      b.onclick = () => { pr.toxic = !pr.toxic; renderChips(); renderLibrary(); renderBloom(); save(); };
      t.appendChild(b); }
    const dz = $("#pDaisy"); dz.innerHTML = "";
    { const b = document.createElement("button"); b.type = "button"; b.className = "chip daisy" + (pr.daisy !== false ? " on" : ""); b.textContent = (pr.daisy !== false ? "✓ " : "") + "Also show daisy-family plants ✿";
      b.onclick = () => { pr.daisy = pr.daisy === false; renderChips(); renderLibrary(); renderBloom(); save(); };
      dz.appendChild(b); }
    $("#daisyHint").textContent = pr.daisy === false ? "" : "Daisy-family plants (marked \u273F) are related to ragweed. Most are pollinated by insects, so they shed far less pollen than ragweed, but people with ragweed allergies can still react, often to handling them. If allergies are a concern, skip them or check with a doctor.";
    { const th = $("#toxHint"); th.textContent = ""; if (pr.toxic) { th.append("Toxic plants are marked with a red Toxic tag here and in the PDF guide. Keep them away from pets and children who chew on plants. These labels are my own starting point, so check the "); const ln = document.createElement("a"); ln.href = "https://www.aspca.org/pet-care/animal-poison-control/toxic-and-non-toxic-plants"; ln.target = "_blank"; ln.rel = "noopener"; ln.textContent = "ASPCA toxic and non-toxic plant list"; th.append(ln, " before you buy. For a person who has eaten a plant, call Poison Control at 1-800-222-1222 (free, 24 hours; online at "); const pl = document.createElement("a"); pl.href = "https://poisonhelp.org/"; pl.target = "_blank"; pl.rel = "noopener"; pl.textContent = "poisonhelp.org"; th.append(pl, "). If someone is unconscious, having trouble breathing or having a seizure, call 911 first."); } }
  }
  function renderLibrary() {
    const c = counts(), list = PL.filter(passes).sort((a, b) => a.name.localeCompare(b.name));
    const sel = Object.keys(c).length;
    const nMatch = PL.filter(matchesPrefs).length, outside = selected().filter(p => !matchesPrefs(p)).length;
    $("#libLede").textContent = `${nMatch} of ${PL.length} plants fit your garden, ${sel} chosen so far. Click a plant to add or remove it. ◆ marks a garden favorite (not native). ✿ marks the daisy family (related to ragweed).` + (outside ? ` ${outside} chosen plant${outside > 1 ? "s don't" : " doesn't"} fit your step 2 choices (marked).` : "");
    const box = $("#lib"); box.style.minHeight = box.offsetHeight + "px"; box.innerHTML = "";
    requestAnimationFrame(() => { box.style.minHeight = ""; });
    if (!list.length) { box.innerHTML = '<div class="empty">No plants match those filters.</div>'; return; }
    list.forEach(p => {
      const on = c[p.id] > 0, d = document.createElement("div");
      d.className = "pcard" + (on ? " on" : ""); d.dataset.id = p.id;
      d.innerHTML = `<img src="${imgSrc(p.id)}" alt=""><div><div class="nm">${esc(p.name)}${p.native ? "" : '&nbsp;<span class="gf" title="Garden favorite, not native">◆</span>'}${p.fam === "daisy" ? '&nbsp;<span class="df" title="Daisy family, related to ragweed">✿</span>' : ""}</div><div class="meta"><span class="tag ${p.native ? "nat" : "gar"}">${p.native ? "Native" : "Garden"}</span>${p.toxic ? '<span class="tag tox" title="' + esc(window.toxLabel(p)) + '">Toxic</span>' : ""}${p.fam ? '<span class="tag daisy" title="Daisy family, a relative of ragweed">Daisy family</span>' : ""}${!matchesPrefs(p) ? '<span class="tag off" title="Doesn\'t match your step 2 choices">Outside your choices</span>' : ""}${Ch.heightText(p)} · ${esc(Ch.bloomText(p))}${on ? " · <b>×" + c[p.id] + "</b>" : ""}</div></div><div class="tick">${on ? "✓" : ""}</div>`;
      d.onclick = () => togglePlant(p.id);
      d.onmouseenter = () => setHover(p.id); d.onmouseleave = () => setHover(null);
      box.appendChild(d);
    });
  }

  // ---------- bloom chart ----------
  function renderBloom() {
    const c = counts();
    $("#monthsHead").innerHTML = Ch.MONTHS.map(m => `<div>${m}</div>`).join("");
    let list = PL.slice();
    if (S.bloomFilter === "sel") list = list.filter(p => c[p.id] > 0);
    else list = list.filter(p => matchesPrefs(p) || c[p.id] > 0);
    const sorters = { start: (a, b) => (a.bloom ? a.bloom[0] : 99) - (b.bloom ? b.bloom[0] : 99) || a.name.localeCompare(b.name), name: (a, b) => a.name.localeCompare(b.name), height: (a, b) => Geo.hMean(a) - Geo.hMean(b) };
    list.sort(sorters[S.bloomSort] || sorters.start);
    const box = $("#bloomRows"); box.innerHTML = "";
    if (!list.length) box.innerHTML = '<div class="empty">Nothing chosen yet. Switch to "All plants" and tick some rows.</div>';
    list.forEach(p => {
      const on = c[p.id] > 0, r = document.createElement("div");
      r.className = "brow" + (on ? "" : " off") + (p.toxic ? " tox" : ""); r.dataset.id = p.id;
      let bar;
      if (p.bloom) { const a = Ch.pct(p.bloom[0]), b = Ch.pct(p.bloom[1]); bar = `<div class="bar${p.toxic ? " toxbar" : ""}" style="left:${a}%;width:${b - a}%;background:${p.hex}" title="${esc(Ch.bloomText(p))}: ${esc(p.color)}"></div>`; }
      else bar = `<div class="bar leaf" style="left:2%;width:96%" title="Foliage plant, green all season"></div>`;
      r.innerHTML = `<div class="lab"><div class="cb">${on ? "✓" : ""}</div><img src="${imgSrc(p.id)}" alt=""><div class="nm">${esc(p.name)}${p.native ? "" : '&nbsp;<span class="gf" title="Garden favorite, not native">◆</span>'}${p.fam === "daisy" ? '&nbsp;<span class="df" title="Daisy family, related to ragweed">✿</span>' : ""}${p.toxic ? '<span class="toxpill" title="' + esc(window.toxLabel(p)) + '">TOXIC</span>' : ""}<small>${on ? "×" + c[p.id] + " · " : ""}${esc(Ch.bloomText(p))}</small></div></div><div class="track">${bar}</div>`;
      r.onclick = () => togglePlant(p.id);
      r.onmouseenter = () => setHover(p.id); r.onmouseleave = () => setHover(null);
      box.appendChild(r);
    });
    // coverage of chosen plants
    const cov = Ch.bloomCounts(selected()), mx = Math.max(1, ...cov);
    $("#cover").innerHTML = cov.map(n => `<div class="covcell" style="background:${n === 0 ? "#D9A09A" : Ch.shade("#6E9A5B", 1.25 - 0.55 * (n / mx))}">${n}</div>`).join("");
    const gaps = Ch.MONTHS.filter((m, i) => cov[i] === 0 && i < 7);
    $("#coverNote").textContent = !selected().length ? "" : gaps.length ? `Gap: nothing chosen is in bloom in ${gaps.join(", ")}. Look for plants with a bar there, or lean on the foliage plants.` : "Something is in bloom in every month from April to October.";
  }

  // ---------- small to big chart ----------
  function renderOrder() {
    const sel = selected().sort((a, b) => Geo.hMean(a) - Geo.hMean(b) || a.name.localeCompare(b.name));
    const host = $("#ochart"); host.innerHTML = "";
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
      if (ri === 0) { const t = document.createElement("div"); t.className = "otitle"; t.innerHTML = "SIDE VIEW <span>(heights to scale)</span> <em>◆ = garden favorite, not native</em> <em class='dk'>✿ = daisy family</em>"; rw.appendChild(t); }
      const grid = document.createElement("div"); grid.className = "gridlines"; grid.style.height = plotH + "px";
      for (let ft = 1; ft * 12 * k <= tall + 2; ft++) { const l = document.createElement("div"); l.style.top = (plotH - ft * 12 * k) + "px"; l.innerHTML = `<span>${ft} ft</span>`; grid.appendChild(l); }
      rw.appendChild(grid);
      const ground = document.createElement("div"); ground.className = "oground"; ground.style.top = (plotH - 1) + "px"; rw.appendChild(ground);
      const cols = document.createElement("div"); cols.className = "orow-cols";
      list.forEach(p => {
        const w = Math.max(14, p.spacing * k), H = Math.max(14, p.hHi * k), col = document.createElement("div");
        col.className = "ocol" + (p.toxic ? " tox" : ""); col.dataset.id = p.id; col.style.width = (colW(p) - 6) + "px";
        col.innerHTML = (p.toxic ? `<div class="toxflag" style="top:${Math.max(0, plotH - H - 24)}px" title="${esc(window.toxLabel(p))}">TOXIC</div>` : "")
          + `<div class="oplot" style="height:${plotH}px"><div class="oh-top" style="top:${Math.max(0, plotH - H - 17)}px">${Ch.heightText(p)}</div>${Ch.silSVG(p, k)}</div>`
          + `<div class="dim" style="width:${w}px"><i></i><b>${p.spacing} in apart</b></div>`
          + `<img src="${imgSrc(p.id)}" alt=""><div class="on">${esc(p.name)}${p.native ? "" : '&nbsp;<span class="gf" title="Garden favorite, not native">◆</span>'}${p.fam === "daisy" ? '&nbsp;<span class="df" title="Daisy family, related to ragweed">✿</span>' : ""}</div>`
          + (p.toxic ? `<div class="toxwho">${esc(window.toxLabel(p).replace(/^Toxic to /, "to "))}</div>` : "");
        if (p.toxic) col.style.setProperty("--toxtop", Math.max(0, plotH - H - 24) + "px");
        col.onclick = () => { armed = p.id; selIdx = -1; refreshPlanOnly(); toast(`Placing ${p.name}: click the bed. Press Esc to stop.`); };
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
      sel.map(p => `<tr data-id="${p.id}"><td><img src="${imgSrc(p.id)}" alt=""><b>${esc(p.name)}</b>${p.native ? "" : '&nbsp;<span class="gf" title="Garden favorite, not native">◆</span>'}${p.fam === "daisy" ? '&nbsp;<span class="df" title="Daisy family, related to ragweed">✿</span>' : ""} <span class="tag ${p.native ? "nat" : "gar"}">${p.native ? "Native" : "Garden"}</span></td>
        <td><div class="stepper"><button type="button" data-d="-1">−</button><span>${c[p.id]}</span><button type="button" data-d="1">+</button></div></td>
        <td>${p.spacing} in</td><td>${Ch.heightText(p)}</td><td>${esc(Ch.bloomText(p))}</td></tr>`).join("") +
      `</tbody><tfoot><tr><td>Total</td><td>${S.placements.length} plants</td><td colspan="3"></td></tr></tfoot>`;
    t.querySelectorAll("tr[data-id]").forEach(tr => {
      const id = tr.dataset.id;
      tr.querySelectorAll("button").forEach(b => b.onclick = () => setQty(id, +b.dataset.d));
      tr.onmouseenter = () => setHover(id); tr.onmouseleave = () => setHover(null);
    });
  }

  // ---------- plan ----------
  function renderPlan() {
    if (selIdx < 0) extraSel = [];
    window.Plan.render({ bed, placements: S.placements, byId, view: S.view, selIdx, selAll: selAll(), hoverId, armed });
    const cv = S.placements.reduce((s, p) => s + Math.PI * Math.pow(byId[p.id].spacing / 24, 2), 0) / (bed.area || 1);
    const bb = bed.bb, kinds = Object.keys(counts()).length;
    $("#stats").innerHTML = `<span><b>${bed.label}</b> · ${bb.w.toFixed(1).replace(/\.0$/, "")} × ${bb.h.toFixed(1).replace(/\.0$/, "")} ft</span><span><b>${Math.round(bed.area)}</b> sq ft</span><span><b>${S.placements.length}</b> plants, ${kinds} kinds</span><span>Full-grown coverage <b>${Math.round(cv * 100)}%</b></span>`;
    const bad = window.Plan.lastBad || 0;
    const msgs = [];
    if (notice) msgs.push(notice);
    const n = document.querySelector("#plan .pl.bad") ? document.querySelectorAll("#plan .pl.bad").length : 0;
    if (n) msgs.push(`${n} plants are drawn with a dashed red edge because they are closer together than their spacing allows. Drag them apart, or remove one.`);
    const box = $("#notice"); box.style.display = msgs.length ? "block" : "none"; box.innerHTML = msgs.map(esc).join("<br>");
    if (notice && noFit.length) {
      const names = noFit.map(i => byId[i].name).join(", ");
      box.insertAdjacentHTML("beforeend", `<div class="askrow"><b>Would you like me to remove ${esc(names)} from the plan?</b><div class="askbtns"><button class="btn small" id="nfYes" type="button">Yes</button> <button class="btn small" id="nfNo" type="button">No</button></div></div>`);
      $("#nfYes").onclick = () => { const ids = noFit.slice(); notice = ""; noFit = []; ids.forEach(removePlant); refresh(); toast("Removed " + names + "."); };
      $("#nfNo").onclick = () => { notice = ""; noFit = []; refreshPlanOnly(); };
    }
    renderFillPick();
    const a = $("#armed");
    if (armed) { a.classList.add("on"); a.innerHTML = `Placing <b>${esc(byId[armed].name)}</b>: click the bed <button class="btn small" id="armOff" type="button">Stop</button>`; $("#armOff").onclick = () => { armed = null; refreshPlanOnly(); }; }
    else a.classList.remove("on");
    document.querySelectorAll("#viewSeg button").forEach(b => b.classList.toggle("on", b.dataset.v === S.view));
  }
  function refreshPlanOnly() { renderPlan(); }
  function setHover(id) {
    hoverId = id;
    document.querySelectorAll(".brow,.ocol,.pcard").forEach(e => e.classList.toggle("hl", !!id && e.dataset.id === id));
    window.Plan.setHover(id);
  }
  function refresh() { renderLibrary(); renderBloom(); renderOrder(); renderShop(); renderPlan(); save(); }
  function fullRender() { renderShapesPanel(); renderDims(); renderChips(); refresh(); }

  // ---------- plan callbacks ----------
  window.Plan.init($("#plan"), {
    onSelect(i, add) {
      if (i < 0) { clearSel(); }
      else if (add) {
        const cur = selAll();
        if (cur.includes(i)) { const rest = cur.filter(x => x !== i); selIdx = rest.length ? rest[rest.length - 1] : -1; extraSel = rest.slice(0, -1); }
        else { selIdx = i; extraSel = cur; }
      } else if (!selAll().includes(i) || selAll().length === 1) { selIdx = i; extraSel = []; }
      else { selIdx = i; extraSel = selAll().filter(x => x !== i); }   // clicking inside a group keeps the group
      if (selIdx >= 0) optMode = "idle";
      renderPlan();
    },
    onMoved() { save(); renderPlan(); },
    onPlace(x, y) {
      if (!armed) return;
      if (!Geo.pip(bed.poly, x, y)) { toast("Click inside the bed."); return; }
      S.placements.push({ id: armed, x, y }); notice = ""; noFit = []; refresh();
    },
    onHover(id) { if (id !== hoverId) setHover(id); }
  });

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
        S = Object.assign(freshState(), plan); S.prefs = Object.assign(freshState().prefs, plan.prefs || {});
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
  $("#bloomFilter").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; S.bloomFilter = b.dataset.f; document.querySelectorAll("#bloomFilter button").forEach(x => x.classList.toggle("on", x === b)); renderBloom(); save(); });
  $("#bloomSort").addEventListener("change", e => { S.bloomSort = e.target.value; renderBloom(); save(); });
  // groundcovers to offer: low plants that suit the step-2 choices (sun, origin, safety)
  function groundcovers() {
    const pr = S.prefs, low = p => p.filler || (p.kind === "mat" && p.hHi <= 12);
    return PL.filter(p => low(p) && p.sun.some(x => pr.sun.includes(x)) && pr.origin.includes(p.native ? "nat" : "gar") && !(p.toxic && !pr.toxic) && !(p.fam === "daisy" && pr.daisy === false))
      .sort((a, b) => (b.filler ? 1 : 0) - (a.filler ? 1 : 0) || a.name.localeCompare(b.name));
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
      t.innerHTML = `<img src="${imgSrc(id)}" alt=""><div class="fp-tn">${esc(pl.name)}${pl.native ? "" : '&nbsp;<span class="gf" title="Garden favorite, not native">◆</span>'}${pl.fam === "daisy" ? '&nbsp;<span class="df" title="Daisy family, related to ragweed">✿</span>' : ""}</div><small>${groups[id].length} of ${cnt[id] || 0} selected${tox ? ' · <b class="toxtxt">toxic</b>' : ""}</small>`;
      t.onclick = () => { if (idxs.length === groups[id].length) { clearSel(); } else { const rest = idxs.filter(i => S.placements[i].id !== id); selIdx = rest[rest.length - 1]; extraSel = rest.slice(0, -1); } renderPlan(); };
      tiles.appendChild(t);
    });
    box.appendChild(tiles);
    if (idxs.length === 1) renderCompanions(tiles, box, idxs[0]);
    const acts = document.createElement("div"); acts.className = "po-acts";
    const mk = (t, f, title) => { const b = document.createElement("button"); b.type = "button"; b.className = "btn small"; b.textContent = t; if (title) b.title = title; b.onclick = f; acts.appendChild(b); return b; };
    mk("Duplicate selected", () => { const objs = idxs.map(i => S.placements[i]), list = objs.map(o => o.id); clearSel(); notice = ""; noFit = []; list.forEach(id => addOne(id, true)); const keep = objs.map(o => S.placements.indexOf(o)).filter(i => i >= 0); selIdx = keep.length ? keep[0] : -1; extraSel = keep.slice(1); refresh(); }, "Adds one more copy of each selected plant in a good spot");
    mk("Remove selected", () => { idxs.slice().sort((a, b) => b - a).forEach(i => S.placements.splice(i, 1)); clearSel(); refresh(); }, "Takes out only the selected plants");
    mk("Remove all similar", () => { clearSel(); ids.forEach(removePlant); refresh(); }, "Takes every copy of the selected kinds out of the bed, not just the plants you picked");
    box.appendChild(acts);
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
      t.innerHTML = `<img src="${imgSrc(c.id)}" alt=""><div class="fp-tn">${esc(pl.name)}${pl.native ? "" : '&nbsp;<span class="gf">◆</span>'}${pl.fam === "daisy" ? '&nbsp;<span class="df">✿</span>' : ""}</div><small>${cnt[c.id] ? cnt[c.id] + " in bed" : "+ add"}</small>`;
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
      const sel = selected(), q = Geo.suggestQuantities(bed, sel), total = sel.reduce((n, p) => n + (q[p.id] || 0), 0);
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
        "The plant list on the left stays as it is, so you can add plants again afterward."
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
    if (selAll().length) { renderPlantOptions(box); return; }
    if (optMode === "suggest" || optMode === "arrange" || optMode === "clear" || optMode === "reset") { renderConfirm(box); return; }
    if (optMode !== "fill") {
      const lab = document.createElement("span"); lab.className = "fp-lab idle"; lab.textContent = "Options bar: click Suggest quantities, Re-arrange, Clear bed or Fill gaps with groundcover above, or click a plant on the bed, and its options will show up here.";
      box.appendChild(lab); return;
    }
    const list = groundcovers();
    S.fillPicks = (S.fillPicks || []).filter(id => list.some(p => p.id === id));
    if (!list.length) {
      const lab = document.createElement("span"); lab.className = "fp-lab"; lab.textContent = "No groundcover matches your garden choices in step 2. Try adding more sun or origin choices.";
      box.appendChild(lab);
    } else {
      const lab = document.createElement("div"); lab.className = "fp-lab fp-full"; lab.innerHTML = "Fill gaps with groundcover <span class=\"fp-hint\">I will tuck low plants into the empty spaces between your plants. Click a name to pick one or more, then confirm. Click a photo to enlarge it.</span>";
      box.appendChild(lab);
      const tiles = document.createElement("div"); tiles.className = "fp-tiles";
      list.forEach(p => {
        const on = S.fillPicks.includes(p.id), t = document.createElement("div"); t.className = "fp-tile" + (on ? " on" : ""); t.title = p.latin + ": " + p.hLo + "–" + p.hHi + " in tall";
        t.innerHTML = `<img src="${imgSrc(p.id)}" alt=""><div class="fp-tn">${on ? "✓ " : ""}${esc(p.name)}${p.native ? "" : '&nbsp;<span class="gf" title="Garden favorite, not native">◆</span>'}${p.fam === "daisy" ? '&nbsp;<span class="df" title="Daisy family, related to ragweed">✿</span>' : ""}</div><small>${p.native ? "native" : "garden"}${p.toxic ? " · toxic" : ""}</small>`;
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
  $("#btnFill").addEventListener("click", () => {
    if (!S.placements.length) { toast("Add some plants to the bed first."); return; }
    optMode = "fill"; selIdx = -1; renderPlan();
  });
  $("#freeView").addEventListener("change", e => { S.freeView = e.target.value; rebuildBed(); refresh(); });
  $("#btnDraw").addEventListener("click", startDraw);
  function doArrange() { relayout(true); refresh(); toast("New arrangement. Click Re-arrange again for another."); }
  function doSuggest() {
    const sel = selected(); if (!sel.length) { toast("Choose some plants first."); return; }
    const q = Geo.suggestQuantities(bed, sel); let first = true;
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
  function doClear() { S.placements = []; selIdx = -1; notice = ""; noFit = []; refresh(); toast("Bed cleared."); }
  $("#btnClear").addEventListener("click", () => { if (!S.placements.length) { toast("The bed is already empty."); return; } optMode = "clear"; clearSel(); renderPlan(); });
  $("#btnReset").addEventListener("click", () => { optMode = "reset"; clearSel(); renderPlan(); $("#planCard").scrollIntoView({ behavior: "smooth", block: "start" }); });
  // Build the guide PDF; returns the jsPDF document
  function buildPdf() {
    const sel = selected();
    return window.PDFExport.make({ plants: sel, bed, placements: S.placements, byId, name: gardenName(), prefs: S.prefs }, (f, m) => { const bar = $("#busyBar"), txt = $("#busyText"); bar.style.width = Math.round(f * 100) + "%"; txt.textContent = m; });
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
    if ((e.key === "Delete" || e.key === "Backspace") && selAll().length) { e.preventDefault(); selAll().sort((a, b) => b - a).forEach(i => S.placements.splice(i, 1)); clearSel(); refresh(); }
    if (e.key === "Escape") { armed = null; clearSel(); renderPlan(); }
  });

  function init(fresh) {
    if (fresh) {
      S = S || freshState();
      bed = Geo.buildBed(S);
      const items = Object.keys(DEFAULT_COUNTS).map(id => ({ plant: byId[id], n: DEFAULT_COUNTS[id] }));
      relayout(false, items);
    } else bed = Geo.buildBed(S);
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
  if (saved && saved.placements && saved.shape && saved.placements.every(p => byId[p.id])) { S = Object.assign(freshState(), saved); S.prefs = Object.assign(freshState().prefs, saved.prefs || {}); init(false); }
  else { S = freshState(); init(true); }
  window.__app = { get S() { return S; }, get bed() { return bed; } };
})();
