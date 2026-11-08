// The checks every plant must pass before it goes on the site
// errors = the build stops; warnings = allowed but worth finishing; notices = for information.
// The rules here are the ones written down in data/SCHEMA.md: change both together.
"use strict";
const fs = require("fs"), path = require("path");
const C = require("./common");

const TOP = ["id", "facts", "photo", "status", "care", "example", "sources", "companions"];
const OPTIONAL_TOP = ["example", "sources"];
const KINDS = ["clump", "fern", "grass", "mat", "bulb"], SUNS = ["full", "part", "shade"], TOX = ["people", "dogs", "cats", "horses"];
const WINTER_HOW = ["dig", "pot", "annual", "mulch"];
const REQUIRED_TEXT = ["code", "name", "latin", "color", "light", "moisture", "notes"];
const FACT_ALLOWED = C.FACT_KEYS;
const NO_AUTHOR_OK = ["Public domain", "CC0"], NO_LICURL_OK = ["Public domain"];

// width and height of a JPEG, read from its header (the SOFn marker)
function jpegSize(b) {
  if (!(b[0] === 0xff && b[1] === 0xd8)) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
    i += 2 + len;
  }
  return null;
}
const PHOTO_SIZE = { full: [640, 480], preview: [240, 180] };

const isNum = v => typeof v === "number" && isFinite(v);
const isText = v => typeof v === "string" && v.trim() !== "";
const isPair = (v, lo, hi) => Array.isArray(v) && v.length === 2 && v.every(isNum) && v[0] >= lo && v[1] <= hi;
const isUrl = v => isText(v) && /^https?:\/\/\S+$/.test(v);

// The code is the short label drawn on each plant: 2 to 4 letters found in order in the common name, each capital
// starting a word ("Moonbeam" → Moon, "Blue Star" → BlSt, "Tall Blue Star" → TBSt, a vowel dropped → Mnbm).
const nameWords = n => n.replace(/['’]s\b/g, "s").split(/[^A-Za-z]+/).filter(Boolean);
function codeFits(code, name) {
  if (!/^[A-Z][A-Za-z]*$/.test(code)) return false;
  const flat = nameWords(name).join(" "); let pos = 0;
  for (let k = 0; k < code.length; k++) {
    const ch = code[k], needStart = k === 0 || ch === ch.toUpperCase();
    let found = -1;
    for (let i = pos; i < flat.length; i++) {
      const start = i === 0 || flat[i - 1] === " ";
      if (flat[i].toLowerCase() === ch.toLowerCase() && (needStart ? start : true)) { found = i; break; }
    }
    if (found < 0) return false;
    pos = found + 1;
  }
  return true;
}
function suggestCode(name) {
  let w = nameWords(name.replace(/'[^']*'/g, "")); if (!w.length) w = nameWords(name);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  if (w.length === 1) return cap(w[0].slice(0, 4));
  if (w.length === 2) return cap(w[0].slice(0, 2)) + cap(w[1].slice(0, 2));
  const c = w.slice(0, 4).map(x => x[0].toUpperCase()).join("");
  return c + (c.length < 4 ? (w[w.length - 1][1] || "").toLowerCase() : "");
}

function validate(plants, readErrors) {
  const errors = readErrors.slice(), warnings = [], notices = [];
  const ids = new Set(plants.map(p => p.d && p.d.id)), codes = {};
  const statusSrc = {}, compSrc = {}, noZones = [];
  const missingNeighbors = {}, extraSrc = {};   // plant id that has no folder -> plants that list it as a good neighbor

  for (const { file, d } of plants) {
    const id = d && d.id, label = (d && d.facts && d.facts.name ? d.facts.name + " " : "") + "(" + (id || file) + ")";
    const E = m => errors.push(`${label}: ${m}`), Wn = m => warnings.push(`${label}: ${m}`);
    if (!d || typeof d !== "object" || Array.isArray(d)) { errors.push(`${file}: must hold one plant object`); continue; }
    if (!/^[a-z0-9-]+$/.test(id || "")) { E("'id' must be lower-case letters, numbers and dashes"); continue; }
    if (file !== id) E(`the folder must be named ${id} (the plant's id), not ${file}`);
    const dir = C.plantDir(file);
    const extraFiles = fs.readdirSync(dir).filter(x => !C.PLANT_FILES.includes(x));
    if (extraFiles.length) Wn(`its folder has files the site doesn't use: ${extraFiles.join(", ")}`);
    for (const k of Object.keys(d)) if (!TOP.includes(k)) E(`unknown field '${k}' (allowed: ${TOP.join(", ")})`);
    for (const k of TOP) if (!(k in d) && !OPTIONAL_TOP.includes(k)) E(`missing '${k}'`);
    if ("example" in d && !(Number.isInteger(d.example) && d.example >= 1 && d.example <= 10)) E("'example' is how many go in the example garden: a whole number from 1 to 10 (or left out)");
    const f = d.facts || {}, ph = d.photo || {}, st = d.status || {}, ca = d.care || {}, co = d.companions;

    // ---- facts ----
    for (const k of Object.keys(f)) if (!FACT_ALLOWED.includes(k)) E(`unknown fact '${k}'`);
    for (const k of REQUIRED_TEXT) if (!isText(f[k])) E(`missing '${k}'`);
    if (typeof f.native !== "boolean") E("'native' must be true (Michigan native) or false (garden favorite)");
    if (!KINDS.includes(f.kind)) E(`'kind' must be one of ${KINDS.join(", ")}`);
    for (const k of ["hLo", "hHi", "spacing"]) if (!isNum(f[k])) E(`missing '${k}' (a number of inches)`);
    if (isNum(f.hLo) && isNum(f.hHi) && (f.hLo <= 0 || f.hLo > f.hHi)) E("hLo must be more than 0 and not taller than hHi");
    if (isNum(f.spacing) && f.spacing <= 0) E("spacing must be more than 0 inches");
    if (!("bloom" in f)) E("missing 'bloom' (use null for a foliage plant)");
    else if (f.bloom !== null && !(isPair(f.bloom, 3, 12) && f.bloom[0] < f.bloom[1])) E("bloom must be [start, end] months between 3 and 12, start before end, or null");
    for (const k of ["hex", "txt"]) if (!/^#[0-9A-Fa-f]{6}$/.test(f[k] || "")) E(`'${k}' must be a color like #A1B2C3`);
    if (!Array.isArray(f.sun) || !f.sun.length || f.sun.some(s => !SUNS.includes(s)) || new Set(f.sun).size !== f.sun.length) E("'sun' must list one or more of full, part, shade (each once)");
    if ("deer" in f && !["A", "B", "C", "D"].includes(f.deer)) E("'deer' must be the Rutgers rating A, B, C or D (or left out if not rated)");
    if ("squirrels" in f && (f.squirrels !== true || f.kind !== "bulb")) E("'squirrels' is only for bulbs squirrels dig up, and must be true");
    if ("gloves" in f && (f.gloves !== true || !Array.isArray(f.toxic))) E("'gloves' is only for toxic plants, and must be true");
    if ("buyNote" in f && !isText(f.buyNote)) E("'buyNote' is a sentence for the PDF's buying tips (or left out)");
    if (!("toxic" in f)) E("missing 'toxic' (a list like [\"dogs\", \"cats\"], or null if not toxic)");
    else if (f.toxic !== null) {
      if (!Array.isArray(f.toxic) || !f.toxic.length || f.toxic.some(t => !TOX.includes(t))) E(`'toxic' lists who it is toxic to (${TOX.join(", ")}), or is null`);
      else if (!isText(f.toxSrc)) E("toxic plants need 'toxSrc' saying where that comes from (for example the ASPCA list)");
    } else if ("toxSrc" in f) E("'toxSrc' is only for toxic plants");
    if ("fam" in f && f.fam !== "daisy") E("'fam' is only used for \"daisy\" (daisy family)");
    for (const k of ["filler", "dormant"]) if (k in f && f[k] !== true) E(`'${k}' is either true or left out`);
    if ("clump" in f && !(Number.isInteger(f.clump) && f.clump >= 1)) E("'clump' is a whole number of bulbs (1 or more)");
    if ("clump" in f && f.kind !== "bulb") E("'clump' is only for bulbs");
    const z = f.zones, wn = f.winter;
    if (z !== undefined) {
      if (!(isPair(z, 1, 13.5) && z[0] <= z[1] && z.every(x => (x * 2) % 1 === 0))) E("zones must be [coldest, warmest] like [3, 8] (use .5 for the b half: 6.5 = 6b)");
      else if (z[0] > 6.5 && !wn) E(`not hardy in zone 6B (zones ${z[0]} to ${z[1]}): add 'winter' care (how: dig, pot, annual)`);
      else if (z[1] < 6) E(`zones ${z[0]} to ${z[1]} don't reach 6B: it won't grow well here`);
    } else if (!wn) noZones.push(f.name || id);
    if (wn !== undefined) {
      if (!wn || typeof wn !== "object" || !WINTER_HOW.includes(wn.how)) E("winter.how must be dig, pot, annual or mulch");
      else {
        for (const k of Object.keys(wn)) if (!["how", "text", "lift", "replant", "mulch"].includes(k)) E(`unknown winter field '${k}'`);
        if ("text" in wn && !isText(wn.text)) E("winter.text, if given, is the plain instructions");
        for (const k of ["lift", "replant", "mulch"]) if (k in wn && !(isPair(wn[k], 1, 12.99) && wn[k][0] < wn[k][1])) E(`winter.${k} must be [start, end] months`);
      }
    }
    if (isText(f.code)) {
      const c = f.code;
      if (codes[c.toLowerCase()]) E(`the code '${c}' is also used by ${codes[c.toLowerCase()]}`);
      codes[c.toLowerCase()] = f.name || id;
      if (!(c.length >= 2 && c.length <= 4) || !codeFits(c, f.name || "")) E(`the code '${c}' doesn't follow the pattern: up to 4 letters taken in order from the common name, starting a word, with capitals only at the start of words (like Moon for "Moonbeam" or BlSt for "Blue Star"). Suggested: ${suggestCode(f.name || "")}`);
    }

    // ---- photo ----
    for (const k of Object.keys(ph)) if (!["focus", "credit"].includes(k)) E(`unknown photo field '${k}'`);
    for (const k of ["full", "preview"]) {
      const p = path.join(dir, k + ".jpg"), at = `data/plants/${file}/${k}.jpg`;
      if (!fs.existsSync(p)) E(`no ${k} photo: ${at} is missing`);
      else {
        const sz = jpegSize(fs.readFileSync(p)), [w, h] = PHOTO_SIZE[k];
        if (!sz) E(`${at} is not a JPEG file`);
        else if (sz.w !== w || sz.h !== h) E(`${at} is ${sz.w} x ${sz.h}; the ${k} photo must be ${w} x ${h}`);
      }
    }
    if ("focus" in ph && !(isPair(ph.focus, 0, 1))) E("photo.focus must be [x, y], each from 0 to 1");
    const cr = ph.credit;
    if (!cr || typeof cr !== "object") E("missing photo.credit");
    else {
      for (const k of Object.keys(cr)) if (!["file", "by", "lic", "licUrl"].includes(k)) E(`unknown credit field '${k}'`);
      if (!isText(cr.file)) E("photo.credit.file: the photo's file name on Wikimedia Commons (or its source) is missing");
      if (!isText(cr.lic)) E("photo.credit.lic: the license is missing");
      if (typeof cr.by !== "string" || (!cr.by.trim() && !NO_AUTHOR_OK.includes(cr.lic))) E(`photo.credit.by: the photographer is missing (the ${cr.lic || "license"} requires naming them)`);
      if (typeof cr.licUrl !== "string" || (cr.licUrl !== "" && !isUrl(cr.licUrl)) || (!cr.licUrl && !NO_LICURL_OK.includes(cr.lic))) E("photo.credit.licUrl: a link to the license is missing (only \"Public domain\" may leave it empty)");
    }

    // ---- native / garden favorite ----
    const kind = f.native === true ? "native" : f.native === false ? "garden" : null;
    if (!["native", "garden"].includes(st.kind)) E("status.kind must be \"native\" or \"garden\"");
    else if (kind && st.kind !== kind) E(`status.kind is "${st.kind}" but facts.native is ${f.native}`);
    if (!Array.isArray(st.sources) || !st.sources.length) E("status.sources: at least one source showing it's a Michigan native or sold at Michigan garden centers");
    else st.sources.forEach((s, i) => {
      if (!isText(s.title) || !isUrl(s.url) || !isText(s.note)) E(`status.sources[${i}] needs a title, a web address (url) and a note`);
      for (const k of Object.keys(s)) if (!["title", "url", "note"].includes(k)) E(`status.sources[${i}]: unknown field '${k}'`);
      if (isUrl(s.url)) (statusSrc[s.url] = statusSrc[s.url] || []).push({ id, s, kind: st.kind });
    });

    // ---- care ----
    const groups = C.CARE_GROUPS.concat("spring");
    if (!groups.includes(ca.group)) E(`care.group must be one of ${groups.join(", ")}`);
    if (typeof ca.trim !== "boolean") E("care.trim must be true (optional shear after the first flowers) or false");
    else if (ca.trim && f.bloom === null) Wn("care.trim is true but it has no bloom time, so no trim is shown");
    for (const k of Object.keys(ca)) if (!["group", "trim", "fall", "divide", "divideNote", "evergreen", "dormancy", "june"].includes(k)) E(`unknown care field '${k}'`);
    if ("divideNote" in ca && !isText(ca.divideNote)) E("care.divideNote is a sentence added to the dividing advice (or left out)");
    if ("june" in ca && !["pinch", "halve"].includes(ca.june)) E("care.june must be pinch or halve (or left out)");
    if ("divide" in ca && !["never", "fleshy", "summer", "early-spring"].includes(ca.divide)) E("care.divide must be never, fleshy, summer or early-spring (leave it out for the usual advice)");
    if ("evergreen" in ca && (ca.evergreen !== true || ca.group !== "sedge")) E("care.evergreen is only for sedges (care.group \"sedge\") and must be true");
    if ("dormancy" in ca) {
      const dz = ca.dormancy;
      if (ca.group !== "ephemeral") E("care.dormancy is only for care.group \"ephemeral\"");
      if (!dz || typeof dz.from !== "number" || dz.from < 5 || dz.from > 9 || !isText(dz.short) || Object.keys(dz).some(k => !["from", "short"].includes(k)))
        E("care.dormancy needs 'from' (month number when the leaves are cleared, 5 to 9) and 'short' (e.g. \"Jul\")");
    }
    if (ca.group === "fall") { if (!ca.fall || !isText(ca.fall.short) || !isText(ca.fall.why)) E("care.fall needs 'short' and 'why' (why it's cut back in fall)"); }
    else if ("fall" in ca) E("care.fall is only for care.group \"fall\"");

    // ---- the plant's own research sources (shown on the credits page) ----
    if ("sources" in d) {
      if (!Array.isArray(d.sources)) E("'sources' must be a list");
      else d.sources.forEach((s, i) => {
        if (!s || !isText(s.title) || !isUrl(s.url) || !isText(s.topic) || !isText(s.note)) E(`sources[${i}] needs a title, a web address (url), a topic and a note`);
        else for (const k of Object.keys(s)) if (!["title", "url", "topic", "note"].includes(k)) E(`sources[${i}]: unknown field '${k}'`);
        if (s && isUrl(s.url)) (extraSrc[s.url] = extraSrc[s.url] || []).push({ id, s });
      });
    }

    // ---- good neighbors ----
    if (!Array.isArray(co)) E("'companions' must be a list");
    else {
      if (!co.length) E("no good neighbors: every plant needs at least one pairing from a source");
      else if (!co.some(c => ids.has(c.id))) Wn("none of its good neighbors are on the site any more, so it shows none");
      const seen = new Set();
      co.forEach((c, i) => {
        const at = `companions[${i}]`;
        for (const k of Object.keys(c)) if (!["id", "why", "aboutThisPlant", "sources"].includes(k)) E(`${at}: unknown field '${k}'`);
        if (typeof c.id !== "string" || !/^[a-z0-9-]+$/.test(c.id)) E(`${at}: 'id' must be a plant id`);
        else if (!ids.has(c.id)) (missingNeighbors[c.id] = missingNeighbors[c.id] || []).push(id);
        if (c.id === id) E(`${at}: a plant can't be its own neighbor`);
        if (seen.has(c.id)) E(`${at}: '${c.id}' is listed twice`);
        seen.add(c.id);
        if (!isText(c.why)) E(`${at}: 'why' (the source's sentence) is missing`);
        if (typeof c.aboutThisPlant !== "boolean") E(`${at}: 'aboutThisPlant' must be true or false`);
        if (!Array.isArray(c.sources) || !c.sources.length) E(`${at}: at least one source`);
        else c.sources.forEach((s, j) => {
          if (!isText(s.title) || !isUrl(s.url)) E(`${at}.sources[${j}] needs a title and a web address (url)`);
          for (const k of Object.keys(s)) if (!["title", "url", "about"].includes(k)) E(`${at}.sources[${j}]: unknown field '${k}'`);
          if ("about" in s && (typeof s.about !== "string" || !/^[a-z0-9-]+$/.test(s.about))) E(`${at}.sources[${j}].about must be a plant id`);
          if (isUrl(s.url)) (compSrc[s.url] = compSrc[s.url] || []).push({ id, s });
        });
      });
    }
  }

  // the same source must be written the same way everywhere it's used
  for (const [url, uses] of Object.entries(statusSrc)) {
    const a = uses[0];
    for (const u of uses.slice(1)) {
      if (u.s.title !== a.s.title || u.s.note !== a.s.note) errors.push(`status source ${url}: the title or note differs between ${a.id} and ${u.id}`);
      if (u.kind !== a.kind) errors.push(`status source ${url} is used for a native plant (${a.kind === "native" ? a.id : u.id}) and a garden favorite (${a.kind === "native" ? u.id : a.id}); a source shows one or the other`);
    }
  }
  for (const [url, uses] of Object.entries(compSrc)) {
    const a = uses[0];
    for (const u of uses.slice(1)) if (u.s.title !== a.s.title || u.s.about !== a.s.about) errors.push(`good-neighbor source ${url}: the title or 'about' differs between ${a.id} and ${u.id}`);
  }
  for (const [url, uses] of Object.entries(extraSrc)) {
    const a = uses[0];
    for (const u of uses.slice(1)) if (u.s.title !== a.s.title || u.s.topic !== a.s.topic || u.s.note !== a.s.note) errors.push(`source ${url}: the title, topic or note differs between ${a.id} and ${u.id}`);
  }
  // good neighbors whose folders aren't there: left off the site (they come back if the folder is added again)
  for (const [m, by] of Object.entries(missingNeighbors))
    notices.push(`'${m}' has no folder in data/plants, so its pairings with ${by.join(", ")} are left off the site`);
  if (noZones.length) warnings.push(`Hardiness zones not recorded yet (${noZones.length}): ${noZones.join(", ")}`);
  return { errors, warnings, notices };
}

module.exports = { validate, codeFits, suggestCode };
