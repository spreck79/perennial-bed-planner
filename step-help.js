// The small round "?" on every step, beside Done: a short how-to for that step in a pop-up.
(function () {
  const HELP = {
    nameCard: `<h3>Naming your garden</h3>
<p>Give your garden a name, like <i>Backyard Shade Garden</i>. It goes at the top of the planner, on your PDF guide and in the name of saved files. It's optional, so you can skip it.</p>
<h4>Just looking around?</h4><p>Press <b>Load an example garden</b> to see a finished plan with plants, objects and sun already mapped. It replaces what you have, so use <b>Save plan</b> first if you want to keep your own.</p>
<h4>Your work is kept</h4><p>The planner saves as you go, in this browser on this computer. <b>Save plan</b> downloads a copy you can open on another computer with <b>Open plan</b>.</p>
<div class="hfoot"><span>More help: the Help button at the top.</span><button type="button" class="btn primary hclose">Got it</button></div>`,
    prefCard: `<h3>Choosing your kind of garden</h3>
<h4>Michigan natives or garden favorites</h4><ul><li><b>Michigan natives</b> grow wild in Michigan and feed local bees, butterflies and birds. Buy them from a Michigan native plant nursery.</li><li><b>Garden favorites</b> ◆ are popular plants sold at Michigan garden centers. A native that garden centers also sell shows both marks.</li><li>Pick both to see everything.</li></ul>
<h4>Kinds of plants</h4><p>Click a kind to turn it on or off: <b>Flowers</b>, <b>Ferns</b>, <b>Grasses &amp; sedges</b>, <b>Groundcovers</b> (low plants that spread and fill the gaps) and <b>Spring bulbs</b> (planted in fall, bloom in spring). <b>All</b> turns them all on.</p>
<p>The bar shows how many plants match. The Plants list shows only those, so you can change your mind any time.</p>
<div class="hfoot"><span>At least one choice has to stay on.</span><button type="button" class="btn primary hclose">Got it</button></div>`,
    avoidCard: `<h3>Plants to watch out for</h3>
<p>For each one, pick <b>Include</b> or <b>Leave out</b>. Plants you include are marked with an icon in the Plants list, on the bed plan and in the PDF guide. <b>Why?</b> on each row gives the full story.</p>
<ul class="hsun"><li><span class="ic ic-tox">!</span> <b>Toxic plants</b>: can make pets or people sick if eaten. Leave them out if pets or small children chew on plants.</li><li><b>Plants deer like to eat</b>: rated by Rutgers University. Leave them out if deer visit your yard.</li><li><span class="ic ic-cold">❄</span> <b>Need winter care here</b>: not hardy in zone 6B, so they're dug up in fall, brought indoors or replanted each year.</li><li><span class="ic ic-inv">↔</span> <b>Can escape the garden</b>: not native, and on a Michigan list of plants that spread into natural areas. Leave them out if you garden near woods or wetlands.</li><li><span class="ic ic-df">✿</span> <b>Daisy family</b>: related to ragweed. Leave them out if someone has ragweed allergies.</li></ul>
<div class="hfoot"><span>Everything is included until you leave it out.</span><button type="button" class="btn primary hclose">Got it</button></div>`,
    bedPanel: `<h3>Setting up your bed</h3>
<h4>1. Pick a shape</h4><ul><li><b>Rectangle</b> or <b>Round island</b>: then set the size with <b>−</b> and <b>+</b>.</li><li><b>Draw your own</b> for any other shape.</li></ul>
<h4>2. Drawing your own outline</h4><ol><li>Click on the plan to drop corners. They snap to the half foot; hold <b>Shift</b> for straight lines.</li><li>Close the shape: click the orange start point, or double-click.</li><li>Fix it up: drag a dot to move a corner, click a <b>+</b> to add one, or drag inside to move the whole bed.</li><li>Press <b>Save shape</b>. <b>Undo</b>, <b>Clear shape</b> and <b>Cancel</b> are in the same bar.</li></ol>
<h4>3. Seen from</h4><p>Pick the side or sides people look at the bed from. Short plants go on that side and tall ones behind. Pick the middle for an island seen from all around: the tallest go in the center.</p>
<div class="hfoot"><span>Each grid square is 1 ft. Ctrl+Z undoes.</span><button type="button" class="btn primary hclose">Got it</button></div>`,
    objCard: `<h3>Adding objects</h3>
<p>Add anything that's already in the bed or going into it, before the plants. Plants are then laid out around it.</p>
<ol><li>Click an object, then click the bed where it goes.</li><li>Drag it to move it and a white dot to resize it. Some objects, like rocks and hedges, have an orange dot to turn them.</li><li>For a <b>Path</b>, click points along the bed, then press <b>Finish</b> (or double-click). Drag the orange dot to change its width.</li><li>To remove one, right-click it, or click it and press Delete.</li></ol>
<h4>Good to know</h4><ul><li><b>Shrubs</b> and <b>hedges</b>: nothing is planted under them.</li><li><b>Trees</b>: only the trunk takes up room, so plants grow underneath. Map the shade it casts in the sun step.</li><li>Several <b>stepping stones</b> make a stepping-stone path.</li></ul>
<div class="hfoot"><span>Nothing to add? Just press Done.</span><button type="button" class="btn primary hclose">Got it</button></div>`,
    sunCard: `<h3>Mapping the sun</h3>
<p>Count only <b>direct</b> sun that lands on the bed, over a summer day.</p>
<ul class="hsun"><li><i style="background:#E9C35C"></i><b>Full sun</b>: 6 or more hours</li><li><i style="background:#B7AC8C"></i><b>Part shade</b>: 3 to 6 hours</li><li><i style="background:#7C7678"></i><b>Shade</b>: under 3 hours</li></ul>
<h4>The bed's main light</h4><p>Pick the light <b>most of the bed</b> gets. The whole bed turns that color. Change it any time here or under <b>Sun</b> above the bed plan.</p>
<h4>Painting the spots that are different</h4><ol><li>Press <b>Paint them on the bed plan</b>. The palette opens above the bed.</li><li>Pick a light and drag across the spots that get it. Choose a brush: small for edges, large to fill.</li><li>The <b>Eraser</b> sets a spot back to the bed's main light. <b>Clear</b> wipes everything you painted.</li><li>Press <b>Done</b> on the palette when it looks right.</li></ol>
<p>The first time you go on to paint, a short lesson points at each tool and shows a stroke being painted. <b>Show me how painting works</b> plays it again.</p>
<p><b>Not sure?</b> Check the bed a few times on a sunny day (morning, noon, mid-afternoon) and note where shadows from the house, trees and fences fall.</p>
<div class="hfoot"><span>Plants are only placed where the light suits them.</span><button type="button" class="btn primary hclose">Got it</button></div>`
  };
  let last = null;
  function close() { const d = document.getElementById("stephelp"); if (d) d.remove(); if (last) { last.focus(); last = null; } }
  function open(id, btn) {
    close(); last = btn;
    const d = document.createElement("div"); d.id = "stephelp"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true");
    d.innerHTML = '<div class="hb">' + HELP[id] + "</div>";
    d.addEventListener("click", e => { if (e.target === d || e.target.closest(".hclose")) close(); });
    document.body.appendChild(d); d.querySelector(".hclose").focus();
  }
  const TITLE = { nameCard: "naming your garden", prefCard: "choosing your kind of garden", avoidCard: "plants to watch out for", bedPanel: "setting up and drawing your bed", objCard: "adding objects", sunCard: "mapping the sun" };
  function add() {
    Object.keys(HELP).forEach(id => {
      const foot = document.querySelector("#" + id + " .stepfoot"); if (!foot || foot.querySelector(".qhelp")) return;
      const b = document.createElement("button"); b.type = "button"; b.className = "qhelp"; b.textContent = "?";
      b.title = "Help with " + TITLE[id]; b.setAttribute("aria-label", b.title);
      b.addEventListener("click", e => { e.stopPropagation(); open(id, b); });
      foot.insertBefore(b, foot.firstChild);
    });
  }
  addEventListener("keydown", e => { if (e.key === "Escape" && document.getElementById("stephelp")) { e.stopImmediatePropagation(); close(); } }, true);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", add); else add();
})();
