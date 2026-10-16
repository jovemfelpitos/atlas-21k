"""Outline approved Sora text without changing the received symbol geometry.

Input: browser measurements from tools/brand-preview.js, saved as JSON.
Requires fontTools; Node's built-in Brotli can decode the existing WOFF2 when
Python's optional Brotli extension is unavailable. No package install is needed.
"""
from pathlib import Path
from io import BytesIO
from types import SimpleNamespace
import argparse
import hashlib
import html
import json
import re
import shutil
import subprocess
import xml.etree.ElementTree as ET

from fontTools.ttLib import TTFont
from fontTools.ttLib import woff2
from fontTools.pens.svgPathPen import SVGPathPen

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / 'assets/brand/v1.0'
FONT = ROOT / 'assets/fonts/sora/sora-latin-wght.woff2'
NS = {'s': 'http://www.w3.org/2000/svg'}


def node_brotli(data):
    node = shutil.which('node')
    if not node:
        raise RuntimeError('Node.js is required to decode WOFF2 without Python Brotli.')
    code = "const fs=require('node:fs'),z=require('node:zlib');process.stdout.write(z.brotliDecompressSync(fs.readFileSync(0)));"
    return subprocess.run([node, '-e', code], input=data, stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE, check=True).stdout


def number(value):
    return f'{value:.8f}'.rstrip('0').rstrip('.') or '0'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('measurements', type=Path)
    args = parser.parse_args()
    measurements = json.loads(args.measurements.read_text(encoding='utf-8'))
    if len(measurements) != 6:
        raise ValueError('Expected the six approved compositions.')
    if not woff2.haveBrotli:
        woff2.brotli = SimpleNamespace(decompress=node_brotli)
        woff2.haveBrotli = True
    font = TTFont(BytesIO(FONT.read_bytes()))
    cmap = font.getBestCmap()
    upem = font['head'].unitsPerEm
    output = BRAND / 'release/svg/logotipo'
    output.mkdir(parents=True, exist_ok=True)
    results = []
    for item in measurements:
        name = item['file']
        if Path(name).name != name or not re.fullmatch(r'atlas-run-(horizontal|vertical)-(colorido|branco|preto)\.svg', name):
            raise ValueError(f'Unexpected composition: {name}')
        source = BRAND / 'svg/logotipo' / name
        original = source.read_text(encoding='utf-8')
        nodes = list(item['texts'])

        def outline(match):
            node = nodes.pop(0)
            text = ET.fromstring(match.group(0))
            if ''.join(text.itertext()) != node['text']:
                raise ValueError(f'Text measurement mismatch in {name}')
            glyphs = font.getGlyphSet(location={'wght': node['weight']})
            scale = node['size'] / upem
            paths = []
            for position in node['positions']:
                pen = SVGPathPen(glyphs)
                glyphs[cmap[ord(position['character'])]].draw(pen)
                commands = pen.getCommands()
                if commands:
                    transform = f'translate({number(position["x"])} {number(position["y"])}) scale({number(scale)} {number(-scale)})'
                    paths.append(f'<path transform="{transform}" d="{commands}"/>')
            return f'<g fill="{html.escape(node["fill"], quote=True)}" data-outlined-text="{html.escape(node["text"], quote=True)}">'+''.join(paths)+'</g>'

        final = re.sub(r'<text\b[^>]*>.*?</text>', outline, original, flags=re.S)
        if nodes or '<text' in final:
            raise ValueError(f'Incomplete outlining in {name}')
        before = ET.fromstring(original).findall('.//s:path', NS)
        after = ET.fromstring(final).findall('.//s:path', NS)
        if [dict(p.attrib) for p in before] != [dict(p.attrib) for p in after[:2]]:
            raise ValueError(f'Symbol geometry changed in {name}')
        # Source bytes, including all symbol wrappers/transforms, remain untouched.
        target = output / name
        target.write_text(final, encoding='utf-8', newline='\n')
        results.append({'file': target.relative_to(BRAND / 'release').as_posix(),
                        'source': source.relative_to(BRAND).as_posix(),
                        'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
    release = BRAND / 'release'
    (release / 'typography-metrics.json').write_text(json.dumps(measurements, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    manifest = {'version': '1.0', 'approved_by': 'proprietario', 'approved_on': '2026-10-15',
                'font': 'Sora', 'font_sha256': hashlib.sha256(FONT.read_bytes()).hexdigest(),
                'geometry': 'original-symbol-paths-and-transforms-preserved', 'files': results}
    (release / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({'outlined_compositions': len(results), 'font_axes': [(a.axisTag, a.minValue, a.maxValue) for a in font['fvar'].axes]}))


if __name__ == '__main__':
    main()
