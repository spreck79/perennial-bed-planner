# Perennial Bed Planner (beta)

> **Beta version.** This is an early test release. Plant lists, pairings and safety notes are still being checked, and things may change or break. Please double-check anything important before you buy or plant.

Plan a perennial flower bed for Michigan (zone 6B): pick a bed shape, choose Michigan natives and garden favorites, and get a bed plan, bloom chart, shopping list and printable PDF guide.

**Open the planner:** https://spreck79.github.io/perennial-bed-planner/

## What it does
A guided tour walks first-time visitors through six steps and the plant list, lighting up one at a time. Each finished step folds down to a one-line summary and can be opened again to change it. Or load the example garden to see a finished plan right away.

1. **Name your garden.** The PDF guide is saved as the date and name, like "26-10-28 Backyard Garden.pdf".
2. **What kind of garden?** Michigan natives and/or garden favorites, and kinds of plants (including spring bulbs).
3. **Plants to watch out for.** Whether to leave out plants that are toxic, that deer eat, that need winter care here, or in the daisy family (ragweed allergies).
4. **Your bed.** A rectangle, a round island, or draw your own: drag the dots, click a dot to switch between a sharp corner and a curve (crisp corners against a house, a curved front), and drag inside to move the shape (a drawn bed can be changed any time with "Edit the outline"). Choose where the bed is seen from, one side or several or all the way around: those edges are outlined in green and plants run short to tall away from them.
5. **Add objects.** Paths, stepping stones, rocks, a birdbath, shrubs, a hedge or trees, placed before the plants so they're laid out around them. Paths and stepping stones show footprints, and a path where people walk and look counts as a viewing edge too, so plants beside it stay low.
6. **How much sun?** Full sun (6+ hours of direct sun a day), part shade (3 to 6) or shade (under 3), and map sunny and shady spots right on the bed plan.

Then **pick plants** from the Plants list beside the bed plan, or let **Suggest a planting** choose plants that suit each part of the bed and go well together. Suggestions and Re-arrange aim for a bed that's about 100% full once the plants are grown.

On the bed plan:
- Right-click any plant, object or empty spot for a menu; click one for a card with what it is, its sun needs and plants that go well with it (each pairing from a published source).
- Drag to rearrange; Ctrl- or Shift-click to work on several plants at once. Undo and redo any change.
- Zoom with Ctrl + scroll or the buttons in the corner.
- Works on phones and tablets: press and hold for the menus, pinch to zoom, and "Select more plants" to pick several.
- Small icons show sun needs, native, garden favorite, daisy family, toxic and deer-eaten plants; hover one for what it means.
- A legend under the plan explains the colors and markings.
- Early-dormant plants (marked "dormant" in their plant files, plus the spring bulbs) may share space with later plants.

The Garden Timeline shows when everything blooms, grouped by sun area when the bed has more than one; drag a plant into another sun area and it moves to that section.

Then create a PDF guide: it opens in a full-screen preview where you can look it over, with **Download**, **Print** and **Back to edit** along the top, so nothing is saved until you choose. The guide has a bloom calendar, care through the year, plant profiles, a side view with spacing, the bed plan and a shopping list. Save and open plans as files; your work is also remembered in your own browser, and nothing is sent anywhere.

## Safety
Plants are believed non-toxic to people, dogs and cats unless marked Toxic. Please check the [ASPCA plant list](https://www.aspca.org/pet-care/animal-poison-control/toxic-and-non-toxic-plants) before buying. For a person who has eaten a plant, call Poison Control at 1-800-222-1222 ([poisonhelp.org](https://poisonhelp.org/)).

## Sources
Photo credits, companion-plant sources and native/garden status sources are on the [Sources and photo credits](https://spreck79.github.io/perennial-bed-planner/credits.html) page. Each plant lives in its own folder in `data/plants` (facts, photos, sources, care and good neighbors; see `data/SCHEMA.md`), and nothing about a plant is kept anywhere else. The site reads the folders every time a page opens: add a folder and the plant is on the site, delete it and it's gone, edit it and the change shows. On your own computer it runs at http://localhost:8321 (see `build/serve.js`).

## License
The planner's own text, plant notes, research and code are © 2026 spreck79, licensed under [Creative Commons Attribution-NonCommercial 4.0 (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/). Photos keep their own licenses (see the Sources and photo credits page); jsPDF is MIT licensed; PDF.js (used for the preview on phones and tablets) is Apache 2.0; the DejaVu fonts have their own free license. Details in `LICENSE.txt`.
