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
    if (repo) {      // the live site: ask GitHub what's in the site's folders right now
      const key = "plants-folders:" + repo, saved = store.get(key) || {};
      try {
        const base = "https://api.github.com/repos/" + repo;
        const r = await fetch(base + "/commits/HEAD", { cache: "no-store", headers: Object.assign({ Accept: "application/vnd.github+json" }, saved.etag ? { "If-None-Match": saved.etag } : {}) });
        let sha = saved.sha, ids = saved.ids;
        if (r.status === 200) {
          const c = await r.json();
          if (c.sha !== saved.sha || !ids) {
            const t = await (await fetch(base + "/git/trees/" + c.commit.tree.sha + "?recursive=1", { headers: { Accept: "application/vnd.github+json" } })).json();
            ids = (t.tree || []).map(e => (e.path.match(/^data\/plants\/([^/]+)\/plant\.json$/) || [])[1]).filter(Boolean);
          }
          sha = c.sha;
          store.set(key, { etag: r.headers.get("ETag"), sha, ids });
        } else if (r.status !== 304) throw new Error("GitHub answered " + r.status);
        if (sha && ids) return { kind: "github", ids, version: sha, file: f => "https://raw.githubusercontent.com/" + repo + "/" + sha + "/" + f };
      } catch (e) {
        console.warn("Couldn't ask GitHub for the plant folders (" + e.message + ")");
        if (saved.sha && saved.ids) return { kind: "github", ids: saved.ids, version: saved.sha, file: f => abs(f) };   // the last folders seen
      }
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

  let current = "", source = null;
  // what the plants say, without the version in the photo addresses (so only a change to a plant counts)
  const fingerprint = (data, src) => { const t = JSON.stringify(data); return src.kind === "github" && src.version ? t.split(src.version).join("") : t; };
  // start(scripts): read the plants, then load the page's own scripts in order
  root.PlantData.start = async function (scripts) {
    source = await findFolders();
    if (source.kind === "file") return !!showMessage("<b>No plants loaded.</b><br>A page opened straight from your disk isn't allowed to look inside the plant folders. Open <b><a href='http://localhost:8321/'>http://localhost:8321</a></b> instead: that's this folder, with its plants.");
    if (source.kind === "none") return !!showMessage("<b>The plant folders couldn't be found.</b><br>Please try again in a minute.");
    const data = await readPlants(source);
    Object.assign(root, data);
    current = fingerprint(data, source);
    for (const s of scripts) await loadScript(s);
    watch();
    return true;
  };

  // keep watching the folders: when a plant is added, deleted or changed, reload the page (the garden plan is kept)
  function watch() {
    const every = source.kind === "local" ? 3000 : 60000;
    let busy = false;
    const check = async () => {
      if (busy) return; busy = true;
      try {
        const s = await findFolders();
        if (s.kind === source.kind && (s.version !== source.version || String(s.ids) !== String(source.ids))) {
          const data = await readPlants(s);
          if (fingerprint(data, s) !== current) { setTimeout(() => location.reload(), 400); return; }
          source = s;
        }
      } catch (e) {}
      busy = false;
    };
    setInterval(check, every);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
  }
})(typeof window !== "undefined" ? window : this);
