# Hourly copy of the community reports and photos into this repo (backup/), so they survive if the database is lost.
# Uses only the public read API (the same publishable key the website uses); hidden or removed photos are deleted here too.
import base64, json, os, urllib.request
URL = 'https://cxehaxfzxhghzhlkdehq.supabase.co/rest/v1/'
KEY = 'sb_publishable_Vyhmpjx--F4AtjZl22-UHA_IUwhdD_N'
def get(path):
    req = urllib.request.Request(URL + path, headers={'apikey': KEY, 'Authorization': 'Bearer ' + KEY})
    with urllib.request.urlopen(req, timeout=60) as r: return json.load(r)
out = os.path.join(os.getcwd(), 'backup')  # run from the repo root (GitHub Actions does)
photos = os.path.join(out, 'photos'); os.makedirs(photos, exist_ok=True)
rows = []  # the API returns at most 1000 rows per request: page through them all (a short list here would also drop photos below)
while True:
    page = get(f'reports?select=id,district,actor,kind,day,note,has_photo,created_at&order=id&limit=1000&offset={len(rows)}')
    rows += page
    if len(page) < 1000: break
json.dump(rows, open(os.path.join(out, 'reports.json'), 'w'), indent=1)
try: json.dump(get('vote_counts?select=report_id,likes,dislikes&order=report_id'), open(os.path.join(out, 'votes.json'), 'w'), indent=1)
except Exception as e: print('votes skipped:', e)
want = {str(r['id']) for r in rows if r['has_photo']}
for f in os.listdir(photos):  # removed by a key holder or retracted: not kept in the public backup either
    if f.endswith('.jpg') and f[:-4] not in want: os.remove(os.path.join(photos, f)); print('removed', f)
for i in sorted(want - {f[:-4] for f in os.listdir(photos)}, key=int):
    b64 = get(f'reports?select=photo&id=eq.{i}')[0]['photo']
    if not b64: print('report', i, 'has no photo in the database and none here, skipped'); continue
    data = base64.b64decode(b64); assert data[:3] == b'\xff\xd8\xff', f'report {i}: not a JPEG'
    open(os.path.join(photos, i + '.jpg'), 'wb').write(data); print('saved', i)
print(len(rows), 'reports,', len(want), 'photos')
