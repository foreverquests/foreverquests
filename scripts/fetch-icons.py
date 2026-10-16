#!/usr/bin/env python3
"""Fetch in-game icons for auto-published items from wago.tools (used with Wago's permission).
Item.IconFileDataID -> https://wago.tools/api/casc/<fileDataID> (BLP) -> 56px webp in src/img/items/.
Sets item["img"] = "<fileDataID>.webp" in src/data.json. Only downloads icons not already on disk."""
import csv, io, json, os, sys, time, urllib.request
from PIL import Image
UA = 'ForeverScout/1.0 (+https://foreverquests.github.io/foreverquests/)'
OUT = 'src/img/items'
def get(url):
    for i in range(3):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60).read()
        except Exception as e:
            err = e; time.sleep(2 * (i + 1))
    raise err
D = json.load(open('src/data.json'))
build = json.load(open('review/state.json')).get('lastForeverBuild') or sys.argv[1]
icon = {r['ID']: r['IconFileDataID'] for r in csv.DictReader(io.StringIO(get(f'https://wago.tools/db2/Item/csv?build={build}').decode()))}
tbl = lambda n: list(csv.DictReader(io.StringIO(get(f'https://wago.tools/db2/{n}/csv?build={build}').decode())))
app = {r['ID']: r['DefaultIconFileDataID'] for r in tbl('ItemAppearance')}
for r in tbl('ItemModifiedAppearance'):  # fallback when Item.IconFileDataID is 0
    if icon.get(r['ItemID'], '0') == '0' and app.get(r['ItemAppearanceID'], '0') != '0': icon[r['ItemID']] = app[r['ItemAppearanceID']]
os.makedirs(OUT, exist_ok=True)
got = miss = 0
for it in D['items']:
    a = it.get('auto', '')
    if not a.startswith('item:'): continue
    fid = icon.get(a[5:])
    if not fid or fid == '0': it.pop('img', None); miss += 1; continue
    f = f'{fid}.webp'
    if not os.path.exists(f'{OUT}/{f}'):
        try:
            Image.open(io.BytesIO(get(f'https://wago.tools/api/casc/{fid}'))).convert('RGBA').resize((56, 56), Image.LANCZOS).save(f'{OUT}/{f}', quality=82, method=6)
        except Exception as e:
            print('  icon fail', a, fid, e); it.pop('img', None); miss += 1; continue
    it['img'] = f; got += 1
json.dump(D, open('src/data.json', 'w'), indent=2, ensure_ascii=False); open('src/data.json', 'a').write('\n')
print(f'icons: {got} items with icon, {miss} without, {len(os.listdir(OUT))} files')
