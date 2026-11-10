/* eslint-disable */
/* global WebImporter */

/**
 * Parser for hero-split.
 * Source: section.section-hero .section-row
 *   > img (hero image)
 *   > .text-section (h1, intro div, CTA links)
 * Target (hero): row 1 = image, row 2 = title + subheading + CTA.
 */
export default function parse(element, { document }) {
  const img = element.querySelector(':scope > img, :scope > picture') || element.querySelector('img');
  const textSection = element.querySelector('.text-section') || element;

  const content = [];
  const heading = textSection.querySelector('h1, h2');
  if (heading) content.push(heading);

  // intro copy: direct child divs/paragraphs that hold text and no links
  [...textSection.children].forEach((child) => {
    if (child === heading) return;
    if (child.querySelector('a') || child.tagName === 'A') return;
    const text = child.textContent.trim();
    if (!text) return;
    const p = document.createElement('p');
    p.innerHTML = child.innerHTML;
    content.push(p);
  });

  // CTAs
  textSection.querySelectorAll('a[href]').forEach((a) => {
    if (!a.textContent.trim()) return;
    const p = document.createElement('p');
    const link = document.createElement('a');
    link.href = a.getAttribute('href');
    link.textContent = a.textContent.trim();
    p.append(link);
    content.push(p);
  });

  const cells = [];
  cells.push([img || '']);
  cells.push([content]);

  const block = WebImporter.Blocks.createBlock(document, { name: 'hero-split', cells });
  element.replaceWith(block);
}
