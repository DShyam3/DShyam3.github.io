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
      // 0,0 is the element itself, painted as its background -- see below.
      if (!value || (rowIndex === 0 && colIndex === 0)) return;
      shadows.push(`${rem(colIndex * step)} ${rem(rowIndex * step)} 0 0 currentColor`);
    });
  });
  return shadows.length > 0 ? shadows.join(', ') : undefined;
}

interface DotMatrixGlyphProps {
  pattern: number[][];
  dot: number;
  gap: number;
  shape?: 'round' | 'square';
}

export function DotMatrixGlyph({ pattern, dot, gap, shape = 'round' }: DotMatrixGlyphProps) {
  const rows = pattern.length;
  const cols = pattern[0]?.length || 0;
  const step = dot + gap;
  const width = cols > 0 ? (cols - 1) * step + dot : dot;
  const height = rows > 0 ? (rows - 1) * step + dot : dot;

  return (
    <div className="dot-matrix-glyph" style={{ width: rem(width), height: rem(height) }}>
      <div
        className={
          shape === 'square' ? 'dot-matrix-glyph-dot dot-matrix-glyph-dot-square' : 'dot-matrix-glyph-dot'
        }
        style={{
          width: rem(dot),
          height: rem(dot),
          // The dot at 0,0 cannot come from the box-shadow list: an outer
          // shadow at zero offset and zero spread is clipped away behind its
          // own border box. It has to be painted as the element's own
          // background, or a pattern lit in its top-left corner silently
          // renders one dot short.
          backgroundColor: pattern[0]?.[0] ? 'currentColor' : undefined,
          boxShadow: buildGlyphShadow(pattern, dot, gap),
        }}
      />
    </div>
  );
}
