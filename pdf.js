// PDF guide, drawn straight with jsPDF so it works offline from a folder.
// Styled after the original garden guide: DejaVu fonts, green cover band, big-photo plant cards.
(function () {
  const W = 612, H = 792, M = 42;
  const DAISY = "#B7791F";
  const deerEats = p => p.deer === "C" || p.deer === "D";
  const deerText = p => (p.deer === "D" ? "Deer often eat it" : "Deer sometimes eat it") + (p.id === "tulip" ? " and squirrels dig the bulbs" : "") + ".";
  const marks = p => (p.native ? "" : " ◆") + (p.fam === "daisy" ? " ✿" : "");
  const C = { forest: "#3F6B3A", ink: "#2E3A2C", muted: "#6B7464", rule: "#D9D3C2", cream: "#F5F2E8", soft: "#EEF0E2", band: "#ECEFE0", leaf: "#5E8F4E", leaf2: "#8DB46F", leafD: "#41693A", berry: "#A8578A", soil: "#B89A74", stripe: "#F7F5EE" };
  const rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

  function make(data, progress) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "letter", compress: true });
    const FN = window.PDF_FONTS;
    if (FN) {
      doc.addFileToVFS("DejaVuSans.ttf", FN.Sans); doc.addFont("DejaVuSans.ttf", "Sans", "normal");
      doc.addFileToVFS("DejaVuSans-Bold.ttf", FN.SansBold); doc.addFont("DejaVuSans-Bold.ttf", "Sans", "bold");
      doc.addFileToVFS("DejaVuSerif-Bold.ttf", FN.SerifBold); doc.addFont("DejaVuSerif-Bold.ttf", "Serif", "bold");
      doc.addFileToVFS("DejaVuSerif-Italic.ttf", FN.SerifItalic); doc.addFont("DejaVuSerif-Italic.ttf", "Serif", "italic");
    }
    const { plants, bed, placements, byId } = data;
    const gName = (data.name || "My Garden").trim() || "My Garden", prefs = data.prefs || { sun: ["part"] };
    const toxicPlants = plants.filter(p => p.toxic && p.toxic.length), TOX = "#A8423A";
    const toxLabel = window.toxLabel || (() => "");
    const lightWords = (() => { const m = { full: "Full sun", part: "Part shade", shade: "Full shade" }; const have = ["full", "part", "shade"].filter(k => plants.some(p => p.sun && p.sun.includes(k)) && (prefs.sun || []).includes(k)); return (have.length ? have : prefs.sun || ["part"]).map(k => m[k]).join(" / "); })();
    const Ch = window.Charts, Geo = window.Geo;
    const fill = h => { const c = rgb(h); doc.setFillColor(c[0], c[1], c[2]); };
    const stroke = h => { const c = rgb(h); doc.setDrawColor(c[0], c[1], c[2]); };
    const color = h => { const c = rgb(h); doc.setTextColor(c[0], c[1], c[2]); };
    // sf(kind, size): s = sans, sb = sans bold, rb = serif bold, ri = serif italic (DejaVu sizes, as in the original guide)
    const sf = (k, sz) => {
      if (!FN) { doc.setFont(k === "rb" ? "times" : "helvetica", k === "sb" || k === "rb" ? "bold" : k === "ri" ? "italic" : "normal"); doc.setFontSize(sz * 0.9); return; }
      if (k === "s") doc.setFont("Sans", "normal"); else if (k === "sb") doc.setFont("Sans", "bold"); else if (k === "rb") doc.setFont("Serif", "bold"); else doc.setFont("Serif", "italic");
      doc.setFontSize(sz);
    };
    // legacy helper used by the drawing blocks (helvetica-sized values)
    const font = (f, st, sz) => { if (f === "times") sf("rb", sz); else if (st === "italic") sf("ri", sz * 0.9); else sf(st === "bold" ? "sb" : "s", sz * 0.9); };
    const wrap = (t, w) => doc.splitTextToSize(t, w);
    const text = (t, x, y, opt) => doc.text(t, x, y, opt);
    const hMean = Geo.hMean;
    const counts = {}; placements.forEach(p => (counts[p.id] = (counts[p.id] || 0) + 1));
    const waiting = data.waiting || {}; let nWait = 0; Object.keys(waiting).forEach(k => { if (waiting[k] > 0 && byId[k]) { counts[k] = (counts[k] || 0) + waiting[k]; nWait += waiting[k]; } });
    let page = 1;
    const newPage = () => { doc.addPage(); page++; };
    const rowOf = p => hMean(p) <= 14 ? "Front" : hMean(p) <= 28 ? "Middle" : "Back";
    const stripe = (x, y, w, h) => { fill(C.stripe); doc.rect(x, y, w, h, "F"); };

    // photo with rounded corners, cropped to fill the frame
    const photo = (id, x, y, w, h, r) => {
      r = r == null ? 6 : r;
      const d = window.PHOTOS[id];
      if (d) {
        try {
          doc.saveGraphicsState(); doc.roundedRect(x, y, w, h, r, r, null); doc.clip(); doc.discardPath();
          const ar = 4 / 3; let dw = w, dh = w / ar;
          if (dh < h) { dh = h; dw = h * ar; }
          doc.addImage(d, "JPEG", x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
          doc.restoreGraphicsState();
        } catch (e) { doc.restoreGraphicsState(); fill(C.band); doc.roundedRect(x, y, w, h, r, r, "F"); }
      } else { fill(C.band); doc.roundedRect(x, y, w, h, r, r, "F"); }
      stroke(C.rule); doc.setLineWidth(0.5); doc.roundedRect(x, y, w, h, r, r, "S");
    };
    const heading = (t, y, size) => { sf("rb", size || 20); color(C.forest); text(t, M, y); };
    const para = (t, x, y, w, size, lead, col, kind) => {
      sf(kind || "s", size || 9); color(col || C.ink);
      const lines = wrap(t, w); text(lines, x, y, { lineHeightFactor: (lead || 12) / (size || 9) });
      return lines.length * (lead || 12);
    };
    // rich text flow: parts = [[text, bold], ...]. Returns number of lines. draw=false just measures.
    const flow = (parts, x, y, maxW, size, lead, col, boldCol, draw) => {
      let cx = x, lines = 1;
      parts.forEach(([t, b]) => {
        t.split(/(\s+)/).forEach(w => {
          if (!w) return; if (/^\s+$/.test(w)) { sf(b ? "sb" : "s", size); cx += doc.getTextWidth(" "); return; }
          sf(b ? "sb" : "s", size); const ww = doc.getTextWidth(w);
          if (cx + ww - x > maxW + 0.5 && cx > x) { cx = x; y += lead; lines++; }
          if (draw) { color(b ? boldCol : col); text(w, cx, y); }
          cx += ww;
        });
      });
      return lines;
    };
    const sorted = plants.slice().sort((a, b) => (a.bloom ? a.bloom[0] : 99) - (b.bloom ? b.bloom[0] : 99) || a.name.localeCompare(b.name));
    const byHeight = plants.slice().sort((a, b) => hMean(a) - hMean(b) || a.name.localeCompare(b.name));
    const nNative = plants.filter(p => p.native).length;
    const bbw = bed.bb.w.toFixed(1).replace(/\.0$/, ""), bbh = bed.bb.h.toFixed(1).replace(/\.0$/, "");
    const dimsShort = bed.label + ", " + bbw + " ft × " + bbh + " ft";
    const dimsText = () => bed.label + ", " + bbw + " ft by " + bbh + " ft (" + Math.round(bed.area) + " sq ft)";
    // a rounded content box with a serif title and rich items (bold lead-in + text)
    const richBox = (title, items, y, bg, numbered, bodyCol) => {
      const size = 8.6, lead = 11.2, tx0 = M + 30, tw0 = W - M - 20 - tx0;
      let h = 44; items.forEach(it => { h += flow(it, tx0, 0, tw0, size, lead, C.ink, C.ink, false) * lead + 6; });
      h += 8;
      if (y + h > H - 46) { newPage(); y = 66; }
      fill(bg); stroke(C.rule); doc.setLineWidth(0.6); doc.roundedRect(M, y, W - 2 * M, h, 10, 10, "FD");
      sf("rb", 13); color(C.forest); text(title, M + 18, y + 24);
      let ty = y + 44;
      items.forEach((it, i) => {
        sf("s", size); color(C.ink); text(numbered ? (i + 1) + "." : "\u2022", M + 18, ty);
        const n = flow(it, tx0, ty, tw0, size, lead, bodyCol || C.ink, C.ink, true); ty += n * lead + 6;
      });
      return y + h + 14;
    };

    // ================= Page 1: cover + bloom calendar =================
    progress && progress(0.05, "Cover and bloom calendar");
    fill(C.band); doc.rect(0, 0, W, 262, "F");
    { sf("sb", 7); const bt = "BETA", bw = doc.getTextWidth(bt) + 16; fill("#E5E2F3"); stroke("#BDB7DD"); doc.setLineWidth(0.6); doc.roundedRect(W - M - bw, 26, bw, 14, 7, 7, "FD"); color("#4F4A8A"); text(bt, W - M - bw / 2, 35.6, { align: "center" }); }
    { let ts = 34; sf("rb", ts); while (doc.getTextWidth(gName) > W - 2 * M && ts > 18) { ts -= 1; sf("rb", ts); } color(C.forest); text(gName, M, 80); }
    {
      const nN = plants.filter(p => p.native).length, mix = nN && nN < plants.length ? "Michigan natives + garden favorites" : nN ? "Michigan natives" : "Garden favorites";
      const sub = [lightWords, "Zone 6B", mix, toxicPlants.length ? "Includes plants toxic to pets or people" : "Pet- and people-friendly", prefs.daisy === false && !plants.some(p => p.fam === "daisy") ? "No daisy-family plants" : null].filter(Boolean).join("  ·  ");
      let ss = 10.5; sf("s", ss); while (doc.getTextWidth(sub) > W - 2 * M && ss > 7.5) { ss -= 0.25; sf("s", ss); }
      color(C.ink); text(sub, M, 102);
    }
    sf("s", 8.8); color(C.muted);
    text(plants.length + " perennials (" + nNative + " Michigan native" + (nNative === 1 ? "" : "s") + ", " + (plants.length - nNative) + " garden favorite" + (plants.length - nNative === 1 ? "" : "s") + ") for color from April through November.", M, 119);
    text("Planned for a " + dimsText() + ", with " + placements.length + " plants" + (nWait ? " drawn (" + nWait + " more on the shopping list didn't fit)." : "."), M, 132);
    {
      // 7 photos spread across the bloom order
      const pick = []; const ph0 = window.PHOTO_PLACEHOLDER || []; const cand = sorted.filter(p => window.PHOTOS[p.id] && !ph0.includes(p.id));
      const nS = Math.min(7, cand.length);
      for (let i = 0; i < nS; i++) pick.push(cand[Math.round(i * (cand.length - 1) / Math.max(1, nS - 1))]);
      const uniq = pick.filter((p, i) => pick.indexOf(p) === i);
      const gap = 9, pw = (W - 2 * M - gap * 6) / 7, ph = 92, y0 = 150;
      uniq.forEach((p, i) => photo(p.id, M + i * (pw + gap), y0, pw, ph, 8));
    }
    let y = 284;
    const labW = 187;
    const barsChart = (rows, y0, first) => {
      const x0 = M + labW, cw = W - M - x0, mw = cw / 8, rh = 24;
      sf("rb", 20); color(C.forest); text(first ? "When each plant blooms" : "When each plant blooms (continued)", M, y0); y0 += 16;
      if (first) {
        y0 += para("The chart shows when each chosen plant is in flower. Foliage plants stay green all season and carry the bed between blooms. Garden favorites are marked ◆ and daisy-family plants (related to ragweed) are marked ✿. The small marks under each bar show when to prep each plant (green) and when to cut it back (brown; dashed = optional trim for more flowers). The Care through the year page explains each one.", M, y0 + 4, W - 2 * M, 8.4, 11, C.muted) + 6;
      }
      sf("sb", 7.2); color(C.muted);
      Ch.MONTHS.forEach((m, i) => text(m, x0 + mw * i + mw / 2, y0 + 8, { align: "center" }));
      y0 += 14;
      const top = y0;
      rows.forEach((p, i) => {
        const ry = y0 + i * rh;
        if (p.toxic) { fill("#F8E4E1"); doc.rect(M, ry, W - 2 * M, rh, "F"); fill(TOX); doc.rect(M, ry, 3.5, rh, "F"); }
        else if (i % 2 === 0) stripe(M, ry, W - 2 * M, rh);
      });
      stroke("#DDD6C3"); doc.setLineWidth(0.4);
      for (let i = 0; i <= 8; i++) doc.line(x0 + mw * i, top, x0 + mw * i, top + rows.length * rh);
      rows.forEach((p, i) => {
        const ry = y0 + i * rh;
        sf("sb", 7.8); color(C.ink); text(p.name, M + 6, ry + 10);
        let mx = M + 6 + doc.getTextWidth(p.name + " "); if (!p.native) { sf("s", 6.5); color(C.berry); text("◆", mx, ry + 9.6); mx += doc.getTextWidth("◆ "); } if (p.fam === "daisy") { sf("s", 7); color(DAISY); text("✿", mx, ry + 9.8); }
        sf("s", 6.3); color(C.muted); const subl = rowOf(p) + " of bed  ·  " + Ch.heightText(p); text(subl, M + 6, ry + 18.4);
        if (p.toxic) { sf("sb", 6); const tl = "TOXIC", tw2 = doc.getTextWidth(tl) + 12; fill(TOX); doc.roundedRect(x0 - tw2 - 6, ry + 3.5, tw2, 11, 5.5, 5.5, "F"); color("#FFFFFF"); text(tl, x0 - 6 - tw2 / 2, ry + 11.2, { align: "center" }); }
        if (p.bloom) {
          const bx = x0 + (Ch.pct(p.bloom[0]) / 100) * cw, bw = ((Ch.pct(p.bloom[1]) - Ch.pct(p.bloom[0])) / 100) * cw;
          fill(p.hex); if (p.toxic) { stroke(TOX); doc.setLineWidth(1.6); } else { stroke(Ch.shade(p.hex, 0.78)); doc.setLineWidth(0.5); } doc.roundedRect(bx, ry + 4, bw, 11, 5.5, 5.5, "FD");
        } else {
          fill("#DDE9CD"); stroke("#BCD2A5"); doc.setLineWidth(0.5); doc.roundedRect(x0 + mw * 0.08, ry + 5, cw - mw * 0.16, 9, 4.5, 4.5, "FD");
          sf("s", 6); color("#5E7A52"); text("foliage all season", x0 + cw / 2, ry + 11.4, { align: "center" });
        }
        { const cr = window.Care.careFor(p);
          [["prep", "#7FA86A"], ["cut", "#9C7B5B"], ["trim", null]].forEach(([k, col]) => { const w = cr[k]; if (!w) return; const xa = x0 + Ch.pct(w.a) / 100 * cw, wd = Math.max(4, (Ch.pct(w.b) - Ch.pct(w.a)) / 100 * cw);
            if (col) { fill(col); doc.roundedRect(xa, ry + 17.3, wd, 4.6, 2.3, 2.3, "F"); }
            else { fill("#FFFFFF"); stroke("#9C7B5B"); doc.setLineWidth(0.6); doc.setLineDashPattern([1.2, 1], 0); doc.roundedRect(xa, ry + 17.3, wd, 4.6, 2.3, 2.3, "FD"); doc.setLineDashPattern([], 0); } }); }
      });
      return top + rows.length * rh;
    };
    const perFirst = Math.max(5, Math.floor((H - 60 - y - 120) / 24));
    let bottom = barsChart(sorted.slice(0, perFirst), y, true);
    let rest = sorted.slice(perFirst);
    while (rest.length) {
      newPage();
      const take = rest.slice(0, 26); rest = rest.slice(26);
      bottom = barsChart(take, 66, false);
    }
    // kinds-in-bloom strip + safety note
    let stripDone = false;
    const drawStrip = () => {
      const cov = Ch.bloomCounts(plants), x0 = M + labW, cw = W - M - x0, mw = cw / 8;
      let yy = bottom + 10;
      if (yy > H - 90) { newPage(); yy = 66; }
      sf("sb", 7.2); color(C.muted); text("Kinds in bloom", M + 6, yy + 11);
      const mx = Math.max(1, ...cov);
      cov.forEach((n, i) => {
        const t = n / mx; fill(n === 0 ? "#D9A09A" : Ch.shade("#8DB46F", 1.1 - 0.35 * t));
        doc.roundedRect(x0 + mw * i + 1.5, yy, mw - 3, 16, 3, 3, "F");
        sf("sb", 7.6); color(n === 0 ? "#FFFFFF" : "#1f3a1c"); text(String(n), x0 + mw * i + mw / 2, yy + 11, { align: "center" });
      });
      const gaps = []; cov.forEach((n, i) => { if (n === 0) gaps.push(Ch.MONTHS[i]); });
      sf("ri", 7.2); color(C.muted);
      text(gaps.length ? "No chosen plant is in bloom in " + gaps.join(", ") + "; the foliage plants carry the bed then." : "Something is in bloom in every month from April to November.", M + 6, yy + 30);
      bottom = yy + 38;
    };
    let safetyShown = false;
    {
      const parts = [["About safety: ", true], [toxicPlants.length ? "this plan includes plants that are toxic if eaten: " + toxicPlants.map(p => p.name + " (" + toxLabel(p).replace(/^Toxic to /, "") + ")").join(", ") + ". Keep them away from pets and children who chew on plants. The rest are believed non-toxic. These labels are a starting point, so check the ASPCA toxic and non-toxic plant list (aspca.org/pet-care/animal-poison-control/toxic-and-non-toxic-plants) before you buy. " : "every plant in this plan is believed to be non-toxic to people, dogs and cats, but lists change and look-alikes exist. These labels are a starting point. Check each plant on the ASPCA toxic and non-toxic plant list (aspca.org/pet-care/animal-poison-control/toxic-and-non-toxic-plants) before you buy. No plant is meant to be eaten. If a person or pet has eaten any part of a plant, call Poison Control at 1-800-222-1222 (free, 24 hours; online at poisonhelp.org); for someone unconscious, having trouble breathing or having a seizure, call 911 first. ", false], ["About buying: ", true], ["get the natives as straight species (the Latin name) from a Michigan native nursery; the garden favorites are at any garden center.", false]];
      const maxW = W - 2 * M - 32, n = flow(parts, 0, 0, maxW, 8.2, 11, C.muted, C.muted, false), h = n * 11 + 20;
      if (bottom + 8 + h < H - 52) {
        fill(C.cream); stroke(C.rule); doc.setLineWidth(0.6); doc.roundedRect(M, bottom + 8, W - 2 * M, h, 10, 10, "FD");
        flow(parts, M + 16, bottom + 8 + 18, maxW, 8.2, 11, C.muted, C.muted, true); safetyShown = true; bottom += 8 + h;
      }
    }

    if (bottom + 8 + 40 < H - 52 || page > 1) drawStrip();

    // ================= Care through the year =================
    {
      progress && progress(0.22, "Care calendar");
      const CC = { prep: "#7FA86A", cut: "#9C7B5B", divide: "#8C7FC0", bulbs: "#C99A1E", mulch: "#A68C72" };
      newPage(); heading("Care through the year", 62, 20);
      let cy = 72;
      cy += para("Timing for Michigan zone 6B, based on university extension advice. Most plants are best cut back in spring, not fall: seed heads feed birds over winter, and native bees and butterflies spend the winter in the hollow stems and fallen leaves.", M, cy + 4, W - 2 * M, 8.4, 11, C.muted) + 10;
      const x0 = M + labW, cw = W - M - x0, mw = cw / 8, tasks = window.Care.gardenTasks(plants);
      sf("sb", 7.2); color(C.muted); Ch.MONTHS.forEach((m, i) => text(m, x0 + mw * i + mw / 2, cy + 8, { align: "center" })); cy += 13;
      stripe(M, cy, W - 2 * M, 44);
      stroke("#DDD6C3"); doc.setLineWidth(0.4); for (let i = 0; i <= 8; i++) doc.line(x0 + mw * i, cy, x0 + mw * i, cy + 44);
      sf("sb", 9); color(C.ink); text("Whole garden", M + 6, cy + 18); sf("s", 6.5); color(C.muted); text("Michigan zone 6B", M + 6, cy + 28);
      tasks.forEach(t => { const xa = x0 + Ch.pct(t.a) / 100 * cw, wd = (Ch.pct(t.b) - Ch.pct(t.a)) / 100 * cw, yy = cy + 5 + t.lane * 19;
        fill(CC[t.k]); doc.roundedRect(xa, yy, wd, 14, 7, 7, "F"); sf("sb", 6.8); color("#FFFFFF"); text(t.label, xa + wd / 2, yy + 9.6, { align: "center" }); });
      cy += 56;
      tasks.forEach(t => {
        const parts = [[t.label + ": ", true], [t.text, false]];
        const n = flow(parts, 0, 0, W - 2 * M - 14, 8, 10.6, C.muted, C.ink, false);
        if (cy + n * 10.6 > H - 60) { newPage(); cy = 66; }
        fill(CC[t.k]); doc.circle(M + 4, cy - 2.6, 3, "F");
        flow(parts, M + 14, cy, W - 2 * M - 14, 8, 10.6, C.muted, C.ink, true); cy += n * 10.6 + 5;
      });
      // per-plant table
      cy += 8;
      const cols = [["Plant", M, 108], ["Prep", M + 108, 152], ["Cut back", M + 260, 160], ["Divide", M + 420, W - M - (M + 420)]];
      const th = () => { fill(C.cream); doc.rect(M, cy, W - 2 * M, 15, "F"); sf("sb", 7); color(C.muted); cols.forEach(([t, x]) => text(t.toUpperCase(), x + 5, cy + 10)); cy += 17; };
      if (cy + 60 > H - 60) { newPage(); cy = 66; }
      th();
      plants.slice().sort((p, q) => (p.bloom ? p.bloom[0] : 99) - (q.bloom ? q.bloom[0] : 99) || p.name.localeCompare(q.name)).forEach((p, i) => {
        const cr = window.Care.careFor(p);
        sf("s", 7.2);
        const cells = [wrap(p.name, cols[0][2] - 10), wrap(cr.prep ? cr.prep.sum : "Same time as cut back", cols[1][2] - 10), wrap(cr.cut.sum + (cr.trim ? ". " + cr.trim.sum : ""), cols[2][2] - 10), wrap(cr.divideShort, cols[3][2] - 10)];
        const nl = Math.max(...cells.map(c => c.length)), rhh = nl * 9 + 7;
        if (cy + rhh > H - 56) { newPage(); cy = 66; th(); }
        if (i % 2 === 0) stripe(M, cy, W - 2 * M, rhh);
        cells.forEach((c, ci) => { if (ci === 0) { sf("sb", 7.4); color(C.ink); } else { sf("s", 7.2); color(ci === 1 && cr.prep ? "#3F6B3A" : ci === 2 ? "#5E4430" : C.muted); } text(c, cols[ci][1] + 5, cy + 9.5, { lineHeightFactor: 9 / 7.2 }); });
        cy += rhh;
      });
      sf("ri", 6.8); color(C.muted); if (cy + 14 < H - 50) text("Divide only when a clump is crowded, dying in the middle, or flowering less. Many plants go years without it.", M, cy + 12);
    }
    // ================= Profiles =================
    progress && progress(0.25, "Plant profiles");
    const groups = [["Your plants, smallest to tallest", plants.slice()]];
    groups.forEach(([title, list]) => {
      if (!list.length) return;
      list = list.slice().sort((a, b) => hMean(a) - hMean(b) || a.name.localeCompare(b.name));
      const startPage = (cont) => { newPage(); let t = cont ? title.replace(/ ◆$/, "") + " (continued)" : title; heading(t, 62, cont ? 18 : 20); if (!cont) { sf("s", 8.4); color(C.muted); text("Listed in planting order, from the front edge of the bed to the back.  ◆ = garden favorite (not native).  ✿ = daisy family.", M, 78); } return cont ? 80 : 94; };
      let py = startPage(false); const ch = 129;
      list.forEach(p => {
        if (py + ch > H - 50) py = startPage(true);
        photo(p.id, M, py + 2, 132, 105, 7);
        const tx = M + 148, tw = W - M - tx;
        sf("rb", 14.5); color(C.forest); text(p.name, tx, py + 16); { let sx = tx + doc.getTextWidth(p.name + " ") + 2; if (!p.native) { sf("s", 9); color(C.berry); text("◆", sx, py + 15.5); sx += doc.getTextWidth("◆") + 4; } if (p.fam === "daisy") { sf("s", 9.5); color(DAISY); text("✿", sx, py + 15.7); } }
        sf("ri", 8.4); color(C.muted); text(p.latin, tx, py + 28);
        const row = rowOf(p).toUpperCase() + " ROW"; sf("sb", 6.2); const pw = doc.getTextWidth(row) + 16;
        fill(rowOf(p) === "Front" ? C.leaf2 : C.leaf); doc.roundedRect(W - M - pw, py + 3, pw, 13, 6.5, 6.5, "F"); color("#FFFFFF"); text(row, W - M - pw / 2, py + 12, { align: "center" });
        if (p.toxic) { const tl = toxLabel(p).toUpperCase(); sf("sb", 6.2); const tw3 = doc.getTextWidth(tl) + 16; fill(TOX); doc.roundedRect(W - M - pw - 6 - tw3, py + 3, tw3, 13, 6.5, 6.5, "F"); color("#FFFFFF"); text(tl, W - M - pw - 6 - tw3 / 2, py + 12, { align: "center" }); }
        if (counts[p.id]) { sf("sb", 6.8); color(C.forest); text("In this bed: " + counts[p.id] + (p.clump ? " clumps (about " + counts[p.id] * p.clump + " bulbs)" : ""), W - M, py + 28, { align: "right" }); }
        const c1 = tx, c2 = tx + tw * 0.40, c3 = tx + tw * 0.72;
        const lab = (t, x, y) => { sf("sb", 5.8); color(C.muted); text(t, x, y); };
        const val = (t, x, y, w) => { sf("s", 8.4); color(C.ink); text(wrap(t, w)[0], x, y); };
        lab("HEIGHT", c1, py + 41); val(Ch.heightText(p), c1, py + 51, tw * 0.38);
        lab("SPACING", c2, py + 41); val(p.clump ? "clumps of " + p.clump + ", " + p.spacing + " in apart" : p.spacing + " in apart", c2, py + 51, tw * 0.3);
        lab("PLACE IN BED", c3, py + 41); val(rowOf(p) + " row", c3, py + 51, tw * 0.28);
        lab("BLOOMS", c1, py + 62); val(p.bloom ? Ch.bloomText(p) : "Foliage plant", c1, py + 72, tw * 0.38);
        lab("COLOR", c2, py + 62); fill(p.hex); stroke(Ch.shade(p.hex, 0.75)); doc.setLineWidth(0.4); doc.circle(c2 + 4, py + 69.6, 3.7, "FD"); val(p.color, c2 + 12, py + 72, tw * 0.58 - 12);
        const lt = p.light || "", soil = lt + (p.moisture && !/soil|moist|dry|wet/i.test(lt) ? "; " + p.moisture.toLowerCase() + " soil" : "");
        const parts = [["Light & soil: ", true], [soil, false]];
        const ln = flow(parts, tx, py + 87, tw, 7.8, 10, C.muted, C.muted, true);
        let note = p.notes; if (p.fam === "daisy") note += " Daisy family, like ragweed."; if (deerEats(p) && !/deer/i.test(p.notes)) note += " " + deerText(p);
        const pf = data.prefs || {}, okPref = q => (!(q.toxic && q.toxic.length) || pf.toxic) && !(deerEats(q) && pf.deer === false) && !(q.fam === "daisy" && pf.daisy === false) && (!pf.sun || q.sun.some(s => pf.sun.includes(s))) && (!pf.origin || pf.origin.includes(q.native ? "nat" : "gar"));
        const comps = (window.COMPANIONS && window.COMPANIONS[p.id] || []).filter(c => byId[c.id] && (counts[c.id] || okPref(byId[c.id])));
        const inPlan = comps.filter(c => counts[c.id]).map(c => byId[c.id].name).slice(0, 4);
        const others = comps.filter(c => !counts[c.id]).map(c => byId[c.id].name).slice(0, Math.max(0, 4 - inPlan.length));
        const andJoin = a => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
        sf("s", 7.8); color(C.muted); const nl = wrap(note, tw).slice(0, comps.length ? 2 : 3);
        text(nl, tx, py + 87 + ln * 10, { lineHeightFactor: 10 / 7.8 });
        if (comps.length) {
          // one line only: add names while they fit
          const all = comps.filter(c => counts[c.id]).concat(comps.filter(c => !counts[c.id]));
          sf("sb", 7.8); const lw = doc.getTextWidth("Good neighbors: "); sf("s", 7.8);
          let txt = "";
          for (const c of all) {
            const nm = byId[c.id].name + (counts[c.id] ? " (in this plan)" : "");
            const t2 = txt ? txt + ", " + nm : nm;
            if (lw + doc.getTextWidth(t2 + ".") > tw) break;
            txt = t2;
          }
          if (txt) flow([["Good neighbors: ", true], [txt + ".", false]], tx, py + 87 + ln * 10 + nl.length * 10, tw, 7.8, 10, C.forest, C.muted, true);
        }
        stroke(C.rule); doc.setLineWidth(0.5); doc.line(M, py + ch - 3, W - M, py + ch - 3);
        py += ch;
      });
    });

    // ================= Side view: small to big =================
    progress && progress(0.5, "Small-to-big side view");
    newPage();
    let sy = 62; heading("Planting small to big: front to back", sy, 20); sy += 12;
    sy += para("Put the shortest plants along the edge people see first (the lawn, path or patio side) and step up in height toward the back (the fence, house or trees). Each row is tall enough to be seen over the one in front of it. If the bed is an island that people walk all the way around, put the tallest plants in the middle instead. The bar under each plant shows how far apart to set that kind.", M, sy + 8, W - 2 * M, 8.8, 11.6, C.ink) + 14;
    const k = 1.2, availW = W - 2 * M - 24;
    const colW = p => Math.max(p.spacing * k, 52) + 6;
    const rowsL = []; let cur = [], cw0 = 0;
    byHeight.forEach(p => { const w = colW(p); if (cw0 + w > availW && cur.length) { rowsL.push(cur); cur = []; cw0 = 0; } cur.push(p); cw0 += w; });
    if (cur.length) rowsL.push(cur);
    const silDraw = (p, x, base) => {
      const w = Math.max(10, p.spacing * k), Hh = Math.max(10, p.hHi * k), cx = x + w / 2;
      const half = (rx, ry, f) => {
        const n = 24, pts = []; for (let i = 0; i <= n; i++) { const a = Math.PI * (i / n); pts.push([cx + rx * Math.cos(a), base - ry * Math.sin(a)]); }
        const steps = []; for (let i = 1; i < pts.length; i++) steps.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
        fill(f); stroke(C.leafD); doc.setLineWidth(0.5); doc.lines(steps, pts[0][0], pts[0][1], [1, 1], "FD", true);
      };
      const q = (x0, y0, qx, qy, x1, y1) => {
        const c1x = x0 + (2 / 3) * (qx - x0), c1y = y0 + (2 / 3) * (qy - y0), c2x = x1 + (2 / 3) * (qx - x1), c2y = y1 + (2 / 3) * (qy - y1);
        doc.lines([[c1x - x0, c1y - y0, c2x - x0, c2y - y0, x1 - x0, y1 - y0]], x0, y0, [1, 1], "S");
      };
      const heads = (n, spread, baseY, rx, ry) => {
        for (let i = 0; i < n; i++) {
          const f = n === 1 ? 0 : (i / (n - 1)) * 2 - 1, hx = cx + f * spread, hy = base - Hh + Math.abs(f) * Hh * 0.12 + (i % 2) * Hh * 0.06 + ry;
          stroke(C.leaf2); doc.setLineWidth(0.9); q(cx + f * spread * 0.3, baseY, hx, (baseY + hy) / 2, hx, hy);
          fill(p.hex); stroke(Ch.shade(p.hex, 0.6)); doc.setLineWidth(0.4); doc.ellipse(hx, hy, rx, ry, "FD");
        }
      };
      doc.setLineCap("round");
      if (p.kind === "fern") {
        const n = 9;
        for (let i = 0; i < n; i++) {
          const a = (-72 + (144 * i) / (n - 1)) * Math.PI / 180, len = Hh * (0.95 - 0.18 * Math.abs(Math.sin(a)));
          const tx = cx + Math.sin(a) * Math.min(w * 0.55, len * 0.9), ty = base - Math.cos(a) * len;
          stroke(p.hex); doc.setLineWidth(Math.max(1.6, w * 0.06)); q(cx, base, cx + Math.sin(a) * w * 0.12, base - Math.cos(a) * len * 1.02, tx, ty);
          stroke(Ch.shade(p.hex, 0.65)); doc.setLineWidth(0.4); q(cx, base, cx + Math.sin(a) * w * 0.12, base - Math.cos(a) * len * 1.02, tx, ty);
        }
      } else if (p.kind === "grass") {
        const n = 13;
        for (let i = 0; i < n; i++) {
          const d = (i - (n - 1) / 2) / ((n - 1) / 2), bx = cx + d * w * 0.1, tx = cx + d * w * 0.5, ty = base - Hh * (1 - (0.12 + 0.55 * d * d + 0.06 * (i % 2)));
          stroke(Ch.shade(p.hex, 0.8)); doc.setLineWidth(Math.max(0.9, w * 0.03)); q(bx, base, bx + d * w * 0.05, base - Hh * 0.7, tx, ty);
        }
        if (p.bloom) heads(5, w * 0.32, base - Hh * 0.5, w * 0.04, Hh * 0.05);
      } else if (p.kind === "mat") {
        const mh = Math.min(Hh * 0.62, Math.max(6, Hh * 0.55)); half(w / 2, mh, C.leaf);
        if (p.bloom) heads(Math.min(7, Math.max(3, Math.round(w / 12))), w * 0.4, base - mh * 0.4, Math.max(1.5, w * 0.035), Math.max(2, Hh * 0.06));
      } else {
        const mh = Hh * (p.bloom ? (p.hHi > 30 ? 0.42 : 0.55) : 0.8); half(w / 2, mh, C.leaf);
        if (p.bloom) heads(p.hHi > 36 ? 5 : 4, w * 0.36, base - mh * 0.6, Math.max(1.8, w * 0.05), Math.max(3, Hh * 0.07));
      }
      doc.setLineCap("butt");
    };
    rowsL.forEach((row, ri) => {
      const tall = Math.max(...row.map(p => p.hHi * k)), labelH = 16 + 52 * 0.75 + 30;
      const boxH = 26 + tall + 8 + labelH;
      if (sy + boxH > H - 80) { newPage(); sy = 62; }
      fill(C.stripe); stroke(C.rule); doc.setLineWidth(0.6); doc.roundedRect(M, sy, W - 2 * M, boxH, 10, 10, "FD");
      if (ri === 0) { sf("sb", 6.8); color(C.muted); text("SIDE VIEW  (heights to scale)", M + 14, sy + 16); }
      const base = sy + 26 + tall;
      stroke("#CFC8B2"); doc.setLineWidth(0.5); doc.setLineDashPattern([2.5, 2.5], 0);
      for (let ft = 1; ft * 12 * k <= tall + 2; ft++) { const gy = base - ft * 12 * k; doc.line(M + 34, gy, W - M - 12, gy); sf("s", 6.2); color(C.muted); text(ft + " ft", M + 12, gy + 2); }
      doc.setLineDashPattern([], 0);
      fill(C.soil); doc.rect(M + 8, base, W - 2 * M - 16, 3.5, "F");
      const used = row.reduce((s, p) => s + colW(p), 0); let x = M + 22 + (availW - used) / 2;
      row.forEach(p => {
        const cwid = colW(p), w = Math.max(10, p.spacing * k), sx = x + (cwid - w) / 2;
        if (p.toxic) {
          const Hh2 = Math.max(10, p.hHi * k), pw2 = Math.min(cwid - 4, 50), ph2 = pw2 * 0.75, nl2 = wrap(p.name + marks(p), cwid - 2).slice(0, 2);
          const top = base - Hh2 - 14, bot = base + 20 + ph2 + 8 + nl2.length * 6.8 + 12;
          fill("#F8E4E1"); stroke(TOX); doc.setLineWidth(1.3); doc.roundedRect(x + 1, top, cwid - 2, bot - top, 6, 6, "FD");
          sf("sb", 5.8); const tl = "TOXIC", tw = doc.getTextWidth(tl) + 12; fill(TOX); doc.roundedRect(x + cwid / 2 - tw / 2, top - 5, tw, 10, 5, 5, "F"); color("#FFFFFF"); text(tl, x + cwid / 2, top + 2, { align: "center" });
        }
        silDraw(p, sx, base);
        stroke("#8b8f80"); doc.setLineWidth(0.8); const by = base + 12; doc.line(sx, by, sx + w, by); doc.line(sx, by - 3, sx, by + 3); doc.line(sx + w, by - 3, sx + w, by + 3);
        sf("sb", 6.2); color("#4b5244"); const lab = p.spacing + " in"; const tw = doc.getTextWidth(lab) + 4; fill(C.stripe); doc.rect(sx + w / 2 - tw / 2, by - 4.5, tw, 8, "F"); text(lab, sx + w / 2, by + 2, { align: "center" });
        const pw = Math.min(cwid - 4, 50), ph = pw * 0.75; photo(p.id, x + (cwid - pw) / 2, base + 20, pw, ph, 4);
        sf("sb", 5.8); color(C.ink); const nl = wrap(p.name + marks(p), cwid - 2).slice(0, 2); text(nl, x + cwid / 2, base + 20 + ph + 8, { align: "center", lineHeightFactor: 1.1 });
        sf("s", 5.4); color(C.muted); text(Ch.heightText(p) + (counts[p.id] ? "  ·  ×" + counts[p.id] : ""), x + cwid / 2, base + 20 + ph + 8 + nl.length * 6.8 + 2, { align: "center" });
        x += cwid;
      });
      sy += boxH + 8;
    });
    // front-to-back arrow bar
    {
      if (sy + 22 > H - 60) { newPage(); sy = 62; }
      fill(C.soil); doc.roundedRect(M, sy, W - 2 * M, 20, 4, 4, "F");
      sf("sb", 7.2); color("#FFFFFF"); text("FRONT  (lawn / path side)", M + 12, sy + 13); text("BACK  (fence / house / trees)", W - M - 12, sy + 13, { align: "right" });
      stroke("#FFFFFF"); doc.setLineWidth(0.7); doc.line(M + 150, sy + 10, W - M - 170, sy + 10);
      fill("#FFFFFF"); doc.triangle(W - M - 170, sy + 6, W - M - 170, sy + 14, W - M - 162, sy + 10, "F");
      sy += 34;
    }
    // ================= Shopping list (fills the rest of the page, then continues) =================
    {
      const list = byHeight, rh = 31, uw = W - 2 * M;
      const cx = { qty: uw * 0.50, sp: uw * 0.60, ht: uw * 0.72, bl: uw * 0.86 };
      const hdr = (cont) => {
        sf("rb", 14); color(C.forest); text(cont ? "Shopping list (continued)" : "Shopping list", M, sy); sy += 12;
        if (!cont) { sf("s", 7.4); color(C.muted); text("Tick each plant off as you buy it.  Spacing is center to center.  ◆ = garden favorite (not native)  ✿ = daisy family" + (toxicPlants.length ? "  ! = toxic" : "") + (plants.some(deerEats) ? "  Brown note = deer eat it" : ""), M, sy); sy += 12; }
        sf("sb", 5.8); color(C.muted); text("PLANT", M + 54, sy); text("HOW MANY", M + cx.qty, sy); text("SPACING", M + cx.sp, sy); text("HEIGHT", M + cx.ht, sy); text("BLOOMS", M + cx.bl, sy);
        stroke(C.rule); doc.setLineWidth(0.5); doc.line(M, sy + 4, W - M, sy + 4); sy += 6;
      };
      if (sy + 110 > H - 56) { newPage(); sy = 62; }
      sy += 6; hdr(false);
      list.forEach(p => {
        if (sy + rh > H - 56) { newPage(); sy = 62; hdr(true); }
        stroke("#8b8f80"); doc.setLineWidth(0.7); fill("#FFFFFF"); doc.roundedRect(M + 4, sy + 11, 9, 9, 1.5, 1.5, "FD");
        photo(p.id, M + 18, sy + 4, 30, 22, 3);
        sf("sb", 7.8); color(C.ink); text(p.name + marks(p) + (p.toxic ? " !" : ""), M + 54, sy + 12);
        { let lx = M + 54; const lab0 = p.native ? "Michigan native" : "Garden favorite"; sf("s", 6); color(C.muted); text(lab0, lx, sy + 20); lx += doc.getTextWidth(lab0 + "  ");
          if (deerEats(p)) { const dt = p.deer === "D" ? "Deer often eat" : "Deer sometimes eat"; sf("sb", 6); color("#7A5230"); text(dt, lx, sy + 20); lx += doc.getTextWidth(dt + "  "); }
          if (waiting[p.id] > 0) { sf("sb", 6); color(TOX); text(waiting[p.id] + " won't fit in the bed drawing", lx, sy + 20); } }
        if (p.toxic) { sf("sb", 6); color(TOX); text(toxLabel(p), M + 54, sy + 27.5); }
        sf("sb", 9.5); color(C.forest); text(String(counts[p.id] || 0), M + cx.qty + 14, sy + (p.clump ? 14 : 17), { align: "center" }); if (p.clump) { sf("s", 5.6); color(C.muted); text("clumps, about " + (counts[p.id] || 0) * p.clump + " bulbs", M + cx.qty + 14, sy + 22, { align: "center" }); }
        sf("s", 7.4); color(C.ink); text(p.spacing + " in", M + cx.sp, sy + 16.5); text(Ch.heightText(p), M + cx.ht, sy + 16.5); text(p.bloom ? Ch.bloomText(p) : "Foliage plant", M + cx.bl, sy + 16.5);
        stroke(C.rule); doc.setLineWidth(0.4); doc.line(M, sy + rh, W - M, sy + rh); sy += rh;
      });
      sf("sb", 8.8); color(C.ink); text("Total: " + (placements.length + nWait) + " plants", W - M - 6, sy + 15, { align: "right" }); sy += 26;
    }
    sy = richBox("How to make it look natural", [
      [["Long, uneven drifts. ", true], ["Stretch each group into a long, irregular shape that runs at an angle across the bed, so drifts slide past each other instead of sitting in a row of blobs.", false]],
      [["A living carpet. ", true], ["Tuck a low groundcover into the gaps between the other plants, the way grasses fill a forest floor. It ties everything together and leaves no bare soil for weeds.", false]],
      [["Soft rows, not stair steps. ", true], ["Keep the bed short-to-tall overall, but let a few taller plants come forward and a few shorter ones tuck in behind.", false]],
      [["Repeat, and add strays. ", true], ["Use the same plant in two or three places along the bed, and set one plant off on its own as if it seeded itself there.", false]],
      [["Odd numbers. ", true], ["Plant in groups of 3, 5 or 7 in zigzags and triangles, never in straight lines.", false]],
      [["Pair early and late. ", true], ["Tuck spring bloomers in among plants that fill the space after they go dormant in summer.", false]],
      [["Face the fall color toward the house. ", true], ["If the bed is mostly viewed from a window, put the late bloomers where they show from there in fall.", false]],
    ], sy, C.soft, false);

    // ================= Bed plan =================
    progress && progress(0.7, "Bed plan");
    newPage();
    const planPage = page;
    let by0 = 62; heading("Bed plan: " + dimsShort + ", planted the natural way", by0, 15.5); by0 += 12;
    by0 += para("Each plant is drawn at the size it grows to, so the plan doubles as a spacing guide: plant each one at the center of its drawing. Each grid square is 1 foot. Drifts run at an angle and repeat along the bed.", M, by0 + 8, W - 2 * M, 8.8, 11.6, C.ink) + 18;
    {
      const bb = bed.bb, availBW = W - 2 * M - 26, availBH = 218;
      const sc = Math.min(availBW / bb.w, availBH / bb.h), bw = bb.w * sc, bh = bb.h * sc;
      const bx = M + 22 + (availBW - bw) / 2, byy = by0 + 6;
      const X = x => bx + x * sc, Y = y => byy + (bb.h - y) * sc;
      const pathLines = pts => pts.map((q, i) => i === 0 ? null : [q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]]).slice(1);
      const P = bed.poly.map(q => [X(q[0]), Y(q[1])]);
      const drawPoly = (f, s, lw) => { doc.setLineWidth(lw || 0.5); doc.lines(pathLines(P.concat([P[0]])), P[0][0], P[0][1], [1, 1], f, true); };
      fill("#8E7660"); stroke("#8E7660"); doc.setLineWidth(6); doc.setLineJoin("round"); drawPoly("FD", 1, 6);
      fill("#A68C72"); stroke("#8E7660"); doc.setLineJoin("miter"); drawPoly("F", 0, 0.5);
      // grid lines clipped to polygon by scan intersection
      stroke("#BBA388"); doc.setLineWidth(0.35);
      const segsAt = (c, vertical) => {
        const ints = [];
        for (let i = 0, j = bed.poly.length - 1; i < bed.poly.length; j = i++) {
          const a = bed.poly[j], b = bed.poly[i], ai = vertical ? a[0] : a[1], bi = vertical ? b[0] : b[1];
          if ((ai > c) !== (bi > c)) { const t = (c - ai) / (bi - ai); ints.push(vertical ? a[1] + t * (b[1] - a[1]) : a[0] + t * (b[0] - a[0])); }
        }
        ints.sort((p1, p2) => p1 - p2); const out = []; for (let i = 0; i + 1 < ints.length; i += 2) out.push([ints[i], ints[i + 1]]); return out;
      };
      for (let gx = 1; gx < bb.w; gx++) segsAt(gx, true).forEach(s => doc.line(X(gx), Y(s[0]), X(gx), Y(s[1])));
      for (let gy = 1; gy < bb.h; gy++) segsAt(gy, false).forEach(s => doc.line(X(s[0]), Y(gy), X(s[1]), Y(gy)));
      // plants, big first
      placements.slice().sort((a, b) => byId[b.id].spacing - byId[a.id].spacing).forEach(p => {
        const pl = byId[p.id], r = (pl.spacing / 24) * sc * 0.96;
        fill(pl.hex); stroke("#FFFFFF"); doc.setLineWidth(0.9); doc.circle(X(p.x), Y(p.y), r, "FD");
        font("helvetica", "bold", Math.min(8, Math.max(4.5, r * 0.8))); color(pl.txt); text(pl.code, X(p.x), Y(p.y) + Math.min(8, Math.max(4.5, r * 0.8)) * 0.35, { align: "center" });
      });
      const BADC = { nat: ["#E1EBCB", "#3F6B3A"], gar: ["#F3DDEA", "#8A3F72"], daisy: ["#FBEBC4", "#8A6410"], deer: ["#EFE2D3", "#7A5230"], tox: [TOX, "#FFFFFF"] };
      const kindsOf = pl => { const k = [pl.native ? "nat" : "gar"]; if (pl.fam === "daisy") k.push("daisy"); if (deerEats(pl)) k.push("deer"); if (pl.toxic && pl.toxic.length) k.push("tox"); return k; };
      const pbadge = (k, x, y, br) => {
        const c = BADC[k]; fill(c[0]); stroke("#FFFFFF"); doc.setLineWidth(0.6); doc.circle(x, y, br, "FD");
        const u = br * 0.55;
        if (k === "nat") { fill(c[1]); doc.lines([[u * 0.75, -u * 1.45], [u * 1.1, -u * 0.4], [-u * 0.4, u * 1.1]], x - u * 0.9, y + u * 0.9, [1, 1], "F", true); }
        else if (k === "gar") { fill(c[1]); doc.lines([[u * 0.8, u * 0.9], [-u * 0.8, u * 0.9], [-u * 0.8, -u * 0.9]], x, y - u * 0.9, [1, 1], "F", true); }
        else if (k === "deer") { stroke(c[1]); doc.setLineWidth(br * 0.22); doc.line(x, y + u, x, y - u * 0.1); doc.line(x, y - u * 0.1, x - u * 0.8, y - u); doc.line(x, y - u * 0.1, x + u * 0.8, y - u); doc.line(x - u * 0.4, y - u * 0.55, x - u * 1.05, y - u * 0.45); doc.line(x + u * 0.4, y - u * 0.55, x + u * 1.05, y - u * 0.45); }
        else if (k === "daisy") { sf("s", br * 1.5); color(c[1]); text("✿", x, y + br * 0.5, { align: "center" }); }
        else { font("helvetica", "bold", br * 1.5); color(c[1]); text("!", x, y + br * 0.52, { align: "center" }); }
      };
      const usedK = new Set();
      placements.forEach(p => { const pl = byId[p.id], ks = kindsOf(pl); ks.forEach(k => usedK.add(k)); const r = (pl.spacing / 24) * sc * 0.96, br = Math.max(2.6, Math.min(4.4, r * 0.3)), st = br * 1.85;
        ks.forEach((k, bi) => pbadge(k, X(p.x) + (bi - (ks.length - 1) / 2) * st, Y(p.y) - r * 0.86, br)); });
      { let lx = bx + 4; [["nat", "Michigan native"], ["gar", "Garden favorite"], ["daisy", "Daisy family"], ["deer", "Deer eat it"], ["tox", "Toxic plant"]].filter(q => usedK.has(q[0])).forEach(([k, t]) => { pbadge(k, lx, byy - 12, 4); sf("sb", 6.8); color(k === "tox" ? TOX : C.muted); text(t, lx + 7, byy - 9.6); lx += 7 + doc.getTextWidth(t) + 12; }); }
      font("helvetica", "normal", 6.4); color(C.muted);
      const xs = bb.w > 30 ? 5 : bb.w > 16 ? 2 : 1; for (let gx = 0; gx <= bb.w + 0.01; gx += xs) text(gx + " ft", X(gx), byy + bh + 12, { align: "center" });
      const ys = bb.h > 24 ? 5 : bb.h > 12 ? 2 : 1; for (let gy = 0; gy <= bb.h + 0.01; gy += ys) text(String(gy), bx - 8, Y(gy) + 2, { align: "right" });
      font("helvetica", "bold", 7.2); color("#4b5244");
      text(bed.mode === "island" ? "ALL SIDES ARE THE FRONT: tall plants in the middle" : "FRONT EDGE (lawn / path side)", bx, byy + bh + 24);
      if (bed.mode !== "island") text("BACK (fence / house / trees)", bx + bw, byy - 8, { align: "right" });
      by0 = byy + bh + 48;
    }
    by0 = richBox("Getting the spacing right", [
      [["Mixing two kinds? ", true], ["Average their two spacings. A plant that wants 18 in next to one that wants 12 in goes about 15 in apart.", false]],
      [["Edges: ", true], ["keep plants 6 to 9 in back from the front edge (a few can spill over on purpose), and keep the back row 12 to 18 in from a fence or wall.", false]],
      [["It will look sparse at first. ", true], ["These are mature sizes, so expect bare soil between plants for the first year or two. Mulch it with shredded leaves; by year three the plants touch.", false]],
    ], by0, C.cream, false, C.muted);
    by0 = richBox("Laying it out on the ground", [
      [["Measure it out. ", true], ["Run a tape measure along the front edge and another up one end. Every grid square on the plan is 1 ft, so each plant's spot can be read as “so many feet along, so many feet back.”", false]],
      [["Mark the centers. ", true], ["Put a dot of flour or spray chalk where each plant's center falls. The plant goes on the dot; the drawing only shows how wide it will grow.", false]],
      [["Big plants first. ", true], ["Set out the back-row plants, then the middle, then the front, and finally tuck the low groundcover into the gaps.", false]],
    ], by0, C.soft, true, C.muted);

    // ================= How to plant =================
    progress && progress(0.88, "How to plant");
    newPage();
    let hy = 62; heading("How to plant it", hy, 20); hy += 26;
    const steps = [
      ["Prep the bed this fall (now is perfect)", "Mark the bed outline, mow the grass short, then lay cardboard over it and cover with 4 to 6 inches of shredded leaves or compost. By spring the grass underneath is dead and the soil is soft, with no digging out sod. Skip deep tilling, which pulls buried weed seeds to the surface."],
      ["Plant in spring (or early fall)", "Best windows in zone 6B are late April through early June, after the soil dries enough to work, or late August through September so roots settle in before winter."],
      ["Buy the right plants", "For the natives, buy straight species from a native nursery; small plugs are cheap and root in fast. Garden favorites come in quart or gallon pots at most garden centers." + (plants.some(p => p.id === "bluebells") ? " Virginia bluebells are often sold as dormant roots." : "")],
      ["Lay it out before digging", "Use the bed plan on page " + planPage + ": mark a few 1-ft grid lines with string or flour, set every pot on its drawn spot, then stand back and adjust until it looks right before digging."],
      ["Plant at the right depth", "Dig a hole about twice as wide as the pot and just as deep. Loosen circling roots, set the crown level with the soil, firm it in and water well."],
      ["Mulch lightly and water the first season", "Use 1 to 2 inches of shredded leaves, kept off the crowns. Water about an inch a week if it doesn't rain during the first summer; after that the plants mostly take care of themselves."],
      ["Be patient", "Perennials follow the old rule: the first year they sleep, the second year they creep, the third year they leap. The bed will look sparse at first and fill in by year three."],
      ["Easy yearly care", "No fertilizer needed. Leave stems standing over winter for bees and birds, then cut them back in spring once days are steadily in the 50s. Pinch turtlehead and cut asters back by half in early June. Water astilbe, ferns and other moisture lovers in dry spells."],
    ];
    steps.forEach(([t, d], i) => {
      sf("s", 9); const ls = wrap(d, W - 2 * M - 40), h = 20 + ls.length * 12;
      if (hy + h > H - 54) { newPage(); hy = 62; }
      fill(C.forest); doc.circle(M + 10, hy + 6, 10, "F");
      sf("sb", 10); color("#FFFFFF"); text(String(i + 1), M + 10, hy + 9.6, { align: "center" });
      sf("rb", 11.5); color(C.ink); text(t, M + 36, hy + 8);
      sf("s", 9); color(C.ink); text(ls, M + 36, hy + 24, { lineHeightFactor: 12 / 9 }); hy += h + 12;
    });
    const noteBox = (parts, bg, bd, col) => {
      const maxW = W - 2 * M - 32, n = flow(parts, 0, 0, maxW, 8.8, 12, col, col, false), h = n * 12 + 22;
      if (hy + h > H - 54) { newPage(); hy = 62; }
      fill(bg); stroke(bd); doc.setLineWidth(0.6); doc.roundedRect(M, hy, W - 2 * M, h, 10, 10, "FD");
      flow(parts, M + 16, hy + 19, maxW, 8.8, 12, col, col, true); hy += h + 10;
    };
    { const bl = plants.filter(p => p.kind === "bulb");
      if (bl.length) noteBox([["Spring bulbs: ", true], [(bl.length === 1 ? bl[0].name + " is" : bl.map(p => p.name).join(", ").replace(/, ([^,]*)$/, " and $1") + " are") + " planted as bulbs in the fall, not as potted plants in spring. In Michigan, plant them in October once the soil cools, 6 to 8 inches deep, in clumps of 5 to 8 bulbs. Each spot on the bed plan is one clump. They bloom in spring and their leaves die back by early summer, which is why the plan lets them sit right among the later perennials that grow up and hide the fading leaves. Let the leaves turn yellow before you cut them off; they feed next year's flowers.", false]], C.soft, C.rule, C.ink); }
    { const dp = plants.filter(deerEats);
      if (dp.length) noteBox([["Deer: ", true], [dp.map(p => p.name).join(", ").replace(/, ([^,]*)$/, " and $1") + (dp.length === 1 ? " is" : " are") + " rated by Rutgers University as plants deer often or sometimes eat. No plant is deer-proof, and rabbits nibble many young plants too. If deer visit your yard, protect these with fencing or a repellent, or swap them for plants deer leave alone.", false]], C.soft, C.rule, C.ink); }
    noteBox([["Where to buy: ", true], ["for the natives, Michigan native plant nurseries such as Wildtype Native Plant Nursery in Mason and Michigan Wildflower Farm in Portland, plus local native plant sales (often run by Wild Ones chapters and conservation districts) every May. The garden favorites are stocked at most garden centers and nurseries from April on.", false]], C.soft, C.rule, C.ink);
    {
      const daisy = plants.filter(p => p.fam === "daisy").map(p => p.name);
      if (daisy.length) {
        const list = daisy.length === 1 ? daisy[0] : daisy.slice(0, -1).join(", ") + " and " + daisy[daisy.length - 1];
        noteBox([["Allergy note: ", true], [list + (daisy.length === 1 ? " is" : " are") + " (marked ✿) in the daisy family along with ragweed. Most are pollinated by insects rather than wind, so they are a less common cause of hay fever than ragweed, but anyone with a daisy-family allergy should check with an allergist before planting them.", false]], "#FBF3DC", "#EBD9A0", "#6B520F");
      }
    }
    if (toxicPlants.length) noteBox([["Toxic plants in this plan: ", true], [toxicPlants.map(p => p.name + " (" + toxLabel(p).replace(/^Toxic to /, "") + ")").join(", ") + ". Every part can make a pet or person sick if chewed or eaten. Plant them where pets and small children don't play, wear gloves when handling foxglove, hellebore and bleeding heart, and call your vet or the ASPCA Animal Poison Control Center (888-426-4435) if a pet eats one. For a person who has eaten a plant, call Poison Control at 1-800-222-1222 (free, 24 hours; online at poisonhelp.org); if someone is unconscious, having trouble breathing or having a seizure, call 911 first.", false]], "#F8E4E1", "#E7B9B2", "#7A2A22");
    if (!safetyShown) noteBox([["Pet and people safety: ", true], [toxicPlants.length ? "the plants not listed above are believed to be non-toxic to people, dogs and cats. Check each plant on the ASPCA toxic and non-toxic plant list (aspca.org/pet-care/animal-poison-control/toxic-and-non-toxic-plants) before buying. For a person who has eaten a plant, call Poison Control at 1-800-222-1222 (free, 24 hours; online at poisonhelp.org); if someone is unconscious, having trouble breathing or having a seizure, call 911 first." : "every plant in this plan is believed to be non-toxic to people, dogs and cats, but lists change and look-alikes exist. Check each plant on the ASPCA toxic and non-toxic plant list before buying, and don't eat anything from the garden unless you know it is edible. Check the ASPCA list at aspca.org/pet-care/animal-poison-control/toxic-and-non-toxic-plants. For a person who has eaten a plant, call Poison Control at 1-800-222-1222 (free, 24 hours; online at poisonhelp.org); if someone is unconscious, having trouble breathing or having a seizure, call 911 first.", false]], C.cream, C.rule, C.ink);

    // ================= Credits =================
    progress && progress(0.95, "Photo credits");
    {
      if (hy + 120 > H - 54) { newPage(); hy = 62; }
      sf("sb", 6.8); color(C.muted); text("PHOTO CREDITS", M, hy + 14); hy += 24;
      hy += para("Photos are from Wikimedia Commons and are used under their Creative Commons or public-domain licenses. Each entry shows the file name, photographer and license; search the file name at commons.wikimedia.org to see the original.", M, hy, W - 2 * M, 6.6, 8.6, C.muted);
      hy += para("This guide was made with Perennial Bed Planner (beta), an early test version: please double-check plant details before you buy. The planner's own text, plant notes and research are \u00A9 2026 spreck79, shared under Creative Commons Attribution-NonCommercial 4.0 (CC BY-NC 4.0, creativecommons.org/licenses/by-nc/4.0): free to share and adapt for non-commercial use with credit. Photos keep their own licenses, listed below.", M, hy + 2, W - 2 * M, 6.6, 8.6, C.muted) + 2;
      const parts = []; plants.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach(p => {
        const c = (window.CREDITS && window.CREDITS[p.id]) || p.credit || {}; if (!c.file) return;
        parts.push([p.name + ": ", true]); parts.push([c.file.replace(/_/g, " ") + (c.by || c.lic ? " (" + [c.by, c.lic].filter(Boolean).join(", ") + ")" : "") + "  ·  ", false]);
      });
      let yy = hy + 4; const maxW = W - 2 * M, lead = 8.2, size = 6.2;
      const total = flow(parts, M, 0, maxW, size, lead, C.muted, C.muted, false);
      // may run across pages: flow in chunks
      let chunk = [], used = 0;
      const avail = () => Math.floor((H - 54 - yy) / lead);
      if (total <= avail()) flow(parts, M, yy, maxW, size, lead, C.muted, C.muted, true);
      else { newPage(); yy = 66; heading("Photo credits", 62, 15); yy = 82; flow(parts, M, yy, maxW, size, lead, C.muted, C.muted, true); }
    }

    // footers
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i); stroke(C.rule); doc.setLineWidth(0.6); doc.line(M, H - 40, W - M, H - 40);
      sf("s", 7.2); color(C.muted); text(gName + "  ·  Zone 6B  ·  Southern Michigan", M, H - 26); text(String(i), W - M, H - 26, { align: "right" });
      sf("s", 6); text("Made with Perennial Bed Planner (beta)  ·  CC BY-NC 4.0  ·  Photos have their own licenses", M, H - 16);
    }
    return doc;
  }
  window.PDFExport = { make };
})();
