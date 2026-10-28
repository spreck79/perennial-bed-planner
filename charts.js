// Chart helpers: bloom bars, month coverage, and the side-view silhouettes.
(function () {
  const MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];
  const T0 = 4, T1 = 12;
  const pct = v => Math.max(0, Math.min(100, ((v - T0) / (T1 - T0)) * 100));

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.round(r * f); g = Math.round(g * f); b = Math.round(b * f);
    return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
  }
  function bloomText(p) {
    if (!p.bloom) return "Foliage plant";
    const mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const a = Math.floor(p.bloom[0]), b = Math.floor(p.bloom[1] - 0.001);
    return a === b ? mo[a - 1] : mo[a - 1] + " – " + mo[b - 1];
  }
  function heightText(p) {
    const f = v => v >= 36 ? (v / 12) + " ft" : v + " in";
    return p.hLo >= 36 ? (p.hLo / 12) + "–" + (p.hHi / 12) + " ft" : p.hHi > 36 ? f(p.hLo) + " – " + f(p.hHi) : p.hLo + "–" + p.hHi + " in";
  }
  function bloomCounts(plants) {
    const out = [];
    for (let i = 0; i < 8; i++) {
      const m = T0 + i; let c = 0;
      plants.forEach(p => { if (p.bloom && Math.min(p.bloom[1], m + 1) - Math.max(p.bloom[0], m) >= 0.35) c++; });
      out.push(c);
    }
    return out;
  }

  // Side-view silhouette. k = pixels per inch. Width = spacing, height = full mature height.
  function silSVG(p, k) {
    const w = Math.max(14, p.spacing * k), H = Math.max(14, p.hHi * k), cx = w / 2;
    const leaf = "#6E9A5B", leaf2 = "#8DB36F", leafD = "#557F47", stroke = "rgba(0,0,0,.28)";
    let s = `<svg class="sil" width="${w.toFixed(1)}" height="${H.toFixed(1)}" viewBox="0 0 ${w.toFixed(1)} ${H.toFixed(1)}" aria-hidden="true">`;
    const heads = (n, top, spread, baseY, rx, ry) => {
      let t = "";
      for (let i = 0; i < n; i++) {
        const f = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
        const x = cx + f * spread, y = top + Math.abs(f) * H * 0.12 + (i % 2) * H * 0.06;
        t += `<path d="M${(cx + f * spread * 0.3).toFixed(1)} ${baseY.toFixed(1)} Q${x.toFixed(1)} ${((baseY + y) / 2).toFixed(1)} ${x.toFixed(1)} ${(y + ry).toFixed(1)}" stroke="${leaf2}" stroke-width="1.6" fill="none"/>`;
        t += `<ellipse cx="${x.toFixed(1)}" cy="${(y + ry).toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${p.hex}" stroke="${stroke}" stroke-width=".8"/>`;
      }
      return t;
    };
    if (p.kind === "fern") {
      const n = 9;
      for (let i = 0; i < n; i++) {
        const a = (-72 + (144 * i) / (n - 1)) * Math.PI / 180, len = H * (0.95 - 0.18 * Math.abs(Math.sin(a)));
        const tx = cx + Math.sin(a) * Math.min(w * 0.55, len * 0.9), ty = H - Math.cos(a) * len;
        const qx = cx + Math.sin(a) * w * 0.12, qy = H - Math.cos(a) * len * 1.02;
        s += `<path d="M${cx} ${H} Q${qx.toFixed(1)} ${qy.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}" stroke="${p.hex}" stroke-width="${Math.max(3, w * 0.07).toFixed(1)}" stroke-linecap="round" fill="none" opacity=".92"/>`;
        s += `<path d="M${cx} ${H} Q${qx.toFixed(1)} ${qy.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}" stroke="${shade(p.hex, .7)}" stroke-width="1" stroke-linecap="round" fill="none"/>`;
      }
    } else if (p.kind === "grass") {
      const n = 13;
      for (let i = 0; i < n; i++) {
        const d = (i - (n - 1) / 2) / ((n - 1) / 2), bx = cx + d * w * 0.1;
        const tx = cx + d * w * 0.5, ty = H * (0.12 + 0.55 * Math.abs(d) * Math.abs(d) + 0.06 * (i % 2));
        s += `<path d="M${bx.toFixed(1)} ${H} Q${(bx + d * w * 0.05).toFixed(1)} ${(H * 0.3).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}" stroke="${shade(p.hex, .8)}" stroke-width="${Math.max(1.6, w * 0.035).toFixed(1)}" stroke-linecap="round" fill="none"/>`;
      }
      if (p.bloom) s += heads(5, 0, w * 0.32, H * 0.5, w * 0.04, H * 0.05);
    } else if (p.kind === "mat") {
      const mh = Math.min(H * 0.62, Math.max(8, H * 0.55));
      s += `<ellipse cx="${cx}" cy="${H}" rx="${w / 2}" ry="${mh}" fill="${leaf}" stroke="${leafD}" stroke-width=".8"/>`;
      s += `<ellipse cx="${cx}" cy="${H}" rx="${w * 0.32}" ry="${mh * 0.62}" fill="${leaf2}" opacity=".85"/>`;
      if (p.bloom) s += heads(Math.min(7, Math.max(3, Math.round(w / 14))), 0, w * 0.4, H - mh * 0.4, Math.max(2.2, w * 0.035), Math.max(3, H * 0.06));
    } else { // clump
      const mh = H * (p.bloom ? (p.hHi > 30 ? 0.42 : 0.55) : 0.8);
      s += `<ellipse cx="${cx}" cy="${H}" rx="${w / 2}" ry="${mh}" fill="${leaf}" stroke="${leafD}" stroke-width=".8"/>`;
      s += `<ellipse cx="${cx - w * 0.12}" cy="${H}" rx="${w * 0.3}" ry="${mh * 0.7}" fill="${leaf2}" opacity=".85"/>`;
      if (p.bloom) s += heads(p.hHi > 36 ? 5 : 4, 0, w * 0.36, H - mh * 0.6, Math.max(2.4, w * 0.05), Math.max(4, H * 0.07));
    }
    return s + "</svg>";
  }

  window.Charts = { MONTHS, T0, T1, pct, shade, bloomText, heightText, bloomCounts, silSVG };
})();
