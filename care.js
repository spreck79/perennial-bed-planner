// Care timing for Michigan zone 6B: when to get each plant going in spring, when to cut it back,
// optional summer trims, and the whole-garden calendar. Month numbers match the bloom chart
// (4 = start of April, 4.5 = mid-April, 12 = end of November). Sources are listed in sources.js.
(function () {

  // how each plant is cut back
  const CUT = {
    // cut after a few hard frosts (disease, pests, or mushy foliage)
    fall: ["peony", "daylily", "brunnera", "veronica", "hosta", "iris", "bergamot", "gardenphlox", "yarrow", "shasta"],
    grass: ["bluestem", "dropseed", "bottlebrush", "forestgrass"],
    sedge: ["sedge", "palmsedge", "morrows"],
    fern: ["fern", "ostrich", "lady", "cinnamon", "painted"],
    evfern: ["christmas", "autumn"],
    // low evergreen or semi-evergreen plants: no fall cutting, tidy in spring
    tidy: ["coral", "alumroot", "bigroot", "bergenia", "creepphlox", "lambsear", "ginger", "strawberry", "foam", "lungwort", "ladysmantle"],
    hellebore: ["hellebore"],
    epimedium: ["epimedium"],
    lavender: ["lavender"],
    marginal: ["hyssop"],
    late: ["butterflyweed"],
    ephemeral: ["bluebells", "mayapple", "bleeding"],
    bulb: ["daffodil", "tulip", "allium"]
  };
  const catOf = {}; Object.keys(CUT).forEach(k => CUT[k].forEach(id => (catOf[id] = k)));

  // optional shear after the first flowers (UNL list: salvia, coreopsis, Shasta daisy, columbine, coral bells, hardy geranium, catmint)
  const TRIM = ["salvia", "caradonna", "coreopsis", "shasta", "columbine", "coral", "alumroot", "geranium", "rozanne", "bigroot", "catmint"];

  const FALL_SHORT = { peony: "leaf blight", daylily: "mushy leaves", brunnera: "mushy leaves", veronica: "blackened leaves", hosta: "rake up slug eggs", iris: "iris borer eggs", bergamot: "bag mildewed leaves", gardenphlox: "bag mildewed leaves", yarrow: "keep low base leaves", shasta: "keep low base leaves" };
  const FALL_WHY = {
    peony: "the leaves blacken and can carry leaf blight into next year",
    daylily: "the leaves turn to mush and add nothing to the winter garden",
    brunnera: "the leaves turn to mush and add nothing to the winter garden",
    veronica: "the leaves blacken and add nothing to the winter garden",
    hosta: "dead hosta leaves hide slug eggs, so rake them all up",
    iris: "old leaves are where iris borers lay their eggs",
    bergamot: "if the leaves had powdery mildew (a white coating), bag them instead of composting. If they stayed clean, you can leave the stems for bees until spring",
    gardenphlox: "if the leaves had powdery mildew (a white coating), bag them instead of composting",
    yarrow: "cut the flower stalks but leave the low new leaves at the base",
    shasta: "cut the flower stalks but leave the low new leaves at the base"
  };

  const W = (a, b, text, sum) => ({ a, b, text, sum });
  const SPRING_CUT = "Spring cleanup, once days stay around 50°F (mid-April to mid-May): cut last year's stems down to 8 to 24 in. New growth hides the stubble within weeks, and native bees nest in the hollow stems.";
  const PREP_EARLY = "Early April, as shoots show: pull back any winter mulch from the crown and clear soggy leaves off the new growth.";

  function divideText(p) {
    const id = p.id;
    if (id === "baptisia" || id === "butterflyweed") return "Don't divide: the deep taproot breaks and the plant rarely recovers.";
    if (id === "peony" || id === "siberianiris") return "Divide only if crowded, in late August to September (fleshy roots do best in fall). Replant peony eyes just 1½ in deep.";
    if (id === "iris") return "Divide every 3 to 4 years in late July to early August.";
    if (id === "hosta") return "Divide in spring as the shoots poke up, before the leaves open.";
    const c = catOf[id];
    if (c === "bulb") return "If a clump gets crowded and flowers less, dig and split it after the leaves die back.";
    if (c === "grass" || c === "sedge" || c === "fern" || c === "evfern") return "Divide in spring as new growth starts, if the clump gets too big.";
    if (!p.bloom || p.bloom[0] >= 6) return "Divide in spring as the shoots come up, if the clump is crowded or the middle dies out.";
    return "Divide in late August to September, if the clump is crowded or flowers less. Allow 4 to 6 weeks before the ground freezes.";
  }

  function divideShort(p) {
    const id = p.id, c = catOf[id];
    if (id === "baptisia" || id === "butterflyweed") return "Don't divide";
    if (id === "peony" || id === "siberianiris") return "Late Aug to Sep, if crowded";
    if (id === "iris") return "Late Jul to early Aug";
    if (id === "hosta") return "Spring, before leaves open";
    if (c === "bulb") return "After leaves die, if crowded";
    if (c === "grass" || c === "sedge" || c === "fern" || c === "evfern" || !p.bloom || p.bloom[0] >= 6) return "Spring, as shoots come up";
    return "Late Aug to Sep";
  }
  function careFor(p) {
    const c = catOf[p.id] || "spring", out = { cat: c, divide: divideText(p), divideShort: divideShort(p) };
    const end = p.bloom ? p.bloom[1] : 7;
    switch (c) {
      case "fall":
        out.prep = W(4.0, 4.45, PREP_EARLY, "Early Apr: pull mulch off the crown");
        out.cut = W(10.75, 11.5, "Cut back in fall, after a few hard frosts (usually late October to November): " + FALL_WHY[p.id] + ".", "Late Oct to Nov, after hard frosts (" + FALL_SHORT[p.id] + ")");
        break;
      case "grass":
        out.cut = W(4.0, 4.5, "Leave standing all winter; it looks good in snow. Cut to 3 to 4 in tall in early April, before the new green blades come up.", "Early Apr: cut to 3 to 4 in");
        break;
      case "sedge":
        out.cut = W(4.0, 4.5, p.id === "morrows" ? "Evergreen: no fall cutting. In early April, snip off any brown or tattered blades." : "Leave over winter. In early April, comb out or trim the old brown blades before new growth starts.", p.id === "morrows" ? "Early Apr: snip brown blades" : "Early Apr: comb out old blades");
        break;
      case "fern":
        out.cut = W(4.0, 4.45, "Leave the old fronds over winter to protect the crown. In early April, clear them away before the new fiddleheads uncurl.", "Early Apr: clear old fronds");
        break;
      case "evfern":
        out.cut = W(4.1, 4.6, "Evergreen: no fall cutting. In spring the old fronds wither as the new ones uncurl; snip them off then if they look ragged.", "Apr: snip ragged old fronds");
        break;
      case "tidy":
        out.cut = W(4.0, 4.5, "Evergreen or semi-evergreen: no fall cutting. In early spring, snip off leaves that winter browned.", "Early Apr: snip winter-browned leaves");
        break;
      case "hellebore":
        out.cut = W(4.0, 4.45, "Evergreen: no fall cutting. In early spring, as the flower buds rise, cut off last year's leaves at the base so the flowers and new leaves show.", "Early Apr: cut off last year's leaves");
        break;
      case "epimedium":
        out.cut = W(4.0, 4.35, "No fall cutting. Cut the old leaves to the ground in early April, before the flowers appear, so the blooms aren't hidden.", "Early Apr: cut old leaves to the ground");
        break;
      case "lavender":
        out.prep = W(4.0, 4.45, PREP_EARLY, "Early Apr: pull mulch off the crown");
        out.cut = W(5.0, 5.6, "Don't cut in fall. Wait until new growth is well under way in May, then cut out dead stems and trim live ones back to healthy buds.", "May, after new growth: trim to live buds");
        break;
      case "marginal":
        out.prep = W(4.0, 4.45, PREP_EARLY, "Early Apr: pull mulch off the crown");
        out.cut = W(5.0, 5.5, "Leave the tops standing over winter: they catch leaves and snow that insulate the crown. Cut back in May once new growth shows.", "May: cut back (leave tops all winter)");
        break;
      case "late":
        out.prep = W(5.2, 5.8, "Slow to come up, often not until late May. Mark the spot so it isn't dug up or planted over by mistake.", "Late May: comes up late, mark the spot");
        out.cut = W(4.4, 5.05, "Leave the stems standing over winter and cut them back in spring, before the new shoots appear.", "Mid-Apr to early May: cut old stems");
        break;
      case "ephemeral": {
        const a = p.id === "bleeding" ? 7.0 : 6.2;
        out.prep = W(4.0, 4.3, "Comes up very early: mark the spot and don't rake or mulch over the shoots.", "Early Apr: mark the spot, don't rake");
        out.cut = W(a, a + 0.7, "Goes dormant in summer. Let the leaves yellow and fade on their own (they feed the roots), then clear them away. Nearby ferns or hostas fill the gap.", (p.id === "bleeding" ? "Jul" : "Jun to early Jul") + ": clear leaves once yellow");
        break;
      }
      case "bulb":
        out.prep = W(10.0, 10.95, "Plant new bulbs in October, 6 to 8 in deep in clumps, before the ground freezes.", "Oct: plant 6 to 8 in deep");
        out.cut = W(end + 1.4, end + 2.0, "Leave the leaves alone for at least 6 weeks after they start to fade (they feed next year's flowers), then cut them off.", "6+ weeks after leaves fade: cut off");
        break;
      default:
        out.prep = W(4.0, 4.45, PREP_EARLY, "Early Apr: pull mulch off the crown");
        out.cut = W(4.55, 5.5, SPRING_CUT, "Mid-Apr to mid-May: cut to 8 to 24 in");
    }
    if (TRIM.includes(p.id) && p.bloom) {
      const long = p.bloom[1] - p.bloom[0] > 2.2, a = long ? p.bloom[0] + 1.3 : p.bloom[1], b = a + 0.45;
      out.trim = W(a, Math.min(11.9, b), long ? "Optional: if it gets floppy or flowering slows in midsummer, shear it back by about half for fresh growth and more flowers." : "Optional: once the first flowers fade, shear the old stems back to the new leaves at the base. Many rebloom in 5 to 6 weeks.", long ? "Optional: shear by half in midsummer" : "Optional: shear after first flowers");
    }
    return out;
  }

  // whole-garden calendar (two lanes)
  function gardenTasks(plants) {
    const names = ids => ids.map(p => p.name);
    const fallCut = plants.filter(p => careFor(p).cat === "fall"), hasBulb = plants.some(p => catOf[p.id] === "bulb");
    const list = arr => arr.length ? arr.join(", ").replace(/, ([^,]*)$/, " and $1") : "";
    const springNow = plants.filter(p => ["grass", "sedge", "fern", "hellebore", "epimedium", "tidy"].includes(careFor(p).cat));
    return [
      { lane: 0, k: "prep", a: 4.0, b: 5.5, label: "Spring prep", text: "Early April: pull winter mulch off the crowns as the top layer thaws" + (springNow.length ? ", and cut back " + list(names(springNow)) + " before new growth" : "") + ". Mid-April to mid-May, once days stay around 50°F: cut the rest of last year's stems to 8 to 24 in. Waiting lets bees and butterflies that spent the winter in the stems and leaves get out first. Don't work the soil while it is wet." },
      { lane: 1, k: "divide", a: 4.3, b: 5.6, label: "Divide", text: "Divide summer- and fall-blooming plants as their shoots come up, if a clump is crowded or dying in the middle." },
      { lane: 1, k: "divide", a: 8.6, b: 9.7, label: "Divide", text: "Late August to September: divide spring-blooming plants, peonies and Siberian iris, giving them 4 to 6 weeks to root before the ground freezes." },
      { lane: 1, k: "bulbs", a: 9.8, b: 10.95, label: "Plant bulbs", text: "October: plant spring bulbs" + (hasBulb ? "" : " if you want early color") + ", 6 to 8 in deep in clumps of 5 to 8." },
      { lane: 0, k: "cut", a: 10.15, b: 11.35, label: "Fall cleanup", text: "After a few hard frosts (usually late October to November): " + (fallCut.length ? "cut back " + list(names(fallCut)) + " and bag any leaves that had mildew. " : "") + "Leave the rest standing: seed heads feed goldfinches and other birds, and hollow stems shelter overwintering insects. Leave fallen leaves around the plants too." },
      { lane: 0, k: "mulch", a: 11.35, b: 12.0, label: "Mulch", text: "Once the ground freezes (usually late November): add about 4 in of shredded leaves or straw over the crowns of new or less hardy plants. Mulching earlier can delay dormancy." }
    ];
  }

  window.Care = { careFor, gardenTasks };
})();
