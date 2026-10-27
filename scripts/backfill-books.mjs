// Fetch a reviewable, resumable patch manifest; this script never writes to a database.
// node --experimental-strip-types scripts/backfill-books.mjs input.json output.json
import { readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { bookshopLinks, completeBookMetadata, isConfidentBookMatch, searchOpenLibrary } from '../src/lib/book-metadata.ts';

const [inputPath, outputPath, mode] = process.argv.slice(2);
if (mode && mode !== '--title-only') throw new Error('Unknown lookup mode.');
if (!inputPath || !outputPath || inputPath === outputPath) throw new Error('Provide distinct input and output JSON paths.');
const input = JSON.parse(await readFile(inputPath, 'utf8'));
const books = Array.isArray(input) ? input : input.rows;
if (!Array.isArray(books)) throw new Error('Input must contain book rows.');
let report = [];
try { report = JSON.parse(await readFile(outputPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const done = new Set(report.filter((row) => !row.error).map((row) => row.id));
let lastRequest = 0;
async function paced(fn) {
  await delay(Math.max(0, 1100 - (Date.now() - lastRequest)));
  lastRequest = Date.now();
  return fn();
}
for (const book of books) {
  if (done.has(book.id)) continue;
  const patch = {};
  if (!book.link?.trim()) patch.link = bookshopLinks(book.title, book.author).amazon;
  const entry = { id: book.id, title: book.title, author: book.author, patch, source: null, status: 'already-complete' };
  if (!book.cover_url?.trim() || !book.description?.trim()) {
    try {
      const quote = (value) => value.replace(/["\\]/g, ' ');
      const results = await paced(() => searchOpenLibrary(mode === '--title-only' ? `title:"${quote(book.title)}"` : `title:"${quote(book.title)}" author:"${quote(book.author)}"`));
      const matches = results.filter((result) => isConfidentBookMatch(book.title, book.author, result));
      const match = matches.find((result) => result.volumeInfo.imageLinks?.thumbnail) ?? matches[0];
      if (match) {
        entry.source = match.volumeInfo.infoLink;
        entry.status = 'matched';
        if (!book.cover_url?.trim() && match.volumeInfo.imageLinks?.thumbnail) patch.cover_url = match.volumeInfo.imageLinks.thumbnail;
        if (!book.description?.trim()) {
          const details = await paced(() => completeBookMetadata(match));
          const description = details.volumeInfo.description?.trim();
          if (description) {
            const words = description.split(/\s+/);
            patch.description = words.length > 180 ? `${words.slice(0, 180).join(' ')}…` : description;
          }
        }
      } else {
        entry.status = 'needs-review';
        entry.candidates = results.slice(0, 3).map((result) => ({ title: result.volumeInfo.title, authors: result.volumeInfo.authors, source: result.volumeInfo.infoLink }));
      }
    } catch (error) {
      entry.status = 'lookup-failed';
      entry.error = error.message;
    }
  }
  report = report.filter((row) => row.id !== book.id);
  report.push(entry);
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  if (report.length % 10 === 0) console.log(`Processed ${report.length}/${books.length}`);
}
console.log(JSON.stringify({ total: report.length, covers: report.filter((r) => r.patch.cover_url).length, descriptions: report.filter((r) => r.patch.description).length, links: report.filter((r) => r.patch.link).length, review: report.filter((r) => r.status !== 'matched' && r.status !== 'already-complete').length }));
