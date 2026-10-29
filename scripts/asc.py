#!/usr/bin/env python3
"""Read-only App Store Connect client.

The console is a web front end over a REST API, so the state of a submission
can be read straight out of it instead of clicked through. Credentials come
from .env (gitignored) and are never printed.

    python scripts/asc.py status
    python scripts/asc.py get /v1/apps
"""
import os, sys, time, json, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = 'https://api.appstoreconnect.apple.com'


def env():
    vals = {}
    with open(os.path.join(ROOT, '.env'), encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line.startswith('ASC_') and '=' in line:
                k, v = line.split('=', 1)
                vals[k.strip()] = v.strip().strip('"').strip("'")
    missing = [k for k in ('ASC_API_KEY_ID', 'ASC_API_KEY_ISSUER_ID', 'ASC_API_KEY_PATH', 'ASC_APP_ID')
               if k not in vals]
    if missing:
        sys.exit(f'.env is missing: {", ".join(missing)}')
    return vals


def token(cfg):
    import jwt
    path = cfg['ASC_API_KEY_PATH']
    if not os.path.isabs(path):
        path = os.path.join(ROOT, path)
    with open(path, 'rb') as f:
        key = f.read()
    now = int(time.time())
    return jwt.encode(
        {'iss': cfg['ASC_API_KEY_ISSUER_ID'], 'iat': now, 'exp': now + 900,
         'aud': 'appstoreconnect-v1'},
        key, algorithm='ES256', headers={'kid': cfg['ASC_API_KEY_ID'], 'typ': 'JWT'})


def get(path, cfg=None, tok=None):
    cfg = cfg or env()
    tok = tok or token(cfg)
    url = path if path.startswith('http') else API + path
    req = urllib.request.Request(url, headers={'Authorization': f'Bearer {tok}'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', 'replace')
        return {'__error': e.code, '__body': body[:600]}


def status():
    cfg = env()
    tok = token(cfg)
    app_id = cfg['ASC_APP_ID']
    g = lambda p: get(p, cfg, tok)

    app = g(f'/v1/apps/{app_id}')
    if '__error' in app:
        print('ERROR', app['__error'], app['__body'])
        return
    a = app['data']['attributes']
    print(f"APP  {a.get('name')}  [{a.get('bundleId')}]  sku={a.get('sku')}")
    print(f"     primaryLocale={a.get('primaryLocale')}")

    # Categories only come back when explicitly included; without ?include= the
    # relationship is a bare link and reads as "not set" when it is in fact set.
    for ai in g(f'/v1/apps/{app_id}/appInfos'
                '?include=primaryCategory,secondaryCategory').get('data', []):
        at = ai['attributes']
        print(f"\nAPP INFO  state={at.get('appStoreState') or at.get('state')}")
        rel = ai.get('relationships', {})
        for name in ('primaryCategory', 'secondaryCategory'):
            d = (rel.get(name) or {}).get('data')
            print(f"  {name:18s} {d['id'] if d else '-- NOT SET'}")
        ar = g(f"/v1/appInfos/{ai['id']}/ageRatingDeclaration").get('data')
        print(f"  ageRating          {'set' if ar else '-- NOT SET'}")
        for loc in g(f"/v1/appInfos/{ai['id']}/appInfoLocalizations").get('data', []):
            la = loc['attributes']
            print(f"  loc {la.get('locale'):6s} name={la.get('name')!r} "
                  f"subtitle={la.get('subtitle')!r} privacyPolicyUrl="
                  f"{'set' if la.get('privacyPolicyUrl') else '-- NOT SET'}")

    vers = g(f'/v1/apps/{app_id}/appStoreVersions?limit=3')
    for v in vers.get('data', []):
        va = v['attributes']
        print(f"\nVERSION {va.get('versionString')}  state={va.get('appStoreState')}"
              f"  platform={va.get('platform')}  release={va.get('releaseType')}")
        b = g(f"/v1/appStoreVersions/{v['id']}/build").get('data')
        print(f"  build              {b['attributes'].get('version') if b else '-- NOT ATTACHED'}")
        rd = g(f"/v1/appStoreVersions/{v['id']}/appStoreReviewDetail").get('data')
        if rd:
            r = rd['attributes']
            print(f"  review contact     {r.get('contactFirstName')} {r.get('contactLastName')} "
                  f"{r.get('contactEmail')}")
            print(f"  demo account       required={r.get('demoAccountRequired')} "
                  f"name={'set' if r.get('demoAccountName') else '-- EMPTY'} "
                  f"pass={'set' if r.get('demoAccountPassword') else '-- EMPTY'}")
            print(f"  review notes       {'set' if r.get('notes') else '-- EMPTY'}")
        else:
            print('  review detail      -- NOT SET')
        for loc in g(f"/v1/appStoreVersions/{v['id']}/appStoreVersionLocalizations").get('data', []):
            la = loc['attributes']
            print(f"  loc {la.get('locale'):6s} desc={'set' if la.get('description') else '-- EMPTY'} "
                  f"keywords={'set' if la.get('keywords') else '-- EMPTY'} "
                  f"support={'set' if la.get('supportUrl') else '-- EMPTY'} "
                  f"whatsNew={'set' if la.get('whatsNew') else '(n/a)'}")
            sets = g(f"/v1/appStoreVersionLocalizations/{loc['id']}/appScreenshotSets").get('data', [])
            if not sets:
                print('       screenshots   -- NONE UPLOADED')
            for s in sets:
                shots = g(f"/v1/appScreenshotSets/{s['id']}/appScreenshots").get('data', [])
                print(f"       screenshots   {s['attributes'].get('screenshotDisplayType')}: {len(shots)}")

    builds = g(f'/v1/builds?filter[app]={app_id}&limit=5&sort=-uploadedDate')
    print('\nBUILDS')
    for b in builds.get('data', []):
        ba = b['attributes']
        print(f"  {ba.get('version'):4s} {ba.get('processingState'):12s} "
              f"expired={ba.get('expired')}  uploaded={ba.get('uploadedDate')}")


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'status'
    if cmd == 'status':
        status()
    elif cmd == 'get':
        print(json.dumps(get(sys.argv[2]), indent=2, ensure_ascii=False))
    else:
        sys.exit('usage: asc.py [status | get <path>]')
