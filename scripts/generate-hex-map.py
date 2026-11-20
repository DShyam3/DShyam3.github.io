#!/usr/bin/env python3
"""
Generate H3 resolution-3 hexagon world map dataset
from Natural Earth 50m countries GeoJSON.

Output:
  - public/data/hex-world-map-r3.json
"""

import json
import os
import sys
import time
import urllib.request
import h3

URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson"

# Microstates & small islands: (lat, lng, ISO_A2)
# Ensures countries smaller than a single H3 cell still appear on the map.
MICROSTATES = [
    (41.9029, 12.4534, "VA"),   # Vatican City
    (43.7384, 7.4246, "MC"),    # Monaco
    (43.9424, 12.4578, "SM"),   # San Marino
    (47.1660, 9.5554, "LI"),    # Liechtenstein
    (42.5063, 1.5218, "AD"),    # Andorra
    (49.8153, 6.1296, "LU"),    # Luxembourg
    (35.9375, 14.3754, "MT"),   # Malta
    (3.2028, 73.2207, "MV"),    # Maldives
    (26.0667, 50.5577, "BH"),   # Bahrain
    (1.3521, 103.8198, "SG"),   # Singapore
    (4.5353, 114.7277, "BN"),   # Brunei
    (-0.5228, 166.9315, "NR"),  # Nauru
    (-7.1095, 177.6493, "TV"),  # Tuvalu
    (7.5150, 134.5825, "PW"),   # Palau
    (7.1315, 171.1845, "MH"),   # Marshall Islands
    (6.8874, 158.2150, "FM"),   # Micronesia
    (1.8709, -157.3627, "KI"),  # Kiribati
    (-21.1790, -175.1982, "TO"),# Tonga
    (-13.7590, -172.1046, "WS"),# Samoa
    (-15.3767, 166.9592, "VU"), # Vanuatu
    (-11.6455, 43.3333, "KM"),  # Comoros
    (0.1864, 6.6131, "ST"),     # Sao Tome and Principe
    (16.5388, -23.0418, "CV"),  # Cape Verde
    (-4.6796, 55.4920, "SC"),   # Seychelles
    (-20.3484, 57.5522, "MU"),  # Mauritius
    (10.6918, -61.2225, "TT"),  # Trinidad and Tobago
    (13.1939, -59.5432, "BB"),  # Barbados
    (13.9094, -60.9789, "LC"),  # Saint Lucia
    (12.1165, -61.6790, "GD"),  # Grenada
    (13.2528, -61.1971, "VC"),  # Saint Vincent
    (17.0608, -61.7964, "AG"),  # Antigua and Barbuda
    (17.3578, -62.7830, "KN"),  # Saint Kitts and Nevis
    (15.4150, -61.3710, "DM"),  # Dominica
    (25.0343, -77.3963, "BS"),  # Bahamas
    (25.3548, 51.1839, "QA"),   # Qatar
    (29.3117, 47.4818, "KW"),   # Kuwait
    (-8.8742, 125.7275, "TL"),  # Timor-Leste
]


def extract_rings(geometry):
    gtype = geometry["type"]
    coords = geometry["coordinates"]
    if gtype == "Polygon":
        return [coords]
    if gtype == "MultiPolygon":
        return coords
    return []


def ring_to_h3_latlng(ring):
    return [(pt[1], pt[0]) for pt in ring]


def resolve_polygon_iso(iso, outer):
    """Split overseas territories bundled into parent sovereign polygons in Natural Earth."""
    if not outer:
        return iso
    lat = sum(p[0] for p in outer) / len(outer)
    lng = sum(p[1] for p in outer) / len(outer)
    if iso == "FR":
        if -15 <= lat <= -11 and 43 <= lng <= 47:
            return "YT"  # Mayotte
        if -23 <= lat <= -19 and 53 <= lng <= 58:
            return "RE"  # Réunion
        if 1 <= lat <= 7 and -56 <= lng <= -50:
            return "GF"  # French Guiana
        if 13.8 <= lat <= 15.2 and -62 <= lng <= -60:
            return "MQ"  # Martinique
        if 15.5 <= lat <= 17.0 and -63 <= lng <= -60.5:
            return "GP"  # Guadeloupe
    elif iso == "NO" and lat > 73:
        return "SJ"  # Svalbard and Jan Mayen
    elif iso == "NL" and lat < 30:
        return "BQ"  # Caribbean Netherlands
    return iso


def build_tier(countries, res):
    t0 = time.time()
    cell_country = {}
    for iso, geometry in countries:
        for poly_coords in extract_rings(geometry):
            outer = ring_to_h3_latlng(poly_coords[0])
            holes = [ring_to_h3_latlng(h) for h in poly_coords[1:]]
            poly_iso = resolve_polygon_iso(iso, outer)
            try:
                poly = h3.LatLngPoly(outer, *holes)
                cells = h3.polygon_to_cells(poly, res)
                if cells:
                    for c in cells:
                        if c not in cell_country:
                            cell_country[c] = poly_iso
                elif outer:
                    # Island/polygon smaller than one hex: seed its centroid cell
                    avg_lat = sum(p[0] for p in outer) / len(outer)
                    avg_lng = sum(p[1] for p in outer) / len(outer)
                    c = h3.latlng_to_cell(avg_lat, avg_lng, res)
                    if c not in cell_country:
                        cell_country[c] = poly_iso
            except Exception:
                pass

    # Ensure microstates / small islands are represented
    present_isos = set(cell_country.values())
    added = []
    for lat, lng, iso in MICROSTATES:
        if iso in present_isos:
            continue
        center_cell = h3.latlng_to_cell(lat, lng, res)
        placed = False
        for candidate in h3.grid_disk(center_cell, 1):
            if candidate not in cell_country:
                cell_country[candidate] = iso
                present_isos.add(iso)
                added.append(iso)
                placed = True
                break
        if not placed:
            print(f"  [res {res}] Warning: could not place {iso}", flush=True)

    cells = [[c, iso] for c, iso in cell_country.items()]
    elapsed = time.time() - t0
    print(
        f"Res {res}: {len(cells):,} cells across {len(present_isos)} countries "
        f"({len(added)} microstates added) in {elapsed:.1f}s",
        flush=True,
    )
    return {"res": res, "cells": cells}


def main():
    print("Fetching Natural Earth 50m GeoJSON...", flush=True)
    try:
        with urllib.request.urlopen(URL, timeout=60) as resp:
            geojson = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"Error fetching GeoJSON: {e}", file=sys.stderr)
        sys.exit(1)

    countries = []
    for feature in geojson["features"]:
        props = feature.get("properties", {})
        iso = (
            props.get("ISO_A2_EH")
            or props.get("iso_a2_eh")
            or props.get("ISO_A2")
            or props.get("iso_a2")
            or ""
        ).strip().upper()
        if not iso or iso in ("-1", "-99", "--", ""):
            iso = (props.get("ADM0_ISO") or "")[:2].upper()
        if iso:
            countries.append((iso, feature["geometry"]))

    os.makedirs("public/data", exist_ok=True)
    res = 3
    data = build_tier(countries, res)
    out_path = f"public/data/hex-world-map-r{res}.json"
    with open(out_path, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    size_kb = os.path.getsize(out_path) / 1024
    print(f"  Wrote {out_path} ({size_kb:.0f} KB)", flush=True)


if __name__ == "__main__":
    main()
