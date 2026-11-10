/* eslint-disable */
/* global WebImporter */

/**
 * Parser for search-results-map.
 * Source: section.doctor-body
 *   section.not-found > p (heading "We're sorry") + p (message)
 *   nav.pagination > ul > li > button.prev / numbered / button.next (icon-only)
 *   aside (empty map container, filled client-side)
 * Target (key | value rows): source, no-results, results-label, per-page,
 *   plus optional label rows only when the static HTML carries text for them.
 * Dynamic doctor results are rendered client-side from the API and are not emitted.
 */
const SOURCE_URL = 'https://www.suresmile.com/api/location/doctors';

function keyRow(document, key, value) {
  const k = document.createElement('p');
  k.textContent = key;
  return [k, value];
}

function textP(document, text) {
  const p = document.createElement('p');
  p.textContent = text;
  return p;
}

export default function parse(element, { document }) {
  const cells = [];

  // source
  const link = document.createElement('a');
  link.href = SOURCE_URL;
  link.textContent = SOURCE_URL;
  const sourceP = document.createElement('p');
  sourceP.append(link);
  cells.push(keyRow(document, 'source', sourceP));

  // no-results: heading (bold) + message, from the server-rendered not-found panel
  const notFound = element.querySelector('section.not-found');
  const nfParas = notFound ? [...notFound.querySelectorAll(':scope > p')] : [];
  const nfHeading = (nfParas[0] && nfParas[0].textContent.trim()) || 'We’re sorry';
  const nfMessage = (nfParas[1] && nfParas[1].textContent.trim())
    || 'We couldn’t find any SureSmile doctors in this area. Try expanding your search.';
  const headP = document.createElement('p');
  const strong = document.createElement('strong');
  strong.textContent = nfHeading;
  headP.append(strong);
  cells.push(keyRow(document, 'no-results', [headP, textP(document, nfMessage)]));

  // results-label and per-page (from authoring analysis; rendered client-side)
  cells.push(keyRow(document, 'results-label', textP(document, '{count} results for')));
  cells.push(keyRow(document, 'per-page', textP(document, '20')));

  // optional pagination labels: only if the prev/next controls carry text or aria-labels
  const pagination = element.querySelector('nav.pagination');
  if (pagination) {
    const label = pagination.getAttribute('aria-label');
    if (label && label.trim()) cells.push(keyRow(document, 'pagination-label', textP(document, label.trim())));
    [['prev', 'previous-label'], ['next', 'next-label']].forEach(([cls, key]) => {
      const btn = pagination.querySelector(`button.${cls}`);
      if (!btn) return;
      const text = (btn.getAttribute('aria-label') || btn.textContent || '').trim();
      if (text) cells.push(keyRow(document, key, textP(document, text)));
    });
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'search-results-map', cells });
  element.replaceWith(block);
}
