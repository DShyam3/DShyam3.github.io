/**
 * Getting the text out of a payslip PDF, in the browser.
 *
 * A payslip from a payroll system carries a text layer, so this is extraction
 * rather than recognition — no OCR, no model, no upload. The file is read in
 * the tab it was chosen in and never leaves it (REHAUL_PLAN.md 7.P).
 *
 * pdf.js is imported lazily: it is the largest dependency in the project and
 * nobody opening the Income surface should pay for it until they pick a file.
 */

import { parsePositionedPayslip, type ParsedPayslip, type PositionedLine } from '@/lib/finance';

/**
 * Groups positioned text runs into lines, keeping the x of each.
 *
 * pdf.js returns each run with a transform, not a line. Runs are grouped by
 * baseline so a label meets the figure beside it — and the x is kept, because
 * on a column-grid payslip the figure is not beside the label at all, it is
 * underneath, and only the x says which column it belongs to.
 */
interface Run { x: number; y: number; text: string }

const toPositionedLines = (runs: Run[]): PositionedLine[] => {
  const rows = new Map<number, Run[]>();
  for (const run of runs) {
    if (!run.text.trim()) continue;
    // A tolerance, because glyphs on one visual line rarely share a baseline
    // exactly once fonts and superscripts are involved.
    const key = [...rows.keys()].find(k => Math.abs(k - run.y) <= 2) ?? run.y;
    const bucket = rows.get(key);
    if (bucket) bucket.push(run);
    else rows.set(key, [run]);
  }
  return [...rows.entries()].map(([y, rs]) => ({
    y,
    runs: rs.map(r => ({ x: r.x, text: r.text })),
  }));
};

export async function extractPayslipFromPdf(file: File): Promise<ParsedPayslip> {
  const pdfjs = await import('pdfjs-dist');
  // The worker ships with the package; Vite resolves this to a hashed asset at
  // build time, so it works on static hosting with no CDN and no CSP change.
  pdfjs.GlobalWorkerOptions.workerSrc = (
    await import('pdfjs-dist/build/pdf.worker.mjs?url')
  ).default;

  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const runs: Run[] = [];
  for (let page = 1; page <= doc.numPages; page++) {
    const loaded = await doc.getPage(page);
    // Item transforms are in PDF space, which ignores how the page is meant to
    // be viewed. A payslip produced landscape and rotated for display comes out
    // with its axes swapped, so labels and their figures stop sharing a line
    // and nothing parses. Composing with the viewport transform puts every run
    // where a reader would see it, whatever the page rotation.
    const viewport = loaded.getViewport({ scale: 1 });
    const content = await loaded.getTextContent();
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const t = pdfjs.Util.transform(viewport.transform, item.transform);
      runs.push({
        x: t[4],
        // Display space grows downward, so it is negated to keep the rest of
        // this file's "larger y is higher" convention. Pages are offset so a
        // second page sorts below the first rather than interleaving with it.
        y: -Math.round(t[5] + page * 10000),
        text: item.str,
      });
    }
  }
  return parsePositionedPayslip(toPositionedLines(runs));
}
