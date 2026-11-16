#!/usr/bin/env node
// A quick end-to-end test to run before every push:  node build/smoke.js
// It opens the site in a real (hidden) browser two ways and stops at the first thing that's broken:
//   A. from the plant folders, the way http://localhost:8321 works
//   B. from the published copy (build/site.js), the way the live site works
// Needs Playwright (npm install playwright). It only reads; nothing in the site is changed.
"use strict";
const http = require("http"), fs = require("fs"), path = require("path"), os = require("os"), { spawn, execFileSync } = require("child_process");
let chromium; try { ({ chromium } = require("playwright")); } catch (e) { console.error("Playwright isn't installed here (npm install playwright)."); process.exit(2); }
const SITE = path.join(__dirname, ".."), PORT_A = 8611, PORT_B = 8612;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml" };
const folders = fs.readdirSync(path.join(SITE, "data", "plants")).filter(d => fs.existsSync(path.join(SITE, "data", "plants", d, "plant.json")));
let failed = 0;
const ok = (cond, what) => { console.log((cond ? "  ok    " : "  FAIL  ") + what); if (!cond) failed++; };

(async () => {
  const srvA = spawn(process.execPath, [path.join(__dirname, "serve.js"), "--no-open"], { env: Object.assign({}, process.env, { PORT: String(PORT_A) }), stdio: "ignore" });
  const dirB = fs.mkdtempSync(path.join(os.tmpdir(), "pbp-site-"));
  execFileSync(process.execPath, [path.join(__dirname, "site.js"), dirB], { stdio: "ignore" });
  const srvB = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p.endsWith("/")) p += "index.html";
    const f = path.join(dirB, path.normalize(p));
    if (!f.startsWith(dirB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
  }).listen(PORT_B, "127.0.0.1");
  await new Promise(r => setTimeout(r, 1200));
  const browser = await chromium.launch();
  try {
    for (const [label, port] of [["A. from the plant folders", PORT_A], ["B. the published copy", PORT_B]]) {
      console.log(label);
      const base = "http://localhost:" + port + "/", page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
      const errs = [], urls = [];
      page.on("pageerror", e => errs.push(e.message)); page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
      page.on("request", r => urls.push(r.url()));
      await page.goto(base);
      await page.waitForFunction(() => window.Plan && window.PLANTS && window.PLANTS.length, null, { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(500);
      const n = await page.evaluate(() => (window.PLANTS || []).length);
      ok(n === folders.length, "planner shows every plant folder (" + n + " of " + folders.length + ")");
      ok(await page.evaluate(() => document.querySelectorAll("#lib .pcard").length > 0 && document.querySelectorAll(".lc-dot").length === 8), "plant list and color dots are drawn");
      ok(!urls.some(u => /jspdf|fonts\.js|\/pdf\.js/.test(u)), "the PDF maker isn't fetched until it's needed");
      if (port === PORT_B) {
        ok(urls.some(u => u.includes("plants.all.json")) && !urls.some(u => u.endsWith("/plant.json")), "plants come from the one published file");
        const vs = new Set(urls.filter(u => /\.(js|css)\?v=/.test(u)).map(u => u.split("?v=")[1]));
        ok(vs.size === 1, "every script and stylesheet carries the same version stamp");
      }
      await page.click("#btnExample"); await page.waitForTimeout(1500);
      ok(await page.evaluate(() => document.querySelectorAll("#lib .pcard.on, #lib .pcard").length > 0 && JSON.parse(localStorage.getItem("shadeGardenPlanner.v1") || "{}").placements.length > 10), "the example garden loads");
      await page.click("#btnPdf");
      const made = await page.waitForSelector("#pvw:not([hidden])", { timeout: 60000 }).then(() => true, () => false);
      ok(made, "the PDF guide is made");
      await page.keyboard.press("Escape");
      for (const [u, test] of [["plant.html?id=" + folders[0], () => document.querySelectorAll(".chip").length > 0], ["credits.html", () => document.querySelectorAll("a[href^='http']").length > 20], ["help.html", () => !!document.querySelector("h1, h2")]]) {
        await page.goto(base + u); await page.waitForTimeout(1500);
        ok(await page.evaluate(test), u.split("?")[0] + " opens");
      }
      ok(!errs.length, "no errors in the browser" + (errs.length ? ": " + errs.slice(0, 3).join(" | ") : ""));
      await page.close();
    }
  } finally { await browser.close(); srvA.kill(); srvB.close(); fs.rmSync(dirB, { recursive: true, force: true }); }
  console.log(failed ? "\n" + failed + " thing(s) broken. Don't push yet." : "\nAll good.");
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
