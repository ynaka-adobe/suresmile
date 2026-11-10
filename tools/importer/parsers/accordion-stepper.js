/* eslint-disable */
/* global WebImporter */

/**
 * Parser for accordion-stepper.
 * Source: section:has(.bg-gradient-progress) .section-row > div.flex.flex-row.relative
 *   each step: div > h3 > button[id^="radix-"] (img thumbnail, span "Step N", span title)
 *              + sibling panel div (description; filled by suresmile-cleanup when collapsed)
 * Target (accordion): one row per step, [thumbnail + "Step N" + title | description].
 */
export default function parse(element, { document }) {
  const cells = [];

  element.querySelectorAll('h3').forEach((h3) => {
    const trigger = h3.querySelector('button') || h3;
    const img = trigger.querySelector('img');
    const spans = [...trigger.querySelectorAll('span')];

    const label = [];
    if (img) label.push(img);
    if (spans.length > 1) {
      const eyebrow = document.createElement('p');
      eyebrow.textContent = spans[0].textContent.replace(/\s+/g, ' ').trim();
      label.push(eyebrow);
    }
    const titleText = (spans.length ? spans[spans.length - 1].textContent : trigger.textContent).trim();
    const title = document.createElement('p');
    title.textContent = titleText;
    label.push(title);

    const body = [];
    const panel = h3.nextElementSibling;
    if (panel) {
      const paras = panel.querySelectorAll('p');
      if (paras.length) {
        paras.forEach((p) => body.push(p));
      } else if (panel.textContent.trim()) {
        const p = document.createElement('p');
        p.textContent = panel.textContent.trim();
        body.push(p);
      }
    }

    cells.push([label, body.length ? body : '']);
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'accordion-stepper', cells });
  element.replaceWith(block);
}
