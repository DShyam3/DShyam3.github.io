import { useLayoutEffect, useState } from 'react';
import { figureSpans } from './hidden-figures';

const STORAGE_KEY = 'finance-figures';
const HIGHLIGHT = 'finance-figure';
/** Marks SVG text holding a figure; highlights do not paint inside SVG, so CSS covers it. */
const SVG_MARK = 'data-hidden-figure';
/** The SVG blur the stylesheet points marked `<text>` at. */
const BLUR_ID = 'finance-figure-blur';
/** Text that is never painted, so never worth a range. */
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'title', 'desc']);
/** A sign rendered as its own text node, which `{sign}{formatGBP(x)}` produces. */
const TRAILING_SIGN = /[-−+]$/;

const supported = typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight === 'function';

const ownText = (element: Element) =>
  Array.from(element.childNodes, child => (child instanceof Text ? child.data : '')).join('');

/**
 * Paints over every money figure under `root` until the returned cleanup runs.
 *
 * The CSS Custom Highlight API styles ranges of text without touching the
 * DOM React owns, so nothing here can fight a re-render. A mutation observer
 * keeps the ranges in step as sections, dialogs and tooltips come and go;
 * its callback runs before the next paint, so a new figure never flashes.
 */
function hideFigures(root: HTMLElement): () => void {
  const highlight = new Highlight();
  const ranges = new Map<Text, Range[]>();
  const marked = new Set<Element>();

  /* A `filter: url()` rather than `blur()`: WebKit applies only the former to
     SVG elements. */
  const svg = (name: string, attributes: Record<string, string>) => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    return element;
  };
  const blur = svg('svg', { 'aria-hidden': 'true', width: '0', height: '0', style: 'position: absolute' });
  const filter = svg('filter', { id: BLUR_ID, x: '-25%', y: '-60%', width: '150%', height: '220%' });
  filter.append(svg('feGaussianBlur', { stdDeviation: '3' }));
  blur.append(filter);
  root.append(blur);

  const forget = (node: Text) => {
    for (const range of ranges.get(node) ?? []) highlight.delete(range);
    ranges.delete(node);
  };

  const mark = (element: Element, on: boolean) => {
    if (on) {
      element.setAttribute(SVG_MARK, '');
      marked.add(element);
    } else if (marked.delete(element)) {
      element.removeAttribute(SVG_MARK);
    }
  };

  /* Marks the whole `<text>`, which takes the blur, unless a label shares it
     with amounts in their own `<tspan>`s (the Sankey's "Rent £950.00"): then
     only those `<tspan>`s, so the label stays readable. */
  const paintSvg = (element: SVGElement) => {
    const text = element.closest('text');
    if (!text) return;
    const tspans = Array.from(text.querySelectorAll('tspan'));
    for (const holder of [text, ...tspans]) mark(holder, false);
    const amounts = tspans.filter(tspan => figureSpans(ownText(tspan)).length > 0);
    const label = [text, ...tspans.filter(tspan => !amounts.includes(tspan))].map(ownText).join('');
    if (amounts.length > 0 && label.trim() && figureSpans(label).length === 0) {
      for (const tspan of amounts) mark(tspan, true);
    } else {
      mark(text, figureSpans(text.textContent ?? '').length > 0);
    }
  };

  const paint = (node: Text) => {
    forget(node);
    const parent = node.parentElement;
    if (!parent || SKIP.has(parent.nodeName)) return;
    if (parent instanceof SVGElement) return paintSvg(parent);
    // Repaint the figure after a sign, or after a node that was one: its range may start here.
    const next = node.nextSibling;
    if (next instanceof Text && (TRAILING_SIGN.test(node.data) || ranges.get(next)?.some(range => range.startContainer === node))) paint(next);
    const spans = figureSpans(node.data);
    if (spans.length === 0) return;
    const before = node.previousSibling;
    ranges.set(node, spans.map(([start, end]) => {
      const range = new Range();
      if (start === 0 && before instanceof Text && TRAILING_SIGN.test(before.data)) {
        range.setStart(before, before.length - 1);
      } else {
        range.setStart(node, start);
      }
      range.setEnd(node, end);
      highlight.add(range);
      return range;
    }));
  };

  const scan = (node: Node) => {
    if (node instanceof Text) return paint(node);
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text; text = walker.nextNode()) paint(text as Text);
  };

  scan(root);
  CSS.highlights.set(HIGHLIGHT, highlight);
  document.documentElement.dataset.financeFigures = 'hidden';

  const observer = new MutationObserver(mutations => {
    let removed = false;
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        scan(mutation.target);
        continue;
      }
      mutation.addedNodes.forEach(scan);
      if (mutation.removedNodes.length === 0) continue;
      removed = true;
      // What is left of an SVG label may no longer be a figure.
      if (mutation.target instanceof SVGElement) paintSvg(mutation.target);
    }
    if (!removed) return;
    for (const node of ranges.keys()) if (!node.isConnected) forget(node);
    for (const element of marked) if (!element.isConnected) marked.delete(element);
  });
  observer.observe(root, { childList: true, characterData: true, subtree: true });

  return () => {
    observer.disconnect();
    CSS.highlights.delete(HIGHLIGHT);
    for (const element of marked) element.removeAttribute(SVG_MARK);
    blur.remove();
    delete document.documentElement.dataset.financeFigures;
  };
}

/**
 * Finance opens with its figures hidden, for reading it where others can see
 * the screen. Showing them lasts for the browser tab; a new tab starts hidden
 * again. Covers the whole document, since dialogs, sheets and toasts portal
 * out of the finance tree. Where the browser has no highlight API nothing is
 * hidden and `supported` is false, so the page offers no control that would
 * do nothing.
 */
export function useHiddenFigures() {
  const [hidden, setHidden] = useState(() => {
    if (!supported) return false;
    try { return sessionStorage.getItem(STORAGE_KEY) !== 'shown'; } catch { return true; }
  });

  // Layout, not passive: the figures have to be covered before the first paint.
  useLayoutEffect(() => {
    if (!supported) return;
    try { sessionStorage.setItem(STORAGE_KEY, hidden ? 'hidden' : 'shown'); } catch { /* Storage may be disabled. */ }
    if (hidden) return hideFigures(document.body);
  }, [hidden]);

  return { supported, hidden, toggle: () => setHidden(value => !value) };
}
