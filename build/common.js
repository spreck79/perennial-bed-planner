// Shared helpers for build/check.js. Plain Node.js, no packages needed.
"use strict";
const path = require("path");
const SITE = path.join(__dirname, "..");
const DATA = path.join(SITE, "data");
// Each plant is one folder: data/plants/<id>/ holding plant.json, full.jpg (640 x 480) and preview.jpg (240 x 180).
const PLANTS_DIR = path.join(DATA, "plants");
const PLANT_FILES = ["plant.json", "full.jpg", "preview.jpg"];
const plantDir = id => path.join(PLANTS_DIR, id);
// Fields of a plant's "facts".
const FACT_KEYS = ["code", "name", "latin", "native", "kind", "filler", "dormant", "clump", "fam", "hLo", "hHi", "spacing", "bloom",
  "color", "hex", "txt", "light", "sun", "moisture", "notes", "deer", "squirrels", "toxic", "toxSrc", "gloves", "zones", "winter", "buyNote"];
// Care groups (care.group); "spring" = the standard care. The same list is in plant-data.js.
const CARE_GROUPS = require(path.join(SITE, "plant-data.js")).CARE_GROUPS;
module.exports = { SITE, DATA, PLANTS_DIR, PLANT_FILES, plantDir, FACT_KEYS, CARE_GROUPS };
