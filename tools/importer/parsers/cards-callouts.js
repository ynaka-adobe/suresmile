/* eslint-disable */
/* global WebImporter */

/**
 * Parser for cards-callouts.
 * Source: section.section-marquee .section-row > div.flex.items-center (one per item)
 *   each item: div.w-6 > svg (inline icon; img with data URI in cached HTML) + span (label)
 * Target (cards): one row per item, [icon | label].
 * Icons are authored as EDS icon tokens (:aligners:, :braces:, :retainers:) that
 * resolve to /icons/{name}.svg.
 */
function toIconName(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function parse(element, { document }) {
  const cells = [];
  const items = element.querySelectorAll(':scope > div.flex.items-center');

  items.forEach((item) => {
    const label = item.querySelector('span');
    const text = (label ? label.textContent : item.textContent).trim();
    if (!text) return;
    const hasIcon = !!item.querySelector('svg, img');
    const iconCell = document.createElement('p');
    if (hasIcon) iconCell.textContent = `:${toIconName(text)}:`;
    const p = document.createElement('p');
    p.textContent = text;
    cells.push([hasIcon ? iconCell : '', p]);
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-callouts', cells });
  element.replaceWith(block);
}
