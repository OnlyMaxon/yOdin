#!/usr/bin/env python3
"""Fill the App Store Connect listing for yOdin from the repo's own copy.

Writes only what is already checked into docs/: listing copy, review notes,
and the composed screenshots. Demo-account credentials are deliberately NOT
handled here -- they are typed into the console by hand.

    python scripts/asc_fill.py

Text fields are idempotent (PATCH overwrites), but step 6 CREATES a screenshot
set every run -- re-running it on a version that already has screenshots leaves
duplicates. Delete the existing appScreenshots first, or comment step 6 out.
"""
import os, sys, json, hashlib, urllib.request, urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from asc import env, token, get, API, ROOT

PRIMARY_CATEGORY = 'SOCIAL_NETWORKING'
SECONDARY_CATEGORY = 'TRAVEL'
VERSION_STRING = '1.1.0'
BUILD_NUMBER = '7'
SUBTITLE = 'Community for people abroad'
KEYWORDS = 'expat,abroad,community,forum,immigrant,relocation,questions,answers,events,locals,diaspora'
SUPPORT_URL = 'https://onlymaxon.com/apps/yodin/'
MARKETING_URL = 'https://onlymaxon.com/apps/yodin/'
SHOTS_DIR = os.path.join(ROOT, 'store-assets', 'appstore', '6.9-inch')
DISPLAY_TYPES = ['APP_IPHONE_69', 'APP_IPHONE_67']

CONTACT = dict(contactFirstName='Jalil', contactLastName='Orujli',
               contactEmail='hello@onlymaxon.com')

NOTES = """yOdin is a community app for people living abroad: posts, Q&A discussions, comments and events, scoped to a nationality the user picks.

Moderation of user-generated content (guideline 1.2):
- Reporting: every post, discussion, comment and reply has a Report action (reason + optional detail) available to any signed-in user.
- Review: reports land in a moderator queue; moderators are granted by a server-side Firebase custom claim, which the security rules verify, and can remove content and apply escalating restrictions up to a ban.
- Blocking: any user can block another; blocked users cannot interact, and the block is enforced in the security rules, not only in the UI.
- Terms: the community rules prohibit objectionable content, and accepting them is a gate on sign-up (the accepted revision is recorded per account).
- Contact: hello@onlymaxon.com, published in-app and on the listing.

Account deletion (5.1.1(v)): Profile > Delete account. It re-proves the session first (password, Sign in with Apple, or Microsoft, matching how the account was created), then a server function erases the account, its content and its media, and revokes the Apple refresh token. There is also a web path: https://onlymaxon.com/apps/yodin/delete-account/

Sign in with Apple (4.8) is offered alongside Microsoft sign-in and email.

Minimum age is 18; the app is not directed at children."""


def req(method, path, body=None, tok=None, raw=None, headers=None):
    url = path if path.startswith('http') else API + path
    h = {'Authorization': f'Bearer {tok}'}
    if raw is None and body is not None:
        h['Content-Type'] = 'application/json'
        data = json.dumps(body).encode()
    else:
        data = raw
    h.update(headers or {})
    r = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=120) as resp:
            payload = resp.read()
            return json.loads(payload) if payload else {}
    except urllib.error.HTTPError as e:
        return {'__error': e.code, '__body': e.read().decode('utf-8', 'replace')[:500]}


def ok(label, res):
    if isinstance(res, dict) and '__error' in res:
        print(f'  FAIL {label}: {res["__error"]} {res["__body"]}')
        return False
    print(f'  ok   {label}')
    return True


def description():
    md = open(os.path.join(ROOT, 'docs', 'play-store-listing.md'), encoding='utf-8').read()
    start = md.index('### Full description')
    block = md.index('```', start) + 3
    end = md.index('```', block)
    return md[block:end].strip()


def main():
    cfg = env()
    tok = token(cfg)
    app_id = cfg['ASC_APP_ID']
    g = lambda p: get(p, cfg, tok)

    assert len(SUBTITLE) <= 30, SUBTITLE
    assert len(KEYWORDS) <= 100, len(KEYWORDS)
    desc = description()
    assert len(desc) <= 4000, len(desc)
    print(f'copy: subtitle {len(SUBTITLE)}/30, keywords {len(KEYWORDS)}/100, '
          f'description {len(desc)}/4000')

    ver = g(f'/v1/apps/{app_id}/appStoreVersions?limit=1')['data'][0]
    vid = ver['id']
    info = g(f'/v1/apps/{app_id}/appInfos')['data'][0]
    iid = info['id']

    print('\n1. version string')
    ok(VERSION_STRING, req('PATCH', f'/v1/appStoreVersions/{vid}', {
        'data': {'type': 'appStoreVersions', 'id': vid,
                 'attributes': {'versionString': VERSION_STRING}}}, tok))

    print('2. categories')
    ok(f'{PRIMARY_CATEGORY} / {SECONDARY_CATEGORY}', req('PATCH', f'/v1/appInfos/{iid}', {
        'data': {'type': 'appInfos', 'id': iid, 'relationships': {
            'primaryCategory': {'data': {'type': 'appCategories', 'id': PRIMARY_CATEGORY}},
            'secondaryCategory': {'data': {'type': 'appCategories', 'id': SECONDARY_CATEGORY}}}}}, tok))

    print('3. subtitle')
    il = g(f'/v1/appInfos/{iid}/appInfoLocalizations')['data'][0]
    ok('subtitle', req('PATCH', f"/v1/appInfoLocalizations/{il['id']}", {
        'data': {'type': 'appInfoLocalizations', 'id': il['id'],
                 'attributes': {'subtitle': SUBTITLE}}}, tok))

    print('4. description / keywords / urls')
    vl = g(f'/v1/appStoreVersions/{vid}/appStoreVersionLocalizations')['data'][0]
    ok('localization', req('PATCH', f"/v1/appStoreVersionLocalizations/{vl['id']}", {
        'data': {'type': 'appStoreVersionLocalizations', 'id': vl['id'], 'attributes': {
            'description': desc, 'keywords': KEYWORDS,
            'supportUrl': SUPPORT_URL, 'marketingUrl': MARKETING_URL}}}, tok))

    print('5. app review information')
    ok('review detail', req('POST', '/v1/appStoreReviewDetails', {
        'data': {'type': 'appStoreReviewDetails',
                 'attributes': {**CONTACT, 'notes': NOTES, 'demoAccountRequired': True},
                 'relationships': {'appStoreVersion': {
                     'data': {'type': 'appStoreVersions', 'id': vid}}}}}, tok))

    print('6. screenshots')
    shots = sorted(f for f in os.listdir(SHOTS_DIR) if f.endswith('.png'))
    set_id = None
    for dt in DISPLAY_TYPES:
        r = req('POST', '/v1/appScreenshotSets', {
            'data': {'type': 'appScreenshotSets', 'attributes': {'screenshotDisplayType': dt},
                     'relationships': {'appStoreVersionLocalization': {
                         'data': {'type': 'appStoreVersionLocalizations', 'id': vl['id']}}}}}, tok)
        if '__error' not in r:
            set_id = r['data']['id']
            print(f'  ok   set {dt}')
            break
        print(f'  --   {dt} rejected')
    if set_id:
        for name in shots:
            blob = open(os.path.join(SHOTS_DIR, name), 'rb').read()
            r = req('POST', '/v1/appScreenshots', {
                'data': {'type': 'appScreenshots',
                         'attributes': {'fileSize': len(blob), 'fileName': name},
                         'relationships': {'appScreenshotSet': {
                             'data': {'type': 'appScreenshotSets', 'id': set_id}}}}}, tok)
            if not ok(f'reserve {name}', r):
                continue
            sid = r['data']['id']
            for op in r['data']['attributes']['uploadOperations']:
                chunk = blob[op['offset']:op['offset'] + op['length']]
                hdrs = {h['name']: h['value'] for h in op['requestHeaders']}
                up = req(op['method'], op['url'], raw=chunk, tok=tok, headers=hdrs)
                if isinstance(up, dict) and '__error' in up:
                    print(f'  FAIL upload {name}: {up["__error"]}')
            ok(f'commit {name}', req('PATCH', f'/v1/appScreenshots/{sid}', {
                'data': {'type': 'appScreenshots', 'id': sid, 'attributes': {
                    'uploaded': True,
                    'sourceFileChecksum': hashlib.md5(blob).hexdigest()}}}, tok))

    print('7. attach build')
    builds = g(f'/v1/builds?filter[app]={app_id}&limit=10&sort=-uploadedDate')['data']
    b = next((x for x in builds if x['attributes'].get('version') == BUILD_NUMBER), None)
    if not b:
        print(f'  FAIL build {BUILD_NUMBER} not found')
    else:
        ok(f'build {BUILD_NUMBER}',
           req('PATCH', f'/v1/appStoreVersions/{vid}/relationships/build',
               {'data': {'type': 'builds', 'id': b['id']}}, tok))


if __name__ == '__main__':
    main()
