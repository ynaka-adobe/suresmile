/* eslint-disable */
/* global WebImporter */

/**
 * Parser for cards-promo.
 * Source: #carousel-why-sureSmile + .carousel-container
 *   article (one per slide): figure > img, then body div with h3, description div, CTA link
 * Target (cards): one row per card, [image | title + description + CTA].
 */
export default function parse(element, { document }) {
  const cells = [];

  element.querySelectorAll('article').forEach((article) => {
    const img = article.querySelector('figure img') || article.querySelector('img');
    const body = article.querySelector(':scope > div') || article;
    const content = [];

    const heading = body.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) content.push(heading);

    [...body.children].forEach((child) => {
      if (child.contains(heading) || child.querySelector('a')) return;
      const text = child.textContent.trim();
      if (!text) return;
      const p = document.createElement('p');
      p.innerHTML = child.innerHTML;
      content.push(p);
    });

    body.querySelectorAll('a[href]').forEach((a) => {
      const text = a.textContent.trim();
      if (!text) return;
      const p = document.createElement('p');
      const link = document.createElement('a');
      link.href = a.getAttribute('href');
      link.textContent = text; // drop the decorative arrow icon
      p.append(link);
      content.push(p);
    });

    if (!img && !content.length) return;
    cells.push([img || '', content]);
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-promo', cells });
  element.replaceWith(block);
}
