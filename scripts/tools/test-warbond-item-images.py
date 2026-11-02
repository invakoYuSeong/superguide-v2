"""Offline downloader regressions; run with python3 scripts/tools/test-warbond-item-images.py.

Uses temporary fixtures and mocked wiki responses, never the network or repository assets.
Pillow is only needed by the downloader; npm run check remains Node-only.
"""
import contextlib
import hashlib
import importlib.util
import io
import json
import pathlib
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('fetch_images', pathlib.Path(__file__).with_name('fetch-warbond-item-images.py'))
fetch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fetch)

SVG = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 128"><path fill="white" d="M0 0h10v10z"/></svg>'


class DownloaderTests(unittest.TestCase):
    def test_api_redirect_records_canonical_filename(self):
        response = {'query': {
            'normalized': [{'from': 'File:SH-51_Directional_Shield_Stratagem_Icon.svg',
                            'to': 'File:SH-51 Directional Shield Stratagem Icon.svg'}],
            'redirects': [{'from': 'File:SH-51 Directional Shield Stratagem Icon.svg',
                           'to': 'File:Directional Shield Stratagem Icon.svg'}],
            'pages': {'1': {'title': 'File:Directional Shield Stratagem Icon.svg', 'imageinfo': [{'url': 'original.svg'}]}}}}
        with patch.object(fetch, 'get', return_value=json.dumps(response).encode()), patch.object(fetch.time, 'sleep'):
            result = fetch.image_info(['SH-51_Directional_Shield_Stratagem_Icon.svg'])
        self.assertEqual(result['SH-51_Directional_Shield_Stratagem_Icon.svg']['wikiTitle'], 'Directional Shield Stratagem Icon.svg')

    def test_svg_xml_and_safety(self):
        self.assertEqual(fetch.safe_svg(SVG), (256, 128))
        self.assertEqual(fetch.safe_svg(SVG, {'width': 512, 'height': 256}), (512, 256))
        for raw in [b'<svg><path></svg>', b'<!DOCTYPE svg><svg/>',
                    SVG.replace(b'<path', b'<script/><path'),
                    SVG.replace(b'<path', b'<foreignObject/><path'),
                    SVG.replace(b'<path', b'<use href="https://example.com"/><path'),
                    SVG.replace(b'<path', b'<path onload="evil()"/><path'),
                    b' ' * (fetch.MAX_SVG_BYTES + 1)]:
            with self.subTest(raw=raw[:120]), self.assertRaises((ValueError, fetch.ET.ParseError)):
                fetch.safe_svg(raw)

    def test_refresh_reuses_shared_svg_saves_title_and_keeps_webp(self):
        real_root = fetch.root
        with tempfile.TemporaryDirectory(prefix='warbond-image-test-') as directory:
            root = pathlib.Path(directory)
            out_dir = root / 'dist/assets/warbond-items'
            out_dir.mkdir(parents=True)
            (root / 'dist/assets/stratagems').mkdir()
            (root / 'dist/data').mkdir()
            (root / 'scripts').mkdir()
            (root / 'scripts/svg-safety.mjs').write_bytes((real_root / 'scripts/svg-safety.mjs').read_bytes())
            shared_src = './assets/stratagems/directional-shield-stratagem-icon.svg'
            shared_path = root / 'dist' / shared_src.removeprefix('./')
            shared_path.write_bytes(SVG)
            title_svg = SVG.replace(b'white', b'#fff')
            name = 'SH-51 Directional Shield Stratagem Icon.svg'
            title = 'Directional Shield Stratagem Icon.svg'
            sha256 = hashlib.sha256(SVG).hexdigest()
            icon = {'src': shared_src, 'title': title,
                    'source': fetch.source_url(title), 'sha256': sha256}
            (root / 'dist/data/wiki-icons.js').write_text('export const wikiIcons = ' + json.dumps({'shield': icon}) + ';')
            module_path = root / 'dist/data/warbond-item-images.js'
            # A previously encoded raster must remain byte-for-byte unchanged.
            image = fetch.Image.new('RGBA', (40, 20), (255, 0, 0, 255))
            buffer = io.BytesIO()
            image.save(buffer, 'PNG')
            png = buffer.getvalue()
            webp, (w, h), _ = fetch.encode(png, (180, 180))
            raster = {'src': './assets/warbond-items/gun.webp', 'width': w, 'height': h,
                      'box': [180, 180], 'sha1': 'unchanged-raster-sha1',
                      'sha256': hashlib.sha256(webp).hexdigest()}
            (out_dir / 'gun.webp').write_bytes(webp)
            boxes = {name: (180, 180), 'Rookie Title Icon.svg': (180, 180), 'Gun.png': (180, 180)}
            meta = {name: {'wikiTitle': title, 'sha1': hashlib.sha1(SVG).hexdigest(), 'width': 512, 'height': 256},
                    'Rookie Title Icon.svg': {'wikiTitle': 'Rookie Title Icon.svg', 'url': 'https://wiki/original.svg',
                                              'thumburl': 'https://wiki/original.svg',
                                              'sha1': hashlib.sha1(title_svg).hexdigest(), 'width': 256, 'height': 128},
                    'Gun.png': {'width': 40, 'height': 20, 'sha1': raster['sha1']}}
            with (patch.object(fetch, 'root', root), patch.object(fetch, 'out_dir', out_dir),
                  patch.object(fetch, 'module_path', module_path), patch.object(fetch, 'tiles', return_value=boxes),
                  patch.object(fetch, 'image_info', side_effect=lambda names, width=None: {n: meta[n] for n in names}),
                  patch.object(fetch, 'get', return_value=title_svg) as download,
                  patch.object(fetch, 'encode', side_effect=AssertionError('unchanged raster was re-encoded')),
                  patch.object(fetch.time, 'sleep'), contextlib.redirect_stdout(io.StringIO())):
                fetch.write_module({'Gun.png': raster}, [name, 'Rookie Title Icon.svg'])
                with patch.object(sys, 'argv', ['fetch']):
                    fetch.main()
                entries = fetch.read_module()
                self.assertEqual(entries[name]['src'], shared_src)
                self.assertEqual(entries[name]['wikiTitle'], title)
                self.assertEqual([entries[name]['width'], entries[name]['height']], [512, 256])
                self.assertEqual(entries['Rookie Title Icon.svg']['src'], './assets/warbond-items/rookie-title-icon.svg')
                self.assertEqual((out_dir / 'rookie-title-icon.svg').read_bytes(), title_svg)
                self.assertEqual((out_dir / 'gun.webp').read_bytes(), webp)
                self.assertEqual(set(p.name for p in out_dir.iterdir()), {'rookie-title-icon.svg', 'gun.webp'})
                download.assert_called_once_with('https://wiki/original.svg')
                # Mixed shared SVG, dedicated SVG and WebP mappings also verify without network.
                with patch.object(sys, 'argv', ['fetch', '--reuse-local']):
                    fetch.main()
                download.assert_called_once()
                assets = fetch.wiki_svg_assets()
                self.assertIsNone(fetch.reuse_svg(name, {**meta[name], 'sha1': 'different-revision'}, boxes[name], assets))
                self.assertIsNone(fetch.reuse_svg('Unrelated Stratagem Icon.svg', {'sha1': meta[name]['sha1']}, boxes[name], assets))
                shared_path.write_bytes(SVG + b' ')
                with self.assertRaisesRegex(ValueError, 'hash differs'):
                    fetch.reuse_svg(name, meta[name], boxes[name], assets)


if __name__ == '__main__':
    unittest.main()
