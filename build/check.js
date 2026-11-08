#!/usr/bin/env node
// Optional: checks every plant folder against the rules in data/SCHEMA.md and lists anything to fix. The site doesn't
// need this to run (it reads the folders by itself and leaves out a plant whose plant.json it can't use).
//
//   node build/check.js
"use strict";
const fs = require("fs"), path = require("path");
const C = require("./common"), { validate } = require("./validate");
const plants = [], readErrors = [];
for (const e of fs.readdirSync(C.PLANTS_DIR, { withFileTypes: true })) {
  if (!e.isDirectory()) { readErrors.push(`data/plants/${e.name}: only plant folders belong in data/plants`); continue; }
  const f = path.join(C.PLANTS_DIR, e.name, "plant.json");
  if (!fs.existsSync(f)) { readErrors.push(`data/plants/${e.name}/: no plant.json in this folder`); continue; }
  try { plants.push({ file: e.name, d: JSON.parse(fs.readFileSync(f, "utf8")) }); }
  catch (err) { readErrors.push(`data/plants/${e.name}/plant.json: not valid JSON (${err.message})`); }
}
const { errors, warnings, notices } = validate(plants, readErrors);
console.log(`Checked ${plants.length} plant folders.`);
if (errors.length) { console.log(`\nTo fix (${errors.length}):`); errors.forEach(m => console.log("  - " + m)); }
if (warnings.length) { console.log(`\nWorth finishing:`); warnings.forEach(m => console.log("  - " + m)); }
if (notices.length) { console.log(`\nNotes:`); notices.forEach(m => console.log("  - " + m)); }
if (!errors.length && !warnings.length) console.log("Everything looks right.");
process.exit(errors.length ? 1 : 0);
