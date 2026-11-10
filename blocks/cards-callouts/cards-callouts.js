import { createOptimizedPicture, decorateIcons } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const ICON_TOKEN = /^:([a-z0-9-]+):$/;

/**
 * Turns a cell whose only text is an icon token (e.g. ":aligners:") into an icon span.
 * The publishing pipeline already does this; local plain HTML keeps the raw token.
 * @param {Element} cell the card cell
 */
function decorateIconToken(cell) {
  const match = cell.textContent.trim().match(ICON_TOKEN);
  if (!match || cell.querySelector('picture, img, .icon')) return;
  const span = document.createElement('span');
  span.className = `icon icon-${match[1]}`;
  cell.replaceChildren(span);
}

export default function decorate(block) {
  /* change to ul, li */
  const ul = document.createElement('ul');
  // list-style: none drops list semantics in Safari; restore them
  ul.setAttribute('role', 'list');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    moveInstrumentation(row, li);
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      decorateIconToken(div);
      if (div.children.length === 1 && div.querySelector('picture, .icon')) div.className = 'cards-callouts-card-image';
      else div.className = 'cards-callouts-card-body';
    });
    ul.append(li);
  });
  ul.querySelectorAll('picture > img').forEach((img) => {
    // optimize only same-origin, non-SVG images; keep the authored picture otherwise
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    moveInstrumentation(img, optimizedPic.querySelector('img'));
    img.closest('picture').replaceWith(optimizedPic);
  });
  decorateIcons(ul);
  block.textContent = '';
  block.append(ul);
}
