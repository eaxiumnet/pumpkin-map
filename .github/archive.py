# After the backup is pushed: clear the database copy of photos GitHub Pages already serves (files that were in backup/photos
# before this run, so committed and deployed by an earlier run). Needs the ARCHIVE_KEY secret from community/007_photos_to_github.sql.
import json, os, sys, urllib.request
URL = 'https://cxehaxfzxhghzhlkdehq.supabase.co/rest/v1/'
KEY = 'sb_publishable_Vyhmpjx--F4AtjZl22-UHA_IUwhdD_N'
key = os.environ.get('ARCHIVE_KEY')
if not key: sys.exit(print('no ARCHIVE_KEY secret, photos stay in the database'))
ids = sorted(int(f[:-4]) for f in open(sys.argv[1]).read().split() if f.endswith('.jpg') and f[:-4].isdigit())
want = {r['id'] for r in json.load(urllib.request.urlopen(urllib.request.Request(URL + 'reports?select=id&has_photo=is.true&limit=100000', headers={'apikey': KEY, 'Authorization': 'Bearer ' + KEY}), timeout=60))}
ids = [i for i in ids if i in want]
for i in ids:  # each file must really be on disk and a JPEG before the database copy goes
    with open(f'backup/photos/{i}.jpg', 'rb') as f: assert f.read(3) == bytes.fromhex('ffd8ff'), i
req = urllib.request.Request(URL + 'rpc/archive_photos', json.dumps({'p_key': key, 'p_ids': ids}).encode(),
                             {'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'})
try: print('cleared', json.load(urllib.request.urlopen(req, timeout=60)), 'database photos now served from GitHub')
except Exception as e: print('archive skipped:', e)  # e.g. 007 not run yet; the photos just stay in the database
