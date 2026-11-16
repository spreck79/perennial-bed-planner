#!/usr/bin/env node
// Makes the folder that gets published: a copy of the site, plus two things made fresh every time.
//
//   node build/site.js <folder>      (the publish workflow runs: node build/site.js _site)
//
//   1. data/plants.all.json: every plant folder's plant.json in one file, so a visitor's browser asks once instead
//      of once per plant. It's made from the folders, so the folders stay the only place a plant lives.
//   2. The ?v= on every script and stylesheet becomes this publish's own stamp, so a visitor's browser can never
//      mix files from two different versions of the site.
// Nothing in the site's own folder is changed.
"use strict";
const fs = require("fs"), path = require("path");
const SITE = path.join(__dirname, ".."), out = path.resolve(process.argv[2] || "");
if (!process.argv[2]) { console.error("Say where to put it: node build/site.js <folder>"); process.exit(1); }
if (out === SITE || SITE.startsWith(out + path.sep)) { console.error("That would overwrite the site itself. Pick another folder."); process.exit(1); }

const SKIP = new Set([".git", ".github", "build", "node_modules", "__pycache__", "README.md"]);
fs.rmSync(out, { recursive: true, force: true });
(function copy(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const d of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, d.name), b = path.join(to, d.name);
    if (a === out || (from === SITE && SKIP.has(d.name)) || d.name === "plants.all.json") continue;
    if (d.isDirectory()) copy(a, b); else if (d.isFile()) fs.copyFileSync(a, b);
  }
})(SITE, out);

// 1. every plant in one file
const dir = path.join(SITE, "data", "plants"), plants = [], bad = [];
for (const d of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
  const f = path.join(dir, d.name, "plant.json");
  if (!d.isDirectory() || !fs.existsSync(f)) continue;
  try { const p = JSON.parse(fs.readFileSync(f, "utf8")); if (p.id !== d.name) throw new Error("its id isn't the folder's name"); plants.push(p); }
  catch (e) { bad.push(d.name + ": " + e.message); }
}
if (!plants.length) { console.error("No plant folders could be read; nothing published."); process.exit(1); }
let extra = [];
try { extra = JSON.parse(fs.readFileSync(path.join(SITE, "data", "extra-sources.json"), "utf8")); } catch (e) {}
const stamp = (process.env.GITHUB_SHA || "").slice(0, 10) || "t" + Date.now().toString(36);
fs.writeFileSync(path.join(out, "data", "plants.all.json"), JSON.stringify({ made: new Date().toISOString(), version: stamp, plants, extra }));

// 2. stamp the pages
let stamped = 0;
for (const f of fs.readdirSync(out).filter(n => n.endsWith(".html"))) {
  const p = path.join(out, f), t = fs.readFileSync(p, "utf8"), n = t.replace(/(\.(?:js|css))\?v=[\w.-]+/g, "$1?v=" + stamp);
  if (n !== t) { fs.writeFileSync(p, n); stamped++; }
}
console.log("Site made in " + out + ": " + plants.length + " plants in one file, " + stamped + " pages stamped " + stamp + ".");
bad.forEach(b => console.warn("Left out: " + b));
