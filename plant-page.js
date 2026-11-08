// Plant page: "Print this plant" makes a one-page PDF of what the page shows (as plant-view.js drew it),
// then opens the same full-screen preview as the planner's PDF guide: Back, Print, Download.
// Drawn with jsPDF and the guide's DejaVu fonts (loaded from the site the first time the button is pressed).
(function () {
  const $ = s => document.querySelector(s);
  const DATA = window.PLANT_VIEW;
  if (!DATA) return;                 // no such plant
  const S = DATA.sheet;
  const W = 612, H = 792, M = 40;
  const C = { forest: "#3F6B3A", ink: "#2E3A2C", muted: "#6B7464", rule: "#D9D3C2", band: "#ECEFE0", soft: "#EEF0E2", stripe: "#F7F5EE" };
  // the guide's icon colors (background, mark), and the tag colors used on the site
  const ICON = { nat: ["#E1EBCB", "#3F6B3A"], gar: ["#F3DDEA", "#8A3F72"], daisy: ["#FBEBC4", "#8A6410"], deer: ["#EFE2D3", "#7A5230"], tox: ["#B8392E", "#FFFFFF"], cold: ["#4F7FB4", "#FFFFFF"] };
  const TAG = { nat: ["#E1EBCB", "#3F6B3A"], gar: ["#F3DDEA", "#8A3F72"], daisy: ["#FBEBC4", "#8A6410"], deer: ["#EFE2D3", "#6A4526"], tox: ["#F6D9D5", "#9A2E24"], cold: ["#DCE7F3", "#2F5D8C"] };
  const MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"], T0 = 4, T1 = 12;
  const rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

  function build(k) {           // k: size factor, made smaller until everything fits on one page
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "letter", compress: true });
    const FN = window.PDF_FONTS;
    if (FN) {
      doc.addFileToVFS("DejaVuSans.ttf", FN.Sans); doc.addFont("DejaVuSans.ttf", "Sans", "normal");
      doc.addFileToVFS("DejaVuSans-Bold.ttf", FN.SansBold); doc.addFont("DejaVuSans-Bold.ttf", "Sans", "bold");
      doc.addFileToVFS("DejaVuSerif-Bold.ttf", FN.SerifBold); doc.addFont("DejaVuSerif-Bold.ttf", "Serif", "bold");
      doc.addFileToVFS("DejaVuSerif-Italic.ttf", FN.SerifItalic); doc.addFont("DejaVuSerif-Italic.ttf", "Serif", "italic");
    }
    const fill = h => doc.setFillColor(...rgb(h)), stroke = h => doc.setDrawColor(...rgb(h)), color = h => doc.setTextColor(...rgb(h));
    const sf = (f, sz) => {
      sz *= k;
      if (!FN) { doc.setFont(f === "rb" ? "times" : "helvetica", f === "sb" || f === "rb" ? "bold" : f === "ri" ? "italic" : "normal"); doc.setFontSize(sz * 0.9); return; }
      doc.setFont(f === "rb" ? "Serif" : f === "ri" ? "Serif" : "Sans", f === "s" ? "normal" : f === "ri" ? "italic" : "bold"); doc.setFontSize(sz);
    };
    const text = (t, x, y, o) => doc.text(t, x, y, o);
    const wrap = (t, w) => doc.splitTextToSize(String(t), w);
    // rich text: parts = [[text, "s"|"sb"|"ri", color]]; returns the y after the last line
    const flow = (parts, x, y, maxW, size, lead) => {
      let cx = x;
      parts.forEach(([t, f, col]) => String(t).split(/(\s+)/).forEach(w => {
        if (!w) return; sf(f, size);
        if (/^\s+$/.test(w)) { cx += doc.getTextWidth(" "); return; }
        const ww = doc.getTextWidth(w);
        if (cx + ww - x > maxW + 0.5 && cx > x) { cx = x; y += lead; }
        color(col || C.ink); text(w, cx, y); cx += ww;
      }));
      return y + lead;
    };
    const drawIc = (kd, x, y, br) => {
      const c = ICON[kd]; fill(c[0]); doc.circle(x, y, br, "F");
      const u = br * 0.55;
      if (kd === "nat") { fill(c[1]); doc.lines([[u * 0.75, -u * 1.45], [u * 1.1, -u * 0.4], [-u * 0.4, u * 1.1]], x - u * 0.9, y + u * 0.9, [1, 1], "F", true); }
      else if (kd === "gar") { fill(c[1]); doc.lines([[u * 0.8, u * 0.9], [-u * 0.8, u * 0.9], [-u * 0.8, -u * 0.9]], x, y - u * 0.9, [1, 1], "F", true); }
      else if (kd === "deer") { stroke(c[1]); doc.setLineCap("round"); doc.setLineWidth(br * 0.22); doc.line(x, y + u, x, y - u * 0.1); doc.line(x, y - u * 0.1, x - u * 0.8, y - u); doc.line(x, y - u * 0.1, x + u * 0.8, y - u); doc.line(x - u * 0.4, y - u * 0.55, x - u * 1.05, y - u * 0.45); doc.line(x + u * 0.4, y - u * 0.55, x + u * 1.05, y - u * 0.45); }
      else if (kd === "cold") { stroke(c[1]); doc.setLineCap("round"); doc.setLineWidth(br * 0.17); [0, 60, 120].forEach(a => { const t = a * Math.PI / 180, dx = Math.sin(t) * br * 0.62, dy = Math.cos(t) * br * 0.62; doc.line(x - dx, y - dy, x + dx, y + dy); }); }
      else if (kd === "daisy") { doc.setFontSize(br * 1.6); if (FN) doc.setFont("Sans", "normal"); color(c[1]); text("✿", x, y + br * 0.55, { align: "center" }); }
      else { doc.setFontSize(br * 1.5); if (FN) doc.setFont("Sans", "bold"); color(c[1]); text("!", x, y + br * 0.53, { align: "center" }); }
    };
    const heading = (t, y) => { sf("rb", 13); color(C.forest); text(t, M, y); return y + 13 * k; };

    // ---- header line and hero (name, marks, notes beside the big photo)
    const pw = 262, ph = pw * 3 / 4, px = W - M - pw, py = 46, tw = px - M - 18;
    const heroText = (draw) => {        // draw=false only measures, so the band behind it can be sized first
      const T = doc.text.bind(doc), R = doc.roundedRect.bind(doc), Ci = doc.circle.bind(doc), L = doc.line.bind(doc), Ls = doc.lines.bind(doc);
      if (!draw) { doc.text = () => doc; doc.roundedRect = () => doc; doc.circle = () => doc; doc.line = () => doc; doc.lines = () => doc; }
      try { return heroBody(); } finally { doc.text = T; doc.roundedRect = R; doc.circle = Ci; doc.line = L; doc.lines = Ls; }
    };
    const heroBody = () => {
      let y = py + 22 * k;
      let ns = 26; sf("rb", ns); while (doc.getTextWidth(S.name) > tw && ns > 15) { ns -= 1; sf("rb", ns); }
      color(C.forest); text(S.name, M, y); y += 15 * k;
      sf("ri", 11); color(C.muted); text(S.latin, M, y); y += 16 * k;
      // marks as tags with the planner's icons
      let tx = M;
      S.marks.forEach(([kd, lab]) => {
        sf("sb", 7.6); const w = doc.getTextWidth(lab) + 26 * k;
        if (tx + w > M + tw) { tx = M; y += 18 * k; }
        fill(TAG[kd][0]); doc.roundedRect(tx, y - 10 * k, w, 15 * k, 7.5 * k, 7.5 * k, "F");
        drawIc(kd, tx + 9 * k, y - 2.5 * k, 5 * k);
        sf("sb", 7.6); color(TAG[kd][1]); text(lab, tx + 18 * k, y + 0.5 * k); tx += w + 5;
      });
      y += 20 * k;
      sf("s", 9.6); color(C.ink); const lines = wrap(S.notes, tw); text(lines, M, y, { lineHeightFactor: 1.42 }); y += lines.length * 9.6 * k * 1.42;
      return y;
    };
    const heroEnd = heroText(false), bandH = Math.max(py + ph + 30, heroEnd + 16);
    fill(C.band); doc.rect(0, 0, W, bandH, "F");
    sf("rb", 11); color(C.forest); text("Perennial Bed Planner", M, 28);
    { sf("sb", 6.5); const bw = doc.getTextWidth("BETA") + 12, bx = M + 4 + (sf("rb", 11), doc.getTextWidth("Perennial Bed Planner")); sf("sb", 6.5);
      fill("#E5E2F3"); stroke("#BDB7DD"); doc.setLineWidth(0.5); doc.roundedRect(bx + 4, 19, bw, 12, 6, 6, "FD"); color("#4F4A8A"); text("BETA", bx + 4 + bw / 2, 27.4, { align: "center" }); }
    sf("s", 7.5); color(C.muted); text("All perennials · Zone 6B · Southern Michigan", W - M, 28, { align: "right" });
    const photoD = window.PHOTO_FULL && window.PHOTO_FULL[DATA.id];
    if (photoD) {
      try { doc.saveGraphicsState(); doc.roundedRect(px, py, pw, ph, 8, 8, null); doc.clip(); doc.discardPath(); doc.addImage(photoD, "JPEG", px, py, pw, ph); doc.restoreGraphicsState(); }
      catch (e) { doc.restoreGraphicsState(); }
    }
    stroke(C.rule); doc.setLineWidth(0.5); doc.roundedRect(px, py, pw, ph, 8, 8, "S");
    const credit = (S.sources.find(s => s[0] === "Photo") || [])[1];
    if (credit) { sf("s", 6.4); color(C.muted); text("Photo: " + credit, px, py + ph + 10); }
    heroText(true);
    let y = bandH + 24 * k;

    // ---- at a glance: two columns of facts
    y = heading("At a glance", y) + 4 * k;
    const colW = (W - 2 * M - 20) / 2, half = Math.ceil(S.facts.length / 2), labW = 84 * k;
    const factCol = (list, x) => {
      let fy = y;
      list.forEach(([lab, val, sub, hex], i) => {
        if (i) { stroke(C.rule); doc.setLineWidth(0.4); doc.line(x, fy - 9 * k, x + colW, fy - 9 * k); }
        sf("sb", 7.6); color(C.muted); text(lab, x, fy);
        let vx = x + labW; const vw = colW - labW;
        if (hex) { fill(hex); stroke("#B9B39E"); doc.setLineWidth(0.4); doc.circle(vx + 4 * k, fy - 2.8 * k, 3.6 * k, "FD"); vx += 12 * k; }
        sf("s", 8.6); color(C.ink); const vl = wrap(val, vw - (hex ? 12 * k : 0)); text(vl, vx, fy, { lineHeightFactor: 1.3 }); let hgt = vl.length * 8.6 * k * 1.3;
        if (sub) { sf("s", 7.2); color(C.muted); const sl = wrap(sub, vw); text(sl, x + labW, fy + hgt, { lineHeightFactor: 1.3 }); hgt += sl.length * 7.2 * k * 1.3; }
        fy += Math.max(hgt, 10 * k) + 9 * k;
      });
      return fy;
    };
    y = Math.max(factCol(S.facts.slice(0, half), M), factCol(S.facts.slice(half), M + colW + 20)) + 8 * k;

    // ---- through the year: bars from April to November, then the care steps
    y = heading("Through the year", y) + 6 * k;
    const bx = M + 66 * k, bw = W - M - bx, mw = bw / 8, pct = v => Math.max(0, Math.min(1, (v - T0) / (T1 - T0)));
    sf("s", 6.8); color(C.muted); MONTHS.forEach((m, i) => text(m, bx + i * mw + mw / 2, y, { align: "center" })); y += 7 * k;
    S.year.forEach(([lab, a, b, col]) => {
      sf("sb", 7.2); color(C.muted); text(lab, M, y + 6.5 * k);
      for (let i = 0; i < 8; i++) { fill(i % 2 ? C.stripe : C.soft); doc.rect(bx + i * mw, y, mw, 9 * k, "F"); }
      fill(col); const x0 = bx + pct(a) * bw, x1 = Math.max(x0 + 7, bx + pct(b) * bw); doc.roundedRect(x0, y, x1 - x0, 9 * k, 4.5 * k, 4.5 * k, "F");
      y += 13 * k;
    });
    y += 8 * k;
    S.care.forEach(([lab, t]) => { sf("s", 8.4); color(C.ink); text("•", M, y); y = flow([[lab + ": ", "sb", C.ink], [t, "s", C.ink]], M + 10, y, W - 2 * M - 10, 8.4, 11 * k) + 2 * k; });
    y += 10 * k;

    // ---- goes well with: every partner once, then up to three of the source sentences (the page lists them all)
    if (S.neighbors.length) {
      y = heading("Goes well with", y) + 6 * k;
      const seen = new Set(), all = [];
      S.neighbors.forEach(g => g.plants.forEach(pl => { if (!seen.has(pl[0])) { seen.add(pl[0]); all.push(pl); } }));
      let cx = M;
      all.forEach(([nm, hex]) => {
        sf("sb", 7.8); const w = doc.getTextWidth(nm) + 20 * k;
        if (cx + w > W - M) { cx = M; y += 17 * k; }
        fill(C.soft); doc.roundedRect(cx, y - 10 * k, w, 14 * k, 7 * k, 7 * k, "F");
        fill(hex); stroke("#B9B39E"); doc.setLineWidth(0.4); doc.circle(cx + 7.5 * k, y - 3 * k, 3 * k, "FD"); color(C.ink); text(nm, cx + 13 * k, y); cx += w + 5;
      });
      y += 17 * k;
      const shown = S.neighbors.slice(0, 3);
      shown.forEach(g => { y = flow([["\u201C" + g.why + "\u201D", "ri", C.ink], [" " + g.src.join(", "), "s", C.muted]], M, y, W - 2 * M, 8, 10.4 * k) + 3 * k; });
      if (S.neighbors.length > shown.length) { sf("s", 7.4); color(C.muted); text("More sources for these pairings are on the plant's page on the website.", M, y); y += 10 * k; }
      y += 6 * k;
    }

    // ---- sources, small
    y = heading("Sources", y) + 4 * k;
    S.sources.forEach(([lab, t]) => { y = flow([[lab + ": ", "sb", C.muted], [t, "s", C.muted]], M, y, W - 2 * M, 7.2, 9.4 * k); });
    sf("s", 6.6); color(C.muted);
    text("Made with Perennial Bed Planner (beta) · spreck79.github.io/perennial-bed-planner · Photos have their own licenses", W / 2, H - 20, { align: "center" });
    return { doc, end: y };
  }

  function makePdf() {
    let k = 1, r = build(k);
    while (r.end > H - 34 && k > 0.7) { k -= 0.04; r = build(k); }      // one page: shrink a little until it fits
    return r.doc;
  }

  // ---- the preview, the same as the planner's (computers use the browser's PDF viewer; phones get drawn pages)
  let pvUrl = null, pvBlob = null, pvName = "", pvFrame = null, pvPrev = null;
  const loadScript = src => new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => no(new Error("Couldn't load " + src)); document.head.appendChild(s); });
  const toast = (msg, ms) => { const t = $("#toast"); if (!t) return; t.textContent = msg; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), ms || 2600); };
  function closePreview() {
    $("#pvw").hidden = true; $("#pvBody").innerHTML = ""; pvFrame = null;
    if (pvUrl) { URL.revokeObjectURL(pvUrl); pvUrl = null; } pvBlob = null;
    document.body.style.overflow = ""; if (pvPrev && pvPrev.focus) pvPrev.focus();
  }
  function openPreview(doc, fname) {
    pvBlob = doc.output("blob"); pvName = fname; if (pvUrl) URL.revokeObjectURL(pvUrl); pvUrl = URL.createObjectURL(pvBlob);
    const box = $("#pvw"), body = $("#pvBody"); pvPrev = document.activeElement; body.innerHTML = ""; $("#pvName").textContent = fname; box.hidden = false; document.body.style.overflow = "hidden";
    $("#pvSave").focus();
    const phone = window.matchMedia("(pointer: coarse)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
    if (!phone && navigator.pdfViewerEnabled !== false) { const f = document.createElement("iframe"); f.title = "Plant page PDF preview"; f.src = pvUrl; body.appendChild(f); pvFrame = f; return; }
    const msg = document.createElement("div"); msg.className = "pvw-msg"; msg.textContent = "Getting the page ready…"; body.appendChild(msg);
    const url = pvUrl;
    (window.pdfjsLib ? Promise.resolve() : loadScript("lib/pdf.min.js")).then(() => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "lib/pdf.worker.min.js";
      return pvBlob.arrayBuffer();
    }).then(buf => pdfjsLib.getDocument({ data: buf }).promise).then(async pdf => {
      if (pvUrl !== url) return; body.innerHTML = "";
      const w = Math.min(body.clientWidth - 16, 900), dpr = Math.min(window.devicePixelRatio || 1, 2);
      for (let i = 1; i <= pdf.numPages; i++) {
        const pg = await pdf.getPage(i), v0 = pg.getViewport({ scale: 1 }), v = pg.getViewport({ scale: w / v0.width * dpr });
        const c = document.createElement("canvas"); c.width = Math.floor(v.width); c.height = Math.floor(v.height); c.style.width = Math.floor(v.width / dpr) + "px";
        body.appendChild(c); await pg.render({ canvasContext: c.getContext("2d"), viewport: v }).promise;
      }
    }).catch(err => { console.error(err); if (pvUrl === url) body.innerHTML = '<div class="pvw-msg">Sorry, the preview could not be shown here. You can still use Download or Print.</div>'; });
  }
  function pvDownload() {
    if (!pvBlob) return; const a = document.createElement("a"); a.href = pvUrl; a.download = pvName; document.body.appendChild(a); a.click(); a.remove();
    toast("Saved “" + pvName + "” to your Downloads folder.", 4000);
  }
  function pvPrintIt() {
    if (!pvBlob) return;
    const viaFrame = f => { try { f.contentWindow.focus(); f.contentWindow.print(); return true; } catch (e) { return false; } };
    if (pvFrame && viaFrame(pvFrame)) return;
    const h = document.createElement("iframe"); h.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;"; h.src = pvUrl; document.body.appendChild(h);
    h.onload = () => { setTimeout(() => { if (!viaFrame(h)) window.open(pvUrl, "_blank"); setTimeout(() => h.remove(), 60000); }, 300); };
  }
  $("#pvBack").addEventListener("click", closePreview); $("#pvSave").addEventListener("click", pvDownload); $("#pvPrint").addEventListener("click", pvPrintIt);
  window.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#pvw").hidden) { e.preventDefault(); closePreview(); } }, true);
  $("#btnPdf").addEventListener("click", () => {
    const btn = $("#btnPdf"); btn.disabled = true; const label = btn.textContent; btn.textContent = "Making the PDF…";
    (window.jspdf ? Promise.resolve() : loadScript("lib/jspdf.umd.min.js"))
      .then(() => window.PDF_FONTS ? null : loadScript("fonts.js"))
      .then(() => openPreview(makePdf(), S.name + " - Perennial Bed Planner.pdf"))
      .catch(err => { console.error(err); toast("Sorry, the PDF couldn't be made: " + err.message, 5000); })
      .finally(() => { btn.disabled = false; btn.textContent = label; });
  });
})();
