#!/usr/bin/env python3
"""
Generate the "hero glyph" tier -- large (25x25) dot-matrix icons for
standalone display moments (status glyphs, feature icons, one-off badges),
as distinct from the small 9x9 iconPatterns in dot-matrix.json used for
inline UI (social links, theme toggle).

25x25 is too coarse a thing to hand-plot cell by cell and still get clean
curves, so glyphs here are described as geometric primitives (thick lines,
filled polygons, filled circles) rasterized onto the grid -- adding a new
glyph later means describing its shape with a few points/circles, not
plotting hundreds of cells by hand.

Re-run after editing shapes below:
    python3 scripts/generate-hero-glyphs.py
"""

import json
import math

GRID = 25


def new_grid():
    return [[0] * GRID for _ in range(GRID)]


def _seg_distance(px, py, x0, y0, x1, y1):
    dx, dy = x1 - x0, y1 - y0
    length_sq = dx * dx + dy * dy
    if length_sq == 0:
        return math.hypot(px - x0, py - y0)
    t = max(0, min(1, ((px - x0) * dx + (py - y0) * dy) / length_sq))
    cx, cy = x0 + t * dx, y0 + t * dy
    return math.hypot(px - cx, py - cy)


def draw_line(grid, x0, y0, x1, y1, thickness=2.2):
    half = thickness / 2
    for y in range(GRID):
        for x in range(GRID):
            if _seg_distance(x + 0.5, y + 0.5, x0, y0, x1, y1) <= half:
                grid[y][x] = 1


def draw_circle(grid, cx, cy, r, fill=True, thickness=2.0):
    for y in range(GRID):
        for x in range(GRID):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if fill:
                if d <= r:
                    grid[y][x] = 1
            elif abs(d - r) <= thickness / 2:
                grid[y][x] = 1


def _point_in_polygon(px, py, poly):
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > py) != (yj > py) and px < (xj - xi) * (py - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def draw_polygon(grid, points):
    for y in range(GRID):
        for x in range(GRID):
            if _point_in_polygon(x + 0.5, y + 0.5, points):
                grid[y][x] = 1


def star_points(cx, cy, outer_r, inner_r, spikes=5, rotation_deg=-90):
    points = []
    for i in range(spikes * 2):
        r = outer_r if i % 2 == 0 else inner_r
        angle = math.radians(rotation_deg + i * (360 / (spikes * 2)))
        points.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
    return points


def make_check():
    g = new_grid()
    draw_line(g, 5, 13, 10, 18, thickness=2.6)
    draw_line(g, 10, 18, 20, 6, thickness=2.6)
    return g


def make_close():
    g = new_grid()
    draw_line(g, 5, 5, 20, 20, thickness=2.4)
    draw_line(g, 20, 5, 5, 20, thickness=2.4)
    return g


def make_heart():
    g = new_grid()
    # Circles sized/spaced to just touch (2r == center distance) so the
    # region above their shared centerline stays open as the top cleft,
    # instead of merging into a rounded blob; the triangle only fills in
    # from the centerline down to the point.
    draw_circle(g, 8.2, 9, 4.3)
    draw_circle(g, 16.8, 9, 4.3)
    draw_polygon(g, [(3.5, 10.5), (21.5, 10.5), (12.5, 21.5)])
    return g


def make_star():
    g = new_grid()
    draw_polygon(g, star_points(12.5, 12.5, 11, 4.4))
    return g


def make_arrow_right():
    g = new_grid()
    draw_line(g, 3, 12.5, 15, 12.5, thickness=2.4)
    draw_polygon(g, [(13, 6), (21.5, 12.5), (13, 19)])
    return g


GLYPHS = {
    'check': make_check,
    'close': make_close,
    'heart': make_heart,
    'star': make_star,
    'arrow-right': make_arrow_right,
}


def main():
    path = 'src/data/hero-glyphs.json'
    output = {name: builder() for name, builder in GLYPHS.items()}

    with open(path, 'w') as f:
        json.dump(output, f, indent=2)
        f.write('\n')

    print(f'Wrote {len(output)} hero glyphs ({GRID}x{GRID}) to {path}')


if __name__ == '__main__':
    main()
