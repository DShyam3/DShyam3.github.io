#!/usr/bin/env bash
# Builds the home-screen icons in public/ from the memoji the header shows.
#
#   scripts/generate-app-icons.sh path/to/memoji.png
#
# The memoji lives in the site-assets bucket (memoji.png), not in the repo, so
# download it first. Needs ImageMagick 7 (`magick`). Rerun if the memoji or the
# manifest's background_color changes.
set -euo pipefail

src="${1:?usage: generate-app-icons.sh path/to/memoji.png}"
out="$(cd "$(dirname "$0")/.." && pwd)/public"
# The manifest's background_color, so the icon and the launch splash around it
# are one surface. Opaque on purpose: iOS decides for itself what goes behind
# a transparent touch icon.
background='#080b0a'

# size, share of the canvas the face's height takes, output name
render_icon() {
  local size="$1" share="$2" name="$3"
  local face=$(( size * share / 100 ))
  magick "$src" -trim +repage -filter Lanczos -resize "x${face}" \
    -background "$background" -gravity center -extent "${size}x${size}" \
    -alpha remove -alpha off -strip "$out/$name"
}

render_icon 180 68 apple-touch-icon.png
render_icon 192 68 icon-192.png
render_icon 512 68 icon-512.png
# Maskable: launchers crop to a circle of 80% of the width, so the face stays
# well inside it.
render_icon 512 54 icon-maskable-512.png
