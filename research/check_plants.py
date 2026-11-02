#!/usr/bin/env python3
"""Check every plant before the planner goes live: run this after adding or changing a plant.

  python check_plants.py            problems and the main things left to do
  python check_plants.py --details  also: plants with no Rutgers deer rating, and plants using the standard care

It loads the planner's own data files (plants.js, images.js, the photos folder, credits.js, companions.js,
sources.js and care.js) and reports:
  PROBLEMS  things that would break or mislead in the planner (missing fields, no photo, no credit, ...)
  TO DO     things that are allowed but should be finished (no researched companions yet, no native/garden check, ...)
It exits with an error code when there are problems, so nothing half-done gets published by accident.
Needs Node.js (the same as build_companions.py and make_notes.py).
"""
import json, os, re, subprocess, sys

SITE = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
JS = r"""
global.window = {}; const fs = require('fs'), p = f => require('path').join(process.argv[1], f);
for (const f of ['plants.js', 'images.js', 'credits.js', 'companions.js', 'sources.js']) eval(fs.readFileSync(p(f), 'utf8'));
console.log(JSON.stringify({ plants: window.PLANTS, photos: Object.keys(window.PHOTOS || {}), credits: window.CREDITS || {},
  comps: window.COMPANIONS || {}, status: window.STATUS_SOURCES || [] }));
"""
KINDS = {"clump", "fern", "grass", "mat", "bulb"}

# The code is the short label drawn on each plant in the bed plan. It must stay close to the common name:
#   one word -> first 4 letters (Foam, Asti); two words -> 2 letters of each (WiGe, BuWe);
#   three or more -> first letter of each word (WBPh, GBLo). A vowel may be dropped (Hsta); varieties may be used (Roza, SaMN).
# The rule that's enforced: 2 to 4 letters, found in order in the name, starting at the start of a word,
# and any capital letter is the first letter of a word. Never the same as another plant's code.
def name_words(name):
    return [w for w in re.split(r"[^A-Za-z]+", re.sub(r"['\u2019]s\b", "s", name)) if w]

def code_fits(code, name):
    if not code[:1].isupper() or not code.isalpha(): return False
    flat = " ".join(name_words(name)); pos = 0
    for k, ch in enumerate(code):
        found = -1
        for i in range(pos, len(flat)):
            start = i == 0 or flat[i - 1] == " "
            if flat[i].lower() == ch.lower() and (start if (k == 0 or ch.isupper()) else True):
                found = i; break
        if found < 0: return False
        pos = found + 1
    return True

def suggest_code(name):
    w = name_words(re.sub(r"'[^']*'", "", name)) or name_words(name)
    if len(w) == 1: return w[0][:4].capitalize()
    if len(w) == 2: return w[0][:2].capitalize() + w[1][:2].capitalize()
    c = "".join(x[0].upper() for x in w[:4])
    return c + (w[-1][1:2].lower() if len(c) < 4 else "")
SUNS = {"full", "part", "shade"}

def main():
    try:
        out = subprocess.run(["node", "-e", JS, SITE], capture_output=True, text=True, check=True).stdout
    except FileNotFoundError: sys.exit("This needs Node.js (node) to read the planner's data files.")
    except subprocess.CalledProcessError as e: sys.exit("Could not read the data files:\n" + e.stderr)
    d = json.loads(out); care = open(os.path.join(SITE, "care.js"), encoding="utf-8").read()
    photos_dir = os.path.join(SITE, "photos"); full = {f[:-3] for f in os.listdir(photos_dir) if f.endswith(".js")} if os.path.isdir(photos_dir) else set()
    in_status = {pid for s in d["status"] for pid in s.get("plants", [])}
    details = "--details" in sys.argv[1:]
    probs, todo, groups = [], [], {}   # groups: kind of to-do -> plant names, printed one line per kind
    G = lambda key, name: groups.setdefault(key, []).append(name)
    ids, codes = {}, {}
    for pl in d["plants"]:
        pid = pl.get("id", "?"); name = pl.get("name", pid); P = lambda m: probs.append(f"{name} ({pid}): {m}"); T = lambda m: todo.append(f"{name} ({pid}): {m}")
        if pid in ids: P("the id is used twice")
        ids[pid] = 1
        for k in ["id", "code", "name", "latin", "kind", "hLo", "hHi", "spacing", "color", "hex", "txt", "light", "moisture", "notes", "credit"]:
            if pl.get(k) in (None, "", []): P(f"missing '{k}'")
        if not isinstance(pl.get("native"), bool): P("'native' must be true (Michigan native) or false (garden favorite)")
        c = pl.get("code", "")
        if c:
            if c.lower() in codes: P(f"the code '{c}' is also used by {codes[c.lower()]}")
            codes[c.lower()] = name
            if not (2 <= len(c) <= 4) or not code_fits(c, name):
                P(f"the code '{c}' doesn't follow the pattern: up to 4 letters taken in order from the common name, "
                  f"starting a word, with capitals only at the start of words (like Foam, WiGe, WBPh). Suggested: {suggest_code(name)}")
        if pl.get("kind") and pl["kind"] not in KINDS: P(f"kind must be one of {sorted(KINDS)}")
        lo, hi, sp = pl.get("hLo"), pl.get("hHi"), pl.get("spacing")
        if isinstance(lo, (int, float)) and isinstance(hi, (int, float)) and lo > hi: P("hLo is taller than hHi")
        if isinstance(sp, (int, float)) and sp <= 0: P("spacing must be more than 0 inches")
        b = pl.get("bloom", "missing")
        if b == "missing": P("missing 'bloom' (use null for a foliage plant)")
        elif b is not None and not (isinstance(b, list) and len(b) == 2 and 3 <= b[0] < b[1] <= 12): P("bloom must be [start, end] months between 3 and 12, start before end")
        sun = pl.get("sun")
        if not sun or not isinstance(sun, list) or not set(sun) <= SUNS: P("'sun' must list one or more of full, part, shade")
        for k in ("hex", "txt"):
            if pl.get(k) and not re.fullmatch(r"#[0-9A-Fa-f]{6}", pl[k]): P(f"'{k}' must be a color like #A1B2C3")
        if pl.get("deer") is not None and pl["deer"] not in list("ABCD"): P("'deer' must be the Rutgers rating A, B, C or D (or left out if not rated)")
        if pl.get("deer") is None and details: G("No Rutgers deer rating (fine if it isn't on their list; it then shows no deer icon)", name)
        if pl.get("toxic"):
            if not set(pl["toxic"]) <= {"people", "dogs", "cats", "horses"}: P("'toxic' lists who it is toxic to: people, dogs, cats")
            if not pl.get("toxSrc"): P("toxic plants need 'toxSrc' saying where that comes from (for example the ASPCA list)")
        if pl.get("fam") not in (None, "daisy"): P("'fam' is only used for \"daisy\" (daisy family)")
        if pid not in d["photos"]: P("no preview photo in images.js (run make_photos.py add ...)")
        if pid not in full: P("no full-size photo in the photos folder (run make_photos.py add ...)")
        if pid not in d["credits"]: P("no photo credit in credits.js (make_photos.py add ... --file --by --lic --lic-url)")
        cr = pl.get("credit") or {}
        if cr and pid in d["credits"] and cr.get("lic") and d["credits"][pid].get("lic") and cr["lic"].split()[0:2] != d["credits"][pid]["lic"].split()[0:2]:
            T(f"the license in plants.js ({cr['lic']}) differs from credits.js ({d['credits'][pid]['lic']})")
        if pid not in d["comps"]: P("not in companions.js: add its pairings to pairs_log.py and run build_companions.py")
        elif not d["comps"][pid]: G("No researched companion pairings yet (add them to pairs_log.py, then run build_companions.py)", name)
        if pid not in in_status: G("Native / garden-favorite check not recorded in sources.js (add the plant to the source it was checked against)", name)
        if f'"{pid}"' not in care and details: G("Standard spring cleanup (not named in care.js; add it there only if it needs fall cutting or other special care)", name)
    for pid in d["photos"]:
        if pid not in ids: todo.append(f"images.js has a photo for '{pid}', which is not in plants.js (remove photos/{pid}.js and run make_photos.py rebuild)")
    for pid in d["comps"]:
        if pid not in ids: probs.append(f"companions.js mentions '{pid}', which is not in plants.js (run build_companions.py)")
    print(f"Checked {len(d['plants'])} plants.\n")
    if probs: print(f"PROBLEMS ({len(probs)}), fix before publishing:"); [print("  - " + m) for m in probs]; print()
    if todo or groups:
        print("TO DO, allowed, but worth finishing:")
        for m in todo: print("  - " + m)
        for k, names in groups.items(): print(f"  - {k}: {len(names)} plant{'s' if len(names) > 1 else ''}: " + ", ".join(names))
        print()
    if not probs: print("No problems found." + ("" if todo or groups else " Nothing left to do."))
    sys.exit(1 if probs else 0)

if __name__ == "__main__":
    main()
