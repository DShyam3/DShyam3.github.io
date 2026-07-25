// Renders a dot-matrix glyph (one character or icon) as a single small
// absolutely-positioned dot whose box-shadow stands in for every other
// active dot in the pattern, instead of one <div> per dot (+ one per row).
// A typical 7x5 character used to cost ~43 DOM nodes; this costs 2. That
// matters here because this renders on every nav label and header on every
// page.
function buildGlyphShadow(pattern: number[][], dot: number, gap: number): string | undefined {
  const step = dot + gap;
  const shadows: string[] = [];
  pattern.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (value) shadows.push(`${colIndex * step}px ${rowIndex * step}px 0 0 currentColor`);
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
    <div className="dot-matrix-glyph" style={{ width, height }}>
      <div
        className="dot-matrix-glyph-dot"
        style={{ width: dot, height: dot, boxShadow: buildGlyphShadow(pattern, dot, gap) }}
      />
    </div>
  );
}
