import { createOptimizedPicture } from '../../scripts/aem.js';

function optimize(img) {
  const url = new URL(img.src, window.location.href);
  if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
  img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '256' }]));
}

/**
 * Fill the progress rail down to the bottom of the last open step.
 * Sets --active-step (index of the last open step, -1 when none) and
 * --progress (filled share of the rail, 0-100%).
 * @param {Element} block
 * @param {Element} list
 */
function updateProgress(block, list) {
  const items = [...list.children];
  const lastOpen = items.findLastIndex((item) => item.open);
  block.style.setProperty('--active-step', lastOpen);
  const total = list.offsetHeight;
  if (lastOpen < 0 || !total) {
    block.style.setProperty('--progress', '0%');
    return;
  }
  const item = items[lastOpen];
  const filled = Math.min(100, ((item.offsetTop + item.offsetHeight) / total) * 100);
  block.style.setProperty('--progress', `${filled.toFixed(1)}%`);
}

/**
 * accordion-stepper: a vertical, numbered stepper built on <details>.
 * One row per step: label cell (optional thumbnail, "Step N" eyebrow, title) | body cell.
 * Steps open and close independently; the first step opens by default.
 * @param {Element} block
 */
export default function decorate(block) {
  const list = document.createElement('div');
  list.className = 'accordion-stepper-list';

  const rows = [...block.children];
  rows.forEach((row, index) => {
    const [label, body] = row.children;
    const details = document.createElement('details');
    details.className = 'accordion-stepper-item';
    details.style.setProperty('--step-index', index);

    const summary = document.createElement('summary');
    summary.className = 'accordion-stepper-label';

    const thumb = document.createElement('div');
    thumb.className = 'accordion-stepper-thumb';
    const text = document.createElement('div');
    text.className = 'accordion-stepper-text';

    if (label) {
      label.querySelectorAll('picture').forEach((pic) => {
        const parent = pic.parentElement;
        thumb.append(pic);
        const empty = !parent.textContent.trim() && !parent.children.length;
        if (parent !== label && empty) parent.remove();
      });
      text.append(...label.childNodes);
      // first short paragraph before the title is the "Step N" eyebrow
      const blocks = [...text.children].filter((el) => el.textContent.trim());
      if (blocks.length > 1) blocks[0].classList.add('accordion-stepper-eyebrow');
      blocks[blocks.length - 1]?.classList.add('accordion-stepper-title');
    }

    if (thumb.children.length) summary.append(thumb);
    summary.append(text);

    const content = document.createElement('div');
    content.className = 'accordion-stepper-body';
    if (body) content.append(...body.childNodes);

    details.append(summary, content);
    if (index === 0) details.open = true;
    list.append(details);
  });

  // steps toggle independently (as on the source); the rail follows the last open step
  list.addEventListener('toggle', () => updateProgress(block, list), true);

  block.style.setProperty('--step-count', rows.length);
  block.style.setProperty('--active-step', 0);
  list.querySelectorAll('picture > img').forEach(optimize);
  block.replaceChildren(list);

  // step heights change with viewport width and image/font loading
  new ResizeObserver(() => updateProgress(block, list)).observe(list);
}
