// Plant rules shared by every page: sun tags, winter care for zone 6B, the toxic label and photo cropping.
// Runs after plant-data.js has read the plant folders into window.PLANTS.
// Light tags: full = full sun (6+ hours of direct sun), part = part shade (3 to 6 hours), shade = shade (little or no
// direct sun, under 3 hours). Every plant lists its own tags; plants added without a sun list get one from their light text.
window.PLANTS.forEach(p => {
  if (!p.sun) { const l = p.light.toLowerCase(); p.sun = []; if (/\bsun\b/.test(l)) p.sun.push("full"); if (/part|light shade/.test(l)) p.sun.push("part"); if (/shade/.test(l.replace(/part shade|light shade/g, ""))) p.sun.push("shade"); }
  if (!p.toxic) p.toxic = null;
});
// Winter care for zone 6B: null for plants that are fully hardy here (or whose zones aren't recorded yet).
// status "tender" = won't survive the winter in the ground without help; "edge" = hardy only to 6B, so mulch it.
window.HOME_ZONE = 6.5;
window.winterCare = p => {
  const z = p.zones, w = p.winter || null;
  const lo = Array.isArray(z) ? z[0] : null;
  let status = null;
  if (lo != null && lo > window.HOME_ZONE) status = "tender";
  else if (lo != null && lo === window.HOME_ZONE) status = "edge";
  if (w && !status) status = w.how === "mulch" ? "edge" : "tender";
  if (!status) return null;
  const how = (w && w.how) || (status === "edge" ? "mulch" : p.kind === "bulb" ? "dig" : "annual");
  const zoneTxt = z ? "hardy to zone " + Math.floor(z[0]) + (z[0] % 1 ? "b" : "a") : "not fully hardy here";
  const D = {
    dig: { lift: [10.45, 11.0], replant: [5.4, 5.95], short: "dig up in fall, replant in May",
           text: "Not winter-hardy here (" + zoneTxt + "). After the first frost blackens the leaves (usually mid to late October), dig it up, let it dry, and store it somewhere cool and frost-free (35 to 45°F) over winter. Replant after the last frost, usually mid to late May." },
    pot: { lift: [9.8, 10.3], replant: [5.4, 5.95], short: "bring indoors before frost",
           text: "Not winter-hardy here (" + zoneTxt + "). Grow it in a pot sunk in the bed, and bring it indoors before the first frost (usually early October). Set it back out after the last frost, usually mid to late May." },
    annual: { replant: [5.4, 5.95], short: "grows as an annual here",
           text: "Not winter-hardy here (" + zoneTxt + "), so treat it as an annual: plant a new one each year after the last frost, usually mid to late May." },
    mulch: { mulch: [11.35, 12.0], short: "mulch the crown for winter",
           text: "Hardy only to zone 6B, the edge of what it can take. Once the ground freezes (usually late November), cover the crown with about 4 to 6 in of shredded leaves or straw, and pull it back in early April." }
  }[how] || {};
  return Object.assign({ status, how, short: D.short, text: (w && w.text) || D.text }, ...["lift", "replant", "mulch"].map(k => (w && w[k]) || D[k] ? { [k]: (w && w[k]) || D[k] } : {}));
};
window.isTender = p => { const w = window.winterCare(p); return !!(w && w.status === "tender"); };

// "Toxic to people, dogs and cats" style label, or "" for plants believed non-toxic
window.toxLabel = p => { if (!p.toxic || !p.toxic.length) return ""; const t = p.toxic.slice(); const last = t.pop(); return "Toxic to " + (t.length ? t.join(", ") + " and " + last : last); };

// Photo focus (0..1) used when cropping the stored photo to 4:3; default is center.
window.PHOTO_FOCUS = window.PHOTO_FOCUS || {};   // from each plant's photo.focus (plant-data.js)
