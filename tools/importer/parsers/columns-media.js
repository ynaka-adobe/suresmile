/* eslint-disable */
/* global WebImporter */

/**
 * Parser for columns-media.
 * Instances (all are a .section-row with two child columns):
 *   1. div > img (logo)            | .text-section > div (paragraph)
 *   2. div > img (photo)           | .text-section > h2 + div (paragraph)
 *   3. h2 > img ("1 Million" stat) | div > div (text + footnote button > sup)
 * Target (columns): one row, two cells: media | text.
 */
function toTextContent(col, document) {
  const content = [];
  const walk = (node) => {
    [...node.children].forEach((child) => {
      if (/^H[1-6]$/.test(child.tagName)) {
        content.push(child);
        return;
      }
      if (child.tagName === 'P' || child.tagName === 'UL' || child.tagName === 'OL') {
        content.push(child);
        return;
      }
      // leaf text wrapper -> paragraph; container -> recurse
      const hasBlockChildren = [...child.children].some((c) => /^(DIV|H[1-6]|P|UL|OL)$/.test(c.tagName));
      if (hasBlockChildren) {
        walk(child);
        return;
      }
      if (!child.textContent.trim()) return;
      const p = document.createElement('p');
      // footnote buttons -> keep only the superscript marker
      child.querySelectorAll('button').forEach((btn) => {
        const sup = btn.querySelector('sup');
        if (sup) btn.replaceWith(sup);
        else btn.remove();
      });
      p.innerHTML = child.innerHTML;
      content.push(p);
    });
  };
  walk(col);
  return content;
}

export default function parse(element, { document }) {
  const cols = [...element.children];
  const mediaCol = cols.find((c) => c.querySelector('img') && !c.textContent.trim()) || cols[0];
  const textCol = cols.find((c) => c !== mediaCol);

  let media = '';
  if (mediaCol) {
    const img = mediaCol.querySelector('img');
    if (img) {
      // absolutize relative sources; keep .svg logos as images (the importer's
      // convertIcons rule turns any src ending in ".svg" into an :icon: token,
      // but columns-media needs a picture in the media cell)
      let src = img.getAttribute('src') || '';
      if (src.startsWith('/') && !src.startsWith('//')) {
        src = new URL(src, 'https://www.suresmile.com').href;
      }
      if (/\.svg$/i.test(src)) src += '?format=svg';
      img.setAttribute('src', src);
    }
    if (mediaCol.tagName === 'H2' || /^H[1-6]$/.test(mediaCol.tagName)) {
      // stat graphic inside a heading: keep the heading semantics
      const h = document.createElement(mediaCol.tagName.toLowerCase());
      if (img) h.append(img);
      media = h;
    } else {
      media = img || '';
    }
  }

  const text = textCol ? toTextContent(textCol, document) : [];

  const cells = [[media, text.length ? text : '']];
  const block = WebImporter.Blocks.createBlock(document, { name: 'columns-media', cells });
  element.replaceWith(block);
}
