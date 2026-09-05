// Renders a dot-matrix glyph (one character or icon) as a single small
// absolutely-positioned dot whose box-shadow stands in for every other
// active dot in the pattern, instead of one <div> per dot (+ one per row).
// A typical 7x5 character used to cost ~43 DOM nodes; this costs 2. That
// matters here because this renders on every nav label and header on every
// page.
// Pitches are quoted in px because that is how a dot grid is designed -- a
// dot is 2px, not 0.125rem -- but they are emitted in rem so the glyphs scale
// with the root size along with everything else. A px glyph next to rem text
// shrank as the page grew: on a wide monitor the header's + and the theme
// toggle stayed at their laptop size beside a name half again as large.
const REM = 16;

function rem(px: number): string {
  return `${px / REM}rem`;
}

function buildGlyphShadow(pattern: number[][], dot: number, gap: number): string | undefined {
  const step = dot + gap;
  const shadows: string[] = [];
  pattern.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (value) shadows.push(`${rem(colIndex * step)} ${rem(rowIndex * step)} 0 0 currentColor`);
    });
  });
  return shadows.length > 0 ? shadows.join(', ') : undefined;
}

interface DotMatrixGlyphProps {
  pattern: number[][];
  dot: number;
  gap: number;
}

export function DotMatrixGlyph({ pattern, dot, gap }: DotMatrixGlyphProps) {
  const rows = pattern.length;
  const cols = pattern[0]?.length || 0;
  const step = dot + gap;
  const width = cols > 0 ? (cols - 1) * step + dot : dot;
  const height = rows > 0 ? (rows - 1) * step + dot : dot;

  return (
    <div className="dot-matrix-glyph" style={{ width: rem(width), height: rem(height) }}>
      <div
        className="dot-matrix-glyph-dot"
        style={{
          width: rem(dot),
          height: rem(dot),
          boxShadow: buildGlyphShadow(pattern, dot, gap),
        }}
      />
    </div>
  );
}
