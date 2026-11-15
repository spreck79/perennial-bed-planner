// The plants come straight from their folders, every time a page opens: data/plants/<id>/plant.json, full.jpg and
// preview.jpg. Nothing about any plant is stored anywhere else. Add a folder and the plant is on the site; delete it
// and it's gone; change a plant.json and the change shows (pages that are open notice within about a minute and
// reload themselves, keeping your garden plan).
//
// Finding the folders: a web page can't list a folder by itself, so this asks whoever serves the site.
//   - On the live site (GitHub Pages) it asks GitHub which plant folders the site has right now.
//   - On your computer (http://localhost:8321, see build/serve.js), it asks the local server.
// A page opened straight from the disk (index.html double-clicked) can't see any folders: browsers don't allow it.
(function (root) {
  "use strict";

  // ---------- putting the plant files together into what the planner uses ----------
  const CARE_GROUPS = ["fall", "grass", "sedge", "fern", "evfern", "tidy", "leavesAtBud", "leavesEarly", "pruneInMay", "marginal", "late", "ephemeral", "bulb"];
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

  // a plant file the planner can use (anything less is left out and named in the browser console)
  function usable(d, folder) {
    const f = d && d.facts, ph = d && d.photo;
    const num = v => typeof v === "number" && isFinite(v), txt = v => typeof v === "string" && v.trim() !== "";
    if (!d || typeof d !== "object") return "not a plant";
    if (d.id !== folder) return "its id isn't the folder's name";
    if (!f || !["code", "name", "latin", "color", "hex", "txt", "light", "moisture", "notes"].every(k => txt(f[k]))) return "facts are missing";
    if (!["clump", "fern", "grass", "mat", "bulb"].includes(f.kind) || !Array.isArray(f.sun) || !f.sun.length) return "kind or sun is missing";
    if (!num(f.hLo) || !num(f.hHi) || !num(f.spacing)) return "height or spacing is missing";
    if (!ph || !ph.credit) return "the photo credit is missing";
    return "";
  }

  // records: [{ id, plant (the parsed plant.json), full (photo address), preview (photo address) }]; extra: site-wide sources
  function assemble(records, extra) {
    const P = records.slice().sort((a, b) => String(a.plant.facts.name).localeCompare(String(b.plant.facts.name), "en") || cmp(a.id, b.id));
    const byId = {}; P.forEach(r => (byId[r.id] = r.plant));
    const name = id => byId[id].facts.name;
    const out = { PLANTS: [], PHOTOS: {}, PHOTO_URL: {}, PHOTO_FOCUS: {}, CREDITS: {}, EXAMPLE_PLANTS: [], PLANT_PAGES: [], PHOTO_PLACEHOLDER: [] };

    P.forEach(r => {
      const d = r.plant;
      out.PLANTS.push(Object.assign({ id: d.id }, d.facts, { credit: d.photo.credit }));
      out.PHOTOS[d.id] = r.preview; out.PHOTO_URL[d.id] = r.full;
      if (d.photo.focus) out.PHOTO_FOCUS[d.id] = d.photo.focus;
      out.CREDITS[d.id] = d.photo.credit;
      if (d.example) out.EXAMPLE_PLANTS.push([d.id, d.example]);
      out.PLANT_PAGES.push(d.id);
    });

    // research sources: the site-wide ones, then each plant's own, each once
    const xs = new Map(); (extra || []).forEach(s => xs.set(s.url, s));
    P.forEach(r => (r.plant.sources || []).forEach(s => { if (!xs.has(s.url)) xs.set(s.url, { title: s.title, url: s.url, topic: s.topic, note: s.note }); }));
    out.EXTRA_SOURCES = [...xs.values()];

    // native / garden favorite sources, each once, with the plants each one showed
    const ss = new Map();
    P.forEach(r => ((r.plant.status && r.plant.status.sources) || []).forEach(s => {
      if (!ss.has(s.url)) ss.set(s.url, { title: s.title, url: s.url, kind: r.plant.status.kind, note: s.note, plants: [] });
      ss.get(s.url).plants.push(r.id);
    }));
    out.STATUS_SOURCES = [...ss.values()];

    // good neighbors: only with plants that are here; a pairing listed on one plant is shown on both
    const here = d => (d.companions || []).filter(c => byId[c.id] && c.id !== d.id);
    const cs = new Map();
    P.forEach(r => here(r.plant).forEach(c => (c.sources || []).forEach(s => {
      if (!cs.has(s.url)) cs.set(s.url, Object.assign({ url: s.url, title: s.title }, byId[s.about] ? { about: s.about } : {}));
    })));
    const urls = [...cs.keys()], idx = {}; urls.forEach((u, i) => (idx[u] = i));
    out.COMPANION_SOURCES = urls.map(u => cs.get(u));
    const lists = {};
    P.forEach(r => (lists[r.id] = here(r.plant).map(c => ({ id: c.id, why: c.why, about: !!c.aboutThisPlant, src: (c.sources || []).map(s => idx[s.url]) }))));
    P.forEach(r => here(r.plant).forEach(c => {
      if (!lists[c.id].some(x => x.id === r.id)) lists[c.id].push({ id: r.id, why: c.why, about: false, src: (c.sources || []).map(s => idx[s.url]) });
    }));
    out.COMPANIONS = {};
    P.forEach(r => (out.COMPANIONS[r.id] = lists[r.id].map((c, i) => [c, i])
      .sort((x, y) => (x[0].about === y[0].about ? 0 : x[0].about ? -1 : 1) || cmp(name(x[0].id), name(y[0].id)) || x[1] - y[1])
      .map(([c]) => ({ id: c.id, why: c.why, src: c.src }))));

    // care (read by care.js)
    const care = r => r.plant.care || {};
    const C = { CUT: {}, TRIM: [], FALL_SHORT: {}, FALL_WHY: {}, DIVIDE: {}, DIVIDE_NOTE: {}, JUNE: {}, EVERGREEN: [], DORMANCY: {} };
    CARE_GROUPS.forEach(g => (C.CUT[g] = P.filter(r => care(r).group === g).map(r => r.id)));
    P.forEach(r => {
      const c = care(r), id = r.id;
      if (c.trim) C.TRIM.push(id);
      if (c.fall) { C.FALL_SHORT[id] = c.fall.short; C.FALL_WHY[id] = c.fall.why; }
      if (c.divide) C.DIVIDE[id] = c.divide;
      if (c.divideNote) C.DIVIDE_NOTE[id] = c.divideNote;
      if (c.june) C.JUNE[id] = c.june;
      if (c.evergreen) C.EVERGREEN.push(id);
      if (c.dormancy) C.DORMANCY[id] = c.dormancy;
    });
    out.CARE_DATA = C;
    return out;
  }

  const api = { assemble, usable, CARE_GROUPS };
  if (typeof module === "object" && module.exports) { module.exports = api; return; }   // used by build/check.js in Node
  root.PlantData = api;

  // ---------- in the browser: find the folders, read them, start the page ----------
  const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const abs = u => new URL(u, location.href).href;

  function repoName() {
    const m = document.querySelector('meta[name="plants-repo"]');
    if (m && m.content) return m.content.trim();
    const h = location.hostname.match(/^([^.]+)\.github\.io$/i);
    if (!h) return "";
    const seg = location.pathname.split("/").filter(Boolean)[0];
    return h[1] + "/" + (seg && !/\.html$/.test(seg) ? seg : h[1] + ".github.io");
  }

  // which plant folders there are right now, and how to fetch their files
  async function findFolders() {
    if (location.protocol === "file:") return { kind: "file" };
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) try {      // the local server on this computer (build/serve.js)
      const r = await fetch("__plants", { cache: "no-store" });
      if (r.ok) { const j = await r.json(); return { kind: "local", ids: j.ids, version: j.version, file: f => abs(f) }; }
    } catch (e) {}
    const repo = repoName();
    if (repo) {      // the live site: which plant folders the repo has. The files themselves come from this site.
      const key = "plants-folders:" + repo, saved = store.get(key) || {};
      const live = ids => ({ kind: "github", ids, file: f => abs(f) });
      // seen in the last 10 minutes: use that list (the site's own files are cached for 10 minutes anyway)
      if (saved.ids && saved.at && Date.now() - saved.at < 10 * 60 * 1000) return live(saved.ids);
      try {      // 1. ask GitHub (each visitor's connection may ask 60 times an hour)
        const base = "https://api.github.com/repos/" + repo, json = { Accept: "application/vnd.github+json" };
        const r = await fetch(base + "/commits/HEAD", { cache: "no-store", headers: Object.assign({}, json, saved.etag ? { "If-None-Match": saved.etag } : {}) });
        let ids = saved.ids;
        if (r.status === 200) {
          const c = await r.json();
          if (c.sha !== saved.sha || !ids) {
            const tr = await fetch(base + "/git/trees/" + c.commit.tree.sha + "?recursive=1", { headers: json });
            if (!tr.ok) throw new Error("GitHub answered " + tr.status);
            ids = ((await tr.json()).tree || []).map(e => (e.path.match(/^data\/plants\/([^/]+)\/plant\.json$/) || [])[1]).filter(Boolean);
          }
          store.set(key, { etag: r.headers.get("ETag"), sha: c.sha, ids, at: Date.now() });
        } else if (r.status === 304 && ids) store.set(key, Object.assign(saved, { at: Date.now() }));
        else throw new Error("GitHub answered " + r.status);
        return live(ids);
      } catch (e) { console.warn("Couldn't ask GitHub for the plant folders (" + e.message + "); trying jsDelivr"); }
      try {      // 2. GitHub said no (busy connection): jsDelivr's copy of the repo (no limit; can be a few hours behind)
        const r = await fetch("https://data.jsdelivr.com/v1/packages/gh/" + repo + "@main?structure=flat", { cache: "no-store" });
        if (!r.ok) throw new Error("jsDelivr answered " + r.status);
        const ids = ((await r.json()).files || []).map(f => (f.name.match(/^\/data\/plants\/([^/]+)\/plant\.json$/) || [])[1]).filter(Boolean);
        if (ids.length) return live(ids);
      } catch (e) { console.warn("Couldn't ask jsDelivr either (" + e.message + ")"); }
      if (saved.ids) return live(saved.ids);      // 3. the last folders this browser saw
    }
    return { kind: "none" };
  }

  async function readPlants(src) {
    const got = await Promise.all(src.ids.map(async id => {
      const dir = "data/plants/" + encodeURIComponent(id) + "/";
      try {
        const r = await fetch(src.file(dir + "plant.json"), { cache: src.kind === "github" ? "default" : "no-store" });
        if (!r.ok) return null;
        const plant = await r.json(), why = usable(plant, id);
        if (why) { console.warn("Plant folder " + id + " left out: " + why); return null; }
        return { id, plant, full: src.file(dir + "full.jpg"), preview: src.file(dir + "preview.jpg") };
      } catch (e) { console.warn("Plant folder " + id + " left out: plant.json can't be read (" + e.message + ")"); return null; }
    }));
    let extra = [];
    try { const r = await fetch(src.file("data/extra-sources.json"), { cache: src.kind === "github" ? "default" : "no-store" }); if (r.ok) extra = await r.json(); } catch (e) {}
    return assemble(got.filter(Boolean), extra);
  }

  function showMessage(html) {
    const d = document.createElement("div");
    d.style.cssText = "max-width:560px;margin:80px auto;padding:24px 28px;background:#F6F3EA;border:1px solid #D9D3C2;border-radius:14px;font:16px/1.5 system-ui,sans-serif;color:#2E3A2C";
    d.innerHTML = html; document.body.innerHTML = ""; document.body.appendChild(d);
  }
  const loadScript = src => new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => no(new Error("Couldn't load " + src)); document.body.appendChild(s); });

  // full-size photo as a data URL (the PDF needs the picture itself), fetched the first time it's needed
  root.PHOTO_FULL = root.PHOTO_FULL || {};
  root.loadFullPhoto = id => {
    if (root.PHOTO_FULL[id]) return Promise.resolve(root.PHOTO_FULL[id]);
    const u = root.PHOTO_URL && root.PHOTO_URL[id];
    if (!u) return Promise.resolve(null);
    return fetch(u).then(r => (r.ok ? r.blob() : null)).then(b => b && new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = () => ok(null); fr.readAsDataURL(b); }))
      .then(d => (d ? (root.PHOTO_FULL[id] = d) : null)).catch(() => null);
  };

  let source = null;
  // start(scripts): read the plants, then load the page's own scripts in order
  root.PlantData.start = async function (scripts) {
    source = await findFolders();
    if (source.kind === "file") return !!showMessage("<b>No plants loaded.</b><br>A page opened straight from your disk isn't allowed to look inside the plant folders. Open <b><a href='http://localhost:8321/'>http://localhost:8321</a></b> instead: that's this folder, with its plants.");
    if (source.kind === "none") return !!showMessage("<b>The plant folders couldn't be found.</b><br>The site is very busy right now. Please try again in a few minutes.");
    const data = await readPlants(source);
    Object.assign(root, data);
    for (const s of scripts) await loadScript(s);
    return true;
  };
})(typeof window !== "undefined" ? window : this);
