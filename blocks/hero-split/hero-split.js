import { createOptimizedPicture } from '../../scripts/aem.js';

function optimize(img) {
  const url = new URL(img.src, window.location.href);
  if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
  img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, true, [{ width: '900' }]));
}

/**
 * hero-split: text on one side, inline image on the other.
 * Authored as either two rows (image row, content row) or one row with two cells.
 * The image may come first or last; the text column always renders first in source order.
 */
export default function decorate(block) {
  const cells = [...block.children].flatMap((row) => [...row.children]);
  const media = document.createElement('div');
  media.className = 'hero-split-media';
  const content = document.createElement('div');
  content.className = 'hero-split-content';

  cells.forEach((cell) => {
    const pictures = [...cell.querySelectorAll('picture')];
    const hasText = [...cell.children].some((el) => el.tagName !== 'PICTURE'
      && !el.querySelector('picture') && el.textContent.trim());
    if (pictures.length && !hasText) {
      media.append(...pictures);
    } else {
      // pull stray pictures out of the text cell into the media column
      pictures.forEach((pic) => {
        const parent = pic.parentElement;
        media.append(pic);
        const empty = !parent.textContent.trim() && !parent.children.length;
        if (parent !== cell && empty) parent.remove();
      });
      content.append(...cell.childNodes);
    }
  });

  content.querySelectorAll('a').forEach((a) => {
    if (a.closest('p') && a.closest('p').textContent.trim() === a.textContent.trim()) {
      a.classList.add('button');
      a.closest('p').classList.add('button-container');
    }
  });

  media.querySelectorAll('picture > img').forEach((img) => {
    img.loading = 'eager';
    optimize(img);
  });

  // the hero image is the page's LCP element: fetch it ahead of other images
  const lcpImg = media.querySelector('img');
  if (lcpImg) {
    lcpImg.loading = 'eager';
    lcpImg.fetchPriority = 'high';
  }

  block.replaceChildren(content);
  if (media.children.length) block.append(media);
  else block.classList.add('hero-split-no-media');
}
