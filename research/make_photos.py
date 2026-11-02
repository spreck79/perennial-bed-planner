#!/usr/bin/env python3
"""Plant photos, made the same way every time.

The planner keeps two copies of each plant's photo:
  photos/<id>.js   the full-size photo (640 x 480 JPEG), loaded only when a photo is enlarged or the PDF is made
  images.js        a small preview (240 x 180 JPEG) of every plant, loaded when the planner opens
and the photo credit in credits.js (shown on the credits page and in the PDF).

Add or replace one plant's photo (crops the middle to 4:3, makes both sizes, records the credit):
  python make_photos.py add <plant-id> <image file> --file "Commons file name.jpg" --by "Author" --lic "CC BY-SA 4.0" --lic-url "https://creativecommons.org/licenses/by-sa/4.0/"

Rebuild images.js from the photos folder (after removing a photo, or to redo all previews):
  python make_photos.py rebuild

Needs Python 3 with Pillow (pip install pillow). Run it from anywhere; it works on the folder it sits in.
"""
import argparse, base64, io, json, os, re, sys

SITE = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
FULL, FULL_Q = (640, 480), 82        # full-size photo
PREV, PREV_Q = (240, 180), 60        # preview in images.js

def need_pillow():
    try:
        from PIL import Image, ImageOps  # noqa: F401
        return Image, ImageOps
    except ImportError:
        sys.exit("This needs Pillow: run  pip install pillow  and try again.")

def jpeg_b64(img, size, q):
    Image, _ = need_pillow()
    im = img.convert("RGB").resize(size, Image.LANCZOS)
    out = io.BytesIO(); im.save(out, "JPEG", quality=q, optimize=True, progressive=True)
    return base64.b64encode(out.getvalue()).decode()

def crop43(img):
    w, h = img.size
    if w / h > 4 / 3: nw = round(h * 4 / 3); return img.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    nh = round(w * 3 / 4); return img.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))

def read_full(pid):
    t = open(os.path.join(SITE, "photos", pid + ".js"), encoding="utf-8").read()
    m = re.search(r'"(data:image/[a-z]+;base64,[^"]+)"', t)
    return m.group(1) if m else None

def write_full(pid, b64):
    os.makedirs(os.path.join(SITE, "photos"), exist_ok=True)
    with open(os.path.join(SITE, "photos", pid + ".js"), "w", encoding="utf-8") as f:
        f.write(f'// Full-size photo of {pid} (credit in plants.js). Loaded on demand by app.js.\n'
                f'(window.PHOTO_FULL = window.PHOTO_FULL || {{}})["{pid}"] = "data:image/jpeg;base64,{b64}";\n')

def rebuild():
    Image, _ = need_pillow()
    path = os.path.join(SITE, "images.js")
    old = open(path, encoding="utf-8").read() if os.path.exists(path) else ""
    order = re.findall(r'^ "([\w-]+)": "data:', old, re.M)                 # keep the existing order...
    have = sorted(f[:-3] for f in os.listdir(os.path.join(SITE, "photos")) if f.endswith(".js"))
    order = [p for p in order if p in have] + [p for p in have if p not in order]   # ...new photos go at the end
    m = re.search(r"window\.PHOTO_PLACEHOLDER = .*?;", old)
    tail = m.group(0) if m else "window.PHOTO_PLACEHOLDER = [];"
    lines = ["// Plant photos from Wikimedia Commons (credits are listed in plants.js and in the PDF).",
             "// These are small 240 x 180 previews so the planner opens fast. The full-size photos are in the",
             "// photos folder, one file per plant, and load only when a photo is enlarged or the PDF is made.",
             "window.PHOTOS = {"]
    for pid in order:
        uri = read_full(pid)
        if not uri: print("  skipped", pid, "(no photo data in photos/" + pid + ".js)"); continue
        img = Image.open(io.BytesIO(base64.b64decode(uri.split(",", 1)[1])))
        lines.append(f' "{pid}": "data:image/jpeg;base64,{jpeg_b64(img, PREV, PREV_Q)}",')
    lines += ["};", tail]
    open(path, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print(f"images.js rebuilt: {len(order)} previews ({os.path.getsize(path) // 1024} KB)")

def set_credit(pid, file, by, lic, lic_url):
    path = os.path.join(SITE, "credits.js"); t = open(path, encoding="utf-8").read()
    i = t.index("window.CREDITS = ") + len("window.CREDITS = "); j = t.rindex("};") + 1
    data = json.loads(t[i:j]); data[pid] = {"file": file, "by": by, "lic": lic, "licUrl": lic_url}
    open(path, "w", encoding="utf-8").write(t[:i] + json.dumps(data, indent=1, ensure_ascii=False) + t[j:])
    print("credit recorded in credits.js")

def add(a):
    Image, ImageOps = need_pillow()
    if not re.fullmatch(r"[a-z0-9-]+", a.id): sys.exit("Plant ids are lower-case letters, numbers and dashes, like 'wildginger'.")
    img = ImageOps.exif_transpose(Image.open(a.image))
    if min(img.size) < 480: print(f"  note: the photo is small ({img.size[0]} x {img.size[1]}); it may look soft when enlarged.")
    write_full(a.id, jpeg_b64(crop43(img), FULL, FULL_Q)); print("wrote photos/" + a.id + ".js")
    if a.file: set_credit(a.id, a.file, a.by or "", a.lic or "", a.lic_url or "")
    else: print("  reminder: no --file given, so the photo credit was not recorded. Add it before publishing.")
    rebuild()
    print("Next: make sure plants.js has the plant with  credit: { file, by, lic }  matching, then run  python check_plants.py")

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Make plant photos the same way every time.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("add", help="add or replace one plant's photo"); p.add_argument("id"); p.add_argument("image")
    p.add_argument("--file", help="Wikimedia Commons file name (or other source file name)"); p.add_argument("--by", help="photographer / author")
    p.add_argument("--lic", help='license, for example "CC BY-SA 4.0"'); p.add_argument("--lic-url", dest="lic_url", help="link to the license")
    sub.add_parser("rebuild", help="rebuild images.js previews from the photos folder")
    a = ap.parse_args()
    add(a) if a.cmd == "add" else rebuild()
