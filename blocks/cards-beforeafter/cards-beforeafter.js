import { createOptimizedPicture } from '../../scripts/aem.js';

function optimize(img) {
  const url = new URL(img.src, window.location.href);
  if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
  img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '500' }]));
}

function mediaFrame(picture, kind) {
  const frame = document.createElement('div');
  frame.className = `cards-beforeafter-image cards-beforeafter-${kind}`;
  const tag = document.createElement('span');
  tag.className = 'cards-beforeafter-tag';
  tag.textContent = kind === 'before' ? 'Before' : 'After';
  frame.append(picture, tag);
  return frame;
}

/**
 * cards-beforeafter: case cards with stacked BEFORE / AFTER photos, a title and a duration,
 * shown in a horizontally scrolling track with previous / next controls.
 * One row per card: before image | after image | text (H3 condition, duration paragraph).
 * The two images may also share a single cell; the first picture is "before", the second "after".
 */
export default function decorate(block) {
  const ul = document.createElement('ul');
  // list-style: none drops list semantics in Safari; restore them
  ul.setAttribute('role', 'list');
  ul.className = 'cards-beforeafter-track';

  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    li.className = 'cards-beforeafter-card';
    const pictures = [...row.querySelectorAll('picture')];
    const media = document.createElement('div');
    media.className = 'cards-beforeafter-media';
    if (pictures[0]) media.append(mediaFrame(pictures[0], 'before'));
    if (pictures[1]) media.append(mediaFrame(pictures[1], 'after'));

    const body = document.createElement('div');
    body.className = 'cards-beforeafter-body';
    [...row.children].forEach((cell) => {
      [...cell.children].forEach((el) => {
        if (el.textContent.trim()) body.append(el);
      });
    });
    const last = [...body.children].pop();
    if (last && !/^H[1-6]$/.test(last.tagName)) last.classList.add('cards-beforeafter-duration');

    if (media.children.length) li.append(media);
    li.append(body);
    ul.append(li);
  });

  ul.querySelectorAll('picture > img').forEach(optimize);

  const nav = document.createElement('div');
  nav.className = 'cards-beforeafter-nav';
  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'cards-beforeafter-prev';
  prev.setAttribute('aria-label', 'Previous');
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'cards-beforeafter-next';
  next.setAttribute('aria-label', 'Next');
  nav.append(prev, next);

  const step = (dir) => {
    const card = ul.querySelector('.cards-beforeafter-card');
    const gap = parseFloat(getComputedStyle(ul).columnGap) || 0;
    const width = card ? card.getBoundingClientRect().width + gap : ul.clientWidth;
    ul.scrollBy({ left: dir * width, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  prev.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));

  const update = () => {
    const max = ul.scrollWidth - ul.clientWidth - 1;
    prev.disabled = ul.scrollLeft <= 0;
    next.disabled = ul.scrollLeft >= max;
    block.classList.toggle('cards-beforeafter-scrollable', max > 0);
  };
  ul.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);

  block.replaceChildren(ul, nav);
  requestAnimationFrame(update);
}
