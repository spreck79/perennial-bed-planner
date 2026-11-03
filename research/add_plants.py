#!/usr/bin/env python3
"""Add plants to the planner from a Plant Research zip, in one step.

  python add_plants.py plant-research-2026-11-02.zip          add every plant in the zip
  python add_plants.py plant-research-2026-11-02.zip dahlia   only the plants named (by id)
  python add_plants.py <zip> --force                          also add plants flagged as not hardy in zone 6B,
                                                              or with no Michigan native / garden-center source
  python add_plants.py plant-updates-2026-11-03.zip --update  add hardiness zones and winter care to plants already
                                                              on the website (nothing else in their entries changes)

The zip comes from Plant Research (github.com/spreck79/perennial-bed-planner-research): "Make zip for Claude".
Each plant in it has a website/ folder with everything already prepared: the finished plants.js entry, the full-size
photo and small preview (the photo Adam chose), the photo credit, where the native / garden-favorite check came from,
and its care group. This script puts each piece in the right file:

  plants.js    the entry (natives and garden favorites in "Added with Plant Research", bulbs with the other bulbs)
  photos/<id>.js, images.js, credits.js   the photo, preview and credit (same sizes as make_photos.py)
  sources.js   the plant's id added to the native / garden-favorite source it was checked against
  care.js      the plant's id added to its cutting group (unless it gets the standard spring cleanup)

then rebuilds companions.js (new plants start with no pairings) and research-notes.md, and runs check_plants.py. A plant whose id is already in the planner is never
overwritten. Needs Python 3 and Node.js (for the checker), the same as the other research scripts.
"""
import json, os, re, subprocess, sys, tempfile, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.abspath(os.path.join(HERE, ".."))
sys.path.insert(0, HERE)
import check_plants  # noqa: E402  (code rules)

def rd(p): return open(os.path.join(SITE, p), encoding="utf-8").read()
def wr(p, t): open(os.path.join(SITE, p), "w", encoding="utf-8").write(t)

def site_plants():
    js = "global.window={};require(process.argv[1]+'/plants.js');console.log(JSON.stringify(window.PLANTS))"
    return json.loads(subprocess.run(["node", "-e", js, SITE], capture_output=True, text=True, check=True).stdout)

def js_entry(e):
    """The entry written the way the rest of plants.js is."""
    q = lambda v: json.dumps(v, ensure_ascii=False)
    def val(v):
        if isinstance(v, bool): return "true" if v else "false"
        if v is None: return "null"
        if isinstance(v, (int, float)): return (f"{v:g}" if isinstance(v, float) else str(v))
        if isinstance(v, list): return "[" + ", ".join(val(x) for x in v) + "]"
        if isinstance(v, dict): return "{ " + ", ".join(f"{k}: {val(x)}" for k, x in v.items()) + " }"
        return q(v)
    groups = [["id", "deer", "code", "name", "latin", "native", "kind", "fam", "filler", "dormant", "zones"],
              ["hLo", "hHi", "spacing", "bloom", "color", "hex", "txt"],
              ["light", "sun", "moisture"],
              ["notes"],
              ["toxic", "toxSrc"],
              ["winter"],
              ["credit"]]
    lines = []
    for g in groups:
        parts = [f"{k}: {val(e[k])}" for k in g if k in e and (e[k] is not None or k == "bloom")]
        if parts: lines.append(", ".join(parts))
    return "  { " + ",\n    ".join(lines) + " },\n"

def js_val(v):
    if isinstance(v, bool): return "true" if v else "false"
    if v is None: return "null"
    if isinstance(v, (int, float)): return f"{v:g}" if isinstance(v, float) else str(v)
    if isinstance(v, list): return "[" + ", ".join(js_val(x) for x in v) + "]"
    if isinstance(v, dict): return "{ " + ", ".join(f"{k}: {js_val(x)}" for k, x in v.items()) + " }"
    return json.dumps(v, ensure_ascii=False)

def entry_span(t, pid):
    """(start, end) of a plant's { ... } in plants.js."""
    m = re.search(r'\{\s*id:\s*"' + re.escape(pid) + r'"', t)
    if not m: return None
    i, depth, q = m.start(), 0, None
    for j in range(i, len(t)):
        c = t[j]
        if q:
            if c == "\\": continue
            if c == q and t[j - 1] != "\\": q = None
        elif c in "\"'": q = c
        elif c == "{": depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0: return (i, j + 1)
    return None

def update_entry(pid, fields):
    """Add or replace only these fields in one plant's entry; everything else stays exactly as it is."""
    t = rd("plants.js"); sp = entry_span(t, pid)
    if not sp: return False
    body = t[sp[0]:sp[1]]
    for k in fields:                     # take out any earlier value of these fields
        m = re.search(r"\s" + k + r":\s*", body)
        if m:
            v0 = m.end()
            if body[v0] in "[{":
                depth = 0
                for j in range(v0, len(body)):
                    if body[j] in "[{": depth += 1
                    elif body[j] in "]}":
                        depth -= 1
                        if depth == 0: end = j + 1; break
            else: end = re.search(r"[,}]", body[v0:]).start() + v0
            k0 = m.start() + 1
            tail = body[end:]; tail = tail[1:] if tail.startswith(",") else tail
            body = body[:k0] + tail.lstrip(" ")
    add = "".join(f"{k}: {js_val(v)}, " for k, v in fields.items() if v is not None)
    body = re.sub(r'(\{\s*id:\s*"' + re.escape(pid) + r'",\s*)', lambda m: m.group(1) + add, body, count=1)
    wr("plants.js", t[:sp[0]] + body + t[sp[1]:])
    return True

def apply_updates(root):
    ups = []
    for d, _, files in os.walk(root):
        for f in files:
            if f.endswith(".json") and f != "packets.json":
                try:
                    u = json.load(open(os.path.join(d, f), encoding="utf-8"))
                    if isinstance(u, dict) and "set" in u and "id" in u: ups.append(u)
                except ValueError: pass
    if not ups: sys.exit("No updates found (looking for updates/<id>.json). Is this a Plant Research update zip?")
    ids = {p["id"] for p in site_plants()}
    done, skipped, diffs = [], [], []
    for u in sorted(ups, key=lambda u: u["name"]):
        if u["id"] not in ids: skipped.append(f"{u['name']}: not on the website"); continue
        f = {k: u["set"].get(k) for k in ("zones", "winter")}
        if not f["zones"]: skipped.append(f"{u['name']}: no zones found"); continue
        update_entry(u["id"], {"zones": f["zones"], "winter": f["winter"]})
        done.append(f"{u['name']}: zones {f['zones'][0]:g} to {f['zones'][1]:g}" + (f", winter: {f['winter']['how']}" if f["winter"] else ""))
        for k, v in (u.get("differences") or {}).items(): diffs.append(f"{u['name']} {k}: website {v['website']}, sources {v['sources']}")
    for x in done: print("UPDATED", x)
    for x in skipped: print("SKIPPED", x)
    if diffs:
        print(f"\n{len(diffs)} differences between the website and the sources (not changed; look them over):")
        for x in diffs: print("  -", x)
    if done:
        print(); r = subprocess.run([sys.executable, os.path.join(HERE, "check_plants.py")], cwd=HERE)
        if r.returncode: sys.exit(r.returncode)

def unique_code(code, name, taken):
    if code and code.lower() not in taken and check_plants.code_fits(code, name): return code
    c = check_plants.suggest_code(name)
    if c.lower() not in taken: return c
    base = c[:3]
    for ch in "abcdefghijklmnopqrstuvwxyz":
        if (base + ch).lower() not in taken and check_plants.code_fits(base + ch, name): return base + ch
    raise SystemExit(f"Couldn't find a free code for {name}; pick one by hand.")

def add_entry(e):
    t = rd("plants.js")
    if e.get("kind") == "bulb":
        i = t.index("\n];") + 1                                      # end of the list = the bulbs group
    else:
        mark = "  // ---------------- Added with Plant Research ----------------\n"
        if mark not in t:
            j = t.index("  // ---------------- Spring bulbs")
            t = t[:j] + mark + t[j:]
        i = t.index("  // ---------------- Spring bulbs")
    before = t[:i].rstrip()
    if not before.endswith((",", "[")) and not before.endswith("----------------"):   # the entry before had no comma (last in the list)
        k = len(before); t = t[:k] + "," + t[k:]; i += 1
    wr("plants.js", t[:i] + js_entry(e) + t[i:])

def add_photo(pid, full_b64, prev_b64, credit):
    os.makedirs(os.path.join(SITE, "photos"), exist_ok=True)
    with open(os.path.join(SITE, "photos", pid + ".js"), "w", encoding="utf-8") as f:      # same format as make_photos.py
        f.write(f'// Full-size photo of {pid} (credit in plants.js). Loaded on demand by app.js.\n'
                f'(window.PHOTO_FULL = window.PHOTO_FULL || {{}})["{pid}"] = "data:image/jpeg;base64,{full_b64}";\n')
    t = rd("images.js"); i = t.index("\n};\nwindow.PHOTO_PLACEHOLDER") + 1
    wr("images.js", t[:i] + f' "{pid}": "data:image/jpeg;base64,{prev_b64}",\n' + t[i:])
    if credit:
        t = rd("credits.js"); i = t.index("window.CREDITS = ") + len("window.CREDITS = "); j = t.rindex("};") + 1
        data = json.loads(t[i:j])
        data[pid] = {"file": credit["file"], "by": credit.get("by", ""), "lic": credit.get("lic", ""), "licUrl": credit.get("licUrl", "")}
        wr("credits.js", t[:i] + json.dumps(data, indent=1, ensure_ascii=False) + t[j:])

def add_status(pid, st):
    t = rd("sources.js")
    k = t.find(f'url: "{st["url"]}"')
    if k >= 0:                                                       # an existing source: add the id to its plants list
        m = re.compile(r'plants: \[([^\]]*)\]').search(t, k)
        if not m or t.rfind("{ title:", 0, m.start()) > k: raise SystemExit(f"Couldn't find the plants list of {st['title']} in sources.js")
        inner = m.group(1).strip(); new = (inner + ", " if inner else "") + json.dumps(pid)
        t = t[:m.start(1)] + new + t[m.end(1):]
    else:                                                            # a new source record at the end of the status list
        end = t.index("\n];", t.index("window.STATUS_SOURCES = ["))
        note = "Michigan native nursery list; checked by Plant Research." if st["kind"] == "native" else "Sold at a Michigan garden center; checked by Plant Research."
        rec = (f',\n  {{ title: {json.dumps(st["title"], ensure_ascii=False)}, url: {json.dumps(st["url"])}, kind: "{st["kind"]}",\n'
               f'    note: {json.dumps(note)}, plants: [{json.dumps(pid)}] }}')
        t = t[:end].rstrip() + rec + t[end:]
    wr("sources.js", t)

def add_care(pid, group):
    if not group: return
    t = rd("care.js")
    m = re.search(r"(\n\s+" + re.escape(group) + r": \[)([^\]]*)\]", t)
    if not m: print(f"  note: care group '{group}' not found in care.js, so {pid} gets the standard care"); return
    inner = m.group(2).strip()
    t = t[:m.start(2)] + (inner + ", " if inner else "") + json.dumps(pid) + t[m.end(2):]
    wr("care.js", t)

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]; force = "--force" in sys.argv
    if not args: print(__doc__); return
    src, only = args[0], set(args[1:])
    tmp = None
    if zipfile.is_zipfile(src):
        tmp = tempfile.mkdtemp(); zipfile.ZipFile(src).extractall(tmp); root = tmp
    else: root = src
    if "--update" in sys.argv: apply_updates(root); return
    pkgs = []
    for d, _, files in os.walk(root):
        if os.path.basename(d) == "website" and "plant.json" in files:
            pkgs.append((d, json.load(open(os.path.join(d, "plant.json"), encoding="utf-8"))))
    if not pkgs: sys.exit("No prepared plants found (looking for */website/plant.json). Is this a Plant Research zip?")
    existing = site_plants()
    ids = {p["id"] for p in existing}; codes = {p["code"].lower() for p in existing}
    latins = {check_plants_norm(p["latin"]): p["name"] for p in existing}
    added, skipped = [], []
    for d, pkg in sorted(pkgs, key=lambda x: x[1]["id"]):
        e = pkg["entry"]; pid = e["id"]; name = e.get("name", pid)
        if only and pid not in only: continue
        why = []
        if pid in ids: why.append(f"the id '{pid}' is already in the planner")
        if check_plants_norm(e.get("latin", "")) in latins: why.append(f"already in the planner as {latins[check_plants_norm(e['latin'])]}")
        if not force:
            if any("NOT hardy" in w for w in pkg.get("warn", [])) and not e.get("winter"): why.append("not hardy in Michigan zone 6B and no winter care given (use --force to add anyway)")
            if not pkg.get("status"): why.append("no Michigan native or garden-center source (use --force to add anyway)")
        if not os.path.exists(os.path.join(d, "photo-full.txt")): why.append("no prepared photo in the zip")
        if why: skipped.append((name, why)); continue
        e["code"] = unique_code(e.get("code"), name, codes)
        if pkg.get("status"): e["native"] = pkg["status"]["kind"] == "native"
        add_entry(e)
        add_photo(pid, open(os.path.join(d, "photo-full.txt")).read().strip(), open(os.path.join(d, "photo-preview.txt")).read().strip(), pkg.get("credit"))
        if pkg.get("status"): add_status(pid, pkg["status"])
        add_care(pid, pkg.get("care"))
        ids.add(pid); codes.add(e["code"].lower()); added.append((name, pid, e["code"]))
    for name, why in skipped: print(f"SKIPPED {name}: " + "; ".join(why))
    for name, pid, code in added: print(f"ADDED   {name} (id {pid}, code {code})")
    if added:
        subprocess.run([sys.executable, os.path.join(HERE, "build_companions.py")], cwd=HERE)   # lists the new plants (no pairings yet)
        subprocess.run([sys.executable, os.path.join(HERE, "make_notes.py")], cwd=HERE)
        print()
        r = subprocess.run([sys.executable, os.path.join(HERE, "check_plants.py")], cwd=HERE)
        if r.returncode: sys.exit(r.returncode)

def check_plants_norm(s):
    w = re.sub(r"['\"‘’“”].*$", "", s or "").split()
    return " ".join(w[:2]).lower()

if __name__ == "__main__":
    main()
