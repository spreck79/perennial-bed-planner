# Plant data format (data/)

This is the contract for every program that reads or writes the planner's plant data. One plant = one folder, holding
its JSON file and its two photos, and **nothing about a plant is kept anywhere outside its folder**: not in the code,
not in a list, not in a page. The website reads the plant folders every time a page opens (`plant-data.js`), so it is
plug-and-play: add a folder and the plant is on the site; delete it and it's gone from every page; change a plant.json
and the change shows. Pages that are already open notice within about a minute (a few seconds at http://localhost:8321 on
your computer) and reload themselves, keeping the visitor's garden plan. Nothing is ever built or generated.

The rules are in `build/validate.js` (run `node build/check.js` to list anything to fix; the site doesn't need it) and
`data/plant.schema.json` (JSON Schema, for editors and other programs). If they disagree, `build/validate.js` decides.
A plant whose plant.json the site can't use at all (not valid JSON, its id not matching the folder, missing its name,
code, sizes, sun or photo credit) is left off the site; the browser console says which and why.

```
data/
  plants/<id>/            one folder per plant, named by its id
    plant.json            the plant (this document)
    full.jpg              the full-size photo, 640 x 480
    preview.jpg           the small preview, 240 x 180
  extra-sources.json      site-wide research sources that aren't about any one plant (credits page)
  SCHEMA.md, plant.schema.json
```

Files are UTF-8 JSON: no comments, no trailing commas. Field names are case-sensitive. A field that isn't listed here
is an error, so typos are caught. **Required** fields must be present and filled in; a plant with a required field
missing or empty fails the build and doesn't go on the site.

## Adding, changing or removing a plant

Put a folder `data/plants/<id>/` with `plant.json`, `full.jpg` and `preview.jpg` in it into the site's `data/plants`
folder. (Copying another plant's folder and changing it is the quickest start.) That's all: the plant is on the site.
Change its plant.json to change what the site says; delete the folder to take the plant off.

On your computer, open the site at **http://localhost:8321** (a page opened straight from the disk isn't allowed to
look inside folders). On the live site the folders are the ones in the GitHub project the site is published from.

Deleting a plant's folder takes it off the planner, its page, the credits page, the example garden, the PDF and every
other plant's good-neighbor list. Pairings that other plants list with it stay in their files (the build skips them and
says so), so adding the folder back brings them back. Saved garden plans store plants by id: a plan that used a deleted plant loses it
when opened. So don't rename an id; to rename a plant, change its `name`.

## Units

| Unit | Meaning |
|---|---|
| inches | Heights and spacing, at mature size. Spacing is center to center. |
| month | A month number plus the fraction of the month gone by: `4.0` = April 1, `4.5` = mid-April, `11.0` = November 1, `12.0` = the end of November. |
| zone | USDA hardiness zone, with `.5` for the "b" half: `6` = 6a, `6.5` = 6b. The planner's home zone is 6.5 (Michigan 6B). |
| color | `#RRGGBB`, six hex digits. |

## The plant file

Top level (all required except `example` and `sources`, nothing else allowed):

| Field | Type | |
|---|---|---|
| `id` | string | Lower-case letters, numbers and dashes (`^[a-z0-9-]+$`). Must match the folder name: `blue-star` lives in `data/plants/blue-star/`. Never changes once published. |
| `facts` | object | What the plant is (below). |
| `photo` | object | Its photo and credit. |
| `status` | object | Michigan native or garden favorite, and the sources that show it. |
| `care` | object | How it's cut back and trimmed through the year. |
| `example` | integer 1 to 10 | Optional. How many of it go in the example garden ("Load an example garden"). Leave out to keep it out of the example. The example garden is laid out sunny plants first, then part shade, then shade. |
| `sources` | array | Optional. Research about this plant shown on the credits page, each `{ "title", "url", "topic", "note" }` (all required). A source used by several plants is shown once (write it the same way in each, matched by `url`) and stays on the site while any of them is there. |
| `companions` | array | Its good neighbors, each from a source. |

### facts

| Field | Type | Required | Rules |
|---|---|---|---|
| `code` | string | yes | The 2 to 4 letter label drawn on the plant in the bed plan. Letters taken in order from the common name, the first letter starting a word, and any capital letter starting a word: one word → first 4 letters (`Moon` for "Moonbeam"), two words → 2 + 2 (`BlSt` for "Blue Star"), three or more → first letters (`TBSt` for "Tall Blue Star"); a vowel may be dropped (`Mnbm`). Unique across all plants, ignoring case. |
| `name` | string | yes | Common name, as shown everywhere (for example `Blue Star`, `Blue Star 'Midnight'`). |
| `latin` | string | yes | Botanical name. |
| `native` | boolean | yes | `true` = Michigan native, `false` = garden favorite. Must agree with `status.kind`. |
| `kind` | string | yes | `clump`, `fern`, `grass`, `mat` (low spreading groundcover) or `bulb`. Sets the silhouette in the side view. |
| `filler` | `true` | no | A groundcover that fills gaps between other plants. Leave out rather than writing `false`. |
| `dormant` | `true` | no | Dies back by early summer, so later plants may share its space. Leave out rather than writing `false`. |
| `clump` | integer ≥ 1 | no | Bulbs only: how many bulbs go in each spot on the plan. |
| `fam` | `"daisy"` | no | Daisy family (shown to people avoiding ragweed-family plants). No other value is used. |
| `hLo` | number (inches) | yes | Shortest typical height. More than 0. |
| `hHi` | number (inches) | yes | Tallest typical height. At least `hLo`. |
| `spacing` | number (inches) | yes | Center-to-center spacing. More than 0. |
| `bloom` | `[start, end]` months, or `null` | yes (may be `null`) | Months between 3 and 12, start before end. `null` = grown for its foliage. |
| `color` | string | yes | Flower or leaf color in words. |
| `hex` | color | yes | The plant's color on the plan and charts. |
| `txt` | color | yes | Text color that reads on `hex` (usually `#2E3A2C` or `#FFFFFF`). |
| `light` | string | yes | Light and soil needs in words. |
| `sun` | array | yes | One or more of `full` (6+ hours of direct sun), `part` (3 to 6), `shade` (under 3), each once. Decides which sun zones of a bed it may go in. |
| `moisture` | string | yes | Soil moisture in words. |
| `notes` | string | yes | The plant's description. |
| `deer` | `"A"`–`"D"` | no | Rutgers NJAES deer rating: A rarely damaged … D frequently severely damaged. Leave out if Rutgers doesn't rate it. |
| `squirrels` | `true` | no | Only for bulbs squirrels dig up. Adds "squirrels dig up the bulbs" to the deer warning in the planner and the PDF. |
| `toxic` | array, or `null` | yes (may be `null`) | Who it is toxic to: any of `people`, `dogs`, `cats`, `horses` (at least one). `null` = not known to be toxic. |
| `toxSrc` | string | when `toxic` is a list | Where the toxicity comes from (for example "ASPCA lists it as toxic"). Not allowed when `toxic` is `null`. |
| `gloves` | `true` | no | Toxic plants to handle with gloves. Named in the PDF's toxic-plant note when they're in the bed. |
| `zones` | `[coldest, warmest]` zones | no, but see the rules | Hardiness range, from 1 to 13.5 in steps of .5, coldest first. Missing zones are allowed but listed as "worth finishing". If the coldest zone is above 6.5 the plant needs `winter`. If the warmest is below 6 it fails. |
| `winter` | object | when the plant isn't hardy in zone 6B | `{ "how": "dig" \| "pot" \| "annual" \| "mulch", "text"?: string, "lift"?: [start, end], "replant"?: [start, end], "mulch"?: [start, end] }`. Windows are months (1 to 12.99, start before end); any left out get the usual timing for that `how`, and `text` replaces the standard instructions. `mulch` = hardy only to 6B, mulch the crown; `dig` = dig up and store; `pot` = bring indoors; `annual` = replant each year. |
| `buyNote` | string | no | A buying tip added to the PDF's "Buy the right plants" step when the plant is in the bed ("Often sold as dormant roots."). |

### photo

The photos themselves are `full.jpg` (a JPEG of exactly 640 x 480; the site uses quality 82, progressive) and
`preview.jpg` (exactly 240 x 180, quality 60) in the plant's folder.

| Field | Type | Required | Rules |
|---|---|---|---|
| `focus` | `[x, y]` | no | Where to center a crop, each from 0 (left/top) to 1 (right/bottom). Default is the middle. |
| `credit` | object | yes | The one record of the photo's credit (shown on the credits page, the plant page and in the PDF). |
| `credit.file` | string | yes | The file name on Wikimedia Commons (spaces, not underscores), or the source file's name. |
| `credit.by` | string | yes | Photographer or author. May be `""` only when `lic` is `"Public domain"` or `"CC0"`. |
| `credit.lic` | string | yes | License as shown, for example `"CC BY-SA 4.0"`, `"CC0"`, `"Public domain"`. |
| `credit.licUrl` | string | yes | Link to the license text. May be `""` only when `lic` is `"Public domain"`. |

### status

| Field | Type | Required | Rules |
|---|---|---|---|
| `kind` | `"native"` \| `"garden"` | yes | Must agree with `facts.native`. |
| `sources` | array | yes, at least one | Each `{ "title": string, "url": "http(s)://…", "note": string }`, all three required. A Michigan native list for a native plant, or a Michigan garden center for a garden favorite. |

A source used by several plants is one source on the site: write its `title` and `note` exactly the same in every
plant that uses it (matched by `url`), and use it only for plants of one kind (all native or all garden).

### care

| Field | Type | Required | Rules |
|---|---|---|---|
| `group` | string | yes | How it's cut back (table below). `spring` is the standard care. |
| `trim` | boolean | yes | `true` = optional shear after the first flowers (shown only for plants with a bloom time). |
| `fall` | object | when `group` is `fall`, not allowed otherwise | `{ "short": string, "why": string }`. `short` is a few words for the timeline ("leaf blight"); `why` finishes the sentence "Cut back in fall, after a few hard frosts …: " ("the leaves blacken and can carry leaf blight into next year"). |
| `divide` | string | no | Only when the usual dividing advice is wrong for the plant: `never` (deep taproot), `fleshy` (late August to September, only if crowded), `summer` (every 3 to 4 years in late July to early August), `early-spring` (as the shoots poke up, before the leaves open). |
| `divideNote` | string | no | A sentence added after the dividing advice ("Replant the eyes just 1½ in deep."). |
| `evergreen` | `true` | no | Only for `group` `sedge`: evergreen, so no fall cutting, just snip brown blades in early April. |
| `dormancy` | object | no | Only for `group` `ephemeral`, when the leaves fade later than usual: `{ "from": month, "short": string }`, for example `{ "from": 7, "short": "Jul" }`. Without it the leaves are cleared from about June 6 ("Jun to early Jul"). |
| `june` | `"pinch"` \| `"halve"` | no | An early-June job named in the PDF's yearly care tip when the plant is in the bed: pinch back the tips, or cut back by half. |

| group | Care |
|---|---|
| `spring` | Standard: pull mulch off the crown in early April; cut last year's stems to 8 to 24 in from mid-April to mid-May. |
| `fall` | Cut back after a few hard frosts (disease, pests or mushy leaves). Needs `fall`. |
| `grass` | Leave standing all winter; cut to 3 to 4 in early April. |
| `sedge` | Leave over winter; comb or trim the old blades in early April. |
| `fern` | Leave the old fronds over winter; clear them in early April. |
| `evfern` | Evergreen fern: no fall cutting; snip ragged old fronds in April. |
| `tidy` | Low evergreen or semi-evergreen: no fall cutting; snip winter-browned leaves in early spring. |
| `leavesAtBud` | Evergreen: cut off last year's leaves as the flower buds rise. |
| `leavesEarly` | Cut the old leaves to the ground in early April, before the flowers. |
| `pruneInMay` | No fall cutting; trim to live buds in May once new growth shows. |
| `marginal` | Leave the tops over winter for protection; cut back in May. |
| `late` | Slow to come up (mark the spot); cut old stems mid-April to early May. |
| `ephemeral` | Goes dormant in summer: let the leaves yellow, then clear them. |
| `bulb` | Plant in October; cut the leaves off 6+ weeks after they fade. |

Dividing advice follows from the group and bloom time, unless `divide` says otherwise. A new plant gets the standard wording for its group.

### companions

An array of good neighbors; at least one is required (every plant needs a sourced pairing).

| Field | Type | Required | Rules |
|---|---|---|---|
| `id` | string | yes | Another plant's id (not this plant; each partner once). If that plant has no folder, the pairing is left off the site until it does. |
| `why` | string | yes | The source's sentence or summary, as shown for this plant. |
| `aboutThisPlant` | boolean | yes | `true` if the source is about this plant (it is listed first on this plant); `false` if it came from the partner's source. |
| `sources` | array | yes, at least one | Each `{ "title": string, "url": "http(s)://…", "about"?: plant id }`. `about` is the plant the source page is about. A source used in several places must have the same `title` and `about` everywhere (matched by `url`). |

A pairing is shown on both plants. Store it on both (each side with its own `why` and `aboutThisPlant`); if only one
side lists it, the build adds it to the other with the same `why` and sources (and says so).
On the site, a plant's neighbors are listed with `aboutThisPlant: true` first, then by the partner's name.

## Order

Plants are listed by common name, and so are the plants in the example garden. Sources are listed in the order they
first come up. There is no list of plants anywhere: the folders are the list.

## extra-sources.json

Site-wide research that isn't about any one plant (general care timing, the deer-rating scale), shown on the credits
page: an array of `{ "title": string, "url": string, "topic": string, "note": string }`. A source that names plants
belongs in those plants' `sources` instead, so it leaves the site with them.

## What the build checks

Problems (the build stops and writes nothing; `--force` writes anyway and still lists them):
anything marked required above that's missing, empty or the wrong type; unknown fields; the id not matching the folder
name; a code that's taken or doesn't follow the pattern; heights, spacing, bloom, zones and winter windows out of range;
not hardy in 6B without `winter`; toxic without `toxSrc`; photos missing, not JPEG or the wrong size; a credit without
an author or license link where the license needs one; `status.kind` disagreeing with `native`; no status source; a
`fall` group without its reason; no good neighbors; a folder without plant.json, or a folder name that isn't the id;
the same source written two different ways.

Worth finishing (allowed, listed): hardiness zones not recorded; `trim` on a plant with no bloom time; photo files
in a plant's folder that the site doesn't use; a plant whose good neighbors are all gone.

Notes (for information): pairings left out because the partner's folder is gone.
