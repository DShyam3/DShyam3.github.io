#!/usr/bin/env python3
"""
HIGH-RESOLUTION dot-matrix world map generator.
Uses Natural Earth 10m countries GeoJSON at 540x270 grid.

- 10m source = much more detailed coastlines (Norway fjords, UK shape, etc.)
- 540x270 grid = ~0.67° per dot (~74km) — noticeably sharper than 50m/360x180
- Runtime: ~30-90 minutes depending on your machine (10m has complex polygons)
- Output: public/data/dot-world-map.json (~600-800KB)

Run from the project root:
    python3 scripts/generate-dot-map-10m.py

When done, replace public/data/dot-world-map.json with the output.
"""

import json
import urllib.request
import sys
import time

GRID_COLS = 540
GRID_ROWS = 270

def point_in_polygon(px, py, polygon):
    n = len(polygon)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside

def point_in_geometry(lng, lat, geometry):
    geo_type = geometry['type']
    coords = geometry['coordinates']
    if geo_type == 'Polygon':
        if not point_in_polygon(lng, lat, coords[0]):
            return False
        for hole in coords[1:]:
            if point_in_polygon(lng, lat, hole):
                return False
        return True
    elif geo_type == 'MultiPolygon':
        for polygon in coords:
            if point_in_polygon(lng, lat, polygon[0]):
                in_hole = any(point_in_polygon(lng, lat, h) for h in polygon[1:])
                if not in_hole:
                    return True
        return False
    return False

def grid_to_lnglat(col, row):
    lng = -180 + (col + 0.5) * (360 / GRID_COLS)
    lat =  90  - (row + 0.5) * (180 / GRID_ROWS)
    return lng, lat

def lnglat_to_grid(lng, lat):
    col = int((lng + 180) / 360 * GRID_COLS)
    row = int((90 - lat) / 180 * GRID_ROWS)
    return col, row

# Manually placed microstates — computed for the 540x270 grid
# col = int((lng + 180) / 360 * 540)
# row = int((90 - lat) / 180 * 270)
MANUAL_DOTS = [
    # Vatican City  (12.45°E, 41.90°N)
    [lnglat_to_grid(12.45, 41.90) + ("VA",)],
    # Monaco        (7.40°E, 43.73°N)
    [lnglat_to_grid(7.40, 43.73) + ("MC",)],
    # San Marino    (12.46°E, 43.94°N)
    [lnglat_to_grid(12.46, 43.94) + ("SM",)],
    # Liechtenstein (9.55°E, 47.14°N)
    [lnglat_to_grid(9.55, 47.14) + ("LI",)],
    # Andorra       (1.52°E, 42.51°N)
    [lnglat_to_grid(1.52, 42.51) + ("AD",)],
    # Luxembourg    (6.13°E, 49.81°N)
    [lnglat_to_grid(6.13, 49.81) + ("LU",)],
    # Malta         (14.37°E, 35.94°N)
    [lnglat_to_grid(14.37, 35.94) + ("MT",)],
    # Maldives      (73.22°E, 3.20°N)
    [lnglat_to_grid(73.22, 3.20) + ("MV",)],
    # Bahrain       (50.55°E, 26.07°N)
    [lnglat_to_grid(50.55, 26.07) + ("BH",)],
    # Singapore     (103.82°E, 1.35°N)
    [lnglat_to_grid(103.82, 1.35) + ("SG",)],
    # Brunei        (114.73°E, 4.53°N)
    [lnglat_to_grid(114.73, 4.53) + ("BN",)],
    # Nauru         (166.93°E, -0.53°N)
    [lnglat_to_grid(166.93, -0.53) + ("NR",)],
    # Tuvalu        (179.19°E, -8.52°N)
    [lnglat_to_grid(179.19, -8.52) + ("TV",)],
    # Palau         (134.58°E, 7.51°N)
    [lnglat_to_grid(134.58, 7.51) + ("PW",)],
    # Marshall Is.  (171.18°E, 7.10°N)
    [lnglat_to_grid(171.18, 7.10) + ("MH",)],
    # Micronesia    (158.25°E, 6.92°N)
    [lnglat_to_grid(158.25, 6.92) + ("FM",)],
    # Kiribati      (173.0°E, 1.87°N)
    [lnglat_to_grid(173.0, 1.87) + ("KI",)],
    # Tonga         (175.20°E, -21.18°N)
    [lnglat_to_grid(175.20, -21.18) + ("TO",)],
    # Samoa         (172.10°E, -13.76°N)
    [lnglat_to_grid(172.10, -13.76) + ("WS",)],
    # Vanuatu       (167.0°E, -15.38°N)
    [lnglat_to_grid(167.0, -15.38) + ("VU",)],
    # Comoros       (43.87°E, -11.70°N)
    [lnglat_to_grid(43.87, -11.70) + ("KM",)],
    # Sao Tome      (6.61°E, 0.19°N)
    [lnglat_to_grid(6.61, 0.19) + ("ST",)],
    # Cape Verde    (-23.61°E, 15.12°N)
    [lnglat_to_grid(-23.61, 15.12) + ("CV",)],
    # Seychelles    (55.49°E, -4.68°N)
    [lnglat_to_grid(55.49, -4.68) + ("SC",)],
    # Mauritius     (57.55°E, -20.35°N)
    [lnglat_to_grid(57.55, -20.35) + ("MU",)],
    # Djibouti      (42.59°E, 11.83°N)
    [lnglat_to_grid(42.59, 11.83) + ("DJ",)],
    # Qatar         (51.18°E, 25.35°N)
    [lnglat_to_grid(51.18, 25.35) + ("QA",)],
    # Kuwait        (47.48°E, 29.37°N)
    [lnglat_to_grid(47.48, 29.37) + ("KW",)],
    # Timor-Leste   (125.73°E, -8.87°N)
    [lnglat_to_grid(125.73, -8.87) + ("TL",)],
    # Belize        (-88.49°W, 17.19°N)
    [lnglat_to_grid(-88.49, 17.19) + ("BZ",)],
    # El Salvador   (-88.90°W, 13.79°N)
    [lnglat_to_grid(-88.90, 13.79) + ("SV",)],
    # Trinidad      (-61.22°W, 10.69°N)
    [lnglat_to_grid(-61.22, 10.69) + ("TT",)],
    # Barbados      (-59.54°W, 13.19°N)
    [lnglat_to_grid(-59.54, 13.19) + ("BB",)],
    # Saint Lucia   (-60.98°W, 13.91°N)
    [lnglat_to_grid(-60.98, 13.91) + ("LC",)],
    # Grenada       (-61.67°W, 12.12°N)
    [lnglat_to_grid(-61.67, 12.12) + ("GD",)],
    # St Vincent    (-61.20°W, 12.98°N)
    [lnglat_to_grid(-61.20, 12.98) + ("VC",)],
    # Antigua       (-61.80°W, 17.07°N)
    [lnglat_to_grid(-61.80, 17.07) + ("AG",)],
    # St Kitts      (-62.78°W, 17.33°N)
    [lnglat_to_grid(-62.78, 17.33) + ("KN",)],
    # Dominica      (-61.37°W, 15.41°N)
    [lnglat_to_grid(-61.37, 15.41) + ("DM",)],
    # Bahamas       (-77.39°W, 24.28°N)
    [lnglat_to_grid(-77.39, 24.28) + ("BS",)],
]

# Flatten the nested list structure from the tuple concatenation above
MANUAL_DOTS = [item[0] for item in MANUAL_DOTS]

def main():
    print(f"Grid: {GRID_COLS}×{GRID_ROWS} = {GRID_COLS*GRID_ROWS:,} points", flush=True)
    print(f"Resolution: ~{360/GRID_COLS:.2f}° per dot (~{360/GRID_COLS*111:.0f}km)", flush=True)
    print("Fetching Natural Earth 10m GeoJSON (~22MB)...", flush=True)

    url = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson"

    try:
        with urllib.request.urlopen(url, timeout=120) as response:
            raw = response.read()
        print(f"Downloaded {len(raw)/1024/1024:.1f} MB", flush=True)
        geojson = json.loads(raw.decode('utf-8'))
    except Exception as e:
        print(f"Error fetching 10m: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"Loaded {len(geojson['features'])} features", flush=True)

    # Build deduplicated country list
    countries = []
    seen = set()
    for feature in geojson['features']:
        props = feature.get('properties', {})
        iso = (props.get('ISO_A2') or props.get('iso_a2') or '').strip().upper()
        if not iso or iso in ('-1', '--', ''):
            iso = (props.get('ADM0_ISO') or '')[:2].upper()
        if iso and iso not in seen:
            seen.add(iso)
            countries.append((iso, feature['geometry']))

    print(f"Processing {len(countries)} countries...", flush=True)
    print("(This will take 30-90 minutes for 10m polygons — go make a coffee)", flush=True)

    dots = []
    total = GRID_COLS * GRID_ROWS
    start = time.time()

    for row in range(GRID_ROWS):
        for col in range(GRID_COLS):
            lng, lat = grid_to_lnglat(col, row)
            for iso, geometry in countries:
                if point_in_geometry(lng, lat, geometry):
                    dots.append([col, row, iso])
                    break

        if (row + 1) % 10 == 0:
            elapsed = time.time() - start
            pct = (row + 1) / GRID_ROWS * 100
            eta = (elapsed / (row + 1)) * (GRID_ROWS - row - 1)
            mins, secs = divmod(int(eta), 60)
            print(f"  {pct:.0f}% — {len(dots):,} land dots — ETA {mins}m {secs}s", flush=True)

    # Add microstates
    existing = {(d[0], d[1]) for d in dots}
    added = []
    for col, row, code in MANUAL_DOTS:
        for dc, dr in [(0,0),(0,1),(1,0),(0,-1),(-1,0),(1,1),(-1,1),(1,-1),(-1,-1),(0,2),(2,0),(0,-2),(-2,0)]:
            nc, nr = col+dc, row+dr
            if 0 <= nc < GRID_COLS and 0 <= nr < GRID_ROWS and (nc, nr) not in existing:
                dots.append([nc, nr, code])
                existing.add((nc, nr))
                added.append(code)
                break
        else:
            print(f"  Warning: could not place {code}", flush=True)

    unique = len(set(d[2] for d in dots))
    elapsed = time.time() - start
    mins, secs = divmod(int(elapsed), 60)
    print(f"\nDone in {mins}m {secs}s — {len(dots):,} dots across {unique} countries", flush=True)
    print(f"Microstates added: {added}", flush=True)

    output = {"cols": GRID_COLS, "rows": GRID_ROWS, "dots": dots}
    path = "public/data/dot-world-map_2.json"
    with open(path, 'w') as f:
        json.dump(output, f, separators=(',', ':'))

    size_kb = len(json.dumps(output, separators=(',', ':'))) / 1024
    print(f"Written to {path} ({size_kb:.0f} KB)", flush=True)
    print("\nDone! Refresh your browser to see the improved map.", flush=True)

if __name__ == '__main__':
    main()
