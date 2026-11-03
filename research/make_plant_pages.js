#!/usr/bin/env node
// Makes a page for each plant (plants/<id>.html) from the website's own data files, so a plant's page always says
// exactly what the planner says. The page also carries the plant's facts as data (the <script id="plant-data"> block),
// so programs such as Plant Research can read them.
//
//   node make_plant_pages.js sneezeweed        one plant (by id)
//   node make_plant_pages.js --all             every plant
//
// Reads: plants.js, care.js, charts.js, credits.js, sources.js, companions.js, plan.js (the sun wording).
// The large photo is not copied: the page loads photos/<id>.js, the same file the planner uses.
const fs = require("fs"), path = require("path");
const SITE = path.join(__dirname, "..");
const rd = f => fs.readFileSync(path.join(SITE, f), "utf8");
global.window = {};
for (const f of ["plants.js", "care.js", "charts.js", "credits.js", "sources.js", "companions.js"]) eval(rd(f));
// the planner's own sun wording (plan.js needs a page to run, so only this function is taken from it)
const sunSrc = rd("plan.js").match(/function sunNeed\(p\) \{[\s\S]*?\n  \}/)[0];
const sunNeed = eval("(" + sunSrc + ")");
const { PLANTS, Care, Charts, CREDITS, STATUS_SOURCES, COMPANIONS, COMPANION_SOURCES } = window;
const byId = Object.fromEntries(PLANTS.map(p => [p.id, p]));

const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const zoneName = z => Math.floor(z) + (z % 1 ? "b" : "a");
const DEER = { A: "Rarely damaged", B: "Seldom severely damaged", C: "Occasionally severely damaged", D: "Frequently severely damaged" };
const KIND = { clump: "Clump-forming perennial", fern: "Fern", grass: "Grass or sedge", mat: "Low, spreading groundcover", bulb: "Spring bulb" };
const hMean = p => (p.hLo + p.hHi) / 2;
const rowOf = p => hMean(p) <= 14 ? "Front" : hMean(p) <= 28 ? "Middle" : "Back";      // same rule as the PDF guide
const commons = f => "https://commons.wikimedia.org/wiki/File:" + encodeURIComponent(String(f).replace(/ /g, "_"));
const LEAF = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 10C2 5 5 2 10 2c0 5-3 8-8 8Zm0 0 5-5" fill="currentColor" stroke="currentColor" stroke-width=".6"/></svg>';
const ANTLER = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 11V6.2M6 6.2 3.2 2M4.3 3.7 2 4.2M6 6.2 8.8 2M7.7 3.7 10 4.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>';

// the year from April to November, as in the planner's Garden Timeline
const T0 = 4, T1 = 12, pct = v => Math.max(0, Math.min(100, ((v - T0) / (T1 - T0)) * 100));
function yearStrip(p, care) {
  const rows = [];
  const bar = (lab, a, b, color, txt) => rows.push(`<div class="yr-row"><span class="yr-lab">${esc(lab)}</span><span class="yr-track">` +
    `<span class="yr-bar" style="left:${pct(a)}%;width:${Math.max(2.5, pct(b) - pct(a))}%;background:${color}" title="${esc(txt)}"></span></span></div>`);
  if (p.bloom) bar("Bloom", p.bloom[0], p.bloom[1], p.hex, Charts.bloomText(p));
  if (care.prep) bar("Spring prep", care.prep.a, care.prep.b, "#7FA66A", care.prep.sum);
  if (care.cut) bar(care.cat === "fall" ? "Cut back" : "Cut back", care.cut.a, care.cut.b, "#A68C72", care.cut.sum);
  if (care.trim) bar("Trim", care.trim.a, care.trim.b, "#C4A884", care.trim.sum);
  if (care.lift) bar("Dig up", care.lift.a, care.lift.b, "#4F7FB4", "Dig up");
  if (care.replant) bar("Replant", care.replant.a, care.replant.b, "#6F9AC9", "Replant");
  if (care.mulch) bar("Winter mulch", care.mulch.a, care.mulch.b, "#A68C72", "Winter mulch");
  const months = MO.slice(T0 - 1, T1 - 1).map(m => `<span>${m}</span>`).join("");
  return `<div class="yr"><div class="yr-row yr-head"><span class="yr-lab"></span><span class="yr-months">${months}</span></div>${rows.join("")}</div>`;
}

function page(p) {
  const care = Care.careFor(p) || {};
  const cr = CREDITS[p.id] || {};
  const status = STATUS_SOURCES.filter(s => (s.plants || []).includes(p.id));
  const wc = window.winterCare(p);
  const comps = (COMPANIONS[p.id] || []).filter(c => byId[c.id]);
  const tox = window.toxLabel(p);
  const sunTxt = sunNeed(p);
  const zones = p.zones ? `${zoneName(p.zones[0])} to ${zoneName(p.zones[1])}` : null;

  // chips under the name, the same marks the planner uses
  const chips = [
    p.native ? `<span class="chip c-nat">${LEAF} Michigan native</span>` : `<span class="chip c-gar">◆ Garden favorite</span>`,
    p.fam === "daisy" ? `<span class="chip c-daisy">✿ Daisy family</span>` : "",
    (p.deer === "C" || p.deer === "D") ? `<span class="chip c-deer">${ANTLER} Deer ${p.deer === "D" ? "often" : "sometimes"} eat it</span>` : "",
    tox ? `<span class="chip c-tox">! ${esc(tox)}</span>` : "",
    wc ? `<span class="chip c-cold">❄ ${window.isTender(p) ? "Not winter-hardy here" : "Mulch for winter"}</span>` : "",
  ].join("");

  const facts = [
    ["Height", Charts.heightText(p)],
    ["Spacing", (p.clump ? `clumps of ${p.clump}, ` : "") + p.spacing + " in apart (center to center)"],
    ["Place in the bed", rowOf(p) + " row"],
    ["Blooms", p.bloom ? Charts.bloomText(p) : "Grown for its leaves"],
    ["Color", `<span class="sw" style="background:${esc(p.hex)}"></span>${esc(p.color)}`, true],
    ["Light", esc(p.light) + (sunTxt ? `<br><span class="muted">${esc(sunTxt)}</span>` : ""), true],
    ["Soil moisture", p.moisture],
    ["Plant type", KIND[p.kind] + (p.dormant ? " (goes dormant in summer)" : "") + (p.filler ? "; good for filling gaps" : "")],
    ["Hardiness zones", zones ? `${zones}` + (wc ? (window.isTender(p) ? " (not hardy in Michigan zone 6B)" : " (hardy only to 6B: mulch for winter)") : " (hardy in Michigan zone 6B)") : "Not recorded yet"],
    ["Deer", p.deer ? `${DEER[p.deer]} (Rutgers rating ${p.deer})` : "Not rated by Rutgers"],
    ["Toxic", tox ? esc(tox) + (p.toxSrc ? `<br><span class="muted">${esc(p.toxSrc)}</span>` : "") : "Believed non-toxic to people, dogs and cats", true],
    ["Code on the plan", `<span class="code" style="background:${esc(p.hex)};color:${esc(p.txt)}">${esc(p.code)}</span>`, true],
  ].map(([k, v, raw]) => `<tr><th>${k}</th><td>${raw ? v : esc(v)}</td></tr>`).join("");

  const careItems = [
    care.prep && ["Spring prep", care.prep.sum, care.prep.text],
    care.cut && [care.cat === "fall" ? "Cut back" : "Cut back", care.cut.sum, care.cut.text],
    care.trim && ["Optional trim", care.trim.sum, care.trim.text],
    care.divide && ["Divide", care.divideShort, care.divide],
    wc && ["Winter", wc.short, wc.text],
  ].filter(Boolean).map(([k, s, t]) => `<li><b>${esc(k)}</b> <span class="muted">${esc(s || "")}</span><br>${esc(t)}</li>`).join("");

  // good neighbors, grouped by the source sentence that names them
  const groups = [];
  comps.forEach(c => {
    const key = c.why + "|" + c.src.join(",");
    let g = groups.find(x => x.key === key);
    if (!g) groups.push(g = { key, why: c.why, src: c.src, ids: [] });
    g.ids.push(c.id);
  });
  const neighbors = groups.map(g => `<li><div class="nb">${g.ids.map(id => `<span class="nbp"><span class="dot" style="background:${esc(byId[id].hex)}"></span>${esc(byId[id].name)}</span>`).join("")}</div>` +
    `<q>${esc(g.why)}</q> ${g.src.map(i => COMPANION_SOURCES[i]).filter(Boolean).map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join(", ")}</li>`).join("");

  const sources = [
    ...status.map(s => `<li><b>${s.kind === "native" ? "Michigan native" : "Sold in Michigan"}:</b> <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`),
    p.deer ? `<li><b>Deer:</b> <a href="https://njaes.rutgers.edu/deer-resistant-plants/" target="_blank" rel="noopener">Rutgers NJAES deer-resistant plant list</a> <span class="muted">rating ${esc(p.deer)}: ${esc(DEER[p.deer].toLowerCase())}</span></li>` : "",
    tox ? `<li><b>Toxic:</b> ${esc(p.toxSrc || "")}</li>` : "",
    cr.file ? `<li><b>Photo:</b> <a href="${esc(commons(cr.file))}" target="_blank" rel="noopener">${esc(cr.file)}</a> by ${esc(cr.by)}, <a href="${esc(cr.licUrl)}" target="_blank" rel="noopener">${esc(cr.lic)}</a>, Wikimedia Commons</li>` : "",
  ].filter(Boolean).join("");

  // what the page shows, as plain text, so the one-page PDF says exactly the same (plant-page.js draws it)
  const sheet = {
    name: p.name, latin: p.latin, notes: p.notes + (p.fam === "daisy" ? " Daisy family, like ragweed." : ""), hex: p.hex, txt: p.txt, code: p.code,
    marks: [p.native ? ["nat", "Michigan native"] : ["gar", "Garden favorite"], p.fam === "daisy" && ["daisy", "Daisy family"],
      (p.deer === "C" || p.deer === "D") && ["deer", "Deer " + (p.deer === "D" ? "often" : "sometimes") + " eat it"], tox && ["tox", tox],
      wc && ["cold", window.isTender(p) ? "Not winter-hardy here" : "Mulch for winter"]].filter(Boolean),
    facts: [["Height", Charts.heightText(p)], ["Spacing", (p.clump ? `clumps of ${p.clump}, ` : "") + p.spacing + " in apart (center to center)"],
      ["Place in the bed", rowOf(p) + " row"], ["Blooms", p.bloom ? Charts.bloomText(p) : "Grown for its leaves"], ["Color", p.color, "", p.hex],
      ["Light", p.light, sunTxt], ["Soil moisture", p.moisture],
      ["Plant type", KIND[p.kind] + (p.dormant ? " (goes dormant in summer)" : "") + (p.filler ? "; good for filling gaps" : "")],
      ["Hardiness zones", zones ? zones + (wc ? (window.isTender(p) ? " (not hardy in Michigan zone 6B)" : " (hardy only to 6B: mulch for winter)") : " (hardy in Michigan zone 6B)") : "Not recorded yet"],
      ["Deer", p.deer ? `${DEER[p.deer]} (Rutgers rating ${p.deer})` : "Not rated by Rutgers"],
      ["Toxic", tox || "Believed non-toxic to people, dogs and cats", tox ? p.toxSrc || "" : ""]],
    year: [p.bloom && ["Bloom", p.bloom[0], p.bloom[1], p.hex], care.prep && ["Spring prep", care.prep.a, care.prep.b, "#7FA66A"],
      care.cut && ["Cut back", care.cut.a, care.cut.b, "#A68C72"], care.trim && ["Trim", care.trim.a, care.trim.b, "#C4A884"],
      care.lift && ["Dig up", care.lift.a, care.lift.b, "#4F7FB4"], care.replant && ["Replant", care.replant.a, care.replant.b, "#6F9AC9"],
      care.mulch && ["Winter mulch", care.mulch.a, care.mulch.b, "#A68C72"]].filter(Boolean),
    care: [care.prep && ["Spring prep", care.prep.text], care.cut && ["Cut back", care.cut.text], care.trim && ["Optional trim", care.trim.text],
      care.divide && ["Divide", care.divide], wc && ["Winter", wc.text]].filter(Boolean),
    neighbors: groups.map(g => ({ plants: g.ids.map(id => [byId[id].name, byId[id].hex]), why: g.why, src: g.src.map(i => COMPANION_SOURCES[i]).filter(Boolean).map(s => s.title) })),
    sources: [...status.map(s => [s.kind === "native" ? "Michigan native" : "Sold in Michigan", s.title]), p.deer && ["Deer", "Rutgers NJAES deer-resistant plant list (rating " + p.deer + ")"],
      tox && ["Toxic", p.toxSrc || ""], cr.file && ["Photo", `${cr.by}, ${cr.lic}, Wikimedia Commons`]].filter(Boolean),
  };

  // the plant's facts as data, for programs (Plant Research reads this block)
  const data = { id: p.id, entry: p, care: care, sheet,
    neighbors: comps.map(c => ({ id: c.id, why: c.why, sources: c.src.map(i => COMPANION_SOURCES[i]).filter(Boolean) })),
    status, credit: cr, made: new Date().toISOString().slice(0, 10) };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.name)} · Perennial Bed Planner</title>
<meta name="description" content="${esc(p.name)} (${esc(p.latin)}): ${esc(p.notes)}">
<link rel="stylesheet" href="../styles.css">
<style>
  .pp { max-width: 1040px; margin: 18px auto 40px; padding: 0 16px; display: grid; gap: 16px; }
  .pp-hero { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 20px; align-items: start; }
  .pp-photo { margin: 0; }
  .pp-photo img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 12px; background: var(--soft); border: 1px solid var(--rule); }
  .pp-photo figcaption { color: var(--muted); font-size: 11.5px; margin-top: 6px; }
  .pp-photo figcaption a, .pp a { color: var(--forest); }
  .pp h1 { font-size: 30px; line-height: 1.1; }
  .pp .latin { font-family: var(--serif); font-style: italic; color: var(--muted); font-size: 16px; margin: 4px 0 12px; }
  .pp .notes { font-size: 15px; line-height: 1.55; margin: 12px 0 0; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 999px; }
  .chip svg { width: 12px; height: 12px; }
  .c-nat { background: #E1EBCB; color: #3F6B3A; } .c-gar { background: #F3DDEA; color: #8A3F72; } .c-daisy { background: #FBEBC4; color: #8A6410; }
  .c-deer { background: #EFE2D3; color: #6A4526; } .c-tox { background: #F6D9D5; color: #9A2E24; } .c-cold { background: #DCE7F3; color: #2F5D8C; }
  .pp h2 { font-size: 19px; margin-bottom: 10px; }
  .facts { width: 100%; border-collapse: collapse; font-size: 14px; }
  .facts th, .facts td { text-align: left; vertical-align: top; padding: 7px 10px; border-top: 1px solid var(--rule); }
  .facts tr:first-child th, .facts tr:first-child td { border-top: 0; }
  .facts th { width: 170px; color: var(--muted); font-weight: 600; }
  .muted { color: var(--muted); font-size: 12.5px; }
  .sw, .dot { display: inline-block; width: 14px; height: 14px; border-radius: 50%; vertical-align: -2px; margin-right: 7px; border: 1px solid rgba(0,0,0,.15); }
  .dot { width: 10px; height: 10px; vertical-align: 0; margin-right: 5px; }
  .code { display: inline-block; min-width: 46px; text-align: center; font-weight: 800; padding: 3px 10px; border-radius: 999px; font-size: 13px; }
  .pp-two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
  .pp ul { margin: 0; padding-left: 18px; } .pp li { margin: 0 0 10px; line-height: 1.5; }
  .yr { margin: 4px 0 14px; font-size: 12px; }
  .yr-row { display: grid; grid-template-columns: 96px 1fr; align-items: center; gap: 8px; margin-bottom: 6px; }
  .yr-lab { color: var(--muted); font-weight: 600; }
  .yr-months { display: grid; grid-template-columns: repeat(8, 1fr); color: var(--muted); font-size: 11px; }
  .yr-track { position: relative; height: 14px; background: repeating-linear-gradient(90deg, var(--soft) 0 calc(12.5% - 1px), #fff calc(12.5% - 1px) 12.5%); border-radius: 7px; }
  .yr-bar { position: absolute; top: 0; bottom: 0; border-radius: 7px; }
  .nb { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 4px; }
  .nbp { display: inline-flex; align-items: center; background: var(--soft); border-radius: 999px; padding: 2px 10px; font-weight: 600; font-size: 13px; }
  .pp q { font-style: italic; color: var(--ink); }
  .back { text-decoration: none; }
  @media print {
    @page { size: letter portrait; margin: .45in; }
    body { background: #fff; font-size: 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .top { display: flex !important; position: static; border: 0; padding: 0 0 10px; background: #fff; box-shadow: none; }
    .top .actions { display: none; }
    .pp { display: block; margin: 0; padding: 0; max-width: none; }
    .card { box-shadow: none; padding: 10px 14px; margin: 0 0 10px; break-inside: avoid; }
    .pp-hero { grid-template-columns: 1.2fr 1fr; gap: 14px; }
    .pp-two { display: block; }
    .pp h1 { font-size: 24px; } .pp h2 { font-size: 16px; margin-bottom: 6px; }
    .facts th, .facts td { padding: 4px 8px; }
    .pp li { margin-bottom: 6px; }
    .pp a { color: var(--ink); text-decoration: none; }
  }
  @media (max-width: 760px) { .pp-hero, .pp-two { grid-template-columns: 1fr; } .facts th { width: 120px; } .pp h1 { font-size: 26px; } }
</style>
</head>
<body>
<header class="top">
  <div>
    <div class="ttl"><h1>Perennial Bed Planner</h1><span class="beta" title="Early test version: things may still change">Beta</span></div>
    <div class="sub">All perennials · Zone 6B · Southern Michigan</div>
  </div>
  <div class="actions"><button class="btn primary" type="button" id="btnPdf">Print this plant</button><a class="btn back" href="../index.html">← Back to the planner</a></div>
</header>
<main class="pp">
  <section class="card pp-hero">
    <figure class="pp-photo">
      <img id="photo" alt="${esc(p.name)} (${esc(p.latin)})">
      <figcaption>${cr.file ? `Photo: <a href="${esc(commons(cr.file))}" target="_blank" rel="noopener">${esc(cr.by)}</a>, <a href="${esc(cr.licUrl)}" target="_blank" rel="noopener">${esc(cr.lic)}</a>, Wikimedia Commons` : ""}</figcaption>
    </figure>
    <div>
      <h1>${esc(p.name)}</h1>
      <div class="latin">${esc(p.latin)}</div>
      <div class="chips">${chips}</div>
      <p class="notes">${esc(p.notes)}${p.fam === "daisy" ? " Daisy family, like ragweed." : ""}</p>
    </div>
  </section>
  <section class="card">
    <h2>At a glance</h2>
    <table class="facts">${facts}</table>
  </section>
  <div class="pp-two">
    <section class="card">
      <h2>Through the year</h2>
      ${yearStrip(p, care)}
      <ul>${careItems || "<li>Standard spring cleanup.</li>"}</ul>
    </section>
    <section class="card">
      <h2>Goes well with</h2>
      <ul>${neighbors || "<li>No researched pairings yet.</li>"}</ul>
    </section>
  </div>
  <section class="card">
    <h2>Sources</h2>
    <ul>${sources}</ul>
  </section>
</main>
<div class="pvw" id="pvw" role="dialog" aria-modal="true" aria-label="Plant page PDF preview" hidden>
  <div class="pvw-bar">
    <button type="button" class="btn" id="pvBack">&larr; Back to the plant</button>
    <span class="pvw-title" id="pvName"></span>
    <button type="button" class="btn" id="pvPrint">Print</button>
    <button type="button" class="btn primary" id="pvSave">Download</button>
  </div>
  <div class="pvw-body" id="pvBody"></div>
</div>
<div class="toast" id="toast"></div>
<script type="application/json" id="plant-data">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>
<script src="../photos/${esc(p.id)}.js"></script>
<script src="plant-page.js"></script>
<script>
  // Back to the planner: go back in the browser's history when we came from it, so it returns exactly as it was
  document.querySelector("a.back").addEventListener("click", function (e) {
    var base = (document.referrer || "").split("?")[0].split("#")[0];
    if (history.length > 1 && base && base.indexOf("/plants/") < 0 && (base.slice(-1) === "/" || base.slice(-10) === "index.html")) { e.preventDefault(); history.back(); }
  });
</script>
<script>
  (function () { var f = window.PHOTO_FULL && window.PHOTO_FULL[${JSON.stringify(p.id)}]; if (f) document.getElementById("photo").src = f; })();
</script>
</body>
</html>
`;
}

const args = process.argv.slice(2);
const ids = args.includes("--all") ? PLANTS.map(p => p.id) : args;
if (!ids.length) { console.log("Usage: node make_plant_pages.js <id> [<id> ...] | --all"); process.exit(1); }
fs.mkdirSync(path.join(SITE, "plants"), { recursive: true });
for (const id of ids) {
  const p = byId[id];
  if (!p) { console.log("No plant with id " + id); continue; }
  fs.writeFileSync(path.join(SITE, "plants", id + ".html"), page(p));
  console.log("wrote plants/" + id + ".html");
}
// the list of plants that have a page, so the planner shows a More info button for them
const have = PLANTS.map(p => p.id).filter(id => fs.existsSync(path.join(SITE, "plants", id + ".html")));
fs.writeFileSync(path.join(SITE, "plants", "pages.js"), "// Plants that have their own page (plants/<id>.html). Written by research/make_plant_pages.js.\nwindow.PLANT_PAGES = " + JSON.stringify(have) + ";\n");
console.log("plants/pages.js lists " + have.length + " plant page(s)");
