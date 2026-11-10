/* eslint-disable */
/* global WebImporter */

/**
 * Parser for cards-beforeafter.
 * Source: #carousel-real-transformations + .carousel-container
 *   article (one per slide):
 *     div > button (figcaption BEFORE + img) + button (figcaption AFTER + img)
 *     div > h3 (condition) + p (clock icon + duration)
 * Target: one row per card, [before image | after image | h3 + duration paragraph].
 * Images are pulled out of the zoom buttons; the decorative clock icon and the
 * BEFORE/AFTER captions are dropped (the block renders its own tags).
 */
export default function parse(element, { document }) {
  const cells = [];

  element.querySelectorAll('article').forEach((article) => {
    const imgs = [...article.querySelectorAll('button img, figure img')]
      .filter((img) => !(img.getAttribute('src') || '').startsWith('data:'));
    const before = imgs[0] || '';
    const after = imgs[1] || '';

    const text = [];
    const heading = article.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) text.push(heading);
    article.querySelectorAll('p').forEach((p) => {
      const value = p.textContent.replace(/\s+/g, ' ').trim();
      if (!value) return;
      const para = document.createElement('p');
      para.textContent = value;
      text.push(para);
    });

    if (!before && !after && !text.length) return;
    cells.push([before, after, text.length ? text : '']);
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-beforeafter', cells });
  element.replaceWith(block);
}
