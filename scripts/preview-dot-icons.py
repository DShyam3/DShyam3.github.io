#!/usr/bin/env python3
"""
Render dot-matrix icon candidates to an HTML page so they can be judged at the
size they actually appear, instead of as ASCII.

    python3 scripts/preview-dot-icons.py && open /tmp/dot-icons.html

Patterns are 9x9 grids of '#' (lit) and '.' (unlit), the same shape as the
entries in src/data/dot-matrix.json under `iconPatterns`.
"""

CANDIDATES = {
    "A. Bold crescent (hollow)": [
        "...###...", ".##...##.", ".#.....#.", "##.......", "##.......",
        "##.......", ".#.....#.", ".##...##.", "...###...",
    ],
    "B. Waning crescent (solid)": [
        "..####...", ".###.##..", "####..##.", "####...#.", "####...#.",
        "####...#.", "####..##.", ".###.##..", "..####...",
    ],
    "C. Crescent + two stars": [
        "..###..#.", ".###.....", "####...#.", "####.....", "####.....",
        "####.....", "####...#.", ".###.....", "..###....",
    ],
    "D. Full moon, craters": [
        "...###...", "..#####..", ".##.####.", "########.", "#####.###",
        "########.", ".###.###.", "..#####..", "...###...",
    ],
    "E. Single star": [
        "....#....", "...###...", "#..###..#", ".#.###.#.", "..#####..",
        ".#.###.#.", "#..###..#", "...###...", "....#....",
    ],
    "F1. Crescent + plus star": [
        "...###...", ".###.....", ".##......", "###...#..", "##...###.",
        "###...#..", ".##......", ".###.....", "...###...",
    ],
    "F2. Crescent + diagonal star": [
        "...###...", ".###.....", ".##......", "###..#.#.", "##....#..",
        "###..#.#.", ".##......", ".###.....", "...###...",
    ],
    "F3. Crescent + 8-point star": [
        "...###...", ".###.....", ".##......", "###..#.#.", "##...###.",
        "###.#####", ".##..###.", ".###.#.#.", "...###...",
    ],
    "F. Current (crescent + star)": [
        "...###...", ".###.....", ".##....#.", "###......", "##.......",
        "###......", ".##......", ".###.....", "...###...",
    ],
}

# Matches DotMatrixIcon's `md` pitch: 2px dots, 1px gaps.
DOT, GAP = 2, 1


def svg(rows, scale):
    d, g = DOT * scale, GAP * scale
    step = d + g
    size = 9 * step - g
    dots = []
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            lit = ch == "#"
            dots.append(
                f'<rect x="{x*step}" y="{y*step}" width="{d}" height="{d}" '
                f'rx="{d/2}" fill="{"#e8e8e8" if lit else "#ffffff10"}"/>'
            )
    return f'<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}">{"".join(dots)}</svg>'


cards = []
for name, rows in CANDIDATES.items():
    cards.append(
        f'<figure><div class="row">{svg(rows, 1)}{svg(rows, 2)}{svg(rows, 5)}</div>'
        f"<figcaption>{name}</figcaption></figure>"
    )

html = f"""<!doctype html><meta charset="utf-8">
<title>Dot-matrix icon candidates</title>
<style>
  body {{ background:#0b0b0c; color:#e8e8e8; font:14px 'Space Mono',monospace;
         margin:0; padding:40px; }}
  h1 {{ font-size:16px; font-weight:400; opacity:.6; margin:0 0 4px; }}
  p  {{ font-size:12px; opacity:.4; margin:0 0 32px; }}
  .grid {{ display:grid; gap:32px; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); }}
  figure {{ margin:0; background:#141416; border-radius:12px; padding:24px; }}
  .row {{ display:flex; align-items:center; gap:28px; min-height:120px; }}
  figcaption {{ margin-top:16px; font-size:12px; opacity:.7; }}
</style>
<h1>Dark-mode icon candidates</h1>
<p>Each shown at actual size (~26px), 2x, and 5x.</p>
<div class="grid">{''.join(cards)}</div>
"""

out = "/tmp/dot-icons.html"
with open(out, "w") as fh:
    fh.write(html)
print(f"wrote {out}")
