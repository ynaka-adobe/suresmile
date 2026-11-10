/* eslint-disable */
/* global WebImporter */

/**
 * Parser for search-locator.
 * Source: section.section-cta section:has(form) > form
 *   header > label, input#address-search (placeholder), select > option (radius),
 *   button "Find a doctor" (submit), button > span "Use my current location".
 * Target: single-cell rows in order:
 *   1 label | 2 placeholder | 3 radius list (bold = default) | 4 action link | 5 geolocation text
 */
const FIND_A_DOCTOR = '/en-us/find-a-doctor';

function textRow(document, text) {
  const p = document.createElement('p');
  p.textContent = text;
  return [p];
}

export default function parse(element, { document }) {
  const form = element.querySelector('form') || element;
  const cells = [];

  // 1. label
  const label = form.querySelector('label');
  cells.push(textRow(document, label ? label.textContent.trim() : 'Search by address or postal code'));

  // 2. placeholder (not present in the server-rendered HTML; site uses "Your location")
  const input = form.querySelector('input:not([type="hidden"])');
  const placeholder = (input && (input.getAttribute('placeholder') || input.getAttribute('aria-label')))
    || 'Your location';
  cells.push(textRow(document, placeholder));

  // 3. radius options, default (currently displayed value) in bold
  const options = [...form.querySelectorAll('select option')];
  const nums = options.map((o) => (o.textContent.match(/\d+/) || [])[0]).filter(Boolean);
  const radii = nums.length ? nums : ['5', '10', '25', '50'];
  // Prefer an explicit selected attribute, then the value shown in the custom trigger.
  // (option.selected is true for the first option of any select without one, so it is
  // only a last resort.)
  const explicitOpt = options.find((o) => o.hasAttribute('selected'));
  const shown = form.querySelector('select')?.previousElementSibling?.querySelector('span');
  const fallbackOpt = options.find((o) => o.selected);
  const defaultText = (explicitOpt && explicitOpt.textContent)
    || (shown && shown.textContent)
    || (fallbackOpt && fallbackOpt.textContent) || '';
  const def = (defaultText.match(/\d+/) || [])[0] || '10';
  const radiusP = document.createElement('p');
  radii.forEach((n, i) => {
    if (i) radiusP.append(document.createTextNode(', '));
    if (n === def) {
      const strong = document.createElement('strong');
      strong.textContent = n;
      radiusP.append(strong);
    } else {
      radiusP.append(document.createTextNode(n));
    }
  });
  cells.push([radiusP]);

  // 4. submit action -> link to the find-a-doctor page
  const buttons = [...form.querySelectorAll('button')];
  const submit = buttons.find((b) => /find a doctor/i.test(b.textContent))
    || buttons.find((b) => b.type === 'submit');
  const actionP = document.createElement('p');
  const link = document.createElement('a');
  link.href = FIND_A_DOCTOR;
  link.textContent = submit ? submit.textContent.trim() : 'Find a doctor';
  actionP.append(link);
  cells.push([actionP]);

  // 5. geolocation button text (omit the row when absent)
  const geo = buttons.find((b) => /location/i.test(b.textContent));
  if (geo) cells.push(textRow(document, geo.textContent.trim()));

  const block = WebImporter.Blocks.createBlock(document, { name: 'search-locator', cells });
  element.replaceWith(block);
}
