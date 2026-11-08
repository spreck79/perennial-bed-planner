#!/usr/bin/env node
// Runs the website on this computer at http://localhost:8321, exactly as it is in this folder.
//
//   node build/serve.js --install     start it hidden whenever you log in to Windows, and start it now
//   node build/serve.js --uninstall   stop starting it at log-in
//   node build/serve.js               run it in this window (close the window to stop) The site reads the plant folders in data/plants every time a page opens and keeps watching them, so
// adding, deleting or editing a plant folder shows up in the open page within a few seconds. Nothing is built or
// copied, and nothing is sent anywhere; only this computer can open it.
"use strict";
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto"), { spawn } = require("child_process");
const SITE = path.join(__dirname, ".."), PLANTS = path.join(SITE, "data", "plants");

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".pdf": "application/pdf", ".woff2": "font/woff2" };

// which plant folders there are, and a fingerprint that changes whenever any file in them changes
function folders() {
  const ids = [], h = crypto.createHash("sha1");
  for (const d of fs.readdirSync(PLANTS, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (!d.isDirectory() || !fs.existsSync(path.join(PLANTS, d.name, "plant.json"))) continue;
    ids.push(d.name);
    for (const f of fs.readdirSync(path.join(PLANTS, d.name)).sort()) { const st = fs.statSync(path.join(PLANTS, d.name, f)); h.update(d.name + "/" + f + ":" + st.size + ":" + st.mtimeMs + ";"); }
  }
  const x = path.join(SITE, "data", "extra-sources.json");
  if (fs.existsSync(x)) { const st = fs.statSync(x); h.update("extra:" + st.size + ":" + st.mtimeMs); }
  return { ids, version: h.digest("hex").slice(0, 16) };
}

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p === "/__plants") { res.writeHead(200, { "Content-Type": TYPES[".json"], "Cache-Control": "no-store" }); res.end(JSON.stringify(folders())); return; }
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(SITE, path.normalize(p).replace(/^([/\\])+/, ""));
  if (!f.startsWith(SITE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404, { "Content-Type": "text/plain" }); res.end("Not found: " + p); return; }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(f).pipe(res);
});

// a log next to this file, so problems can be looked at later (the site normally runs hidden)
const LOG = path.join(__dirname, "serve-log.txt");
const log = m => { try { fs.appendFileSync(LOG, new Date().toISOString() + "  " + m + "\n"); } catch (e) {} };
process.on("uncaughtException", e => { log("error: " + (e && e.stack || e)); process.exit(1); });

// --install: start this site hidden whenever you log in to Windows, and start it now
// --background: start it hidden now (this window can be closed)
// --uninstall: stop starting it at log-in
const STARTUP = process.platform === "win32" ? path.join(process.env.APPDATA || "", "Microsoft", "Windows", "Start Menu", "Programs", "Startup") : "";
const LINK = path.join(STARTUP, "Perennial Bed Planner.lnk");
function startHidden() {
  spawn(process.execPath, [__filename], { detached: true, stdio: "ignore", windowsHide: true }).unref();
}
function makeShortcut() {
  const q = t => "'" + String(t).replace(/'/g, "''") + "'";       // a PowerShell string
  const ps = [
    "$s = (New-Object -ComObject WScript.Shell).CreateShortcut(" + q(LINK) + ")",
    "$s.TargetPath = " + q(process.execPath),
    "$s.Arguments = " + q('"' + __filename + '" --background'),
    "$s.WorkingDirectory = " + q(SITE),
    "$s.WindowStyle = 7",
    "$s.Save()"
  ].join("; ");
  const enc = Buffer.from(ps, "utf16le").toString("base64");
  require("child_process").execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", enc], { stdio: "inherit" });
}
if (process.argv.includes("--uninstall")) {
  try { fs.unlinkSync(LINK); } catch (e) {}
  for (const f of ["Perennial Bed Planner.vbs"]) try { fs.unlinkSync(path.join(STARTUP, f)); } catch (e) {}
  console.log("It won't start at log-in any more. (If it's running now, it stops when you restart the computer.)");
  process.exit(0);
}
if (process.argv.includes("--install")) {
  try { fs.unlinkSync(path.join(STARTUP, "Perennial Bed Planner.vbs")); } catch (e) {}
  makeShortcut();
  console.log("Done: it will start hidden whenever you log in to Windows.");
  startHidden();
  console.log("Started now. Open http://localhost:8321 (give it a few seconds). You can close this window.");
  process.exit(0);
}
if (process.argv.includes("--background")) { startHidden(); process.exit(0); }

function listen(port, triesLeft) {
  server.once("error", e => {
    if (e.code === "EADDRINUSE") { log("already running at http://localhost:" + port + " (nothing to do)"); console.log("It's already running: http://localhost:" + port); process.exit(0); }
    log("error: " + e.message); console.error(e.message); process.exit(1);
  });
  server.listen(port, "127.0.0.1", () => {
    const url = "http://localhost:" + port + "/";
    log("running at " + url);
    console.log("Perennial Bed Planner, running from this folder: " + url);
    console.log("Add, delete or change plant folders in data\\plants: the open page updates by itself.");
    console.log("Leave this window open while you use it; close it to stop.");
    if (process.argv.includes("--no-open") || !process.stdout.isTTY) return;
    if (process.platform === "win32") spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    else if (process.platform === "darwin") spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
  });
}
listen(Number(process.env.PORT) || 8321);
