#!/usr/bin/env python3
"""
Generate the dot-matrix character font used by DotMatrixText/DotMatrixGlyph.

Each glyph is authored below as 7 rows of a 5-column grid (3 columns for
space), using '.' for an off dot and 'X' for an on dot -- kept as literal
ASCII art so the letterforms are easy to read and tweak in place, rather
than as opaque 0/1 arrays. Single-pixel stroke widths throughout (no doubled
fills) is what makes the rendered font read as thin rather than the blocky
LED-scoreboard look of the previous data.

Only uppercase entries exist -- DotMatrixText always uppercases input
before lookup, so lowercase keys are never read.

Re-run after editing patterns below:
    python3 scripts/generate-dot-font.py
"""

import json

ROWS = 7

# Each entry is a list of 7 row-strings. All are 5 chars wide except space.
PATTERNS = {
    ' ': ['...', '...', '...', '...', '...', '...', '...'],

    '!': ['..X..', '..X..', '..X..', '..X..', '..X..', '.....', '..X..'],
    '"': ['.X.X.', '.X.X.', '.....', '.....', '.....', '.....', '.....'],
    '#': ['.X.X.', 'XXXXX', '.X.X.', 'XXXXX', '.X.X.', '.....', '.....'],
    '$': ['..X..', '.XXXX', 'X.X..', '.XXX.', '..X.X', 'XXXX.', '..X..'],
    '%': ['XX..X', 'XX.X.', '...X.', '..X..', '.X...', '.X.XX', 'X..XX'],
    '&': ['.XX..', 'X..X.', 'X.X..', '.X...', 'X.X.X', 'X..X.', '.XX.X'],
    "'": ['..X..', '..X..', '.....', '.....', '.....', '.....', '.....'],
    '(': ['...X.', '..X..', '.X...', '.X...', '.X...', '..X..', '...X.'],
    ')': ['.X...', '..X..', '...X.', '...X.', '...X.', '..X..', '.X...'],
    '*': ['.....', 'X.X.X', '.XXX.', 'XXXXX', '.XXX.', 'X.X.X', '.....'],
    '+': ['.....', '..X..', '..X..', 'XXXXX', '..X..', '..X..', '.....'],
    ',': ['.....', '.....', '.....', '.....', '.....', '..X..', '.X...'],
    '-': ['.....', '.....', '.....', 'XXXXX', '.....', '.....', '.....'],
    '.': ['.....', '.....', '.....', '.....', '.....', '.XX..', '.XX..'],
    '/': ['....X', '...X.', '..X..', '..X..', '..X..', '.X...', 'X....'],

    '0': ['.XXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
    '1': ['..X..', '.XX..', '..X..', '..X..', '..X..', '..X..', '.XXX.'],
    '2': ['.XXX.', 'X...X', '....X', '...X.', '..X..', '.X...', 'XXXXX'],
    '3': ['.XXX.', 'X...X', '....X', '..XX.', '....X', 'X...X', '.XXX.'],
    '4': ['...X.', '..XX.', '.X.X.', 'X..X.', 'XXXXX', '...X.', '...X.'],
    '5': ['XXXXX', 'X....', 'X....', 'XXXX.', '....X', 'X...X', '.XXX.'],
    '6': ['..XX.', '.X...', 'X....', 'XXXX.', 'X...X', 'X...X', '.XXX.'],
    '7': ['XXXXX', '....X', '...X.', '..X..', '..X..', '..X..', '..X..'],
    '8': ['.XXX.', 'X...X', 'X...X', '.XXX.', 'X...X', 'X...X', '.XXX.'],
    '9': ['.XXX.', 'X...X', 'X...X', '.XXXX', '....X', '...X.', '.XX..'],

    ':': ['.....', '.XX..', '.XX..', '.....', '.XX..', '.XX..', '.....'],
    ';': ['.....', '.XX..', '.XX..', '.....', '.XX..', '.X...', 'X....'],
    '<': ['...X.', '..X..', '.X...', 'X....', '.X...', '..X..', '...X.'],
    '=': ['.....', '.....', 'XXXXX', '.....', 'XXXXX', '.....', '.....'],
    '>': ['.X...', '..X..', '...X.', '....X', '...X.', '..X..', '.X...'],
    '?': ['.XXX.', 'X...X', '....X', '...X.', '..X..', '.....', '..X..'],
    '@': ['.XXX.', 'X...X', 'X.XXX', 'X.X.X', 'X.XX.', 'X....', '.XXX.'],

    'A': ['.XXX.', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
    'B': ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X...X', 'X...X', 'XXXX.'],
    'C': ['.XXX.', 'X...X', 'X....', 'X....', 'X....', 'X...X', '.XXX.'],
    'D': ['XXXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'XXXX.'],
    'E': ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'XXXXX'],
    'F': ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'X....'],
    'G': ['.XXX.', 'X...X', 'X....', 'X.XXX', 'X...X', 'X...X', '.XXX.'],
    'H': ['X...X', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
    'I': ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', 'XXXXX'],
    'J': ['..XXX', '...X.', '...X.', '...X.', '...X.', 'X..X.', '.XX..'],
    'K': ['X...X', 'X..X.', 'X.X..', 'XX...', 'X.X..', 'X..X.', 'X...X'],
    'L': ['X....', 'X....', 'X....', 'X....', 'X....', 'X....', 'XXXXX'],
    'M': ['X...X', 'XX.XX', 'X.X.X', 'X...X', 'X...X', 'X...X', 'X...X'],
    'N': ['X...X', 'XX..X', 'XX..X', 'X.X.X', 'X..XX', 'X..XX', 'X...X'],
    'O': ['.XXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
    'P': ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X....', 'X....', 'X....'],
    'Q': ['.XXX.', 'X...X', 'X...X', 'X...X', 'X.X.X', 'X..X.', '.XX.X'],
    'R': ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X.X..', 'X..X.', 'X...X'],
    'S': ['.XXXX', 'X....', 'X....', '.XXX.', '....X', '....X', 'XXXX.'],
    'T': ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', '..X..'],
    'U': ['X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
    'V': ['X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.X.X.', '..X..'],
    'W': ['X...X', 'X...X', 'X...X', 'X...X', 'X.X.X', 'XX.XX', 'X...X'],
    'X': ['X...X', 'X...X', '.X.X.', '..X..', '.X.X.', 'X...X', 'X...X'],
    'Y': ['X...X', 'X...X', '.X.X.', '..X..', '..X..', '..X..', '..X..'],
    'Z': ['XXXXX', '....X', '...X.', '..X..', '.X...', 'X....', 'XXXXX'],

    '[': ['.XXX.', '.X...', '.X...', '.X...', '.X...', '.X...', '.XXX.'],
    ']': ['.XXX.', '...X.', '...X.', '...X.', '...X.', '...X.', '.XXX.'],
    '^': ['..X..', '.X.X.', 'X...X', '.....', '.....', '.....', '.....'],
    '_': ['.....', '.....', '.....', '.....', '.....', '.....', 'XXXXX'],
    '`': ['.X...', '..X..', '.....', '.....', '.....', '.....', '.....'],

    '{': ['...X.', '..X..', '..X..', '.X...', '..X..', '..X..', '...X.'],
    '|': ['..X..', '..X..', '..X..', '..X..', '..X..', '..X..', '..X..'],
    '}': ['.X...', '..X..', '..X..', '...X.', '..X..', '..X..', '.X...'],
    '~': ['.....', '.....', '.X..X', 'X.XX.', 'X....', '.....', '.....'],

    '©': ['.XXX.', 'X...X', 'X.X.X', 'X.X..', 'X.X.X', 'X...X', '.XXX.'],
}


def to_grid(rows):
    grid = [[1 if ch == 'X' else 0 for ch in row] for row in rows]
    width = len(grid[0])
    assert all(len(row) == width for row in grid), rows
    assert len(grid) == ROWS, rows
    return grid


def main():
    path = 'src/data/dot-matrix.json'
    with open(path) as f:
        existing = json.load(f)

    char_patterns = {char: to_grid(rows) for char, rows in PATTERNS.items()}

    output = {
        'charPatterns': char_patterns,
        'iconPatterns': existing['iconPatterns'],
    }

    with open(path, 'w') as f:
        json.dump(output, f, indent=2)
        f.write('\n')

    print(f'Wrote {len(char_patterns)} character glyphs to {path}')


if __name__ == '__main__':
    main()
