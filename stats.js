// Counts how the site is used, for the owner's own spreadsheet. Nothing about the person is collected:
// no name, no IP address, no ID, no cookies. The browser only remembers which month it was last counted in,
// so each browser is one visitor per month however often it reloads.
//
// What is sent, as plain counts: new visitor this month (yes/no), computer/tablet/phone, the name of the
// site a visitor came from (google.com, not the page), and what was used: plants added, plant pages opened,
// PDF guides made with the choices behind them, the tour, lessons, the example garden, saving and opening a plan.
//
// Turn it off for one browser (the owner's): open the site once with ?stats=off at the end of the address.
// ?stats=on turns it back on. It never runs on localhost.
//
// window.Stats: add(id)  page(id)  plantPdf(id)  use(name)  guide({...})
(function () {
  "use strict";
  const ENDPOINT = "https://script.google.com/macros/s/AKfycbx5hY-cdESRyc6afPImbbv-QOlNCVdRFVP1rEi19dhSTUqvksu4es3el5SiTi0HvhgC/exec";   // the Google Apps Script web app address; empty = counting is off
  const OFF = "pbp.statsOff", MONTH = "pbp.countedMonth";
  const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }, del: k => { try { localStorage.removeItem(k); } catch (e) {} } };

  const q = /[?&]stats=(off|on)\b/.exec(location.search);
  if (q) { if (q[1] === "off") ls.set(OFF, "1"); else ls.del(OFF); }
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === "file:";
  const live = !!ENDPOINT && !local && ls.get(OFF) !== "1";

  const ev = { add: new Set(), page: new Set(), ppdf: new Set(), use: new Set(), guide: null };
  let dirty = false;
  const mark = () => { dirty = true; };
  window.Stats = {
    add: id => { if (id) { ev.add.add(String(id)); mark(); } },
    page: id => { if (id) { ev.page.add(String(id)); mark(); } },
    plantPdf: id => { if (id) { ev.ppdf.add(String(id)); mark(); } },
    use: name => { if (name) { ev.use.add(String(name)); mark(); } },
    guide: g => { ev.guide = g; mark(); send(); },   // a PDF guide is the end of the job: send it right away
    off: !live
  };
  if (!live) return;

  const device = (() => {
    const coarse = matchMedia("(pointer: coarse)").matches, small = Math.min(screen.width, screen.height);
    return coarse ? (small < 600 ? "phone" : "tablet") : "computer";
  })();
  const source = (() => {   // just the other site's name, e.g. "google"
    try {
      if (!document.referrer) return "direct";
      const h = new URL(document.referrer).hostname.replace(/^(www|m|l|lm)\./, "");
      if (h === location.hostname) return "";
      const known = ["google", "bing", "duckduckgo", "yahoo", "facebook", "instagram", "pinterest", "reddit", "youtube", "github"];
      const k = known.find(n => h === n + ".com" || h.indexOf(n + ".") === 0 || h.indexOf("." + n + ".") > 0);
      return k || h.slice(0, 60);
    } catch (e) { return ""; }
  })();

  const month = new Date().toISOString().slice(0, 7);
  let isNew = ls.get(MONTH) !== month;

  function send() {
    if (!dirty && !isNew) return;
    if (ls.get(OFF) === "1") return;   // switched off on the Help page while this page was open
    const body = { v: 1, new: isNew ? 1 : 0, dev: device, src: isNew ? source : "",
      add: [...ev.add], page: [...ev.page], ppdf: [...ev.ppdf], use: [...ev.use], guide: ev.guide };
    const json = JSON.stringify(body);
    let ok = false;
    try { ok = navigator.sendBeacon(ENDPOINT, new Blob([json], { type: "text/plain" })); } catch (e) {}
    if (!ok) try { fetch(ENDPOINT, { method: "POST", mode: "no-cors", keepalive: true, body: json, headers: { "Content-Type": "text/plain" } }); } catch (e) {}
    if (isNew) { ls.set(MONTH, month); isNew = false; }
    ev.add.clear(); ev.page.clear(); ev.ppdf.clear(); ev.use.clear(); ev.guide = null; dirty = false;
  }
  // a new visitor is counted a moment after the page opens; everything else goes when the page is left or hidden
  setTimeout(send, 3000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") send(); });
  addEventListener("pagehide", send);
})();
