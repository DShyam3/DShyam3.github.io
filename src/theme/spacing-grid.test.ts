import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Spacing sits on a 4px grid: padding, margin, gap, `space-*` and offsets are
 * multiples of 4px. A hairline (0 or ±1px) is the one exception, because it
 * offsets a border rather than spacing anything.
 *
 * Two places can break it. In class strings, Tailwind's half steps -- `*-0.5`,
 * `*-1.5`, `*-2.5`, `*-3.5` (2, 6, 10, 14px) -- and arbitrary lengths such as
 * `pl-[1.375rem]`. In CSS, a spacing declaration whose px or rem length is off
 * the grid, or a fluid one (`clamp(1rem, 2vw, 2rem)`) that does not snap with
 * `round(..., 4px)`. Sizes (`h-3.5` icons), line heights and inline chart
 * margins are out of scope.
 *
 * Most of the site predates the rule, so this is a ratchet: the baseline holds
 * how many off-grid values each file had, a file may not gain any, and a file
 * that loses some must have its entry lowered. After fixing spacing, run
 *   UPDATE_SPACING_BASELINE=1 npx vitest run src/theme/spacing-grid.test.ts
 * which only ever lowers entries -- a new off-grid value still fails. A
 * renamed or split file is the one hand edit: move its entry to the new path.
 *
 * Not scanned: inline `style={{ ... }}` objects, and a CSS value that wraps
 * onto a second line.
 */

const ROOT = process.cwd();
const SRC = resolve(ROOT, 'src');
const BASELINE_PATH = resolve(ROOT, 'src/theme/spacing-grid-baseline.json');

type Finding = { line: number; value: string };

const SPACING_UTILITY =
  /(?<=^|[\s"'`:!])-?(?:p[xytrblse]?|m[xytrblse]?|gap(?:-[xy])?|space-[xy]|inset(?:-[xy])?|top|right|bottom|left|start|end|scroll-[mp][xytrblse]?)-(0\.5|1\.5|2\.5|3\.5|\[[^\]\s]+\])(?![\w./-])/g;
const SPACING_PROPERTY =
  /^(?:(?:padding|margin|scroll-padding|scroll-margin|inset)(?:-[a-z-]+)?|gap|row-gap|column-gap|top|right|bottom|left)$/;
/** Custom properties that carry spacing, e.g. `--page-gutter`, `--card-gap`. */
const SPACING_VARIABLE = /^--(?!tw-)[\w-]*(?:gutter|pad|gap|space|inset|margin|offset)[\w-]*$/;
const DECLARATION = /(?:^|[{;\s])(--[\w-]+|[a-z-]+)\s*:\s*([^;{}]+)/g;
const LENGTH = /(-?\d*\.?\d+)(px|rem)\b/g;
const FLUID = /\d(?:vw|vh|vmin|vmax|[sdl]v[wh]|cq[iwh])\b/;

const toPx = (n: number, unit: string) => (unit === 'rem' ? n * 16 : n);
const onGrid = (px: number) => {
  const whole = Math.round(px);
  return Math.abs(px - whole) < 1e-6 && (Math.abs(whole) <= 1 || whole % 4 === 0);
};

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });

/** Blank out CSS comments, keeping newlines so line numbers survive. */
const stripCssComments = (css: string) =>
  css.replace(/\/\*[\s\S]*?\*\//g, comment => comment.replace(/[^\n]/g, ' '));

const scanUtilities = (line: string, lineNo: number, out: Finding[]) => {
  for (const [token, step] of line.matchAll(SPACING_UTILITY)) {
    if (step.startsWith('[')) {
      const length = /^(-?\d*\.?\d+)(px|rem)$/.exec(step.slice(1, -1));
      if (!length || onGrid(toPx(parseFloat(length[1]), length[2]))) continue;
    }
    out.push({ line: lineNo, value: token });
  }
};

const scanCss = (line: string, lineNo: number, out: Finding[]) => {
  for (const [, property, value] of line.matchAll(DECLARATION)) {
    if (!SPACING_PROPERTY.test(property) && !SPACING_VARIABLE.test(property)) continue;
    if (FLUID.test(value) && !value.includes('round(')) {
      out.push({ line: lineNo, value: `${property}: ${value.trim()}` });
      continue;
    }
    for (const [raw, n, unit] of value.matchAll(LENGTH)) {
      if (!onGrid(toPx(parseFloat(n), unit))) out.push({ line: lineNo, value: `${property}: ${raw}` });
    }
  }
};

const scan = (): Map<string, Finding[]> => {
  const found = new Map<string, Finding[]>();
  for (const path of files(SRC)) {
    const isCss = path.endsWith('.css');
    const text = readFileSync(path, 'utf8');
    const lines = (isCss ? stripCssComments(text) : text).split('\n');
    const out: Finding[] = [];
    lines.forEach((line, i) => {
      scanUtilities(line, i + 1, out); // also catches `@apply` in CSS
      if (isCss) scanCss(line, i + 1, out);
    });
    if (out.length) found.set(relative(ROOT, path).split('\\').join('/'), out);
  }
  return found;
};

const readBaseline = (): Record<string, number> =>
  JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Record<string, number>;

describe('4px spacing grid', () => {
  const found = scan();
  const baseline = readBaseline();

  if (process.env.UPDATE_SPACING_BASELINE) {
    const lowered = Object.fromEntries(
      Object.keys(baseline)
        .sort()
        .map(file => [file, Math.min(baseline[file], found.get(file)?.length ?? 0)] as const)
        .filter(([, count]) => count > 0),
    );
    writeFileSync(BASELINE_PATH, `${JSON.stringify(lowered, null, 2)}\n`);
    Object.assign(baseline, lowered);
    for (const file of Object.keys(baseline)) if (!(file in lowered)) delete baseline[file];
  }

  it('adds no off-grid spacing', () => {
    const added = [...found]
      .filter(([file, list]) => list.length > (baseline[file] ?? 0))
      .map(([file, list]) =>
        `${file} has ${list.length} off-grid values, baseline ${baseline[file] ?? 0}:\n` +
        list.map(f => `  ${file}:${f.line}  ${f.value}`).join('\n'),
      );
    expect(added, 'Spacing must be a multiple of 4px (see this file\'s header)').toEqual([]);
  });

  it('keeps the baseline as low as the tree', () => {
    const stale = Object.entries(baseline)
      .filter(([file, count]) => (found.get(file)?.length ?? 0) < count)
      .map(([file, count]) => `${file}: ${found.get(file)?.length ?? 0} (baseline ${count})`);
    expect(stale, 'Lower these entries: UPDATE_SPACING_BASELINE=1 npx vitest run src/theme/spacing-grid.test.ts').toEqual([]);
  });
});
