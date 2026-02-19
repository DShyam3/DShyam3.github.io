#!/usr/bin/env python3
"""
Generate a high-resolution dot-matrix world map dataset.
Uses Natural Earth 50m countries GeoJSON at 360x180 grid.
50m gives excellent shape accuracy at this dot density while being fast to process.

The visual quality at 360x180 dots is determined by the grid resolution,
not the source polygon resolution — 50m is more than sufficient.
"""

import json
import urllib.request
import sys
import time

GRID_COLS = 360
GRID_ROWS = 180

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
    # Centre of each cell
    lng = -180 + (col + 0.5) * (360 / GRID_COLS)
    lat =  90  - (row + 0.5) * (180 / GRID_ROWS)
    return lng, lat

# Manually placed microstates — [col, row, "CC"]
# col = int((lng + 180) / 360 * GRID_COLS)
# row = int((90 - lat) / 180 * GRID_ROWS)
MANUAL_DOTS = [
    [192, 48, "VA"],  # Vatican City
    [187, 46, "MC"],  # Monaco
    [192, 46, "SM"],  # San Marino
    [189, 42, "LI"],  # Liechtenstein
    [181, 47, "AD"],  # Andorra
    [186, 40, "LU"],  # Luxembourg
    [194, 54, "MT"],  # Malta
    [253, 86, "MV"],  # Maldives
    [230, 63, "BH"],  # Bahrain
    [283, 88, "SG"],  # Singapore
    [294, 85, "BN"],  # Brunei
    [346, 90, "NR"],  # Nauru
    [359, 98, "TV"],  # Tuvalu
    [314, 82, "PW"],  # Palau
    [351, 82, "MH"],  # Marshall Islands
    [338, 83, "FM"],  # Micronesia
    [353, 88, "KI"],  # Kiribati
    [355, 111, "TO"], # Tonga
    [352, 103, "WS"], # Samoa
    [347, 105, "VU"], # Vanuatu
    [223, 101, "KM"], # Comoros
    [186, 89, "ST"],  # Sao Tome and Principe
    [156, 74, "CV"],  # Cape Verde
    [235, 94, "SC"],  # Seychelles
    [237, 110, "MU"], # Mauritius
    [118, 79, "TT"],  # Trinidad and Tobago
    [120, 76, "BB"],  # Barbados
    [119, 76, "LC"],  # Saint Lucia
    [118, 77, "GD"],  # Grenada
    [119, 77, "VC"],  # Saint Vincent
    [118, 72, "AG"],  # Antigua and Barbuda
    [117, 72, "KN"],  # Saint Kitts and Nevis
    [118, 74, "DM"],  # Dominica
    [102, 65, "BS"],  # Bahamas
    [231, 63, "QA"],  # Qatar
    [227, 60, "KW"],  # Kuwait
    [305, 98, "TL"],  # Timor-Leste
]

def main():
    print("Fetching Natural Earth 50m GeoJSON...", flush=True)
    url = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson"

    try:
        with urllib.request.urlopen(url, timeout=60) as response:
            raw = response.read()
        print(f"Downloaded {len(raw)/1024:.0f} KB", flush=True)
        geojson = json.loads(raw.decode('utf-8'))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"Loaded {len(geojson['features'])} features", flush=True)

    # Build country list, deduplicated by ISO code
    countries = []
    seen = set()
    for feature in geojson['features']:
        props = feature.get('properties', {})
        iso = (props.get('ISO_A2_EH') or props.get('iso_a2_eh') or props.get('ISO_A2') or props.get('iso_a2') or '').strip().upper()
        if not iso or iso in ('-1', '-99', '--', ''):
            iso = (props.get('ADM0_ISO') or '')[:2].upper()
        if iso and iso not in seen:
            seen.add(iso)
            countries.append((iso, feature['geometry']))

    print(f"Processing {len(countries)} countries on {GRID_COLS}×{GRID_ROWS} grid ({GRID_COLS*GRID_ROWS:,} points)...", flush=True)

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

        # Progress every 10 rows
        if (row + 1) % 10 == 0:
            elapsed = time.time() - start
            pct = (row + 1) / GRID_ROWS * 100
            eta = (elapsed / (row + 1)) * (GRID_ROWS - row - 1)
            print(f"  {pct:.0f}% — {len(dots)} land dots — ETA {eta:.0f}s", flush=True)

    # Add manual microstates, avoiding already-occupied cells
    existing = {(d[0], d[1]) for d in dots}
    added = []
    for col, row, code in MANUAL_DOTS:
        placed = False
        for dc, dr in [(0,0),(0,1),(1,0),(0,-1),(-1,0),(1,1),(-1,1),(1,-1),(-1,-1)]:
            nc, nr = col+dc, row+dr
            if 0 <= nc < GRID_COLS and 0 <= nr < GRID_ROWS and (nc, nr) not in existing:
                dots.append([nc, nr, code])
                existing.add((nc, nr))
                added.append(code)
                placed = True
                break
        if not placed:
            print(f"  Warning: could not place {code}", flush=True)

    unique = len(set(d[2] for d in dots))
    elapsed = time.time() - start
    print(f"\nDone in {elapsed:.0f}s — {len(dots)} dots across {unique} countries", flush=True)
    print(f"Microstates added: {added}", flush=True)

    output = {"cols": GRID_COLS, "rows": GRID_ROWS, "dots": dots}
    path = "public/data/dot-world-map.json"
    with open(path, 'w') as f:
        json.dump(output, f, separators=(',', ':'))

    size_kb = len(json.dumps(output, separators=(',', ':'))) / 1024
    print(f"Written to {path} ({size_kb:.0f} KB)", flush=True)

if __name__ == '__main__':
    main()
