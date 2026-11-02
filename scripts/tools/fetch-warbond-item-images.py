"""Download the item images shown on the warbond page boards (Helldivers Wiki).

Reads dist/data/warbonds.js (run scripts/build-warbonds.mjs first): every item carries the
`image` file name from the wiki {{Acquisitions Page}} template and its tile size (colspan ×
rowspan). For each distinct file:
  - asks the MediaWiki API (imageinfo, iiurlwidth) for a thumbnail a bit larger than needed,
  - trims transparent margins, then fits it inside the largest tile it is used in
    (CELL px per board cell; never upscales),
  - saves rasters to dist/assets/warbond-items/<slug>.webp (unchanged raster pipeline),
  - reuses an existing stratagem SVG only when its recorded wiki identity, SHA-256 and the
    current wiki SHA-1 agree; otherwise saves a safety-checked original <slug>.svg (max 50 KB).
and writes dist/data/warbond-item-images.js (file name → src/size/source URL and sha1) plus the list of
files that could not be fetched (the page shows those tiles with their name only).

Files whose wiki sha1 and tile box did not change are kept as they are (no re-encoding), so a
refresh only touches new or changed images. --force re-encodes everything.
Images: Helldivers Wiki, CC BY-NC-SA 4.0. The wiki rejects browser User-Agents.
Usage: python3 scripts/tools/fetch-warbond-item-images.py [--force]   (requires curl and Pillow with WebP)
       python3 scripts/tools/fetch-warbond-item-images.py --reuse-local
         Verify and reuse the existing mapping/images without network access; adds source URLs.
         Does not invent missing entries or alter image bytes.
"""
import hashlib, io, json, pathlib, re, subprocess, sys, time, urllib.parse
import xml.etree.ElementTree as ET

from PIL import Image

root = pathlib.Path(__file__).resolve().parents[2]
out_dir = root / 'dist' / 'assets' / 'warbond-items'
module_path = root / 'dist' / 'data' / 'warbond-item-images.js'
API = 'https://helldivers.wiki.gg/api.php'
CELL = 180          # px per board cell: ~1.2x the widest CSS cell (~150 px), sharp enough on most screens
QUALITY = 74        # WebP quality (alpha kept); the largest tiles are lowered step by step to MAX_BYTES
MAX_BYTES = 45_000
MAX_SVG_BYTES = 50_000
BUCKETS = (160, 240, 320, 480, 640, 800, 1000)  # thumbnail widths requested from the wiki


def get(url):
    # curl's default User-Agent works on wiki.gg; a Mozilla UA returns a block page.
    return subprocess.run(['curl', '--fail', '--silent', '--show-error', '--location',
                           '--max-time', '60', url], capture_output=True, check=True).stdout


def source_url(name):
    return 'https://helldivers.wiki.gg/wiki/File:' + urllib.parse.quote(name.replace(' ', '_'), safe='')


def slug(name):
    return re.sub(r'^-|-$', '', re.sub(r'[^a-z0-9]+', '-', re.sub(r'\.(png|jpe?g|gif|webp|svg)$', '', name.lower())))


def tiles():
    """{file name: (box width, box height)} — the largest tile each image appears in."""
    script = ('import { warbonds } from "./dist/data/warbonds.js";'
              'console.log(JSON.stringify(warbonds.flatMap(w => w.pages.flatMap(p => p.items'
              '.filter(i => i.image).map(i => [i.image, i.colspan || 1, i.rowspan || 1])))))')
    rows = json.loads(subprocess.run(['node', '--input-type=module', '-e', script], cwd=root,
                                     capture_output=True, text=True, check=True).stdout)
    boxes = {}
    for name, cols, rows_ in rows:
        w, h = boxes.get(name, (0, 0))
        boxes[name] = (max(w, cols * CELL), max(h, rows_ * CELL))
    return boxes


def image_info(names, width=None):
    info = {}
    names = sorted(set(names))
    for start in range(0, len(names), 50):
        batch = names[start:start + 50]
        params = {'action': 'query', 'format': 'json', 'redirects': 1, 'prop': 'imageinfo', 'iiprop': 'url|sha1|size',
                  'titles': '|'.join('File:' + t for t in batch)}
        if width:
            params['iiurlwidth'] = width
        data = json.loads(get(f'{API}?{urllib.parse.urlencode(params)}'))
        query = data['query']
        aliases = {n['from']: n['to'] for n in query.get('normalized', []) + query.get('redirects', [])}
        pages = {p['title']: p for p in query['pages'].values()}
        for name in batch:
            title, seen = 'File:' + name, set()
            while title in aliases and title not in seen:
                seen.add(title)
                title = aliases[title]
            page = pages.get(title, {})
            if page.get('imageinfo'):
                info[name] = {**page['imageinfo'][0], 'wikiTitle': page['title'].removeprefix('File:')}
        time.sleep(0.3)
    return info


def bucket(meta, box):
    """Thumbnail width so that, after trimming (assume up to ~30% margin), the image still fills the box."""
    w, h = meta.get('width') or 0, meta.get('height') or 0
    if not w or not h:
        return BUCKETS[-1]
    need = max(box[0], box[1] * w / h) * 1.3
    return next((b for b in BUCKETS if b >= need), BUCKETS[-1])


def encode(raw, box):
    with Image.open(io.BytesIO(raw)) as image:
        image = image.convert('RGBA')
        alpha = image.getchannel('A')
        bounds = alpha.point(lambda a: 255 if a > 8 else 0).getbbox()
        if bounds:
            image = image.crop(bounds)
        scale = min(1, box[0] / image.width, box[1] / image.height)
        if scale < 1:
            image = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.LANCZOS)
        opaque = image.getchannel('A').getextrema()[0] == 255
        if opaque:
            image = image.convert('RGB')
        for quality in range(QUALITY, 44, -6):
            buffer = io.BytesIO()
            image.save(buffer, 'WEBP', quality=quality, alpha_quality=80, method=6)
            if buffer.tell() <= MAX_BYTES:
                break
        return buffer.getvalue(), image.size, quality


def read_module():
    if not module_path.exists():
        return {}
    text = module_path.read_text(encoding='utf-8')
    match = re.search(r'export const warbondItemImages = (\{.*?\n\});', text, re.S)
    return json.loads(re.sub(r',\n\}$', '\n}', match.group(1))) if match else {}


def safe_svg(raw, meta=None):
    """Parse XML with the standard library, then apply the shared Node-only passive SVG policy."""
    if not 0 < len(raw) <= MAX_SVG_BYTES:
        raise ValueError('SVG exceeds 50,000 bytes')
    # Reject DTD/entity declarations before XML parsing (no entity expansion or external input).
    text = raw.decode('utf-8-sig')
    if re.search(r'<!\s*(DOCTYPE|ENTITY)', text, re.I):
        raise ValueError('SVG DTDs/entities are not allowed')
    ET.fromstring(text)
    size = {k: meta[k] for k in ('width', 'height') if meta and meta.get(k)}
    result = subprocess.run(['node', str(root / 'scripts' / 'svg-safety.mjs'), json.dumps(size)],
                            input=raw, capture_output=True, check=False)
    if result.returncode:
        raise ValueError(result.stderr.decode('utf-8').strip())
    dimensions = json.loads(result.stdout)
    return dimensions['width'], dimensions['height']


def wiki_svg_assets():
    """Only explicit wiki filename/source identities count; no guessed display-name matches."""
    text = (root / 'dist' / 'data' / 'wiki-icons.js').read_text(encoding='utf-8')
    icons = json.loads(re.search(r'export const wikiIcons = (\{.*\});', text, re.S).group(1))
    assets = {}
    for icon in icons.values():
        title = icon.get('title', '').replace('_', ' ')
        source = urllib.parse.urlparse(icon.get('source', ''))
        if (source.netloc != 'helldivers.wiki.gg'
                or urllib.parse.unquote(source.path) != '/wiki/File:' + title.replace(' ', '_')
                or not re.fullmatch(r'\./assets/stratagems/[a-z0-9-]+\.svg', icon.get('src', ''))):
            continue
        if title in assets and assets[title] != icon:
            raise ValueError(f'Ambiguous wiki SVG record: {title}')
        assets[title] = icon
    return assets


def reuse_svg(name, meta, box, assets):
    """Current API canonical filename handles redirects, including SH-51 Directional Shield."""
    title = meta.get('wikiTitle', name).replace('_', ' ')
    icon = assets.get(title)
    if not icon:
        return None
    target = root / 'dist' / icon['src'].removeprefix('./')
    raw = target.read_bytes()
    if hashlib.sha256(raw).hexdigest() != icon.get('sha256'):
        raise ValueError(f'Existing stratagem SVG hash differs from wiki-icons.js: {title}')
    # wiki-icons.js records SHA-256, while imageinfo records the original file SHA-1.
    # Verify both so a filename/redirect alone never substitutes a different revision.
    if hashlib.sha1(raw).hexdigest() != meta.get('sha1'):
        return None
    w, h = safe_svg(raw, meta)
    return {'src': icon['src'], 'width': w, 'height': h, 'box': list(box),
            'wikiTitle': title, 'sha1': meta['sha1'], 'sha256': icon['sha256']}


def local_matches(name, entry, box, assets):
    """Only reuse an existing image if its bytes, size and tile box match its record."""
    if not entry or entry.get('box') != list(box):
        return False
    src = entry.get('src', '')
    shared = src.startswith('./assets/stratagems/')
    if shared:
        icon = assets.get(entry.get('wikiTitle', name).replace('_', ' '))
        if not icon or icon['src'] != src or icon['sha256'] != entry.get('sha256'):
            return False
    elif src not in {f'./assets/warbond-items/{slug(name)}.{ext}' for ext in ('webp', 'svg')}:
        return False
    target = root / 'dist' / src.removeprefix('./')
    if not target.is_file():
        return False
    if hashlib.sha256(target.read_bytes()).hexdigest() != entry.get('sha256'):
        return False
    if target.suffix == '.svg':
        raw = target.read_bytes()
        if hashlib.sha1(raw).hexdigest() != entry.get('sha1'):
            return False
        return list(safe_svg(raw, entry)) == [entry.get('width'), entry.get('height')]
    with Image.open(target) as image:
        image.load()
        return (image.format == 'WEBP' and list(image.size) == [entry.get('width'), entry.get('height')]
                and 0 < image.width <= box[0] and 0 < image.height <= box[1])


def write_module(entries, missing):
    body = ',\n'.join(f'  {json.dumps(k, ensure_ascii=False)}: {json.dumps({**v, "source": source_url(k)}, ensure_ascii=False)}' for k, v in sorted(entries.items()))
    module_path.write_text(
        '// Generated by scripts/tools/fetch-warbond-item-images.py from Helldivers Wiki item images\n'
        '// (CC BY-NC-SA 4.0; source: https://helldivers.wiki.gg/wiki/File:<file name>).\n'
        '// Rasters: Trimmed, resized, WebP. SVGs: original bytes, safety-checked; existing stratagem assets reused.\n'
        '// Key: the wiki file name used by the warbond page template. Do not edit by hand.\n'
        f'export const warbondItemImages = {{\n{body}\n}};\n'
        f'export const warbondItemImagesMissing = {json.dumps(sorted(missing), ensure_ascii=False)};\n',
        encoding='utf-8', newline='\n')


def main():
    unknown = set(sys.argv[1:]) - {'--force', '--reuse-local'}
    if unknown or ('--force' in sys.argv and '--reuse-local' in sys.argv):
        sys.exit('Usage: fetch-warbond-item-images.py [--force | --reuse-local]')
    force = '--force' in sys.argv
    boxes = tiles()
    assets = wiki_svg_assets()
    previous = {} if force else read_module()
    slugs = {}
    for name in boxes:
        s = slug(name)
        if s in slugs:
            sys.exit(f'Slug collision: {name!r} and {slugs[s]!r}')
        slugs[s] = name
    if '--reuse-local' in sys.argv:
        text = module_path.read_text(encoding='utf-8')
        missing = json.loads(re.search(r'export const warbondItemImagesMissing = (\[.*?\]);', text).group(1))
        if set(previous) & set(missing) or set(previous) | set(missing) != set(boxes):
            sys.exit('Local mapping does not cover exactly the current template images; run a network refresh.')
        for name, entry in previous.items():
            if not local_matches(name, entry, boxes[name], assets):
                sys.exit(f'Local image failed verification: {name}; run a network refresh.')
        expected = {pathlib.Path(e['src']).name for e in previous.values()
                    if e['src'].startswith('./assets/warbond-items/')}
        if {p.name for p in out_dir.iterdir()} != expected:
            sys.exit('Unreferenced files in warbond-items; inspect before refreshing.')
        write_module(previous, missing)
        total = sum(p.stat().st_size for p in out_dir.iterdir())
        print(f'Verified/reused {len(previous)} images, {total:,} bytes; {len(missing)} still missing (no network request).')
        return
    meta = image_info(boxes)
    print(f'{len(boxes)} distinct images, {len(meta)} found on the wiki')
    entries, missing, fetched, reused = {}, [], 0, 0
    todo = {}
    for name, box in boxes.items():
        m = meta.get(name)
        if not m:
            missing.append(name)
            continue
        if name.lower().endswith('.svg'):
            try:
                shared = reuse_svg(name, m, box, assets)
                if shared:
                    entries[name] = shared
                    reused += 1
                    continue
            except Exception as error:
                print(f'  cannot reuse: {name}: {error}; trying wiki original')
        old = previous.get(name)
        if old and old.get('sha1') == m.get('sha1') and local_matches(name, old, box, assets):
            entries[name] = old
            continue
        todo.setdefault(bucket(m, box), []).append(name)
    out_dir.mkdir(parents=True, exist_ok=True)
    for width, names in sorted(todo.items()):
        thumbs = image_info(names, width)
        for name in names:
            m = thumbs.get(name)
            try:
                if not m:
                    raise ValueError('No imageinfo returned for the thumbnail')
                svg = name.lower().endswith('.svg')
                raw = get(m['url'] if svg else m.get('thumburl') or m['url'])
                time.sleep(0.15)
                if svg:
                    w, h = safe_svg(raw, m)
                    if hashlib.sha1(raw).hexdigest() != m.get('sha1'):
                        raise ValueError('Original SVG SHA-1 does not match imageinfo')
                    data = raw
                else:
                    data, (w, h), quality = encode(raw, boxes[name])
            except Exception as error:  # a broken file on the wiki: show the tile without an image
                print(f'  failed: {name}: {error}')
                missing.append(name)
                continue
            target = out_dir / f'{slug(name)}.{"svg" if svg else "webp"}'
            target.write_bytes(data)
            entries[name] = {'src': f'./assets/warbond-items/{target.name}', 'width': w, 'height': h,
                             'box': list(boxes[name]), 'sha1': m.get('sha1'),
                             'sha256': hashlib.sha256(data).hexdigest()}
            fetched += 1
    keep = {pathlib.Path(e['src']).name for e in entries.values()
            if e['src'].startswith('./assets/warbond-items/')}
    for stale in out_dir.iterdir():
        if stale.suffix in ('.webp', '.svg') and stale.name not in keep:
            stale.unlink()
    write_module(entries, missing)
    total = sum(p.stat().st_size for p in out_dir.iterdir())
    print(f'{len(entries)} images ({fetched} new or changed, {reused} shared stratagem SVGs), '
          f'{total:,} bytes in warbond-items; missing {len(missing)}: {sorted(missing)}')


if __name__ == '__main__':
    main()
