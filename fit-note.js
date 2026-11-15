// A friendly note for screens too small for the planner: phones, and tablets held upright.
// Computers and sideways tablets never see it. "Look around anyway" / "Keep it upright" is remembered.
(function () {
  const store = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: k => { try { localStorage.setItem(k, "1"); } catch (e) {} }
  };
  const sprout = '<svg viewBox="0 0 32 32" fill="none" stroke="#3F6B3A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 29V14"/><path d="M16 18c-6 0-9-3-9-8 6 0 9 3 9 8z"/><path d="M16 14c0-5 3-8 9-8 0 5-3 8-9 8z"/></svg>';
  const turn = '<svg viewBox="0 0 64 64" fill="none" stroke="#3F6B3A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="20" y="8" width="24" height="40" rx="4"/><path d="M8 40h40v16H8z" opacity=".35"/><path d="M52 22a20 20 0 0 1-6 18"/><path d="M41 38l5 2 1-5"/></svg>';
  const NOTES = {
    phone: { key: "fitnote-phone", html: sprout + "<h2>Made for bigger screens</h2><p>The planner needs room to lay out a garden bed. It works best on a computer, or on an iPad or other tablet turned sideways.</p><button type=\"button\">Look around anyway</button>" },
    upright: { key: "fitnote-upright", html: turn + "<h2>Turn your tablet sideways</h2><p>The planner works best in landscape, with the bed and the plant list side by side.</p><button type=\"button\">Keep it upright</button>" }
  };
  let shown = null;
  function which() {
    const touch = window.matchMedia && matchMedia("(pointer: coarse)").matches;
    if (Math.min(screen.width, screen.height) < 600) return "phone";        // a phone, either way up
    if (touch && innerHeight > innerWidth) return "upright";               // a tablet held upright
    return null;
  }
  function update() {
    const kind = which(), want = kind && !store.get(NOTES[kind].key) ? kind : null;
    if (want === shown) return;
    const old = document.getElementById("fitnote"); if (old) old.remove();
    shown = want;
    if (!want) return;
    const d = document.createElement("div");
    d.id = "fitnote"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true");
    d.innerHTML = '<div class="box">' + NOTES[want].html + "</div>";
    d.querySelector("button").onclick = () => { store.set(NOTES[want].key); update(); };
    document.body.appendChild(d);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", update); else update();
  addEventListener("resize", update);
  addEventListener("orientationchange", update);
})();
