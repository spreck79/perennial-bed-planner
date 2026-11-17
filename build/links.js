#!/usr/bin/env node
// Checks every source link on the site:  node build/links.js
// It reads the web addresses out of the plant folders and the site's pages, opens each one, and lists
//   DEAD    the page is gone (not found, or the website no longer exists): fix these
//   UNSURE  the website wouldn't answer a robot (blocked, too busy, timed out): open it by hand if it keeps showing up
// It ends with an error when anything is DEAD, so the weekly check on GitHub (.github/workflows/links.yml) sends an email.
// Needs Node 18 or newer and the internet. It only reads; nothing in the site is changed.
"use strict";
const fs = require("fs"), path = require("path");
const SITE = path.join(__dirname, ".."), PLANTS = path.join(SITE, "data", "plants");
const SKIP = /^https?:\/\/(www\.w3\.org|localhost|127\.0\.0\.1|pbp\.spreck79\.com|spreck79\.github\.io|fonts\.|cdn\.jsdelivr\.net|api\.github\.com|gc\.zgo\.at)/;
const used = new Map();   // address -> where it's used
const note = (u, where) => { u = u.replace(/[),.;]+$/, ""); if (SKIP.test(u)) return; if (!used.has(u)) used.set(u, new Set()); used.get(u).add(where); };
const walk = (o, where) => { if (typeof o === "string") { if (/^https?:\/\//.test(o)) note(o, where); } else if (o && typeof o === "object") Object.values(o).forEach(v => walk(v, where)); };

for (const d of fs.readdirSync(PLANTS)) {
  const f = path.join(PLANTS, d, "plant.json"); if (!fs.existsSync(f)) continue;
  const p = JSON.parse(fs.readFileSync(f, "utf8")); walk(p, (p.facts && p.facts.name) || d);
}
for (const f of fs.readdirSync(SITE).filter(x => /\.(js|html)$/.test(x) && !/\.min\.js$/.test(x))) {
  const t = fs.readFileSync(path.join(SITE, f), "utf8");
  for (const m of t.matchAll(/https?:\/\/[^\s"'`<>\\)]+/g)) if (!m[0].includes("${")) note(m[0], f);
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
async function open(u) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 25000);
  try {
    const r = await fetch(u, { redirect: "follow", signal: ctl.signal, headers: { "User-Agent": UA, Accept: "text/html,application/pdf,*/*" } });
    try { r.body && r.body.cancel(); } catch (e) {}
    // a page that sends you to the site's front page or an error page is as good as gone
    const moved = r.url && r.url !== u && /\/(error|404)\b/i.test(new URL(r.url).pathname);
    return { code: moved ? 404 : r.status, to: r.url };
  } catch (e) {
    const c = (e.cause && e.cause.code) || e.name || "error";
    return { code: 0, why: c === "AbortError" ? "timed out" : c };
  } finally { clearTimeout(t); }
}
const verdict = r => r.code >= 200 && r.code < 400 ? "ok" : r.code === 404 || r.code === 410 || r.why === "ENOTFOUND" ? "dead" : "unsure";

(async () => {
  const list = [...used.keys()].sort(), out = {}, lastHit = {};
  let next = 0;
  async function worker() {
    while (next < list.length) {
      const u = list[next++], host = new URL(u).host;
      const wait = (lastHit[host] || 0) + 700 - Date.now(); lastHit[host] = Date.now() + Math.max(0, wait);   // be gentle with each website
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
      let r = await open(u);
      if (verdict(r) !== "ok") { await new Promise(x => setTimeout(x, 1500)); const r2 = await open(u); if (verdict(r2) === "ok" || verdict(r) !== "dead") r = r2; }
      out[u] = r;
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  if (list.filter(u => out[u].why === "ENOTFOUND").length > list.length / 2) { console.log("Most websites couldn't be reached at all, so this computer has no open internet. Nothing was checked."); process.exit(2); }
  const rows = k => list.filter(u => verdict(out[u]) === k);
  const dead = rows("dead"), unsure = rows("unsure"), lines = [];
  const show = u => "- " + u + "\n    " + (out[u].code ? "answer " + out[u].code : out[u].why) + " · used by: " + [...used.get(u)].sort().join(", ");
  lines.push("Checked " + list.length + " links: " + (list.length - dead.length - unsure.length) + " fine, " + dead.length + " dead, " + unsure.length + " unsure.");
  if (dead.length) lines.push("", "DEAD (fix these):", ...dead.map(show));
  if (unsure.length) lines.push("", "UNSURE (the website wouldn't answer a robot):", ...unsure.map(show));
  const text = lines.join("\n"); console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, "```\n" + text + "\n```\n");
  process.exit(dead.length ? 1 : 0);
})();
