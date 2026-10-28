import sys,json,subprocess,os; sys.path.insert(0,'.')
from pairs_log import LOG
SITE = sys.argv[1] if len(sys.argv) > 1 else '..'
run=lambda js: subprocess.run(["node","-e",js],capture_output=True,text=True).stdout
names=json.loads(run(f"global.window={{}};eval(require('fs').readFileSync('{SITE}/plants.js','utf8'));console.log(JSON.stringify(Object.fromEntries(window.PLANTS.map(p=>[p.id,p.name]))))"))
st=json.loads(run(f"global.window={{}};eval(require('fs').readFileSync('{SITE}/sources.js','utf8'));console.log(JSON.stringify(window.STATUS_SOURCES))"))
comp=json.loads(run(f"global.window={{}};eval(require('fs').readFileSync('{SITE}/companions.js','utf8'));console.log(JSON.stringify(window.COMPANIONS))"))
L=["# Perennial Bed Planner – research notes","","Kept so the research does not have to be redone. Checked October 2026.","","## Good neighbors (companion plantings)","","Each entry: the plant the source is about, what the source says, the partners in our plant list, and the source link.",""]
for a,ps,u,n in LOG:
    L.append(f"- **{names[a]}** – {n}  \n  Partners in the planner: {', '.join(names[p] for p in ps)}  \n  Source: {u}")
L+=["","## Michigan native or garden favorite","","- Michigan native = a true Michigan native plant.","- Garden favorite = sold at Michigan garden centers.",""]
for s in st:
    L.append(f"- **{s['title']}** ({'native check' if s['kind']=='native' else 'garden-center check'}) – {s['note']}  \n  Plants: {', '.join(names[p] for p in s['plants'] if p in names)}  \n  {s['url']}")
none=[names[k] for k,v in comp.items() if not v]
L+=["","## Still to research","","No published companion pairing found yet for: "+", ".join(none)+"."]
os.makedirs(f'{SITE}/research',exist_ok=True)
open(f'{SITE}/research/research-notes.md','w').write("\n".join(L)+"\n")
print("notes written; none:", none)
