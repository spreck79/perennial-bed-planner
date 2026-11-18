// A short lesson played on top of the page: it lights up one thing at a time, says what it does, and can play a
// demonstration with a moving pointer. Used for painting the sun (app.js) and drawing a bed (plan.js).
//
//   Lesson.run({ kick, steps, last, reset, onClose })
//     kick     the small heading, e.g. "Painting the sun"
//     steps    [{ t: title, html, target: () => [elements to light up], below: true (card beside the target, not
//                over it), card: () => [elements the card must not cover, when that is more than the target],
//                lit: () => [other elements that stay bright], under: () => element the card sits right under,
//                demo: async api => {...} }]
//     last     the label of the last step's button ("Start painting")
//     reset    called before every step and replay, to put things back the way they were
//     onClose  called once when the lesson ends (finished, skipped or Esc)
(function () {
  "use strict";
  const STOP = {};
  // a phone or tablet: the pointer is drawn as a fingertip, and demonstrations can press and hold or pinch
  const TOUCH = !!(window.matchMedia && window.matchMedia("(hover: none) and (pointer: coarse)").matches);
  const FINGER = '<i></i><b></b><svg class="sl-lp" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="19" fill="none" stroke="#F2C40F" stroke-width="4" stroke-dasharray="119.4" stroke-dashoffset="119.4" transform="rotate(-90 22 22)"/></svg>';
  let on = false;
  function run(cfg) {
    if (on) return; on = true; document.body.classList.add("lessonon");
    const steps = cfg.steps;
    let at = 0, runId = 0;
    const ov = document.createElement("div"); ov.id = "lesson"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", cfg.kick);
    ov.innerHTML = '<svg class="sl-veil" aria-hidden="true"><path fill-rule="evenodd"></path></svg><div class="sl-ring"></div><div class="sl-cur" hidden>' + FINGER + '</div><div class="sl-cur sl-cur2" hidden></div><div class="sl-card"><div class="sl-kick"><span></span><span class="sl-dots"></span></div><h3></h3><div class="sl-body"></div><div class="sl-foot"><button type="button" class="whybtn sl-skip">Skip</button><span class="sl-grow"></span><button type="button" class="btn small sl-back">Back</button><button type="button" class="btn small primary sl-next">Next</button></div></div>';
    ov.classList.toggle("touch", TOUCH); document.body.appendChild(ov);
    const veil = ov.querySelector(".sl-veil"), ring = ov.querySelector(".sl-ring"), card = ov.querySelector(".sl-card"), cur = ov.querySelector(".sl-cur"), body = ov.querySelector(".sl-body"), dot = cur.querySelector("i"), tag = cur.querySelector("b"), cur2 = ov.querySelector(".sl-cur2");
    const union = els => { const r = els.filter(Boolean).map(e => e.getBoundingClientRect()); return { left: Math.min(...r.map(x => x.left)), top: Math.min(...r.map(x => x.top)), right: Math.max(...r.map(x => x.right)), bottom: Math.max(...r.map(x => x.bottom)) }; };
    function place() {
      const s = steps[at], ring0 = union(s.target()), pad = 5;
      Object.assign(ring.style, { left: ring0.left - pad + "px", top: ring0.top - pad + "px", width: ring0.right - ring0.left + pad * 2 + "px", height: ring0.bottom - ring0.top + pad * 2 + "px" });
      const r = s.card ? union(s.card()) : ring0;   // the card can be told to keep clear of more than the ringed thing
      // lit: other things that stay bright next to the ringed one. The page is then dimmed by a sheet with a hole for each.
      const lit = s.lit ? s.lit().filter(Boolean).map(e => e.getBoundingClientRect()) : [];
      ov.classList.toggle("holes", lit.length > 0);
      if (lit.length) {
        const hole = (q, p) => { const x = q.left - p, y = q.top - p, w = q.right - q.left + 2 * p, h = q.bottom - q.top + 2 * p, c = 12; return `M${x + c} ${y}h${w - 2 * c}a${c} ${c} 0 0 1 ${c} ${c}v${h - 2 * c}a${c} ${c} 0 0 1 ${-c} ${c}h${-(w - 2 * c)}a${c} ${c} 0 0 1 ${-c} ${-c}v${-(h - 2 * c)}a${c} ${c} 0 0 1 ${c} ${-c}Z`; };
        veil.setAttribute("viewBox", `0 0 ${innerWidth} ${innerHeight}`);
        veil.firstChild.setAttribute("d", `M0 0H${innerWidth}V${innerHeight}H0Z` + hole(ring0, pad) + lit.map(q => hole(q, 2)).join(""));
      }
      const cw = Math.min(360, innerWidth - 20); card.style.width = cw + "px";
      const ch = card.offsetHeight;
      let top = r.bottom + 14, left = r.left;
      const u = s.under && s.under();
      if (u) { const q = u.getBoundingClientRect(); left = q.left; top = Math.min(q.bottom + 12, innerHeight - ch - 10); card.style.width = Math.min(cw, Math.max(260, q.right - q.left)) + "px"; }   // parked right under something, every step
      else if (s.below) {      // beside the target when there's room (so it stays in view), else under it
        if (r.left >= cw + 24) { left = r.left - cw - 14; top = Math.min(r.top, innerHeight - ch - 10); }
        else { left = r.left + (r.right - r.left - cw) / 2; top = Math.min(r.bottom + 12, innerHeight - ch - 10); }
      } else if (top + ch > innerHeight - 10) top = Math.max(10, r.top - ch - 14);
      card.style.left = Math.max(10, Math.min(left, innerWidth - cw - 10)) + "px"; card.style.top = Math.max(10, top) + "px";
    }
    // what a demonstration can do; every step stops quietly if the lesson has moved on
    function makeApi(id) {
      const live = () => on && id === runId, ok = () => { if (!live()) throw STOP; };
      const wait = ms => new Promise(res => setTimeout(res, ms)).then(ok);
      const pos = { x: 0, y: 0 };
      const to = async (x, y, ms) => { ok(); pos.x = x; pos.y = y; cur.style.transitionDuration = ms + "ms"; cur.style.left = x + "px"; cur.style.top = y + "px"; await wait(ms + 30); };
      const mid = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
      const api = {
        live, wait, to, pos, touch: TOUCH,
        start(x, y) { cur.hidden = false; cur2.hidden = true; cur.classList.remove("down", "clk", "lp"); tag.textContent = ""; dot.style.width = dot.style.height = "0px"; pos.x = x; pos.y = y; cur.style.transitionDuration = "0ms"; cur.style.left = x + "px"; cur.style.top = y + "px"; },
        toEl: (el, ms) => to(...mid(el), ms),
        // move in small steps, calling each(x, y) along the way (for dragging and painting)
        async glide(x, y, ms, each) { const n = Math.max(2, Math.round(ms / 55)), x0 = pos.x, y0 = pos.y; for (let i = 1; i <= n; i++) { await to(x0 + (x - x0) * i / n, y0 + (y - y0) * i / n, ms / n); each && each(pos.x, pos.y); } },
        async click() { ok(); cur.classList.remove("clk"); void cur.offsetWidth; cur.classList.add("clk"); await wait(240); },
        async press(el, ms) { await api.toEl(el, ms || 600); el.classList.add("sl-press"); await api.click(); el.classList.remove("sl-press"); },
        hold(v) { cur.classList.toggle("down", !!v); },
        // a finger held still while a ring fills around it
        async longPress(ms) { ok(); cur.style.setProperty("--lp", ms + "ms"); cur.classList.add("down", "lp"); try { await wait(ms + 60); } finally { cur.classList.remove("down", "lp"); } },
        // two fingers moving apart (or together) around a spot; each(f) is called along the way with f from 0 to 1
        async pinch(x, y, g0, g1, ms, each) {
          const put = (g, d) => { const o = g * 0.35; [[cur, -o, o], [cur2, o, -o]].forEach(([c, dx, dy]) => { c.style.transitionDuration = d + "ms"; c.style.left = x + dx + "px"; c.style.top = y + dy + "px"; }); };
          await to(x - g0 * 0.35, y + g0 * 0.35, 450); put(g0, 0); cur2.hidden = false; cur.classList.add("down"); cur2.classList.add("down");
          const n = Math.max(4, Math.round(ms / 60));
          try { await wait(250); for (let i = 1; i <= n; i++) { put(g0 + (g1 - g0) * i / n, ms / n); await wait(ms / n); each && each(i / n); } await wait(250); }
          finally { cur2.hidden = true; cur.classList.remove("down"); cur2.classList.remove("down"); pos.x = x - g1 * 0.35; pos.y = y + g1 * 0.35; }
        },
        brush(px) { dot.style.width = dot.style.height = px + "px"; },
        note(t) { tag.textContent = t || ""; }
      };
      return api;
    }
    function play() {
      const s = steps[at], id = ++runId;
      cur.hidden = cur2.hidden = true; cfg.reset && cfg.reset(s);
      if (!s.demo) return;
      Promise.resolve().then(() => s.demo(makeApi(id))).catch(e => { if (e !== STOP) console.error(e); });
    }
    function show() {
      const s = steps[at];
      ov.querySelector(".sl-kick span").textContent = cfg.kick + " · " + (at + 1) + " of " + steps.length;
      ov.querySelector(".sl-dots").innerHTML = steps.map((x, i) => "<i class='" + (i < at ? "done" : i === at ? "on" : "") + "'></i>").join("");
      ov.querySelector("h3").textContent = s.t; body.innerHTML = s.html;
      const next = ov.querySelector(".sl-next"); ov.querySelector(".sl-back").hidden = at === 0; next.textContent = at === steps.length - 1 ? cfg.last || "Done" : "Next";
      if (s.demo) { const again = document.createElement("button"); again.type = "button"; again.className = "whybtn sl-again"; again.textContent = "Play it again"; again.onclick = play; body.appendChild(again); }
      cur.hidden = true; runId++; cfg.reset && cfg.reset(s);
      requestAnimationFrame(() => { if (!on) return; place(); play(); next.focus(); });
    }
    function close(skipped) {
      if (!on) return; runId++; on = false; cfg.reset && cfg.reset(null);
      document.body.classList.remove("lessonon"); ov.remove();
      removeEventListener("resize", place); removeEventListener("scroll", place, true); removeEventListener("keydown", onKey, true);
      const name = { "Drawing your bed": "draw", "Painting the sun": "sun", "Adding objects": "objects" }[cfg.kick];
      if (name && window.Stats) window.Stats.use("lesson-" + name + "-" + (skipped ? "skip" : "done"));   // usage counts (stats.js)
      cfg.onClose && cfg.onClose(!!skipped);
    }
    ov.querySelector(".sl-next").onclick = () => { if (at === steps.length - 1) close(false); else { at++; show(); } };
    ov.querySelector(".sl-back").onclick = () => { if (at > 0) { at--; show(); } };
    ov.querySelector(".sl-skip").onclick = () => close(true);
    // Esc skips the lesson, and nothing else on the page hears that key press
    const onKey = e => { if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); close(true); } };
    addEventListener("keydown", onKey, true);
    addEventListener("resize", place); addEventListener("scroll", place, true);
    show();
  }
  window.Lesson = { run, touch: TOUCH, get on() { return on; } };
})();
