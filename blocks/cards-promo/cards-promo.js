import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const ARROW_PATHS = {
  prev: 'm12 19-7-7 7-7M19 12H5',
  next: 'M5 12h14m-7-7 7 7-7 7',
};

function createArrow(direction) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', ARROW_PATHS[direction]);
  svg.append(path);
  return svg;
}

function createControl(direction, label, track) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `cards-promo-nav cards-promo-${direction}`;
  button.setAttribute('aria-label', label);
  button.setAttribute('aria-controls', track.id);
  button.append(createArrow(direction));
  return button;
}

let instanceCount = 0;

/**
 * Small-screen carousel: the card row scrolls horizontally (scroll-snap), and
 * prev/next buttons move it by one card. On wide screens all cards fit and
 * the buttons are hidden by CSS.
 */
function setupCarousel(block, track) {
  instanceCount += 1;
  track.id = `cards-promo-track-${instanceCount}`;
  const prev = createControl('prev', 'Previous slide', track);
  const next = createControl('next', 'Next slide', track);

  const step = () => {
    const card = track.querySelector(':scope > li');
    if (!card) return track.clientWidth;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    return card.getBoundingClientRect().width + gap;
  };

  const update = () => {
    const max = track.scrollWidth - track.clientWidth;
    prev.disabled = track.scrollLeft <= 1;
    next.disabled = track.scrollLeft >= max - 1;
  };

  block.addEventListener('click', (e) => {
    const button = e.target.closest('.cards-promo-nav');
    if (!button || button.disabled) return;
    const dir = button.classList.contains('cards-promo-prev') ? -1 : 1;
    track.scrollBy({ left: dir * step(), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });

  track.addEventListener('scroll', update, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(update).observe(track);
  block.append(prev, next);
  update();
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
      if (div.children.length === 1 && div.querySelector('picture')) div.className = 'cards-promo-card-image';
      else div.className = 'cards-promo-card-body';
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
  block.textContent = '';
  block.append(ul);
  setupCarousel(block, ul);
}
