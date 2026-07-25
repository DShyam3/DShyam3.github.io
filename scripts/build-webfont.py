#!/usr/bin/env python3
"""
Compile the dot-matrix letterforms in generate-dot-font.py into a real
WOFF2 font (square-dot pixel style), instead of simulating the font with
CSS box-shadow circles positioned per character.

Why: the CSS box-shadow approach draws each glyph as raw positioned dots,
not real font glyphs, so the browser has no font hinting/pixel-snapping for
it. Depending on where a word lands in a flex layout, its dots can fall on
fractional device pixels and render visibly softer than a neighboring word
that happens to land on integer pixels -- an inconsistency that isn't
fixable by editing letterforms, since it's about *positioning*, not shape.
A real font is hinted/rendered by the browser's own text engine like any
other text, so it doesn't have this problem.

Requires (isolated venv, not a project dependency):
    pip install fonttools brotli

Re-run after editing patterns in generate-dot-font.py:
    python3 scripts/build-webfont.py
"""

import importlib.util
import pathlib
import sys

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

SCRIPT_DIR = pathlib.Path(__file__).parent
spec = importlib.util.spec_from_file_location("generate_dot_font", SCRIPT_DIR / "generate-dot-font.py")
generate_dot_font = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generate_dot_font)
PATTERNS = generate_dot_font.PATTERNS
ROWS = generate_dot_font.ROWS

UNITS_PER_EM = 1000
GRID_UNIT = 120      # pitch between adjacent dot positions (x and y)
DOT_SIZE = 80        # drawn square size -- leaves a 40-unit gap, ~2:1 dot:gap,
                      # matching the dot=2/gap=1 ratio the CSS version used
SIDE_BEARING = 60    # left/right margin around each glyph's ink
BASELINE_OFFSET = 20 # bottom row sits this far above y=0

COLS = 5
SPACE_COLS = 3
ADVANCE = (COLS - 1) * GRID_UNIT + DOT_SIZE + 2 * SIDE_BEARING
SPACE_ADVANCE = (SPACE_COLS - 1) * GRID_UNIT + DOT_SIZE + 2 * SIDE_BEARING

CAP_HEIGHT = (ROWS - 1) * GRID_UNIT + DOT_SIZE + BASELINE_OFFSET


def row_y(row_index):
    return (ROWS - 1 - row_index) * GRID_UNIT + BASELINE_OFFSET


def glyph_name_for(ch):
    if ch == ' ':
        return 'space'
    return f'uni{ord(ch):04X}'


def build_glyph(pattern):
    pen = TTGlyphPen(None)
    for r, row in enumerate(pattern):
        y0 = row_y(r)
        y1 = y0 + DOT_SIZE
        for c, value in enumerate(row):
            if not value:
                continue
            x0 = SIDE_BEARING + c * GRID_UNIT
            x1 = x0 + DOT_SIZE
            pen.moveTo((x0, y0))
            pen.lineTo((x1, y0))
            pen.lineTo((x1, y1))
            pen.lineTo((x0, y1))
            pen.closePath()
    return pen.glyph()


def main():
    glyph_order = ['.notdef']
    glyphs = {'.notdef': TTGlyphPen(None).glyph()}
    metrics = {'.notdef': (ADVANCE, 0)}
    cmap = {}

    for ch, rows in PATTERNS.items():
        name = glyph_name_for(ch)
        glyph_order.append(name)
        glyphs[name] = build_glyph(rows)
        advance = SPACE_ADVANCE if ch == ' ' else ADVANCE
        lsb = 0 if ch == ' ' else SIDE_BEARING
        metrics[name] = (advance, lsb)
        cmap[ord(ch)] = name

    fb = FontBuilder(UNITS_PER_EM, isTTF=True)
    fb.setupGlyphOrder(glyph_order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=int(CAP_HEIGHT + 140), descent=int(-140))
    fb.setupNameTable({
        'familyName': 'Dot Matrix Mono',
        'styleName': 'Regular',
        'uniqueFontIdentifier': 'DotMatrixMono-Regular',
        'fullName': 'Dot Matrix Mono Regular',
        'psName': 'DotMatrixMono-Regular',
        'version': 'Version 1.0',
    })
    fb.setupOS2(
        sTypoAscender=int(CAP_HEIGHT + 140),
        sTypoDescender=int(-140),
        sTypoLineGap=0,
        usWinAscent=int(CAP_HEIGHT + 140),
        usWinDescent=140,
        sCapHeight=int(CAP_HEIGHT),
    )
    fb.setupPost()

    out_dir = pathlib.Path('public/fonts')
    out_dir.mkdir(parents=True, exist_ok=True)

    ttf_path = out_dir / 'dot-matrix-mono.ttf'
    fb.save(str(ttf_path))

    fb.font.flavor = 'woff2'
    woff2_path = out_dir / 'dot-matrix-mono.woff2'
    fb.save(str(woff2_path))

    print(f'Wrote {len(PATTERNS)} glyphs to {ttf_path} and {woff2_path}')


if __name__ == '__main__':
    main()
