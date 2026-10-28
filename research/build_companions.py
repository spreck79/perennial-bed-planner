import sys, json, re, subprocess
sys.path.insert(0, '.')
from pairs_log import LOG
names = json.loads(subprocess.run(["node","-e","global.window={};eval(require('fs').readFileSync('../plants.js','utf8'));console.log(JSON.stringify(Object.fromEntries(window.PLANTS.map(p=>[p.id,p.name]))))"],capture_output=True,text=True).stdout)
def title(u, about=None):
    n = names.get(about, "")
    if "hort.extension.wisc.edu" in u: return f"Wisconsin Horticulture (UW–Madison Extension): {n} article"
    if "waltersgardens.com" in u: return f"Walters Gardens, Zeeland, Michigan: {n} companions" if "photo_essay" not in u else "Walters Gardens, Zeeland, Michigan: Plants to Pair with Hostas"
    if "mtcubacenter.org" in u: return f"Mt. Cuba Center: {n}"
    if "perennials.com" in u: return f"Perennials.com: {n} profile"
    return u
def _old_title(u):
    if "hort.extension.wisc.edu" in u:
        slug = u.rstrip('/').split('/')[-1]; return "Wisconsin Horticulture (UW–Madison Extension): " + re.sub(r'-', ' ', slug).title()
    if "waltersgardens.com" in u:
        return "Walters Gardens, Zeeland, Michigan: plant " + u.split('ID=')[-1] if 'ID=' in u else "Walters Gardens, Zeeland, Michigan"
    if "mtcubacenter.org" in u:
        return "Mt. Cuba Center: " + u.rstrip('/').split('/')[-1].replace('-', ' ').title()
    if "perennials.com" in u:
        return "Perennials.com plant profile: " + u.rstrip('/').split('/')[-1].replace('.html','').replace('-', ' ').title()
    return u
srcs = []; sidx = {}
comp = {k: {} for k in names}
for a, ps, u, note in LOG:
    if u not in sidx: sidx[u] = len(srcs); srcs.append({"url": u, "title": title(u, a), "about": a})
    for b in ps:
        if a == b: continue
        for x, y in ((a, b), (b, a)):
            if y not in comp[x]: comp[x][y] = {"why": note, "src": [sidx[u]], "from": a}
            elif sidx[u] not in comp[x][y]["src"]:
                comp[x][y]["src"].append(sidx[u])
                if a == x: comp[x][y]["why"] = note; comp[x][y]["from"] = a
# a pair stated about plant x itself is preferred as the reason shown for x
out = {k: [{"id": y, "why": v["why"], "src": v["src"]} for y, v in sorted(d.items(), key=lambda kv: (kv[1]["from"] != k, names[kv[0]]))] for k, d in comp.items()}
js = "// Good-neighbor (companion) pairings, from the sources listed in COMPANION_SOURCES.\n// Built from research/pairs_log.py. Each entry: partner id, the reason as stated by the source, source index.\n"
js += "window.COMPANION_SOURCES = " + json.dumps(srcs, ensure_ascii=False, indent=0) + ";\n"
js += "window.COMPANIONS = " + json.dumps(out, ensure_ascii=False) + ";\n"
open('../companions.js','w').write(js)
cnt = {k: len(v) for k, v in out.items()}
print("sources", len(srcs), "plants with none:", [k for k,v in cnt.items() if v==0], "avg", round(sum(cnt.values())/len(cnt),1))
