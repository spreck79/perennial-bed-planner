# Tools

The website needs nothing from this folder: it reads the plant folders (`../data/plants/<id>/`) by itself every time
a page opens (see `../plant-data.js` and `../data/SCHEMA.md`). Nothing is built or generated.

| File | What it's for |
|---|---|
| `serve.js` | The site on your computer at http://localhost:8321. It starts by itself with Windows (hidden), serves the site from this folder and tells it which plant folders there are, so adding, deleting or editing a folder shows in the open page within a few seconds. |
| `check.js` | Optional: `node build/check.js` checks every plant folder against the rules in `../data/SCHEMA.md` and lists anything to fix. |
| `validate.js`, `common.js` | The rules `check.js` uses. |
