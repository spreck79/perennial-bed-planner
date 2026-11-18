/**
 * @OnlyCurrentDoc
 */
// Perennial Bed Planner: usage counts.
// This script lives inside the "Perennial Bed Planner stats" Google Sheet (Extensions > Apps Script) and is
// deployed as a web app. The site's stats.js sends it small counts; it checks them and adds one row to the Log tab.
// @OnlyCurrentDoc above means it can only open this one spreadsheet, nothing else in the owner's Drive.
// It keeps nothing about the visitor: no IP address, no ID. Anything it doesn't expect is thrown away.
// A copy is kept in the site's repo at build/stats-script.gs.

const LABEL = {
  dev: { computer: "Computer", tablet: "Tablet", phone: "Phone" },
  use: {
    "example": "Loaded the example garden", "save": "Saved a plan", "open": "Opened a plan", "help": "Opened Help",
    "tour-done": "Finished the tour", "tour-skip": "Skipped the tour",
    "lesson-draw-done": "Drawing lesson: watched", "lesson-draw-skip": "Drawing lesson: skipped",
    "lesson-sun-done": "Sun lesson: watched", "lesson-sun-skip": "Sun lesson: skipped",
    "lesson-objects-done": "Objects lesson: watched", "lesson-objects-skip": "Objects lesson: skipped"
  },
  kind: { natives: "Michigan natives", garden: "Garden favorites", both: "Both" },
  types: { clump: "Flowers", fern: "Ferns", grass: "Grasses & sedges", mat: "Groundcovers", bulb: "Spring bulbs", annual: "Annuals", shrub: "Shrubs" },
  avoid: { toxic: "Toxic plants", deer: "Plants deer eat", tender: "Plants that need winter care", daisy: "Daisy family", invasive: "Plants that can escape the garden" },
  shape: { rect: "Rectangle", lshape: "L-shape", curved: "Curved border", half: "Half moon", wedge: "Corner wedge", circle: "Round island", oval: "Oval island", free: "Drawn by hand" },
  size: { "under 50": "Under 50 sq ft", "50-99": "50 to 99 sq ft", "100-199": "100 to 199 sq ft", "200-399": "200 to 399 sq ft", "400+": "400 sq ft or more" },
  light: { full: "Full sun", part: "Part shade", shade: "Shade" },
  obj: { path: "Path", stone: "Stepping stone", stump: "Tree stump", rock: "Rock", birdbath: "Birdbath", shrub: "Existing shrub", hedge: "Existing hedge", tree: "Existing tree" }
};

function doPost(e) {
  try {
    const raw = String((e && e.postData && e.postData.contents) || "");
    if (raw.length > 20000) return done();
    const d = JSON.parse(raw);
    if (!d || d.v !== 1) return done();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const known = new Set(ss.getSheetByName("Plants").getRange("A2:A").getValues().map(r => String(r[0])).filter(String));

    const ids = a => Array.isArray(a) ? uniq(a.map(String).filter(x => known.has(x))).slice(0, 300) : [];
    const many = (a, map) => Array.isArray(a) ? uniq(a.map(String).filter(x => map[x])).map(x => map[x]) : [];
    const one = (x, map) => map[String(x)] || "";
    const list = a => a.length ? "," + a.join(",") + "," : "";   // ",a,b," so a formula can find ",a," in it

    const isNew = d.new === 1 ? 1 : 0;
    const src = isNew && /^[a-z0-9.-]{1,60}$/.test(String(d.src || "")) ? String(d.src) : "";
    const g = d.guide && typeof d.guide === "object" ? d.guide : null;
    const n = g ? Math.max(0, Math.min(2000, Math.floor(+g.n) || 0)) : 0;
    const row = [
      new Date(), "", isNew, isNew ? one(d.dev, LABEL.dev) : "", src,
      list(ids(d.add)), list(ids(d.page)), list(ids(d.ppdf)), list(many(d.use, LABEL.use)),
      g ? 1 : 0, g ? n : "", g ? list(ids(g.ids)) : "",
      g ? one(g.kind, LABEL.kind) : "", g ? list(many(g.types, LABEL.types)) : "", g ? list(many(g.avoid, LABEL.avoid)) : "",
      g ? one(g.shape, LABEL.shape) : "", g ? one(g.size, LABEL.size) : "", g ? one(g.light, LABEL.light) : "",
      g ? (g.paint === 1 ? 1 : 0) : "", g ? list(many(g.obj, LABEL.obj)) : "", g ? (g.ex === 1 ? 1 : 0) : ""
    ];
    row[1] = Utilities.formatDate(row[0], ss.getSpreadsheetTimeZone(), "yyyy-MM");
    if (!isNew && !row.slice(5, 10).some(v => v)) return done();   // nothing to count

    const lock = LockService.getDocumentLock();
    lock.waitLock(10000);
    try { ss.getSheetByName("Log").appendRow(row); } finally { lock.releaseLock(); }
  } catch (err) { /* bad input: nothing is written */ }
  return done();
}

function doGet() { return done(); }
function done() { return ContentService.createTextOutput(""); }
function uniq(a) { return a.filter((x, i) => a.indexOf(x) === i); }
