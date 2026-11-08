// A plant's own page (plant.html?id=<id>), drawn from that plant's folder as the page opens, so it always says
// exactly what the planner says. Runs after plant-data.js, plant-rules.js, care.js, charts.js and plan.js.
(function () {
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
    const sunTxt = window.Plan && window.Plan.sunNeed ? window.Plan.sunNeed(p) : "";
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

    // the plant's facts as data, for other programs
    const data = { id: p.id, entry: p, care: care, sheet,
      neighbors: comps.map(c => ({ id: c.id, why: c.why, sources: c.src.map(i => COMPANION_SOURCES[i]).filter(Boolean) })),
      status, credit: cr };
    return { data, html: `<section class="card pp-hero">
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
  </section>` };
  }

  const id = new URLSearchParams(location.search).get("id"), p = byId[id];
  if (!p) {
    document.title = "Plant not found · Perennial Bed Planner";
    document.getElementById("pp").innerHTML = '<section class="card"><h2>This plant isn\'t on the site</h2><p>There\'s no plant folder for it (any more). <a href="index.html">Back to the planner</a></p></section>';
    document.getElementById("btnPdf").hidden = true;
    window.PLANT_VIEW = null;
    return;
  }
  const v = page(p);
  document.title = p.name + " · Perennial Bed Planner";
  const md = document.createElement("meta"); md.name = "description"; md.content = p.name + " (" + p.latin + "): " + p.notes; document.head.appendChild(md);
  document.getElementById("pp").innerHTML = v.html;
  window.PLANT_VIEW = v.data;
  const img = document.getElementById("photo");
  img.src = window.PHOTOS[p.id];
  window.loadFullPhoto(p.id).then(u => { if (u) img.src = u; });    // sharpen to the full-size photo
})();
