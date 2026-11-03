# Adding a plant to the Perennial Bed Planner

Follow these steps in order, every time, so each plant is researched, pictured and checked the same way.
Run the commands from inside this `research` folder. You need Python 3 (with Pillow: `pip install pillow`)
and Node.js.

## The quick way: Plant Research + add_plants.py (use this)
1. Adam runs **Plant Research** ([perennial-bed-planner-research](https://github.com/spreck79/perennial-bed-planner-research)):
   types the plants, presses Start, picks each plant's photo with **Choose photos…**, then **Make zip for Claude**.
2. With the zip, run from this folder:

        python add_plants.py plant-research-<date>.zip

   It adds every prepared plant: the plant entry in plants.js, the photo (photos/<id>.js and the preview in images.js),
   the credit in credits.js, the native / garden-favorite source in sources.js and the care group in care.js. Then it
   rebuilds companions.js and research-notes.md and runs check_plants.py.
3. It skips (and says why) any plant already in the planner, any plant **not hardy in zone 6B**, and any plant with no
   Michigan native or garden-center source. `--force` adds those last two anyway.
4. Open index.html, add a new plant to a bed and check its card, photo and the PDF.
5. **Plants already on the website** get hardiness zones and winter care the same way: in Plant Research, "On the website"
   tab, **Update all** (or select plants and **Update selected**), then **Make update zip for Claude**, and run
   `python add_plants.py plant-updates-<date>.zip --update`. Only `zones` and `winter` are added; differences between the
   sources and the website are listed, not changed. Companion pairings can be added later
   (step 5 below); the checker lists plants with none under TO DO.

The steps below are the same work done by hand, for anything the quick way can't do.

## 1. Check it belongs
- It is a **perennial (or spring bulb) that grows in Michigan zone 6B**.
- It is either a **Michigan native** (check Michigan Flora, Michigan Wildflower Farm or Wildtype Native Plant
  Nursery) or a **garden favorite sold at Michigan garden centers** (for example Walters Gardens in Zeeland,
  English Gardens, MIgardener).
- Note which source you checked, for step 6.

## 2. Research the facts (use reliable sources, and keep the links)
Use the Missouri Botanical Garden Plant Finder, a university extension (UW-Madison, MSU, Penn State, NC State,
Iowa State, Purdue, Illinois) or a Michigan nursery. For each plant you need:

| Field | What it is |
|---|---|
| `id` | short lower-case name, letters only, for example `wildginger` (must be new) |
| `code` | up to 4-letter label drawn on the plan, from the common name: one word = first 4 letters (`Foam`), two words = 2 letters of each (`WiGe`, `BuWe`), three or more = first letter of each word (`WBPh`). A vowel may be dropped (`Hsta`). Must be new; check_plants.py enforces the pattern and suggests one |
| `name`, `latin` | common and botanical name |
| `native` | `true` for a Michigan native, `false` for a garden favorite |
| `kind` | `clump`, `fern`, `grass`, `mat` (groundcover) or `bulb` |
| `hLo`, `hHi` | height range in inches when grown |
| `spacing` | how far apart to plant, in inches, center to center |
| `bloom` | `[start, end]` as months (4.5 = mid April, 7 = start of July), or `null` for a foliage plant |
| `color`, `hex`, `txt` | flower color in words; the color drawn on the plan (`#RRGGBB`); label color on it (`#2E3A2C` dark or `#FFFFFF` white) |
| `light` | sun needs in words; say "shade" only for under 3 hours of direct sun |
| `sun` | the lights it grows in: any of `"full"` (6+ hrs), `"part"` (3 to 6), `"shade"` (under 3) |
| `moisture` | for example "Average to moist" |
| `notes` | one or two plain sentences on why it's worth growing |
| `deer` | Rutgers NJAES deer-resistance rating `A` to `D`; leave out if it isn't on their list |
| `toxic`, `toxSrc` | only if toxic: who to (`"people"`, `"dogs"`, `"cats"`) and the source (for example the ASPCA list) |
| `fam` | `"daisy"` if it's in the daisy family (ragweed allergies) |
| `dormant` | `true` if it dies back by early summer (spring ephemerals, bulbs) |
| `filler` | `true` if it works as a low groundcover filler |
| `credit` | the photo credit: `{ file, by, lic }` (same as step 4) |
| `zones` | USDA hardiness zones `[coldest, warmest]`, `.5` = the "b" half (`[3, 8]`, `[7, 10.5]`); Michigan here is 6B (6.5) |
| `winter` | only for plants not fully hardy here: `{ how: "dig" }` (dig up after frost, replant in May), `"pot"` (bring indoors), `"annual"` (plant new each year) or `"mulch"` (hardy only to 6B); optional `text`, `lift`, `replant`, `mulch` windows. The planner shows the ❄ icon, timeline marks and PDF notes from this |

## 3. Add it to plants.js
Copy an existing plant of the same kind as a pattern and put the new one in the right group
(Michigan natives or garden favorites).

## 4. Add the photo
Find a photo on Wikimedia Commons with a free license (CC BY, CC BY-SA or CC0), download it, then:

    python make_photos.py add <id> <photo file> --file "Commons file name.jpg" --by "Photographer" --lic "CC BY-SA 4.0" --lic-url "https://creativecommons.org/licenses/by-sa/4.0/"

This crops it to 4:3, saves the full-size photo in `photos/<id>.js`, adds the small preview to `images.js`
and records the credit in `credits.js`. Use the same file, author and license in the plant's `credit` in plants.js.

## 5. Add its companions ("goes well with")
In `pairs_log.py`, add one line per published source that pairs it with plants already in the planner:

    add("<id>", ["partner-id", "partner-id"], "https://source-link", "Short quote or summary from the source.")

Add it as a partner in other plants' lines too, when a source pairs them. Then rebuild:

    python build_companions.py
    python make_notes.py

(`make_notes.py` rewrites `research-notes.md` and keeps the hand-written sections such as deer ratings.)

## 6. Record the native / garden-favorite check
In `sources.js` (one level up), add the plant's id to the `plants` list of the source you checked in step 1,
or add a new source entry with its title, link, kind (`"native"` or `"garden"`) and a short note.

## 7. Care (only if needed)
Plants get the standard spring cleanup unless they're named in `care.js`. Add the id to the right list there
if it should be cut back in fall, is a grass, sedge, fern or evergreen, dies back early, or is a bulb.

## 8. Check everything

    python check_plants.py

Fix every item under **PROBLEMS**. Items under **TO DO** are allowed, but finish them when you can.
Then open `index.html`, add the plant to a bed, and look at its card, its photo (click to enlarge) and the PDF.

## 9. Publish
Update the GitHub copy only when you're ready (and the README if the plant list is mentioned there).
