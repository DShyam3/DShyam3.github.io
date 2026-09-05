#!/usr/bin/env python3
"""
Generate public/og-image.png — the 1200x630 card shown when a link to the site
is shared.

The site's identity is dot-matrix text, so the wordmark here is really made of
dots rather than being a screenshot of type: a monospace face is rasterised to
a coarse grid and every lit cell becomes a circle, which is the same idea
`DotMatrixText` implements in the browser with the Doto font.

Only ImageMagick and a system monospace font are needed, so this stays
runnable without adding a Python imaging dependency to the project.

    python3 scripts/generate-og-image.py

Colours are the light-theme tokens from src/index.css. If those change, change
them here too — this file is generated art, not a live component, so nothing
warns you.
"""

import subprocess
import sys
from pathlib import Path

OUT = Path("public/og-image.png")

WIDTH, HEIGHT = 1200, 630

# src/index.css :root — --background, --foreground, --muted-foreground, --border
BACKGROUND = "#FBFAF9"
FOREGROUND = "#2A2622"
MUTED = "#6B635B"
BORDER = "#E6E1DA"

FONT = "/System/Library/Fonts/Menlo.ttc"

WORDMARK = "DHYAN SHYAM"
TAGLINE = "MY DIGITAL GARDEN"
LEFT_FOOT = "ROBOTIC ENGINEER"
RIGHT_FOOT = "DSHYAM3.GITHUB.IO"

# Wordmark grid. The pitch is derived from WORDMARK_WIDTH rather than fixed,
# because the column count falls out of the rasterised text — pinning the pitch
# instead makes a longer name silently run off the canvas.
GRID_ROWS = 15
WORDMARK_WIDTH = 880
# Fraction of the pitch each dot fills. Below about 0.4 the text stops holding
# together; above it, the dots merge and it reads as blurred type.
DOT_FILL = 0.33

# The faint dot field behind everything, echoing the site's background texture.
FIELD_PITCH = 26
FIELD_RADIUS = 1.5


def run(args: list[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(args, check=True, capture_output=True, **kwargs)


def rasterise(text: str, rows: int) -> tuple[list[list[bool]], int]:
    """Render `text` and sample it down to a `rows`-tall grid of on/off cells."""
    # Render large first, then shrink: the downscale antialiases, and the
    # threshold afterwards decides each cell from the averaged coverage. Going
    # straight to a tiny point size instead drops thin strokes entirely.
    proc = run([
        "magick",
        "-background", "black",
        "-fill", "white",
        "-font", FONT,
        "-pointsize", "200",
        f"label:{text}",
        "-trim", "+repage",
        "-resize", f"x{rows}",
        "-threshold", "45%",
        "txt:-",
    ])

    cells: dict[tuple[int, int], bool] = {}
    max_x = 0
    for line in proc.stdout.decode().splitlines()[1:]:
        coords, _, rest = line.partition(":")
        x_str, _, y_str = coords.partition(",")
        x, y = int(x_str), int(y_str)
        cells[(x, y)] = "white" in rest or "#FFFFFF" in rest.upper()
        max_x = max(max_x, x)

    grid = [[cells.get((x, y), False) for x in range(max_x + 1)] for y in range(rows)]
    return grid, max_x + 1


def draw_commands(
    grid: list[list[bool]], origin_x: float, origin_y: float, pitch: float
) -> list[str]:
    radius = pitch * DOT_FILL
    parts = []
    for y, row in enumerate(grid):
        for x, lit in enumerate(row):
            if not lit:
                continue
            cx = origin_x + x * pitch
            cy = origin_y + y * pitch
            parts.append(f"circle {cx:.2f},{cy:.2f} {cx + radius:.2f},{cy:.2f}")
    return parts


def main() -> int:
    if not Path(FONT).exists():
        print(f"font not found: {FONT}", file=sys.stderr)
        return 1

    grid, cols = rasterise(WORDMARK, GRID_ROWS)

    pitch = WORDMARK_WIDTH / (cols - 1)
    wordmark_height = (GRID_ROWS - 1) * pitch
    origin_x = (WIDTH - WORDMARK_WIDTH) / 2
    # Optical centre sits a little above the middle: the tagline and the rule
    # below carry visual weight the top half does not.
    origin_y = 268 - wordmark_height / 2

    rule_y = origin_y + wordmark_height + 62
    tagline_y = rule_y + 40

    # Background dot field, drawn first and kept faint enough to read as paper
    # texture rather than as a second layer of content.
    field = []
    for gy in range(FIELD_PITCH, HEIGHT, FIELD_PITCH):
        for gx in range(FIELD_PITCH, WIDTH, FIELD_PITCH):
            field.append(f"circle {gx},{gy} {gx + FIELD_RADIUS},{gy}")

    args = [
        "magick",
        "-size", f"{WIDTH}x{HEIGHT}",
        f"xc:{BACKGROUND}",
        # Texture
        "-fill", BORDER, "-stroke", "none",
        "-draw", " ".join(field),
        # Wordmark
        "-fill", FOREGROUND,
        "-draw", " ".join(draw_commands(grid, origin_x, origin_y, pitch)),
        # Rule under the wordmark, the width of the wordmark itself
        "-stroke", BORDER, "-strokewidth", "2",
        "-draw", f"line {origin_x:.0f},{rule_y:.0f} {origin_x + WORDMARK_WIDTH:.0f},{rule_y:.0f}",
        "-stroke", "none",
        # Tagline
        "-font", FONT, "-fill", MUTED, "-pointsize", "28",
        "-gravity", "north",
        "-annotate", f"+0+{tagline_y:.0f}", " ".join(TAGLINE),
        # Footer, mirroring the site's own header/footer pairing
        "-gravity", "southwest", "-pointsize", "22", "-fill", MUTED,
        "-annotate", "+64+56", " ".join(LEFT_FOOT),
        "-gravity", "southeast",
        "-annotate", "+64+56", " ".join(RIGHT_FOOT),
        # Two flat colours on paper: 16-bit channels and PNG metadata buy
        # nothing here and triple the file a scraper has to pull.
        "-depth", "8",
        "-strip",
        str(OUT),
    ]
    run(args)

    size = OUT.stat().st_size
    print(f"wrote {OUT} ({WIDTH}x{HEIGHT}, {size // 1024} kB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
