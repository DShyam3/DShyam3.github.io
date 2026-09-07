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

import { parsePayslipText, type ParsedPayslip } from '@/lib/finance';

/**
 * Reassembles lines from positioned text runs.
 *
 * pdf.js returns each run with a transform, not a line. A payslip's meaning is
 * entirely in the pairing of a label with the figure to its right, so runs are
 * grouped by baseline and then sorted left to right — without which "Net Pay"
 * and "2,517.44" arrive as unrelated fragments.
 */
interface Run { x: number; y: number; text: string }

const toLines = (runs: Run[]): string => {
  const rows = new Map<number, Run[]>();
  for (const run of runs) {
    if (!run.text.trim()) continue;
    // A tolerance, because glyphs on one visual line rarely share a baseline
    // exactly once fonts and superscripts are involved.
    const key = [...rows.keys()].find(k => Math.abs(k - run.y) <= 2) ?? run.y;
    (rows.get(key) ?? rows.set(key, []).get(key)!).push(run);
  }
  return [...rows.keys()]
    .sort((a, b) => b - a) // PDF y grows upward, so descending is top-down
    .map(y => rows.get(y)!.sort((a, b) => a.x - b.x).map(r => r.text).join(' ').replace(/\s+/g, ' ').trim())
    .join('\n');
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
    const content = await (await doc.getPage(page)).getTextContent();
    for (const item of content.items) {
      if (!('str' in item)) continue;
      runs.push({ x: item.transform[4], y: Math.round(item.transform[5]), text: item.str });
    }
  }
  return parsePayslipText(toLines(runs));
}
