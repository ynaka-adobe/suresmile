/*
 * Header: sticky bar (hamburger, logo, CTA) + left slide-in navigation drawer
 * + region chooser dialog. All copy, links and images come from the nav fragment
 * (content/nav.plain.html); this file only builds controls and behavior.
 *
 * Fragment sections (top-level <div>s, in order):
 *   1. brand   - logo link
 *   2. links   - one or more <ul> of drawer links (a new <ul> starts a group after a divider)
 *   3. tools   - CTA link(s) shown in the bar
 *   4. region  - <h2> title, <p> field label, <ul> of locale links (current one in <strong>),
 *                <p> submit label
 */

import { fetchLocaleFragment } from '../../scripts/locale.js';

const BREAKPOINT = window.matchMedia('(width >= 600px)');

const ICONS = {
  menu: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>',
  close: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  globe: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
  chevronDown: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg>',
  chevronRight: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m9 18 6-6-6-6"/></svg>',
};

/**
 * Fetches the nav fragment (metadata-independent): /content first (local preview),
 * then the page's locale folder, then the site root. Relative media URLs are resolved against
 * the fragment's own URL so they work from any page depth.
 * @returns {Promise<HTMLElement|null>}
 */
async function fetchNavFragment() {
  const resp = await fetchLocaleFragment('nav');
  if (!resp) return null;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = await resp.text();
  const base = resp.url || window.location.href;
  wrapper.querySelectorAll('img[src]').forEach((img) => {
    img.src = new URL(img.getAttribute('src'), base).href;
  });
  wrapper.querySelectorAll('source[srcset]').forEach((source) => {
    source.srcset = new URL(source.getAttribute('srcset'), base).href;
  });
  return wrapper;
}

function createButton(className, label, iconHtml) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  if (label) button.setAttribute('aria-label', label);
  if (iconHtml) button.innerHTML = iconHtml;
  return button;
}

/** Strips a leading flag emoji / symbols so a locale label reads as plain text. */
function plainLabel(text) {
  return text.replace(/^[^\p{L}\p{N}]+/u, '').trim();
}

/**
 * Builds the region chooser dialog from the region section.
 * @param {Element} section region section of the fragment
 * @returns {{ dialog: HTMLDialogElement, currentLabel: string } | null}
 */
function buildRegionDialog(section) {
  const links = section ? [...section.querySelectorAll('ul a[href]')] : [];
  if (!links.length) return null;
  const heading = section.querySelector('h1, h2, h3');
  const paragraphs = [...section.querySelectorAll(':scope > p')];
  const fieldLabel = paragraphs[0]?.textContent.trim() || '';
  const submitLabel = paragraphs[paragraphs.length - 1]?.textContent.trim() || '';

  const current = links.find((a) => a.closest('strong'))
    || links.find((a) => window.location.pathname.startsWith(new URL(a.href).pathname))
    || links[0];

  const dialog = document.createElement('dialog');
  dialog.className = 'nav-region-dialog';

  const close = createButton('nav-region-close', 'Close dialog', ICONS.close);
  close.addEventListener('click', () => dialog.close());

  const title = document.createElement('h2');
  title.id = 'nav-region-title';
  title.textContent = heading?.textContent.trim() || '';
  dialog.setAttribute('aria-labelledby', title.id);

  const field = document.createElement('div');
  field.className = 'nav-region-field';
  const label = document.createElement('label');
  label.htmlFor = 'nav-region-select';
  label.textContent = fieldLabel;
  const selectWrap = document.createElement('div');
  selectWrap.className = 'nav-region-select';
  const select = document.createElement('select');
  select.id = 'nav-region-select';
  links.forEach((a) => {
    const option = document.createElement('option');
    option.value = a.href;
    option.textContent = a.textContent.trim();
    option.selected = a === current;
    select.append(option);
  });
  selectWrap.innerHTML = ICONS.chevronDown;
  selectWrap.prepend(select);
  field.append(label, selectWrap);

  const submit = createButton('nav-region-submit');
  submit.textContent = submitLabel;
  submit.insertAdjacentHTML('beforeend', ICONS.chevronRight);
  submit.addEventListener('click', () => {
    if (select.value && select.value !== current.href) window.location.href = select.value;
    else dialog.close();
  });

  dialog.append(close, title, field, submit);
  // close when the backdrop (outside the dialog box) is clicked
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  return { dialog, currentLabel: plainLabel(current.textContent) };
}

export default async function decorate(block) {
  const fragment = await fetchNavFragment();
  block.textContent = '';
  if (!fragment) return;

  const [brandSection, linksSection, toolsSection, regionSection] = [...fragment.children];

  // --- bar ---
  const nav = document.createElement('nav');
  nav.id = 'nav';
  nav.setAttribute('aria-label', 'Main');

  const hamburger = createButton('nav-hamburger', 'Open main navigation', `<span class="nav-hamburger-icons"><span class="nav-hamburger-icon nav-hamburger-open">${ICONS.menu}</span><span class="nav-hamburger-icon nav-hamburger-close">${ICONS.close}</span></span>`);
  hamburger.setAttribute('aria-expanded', 'false');
  hamburger.setAttribute('aria-controls', 'nav-drawer');

  const brand = document.createElement('div');
  brand.className = 'nav-brand';
  const brandLink = brandSection?.querySelector('a[href]');
  if (brandLink) {
    if (!brandLink.textContent.trim()) {
      const alt = brandLink.querySelector('img')?.alt || 'Home';
      brandLink.setAttribute('aria-label', alt.replace(/logo$/i, 'Home').trim());
    }
    brand.append(brandLink);
  }

  const tools = document.createElement('div');
  tools.className = 'nav-tools';
  toolsSection?.querySelectorAll('a[href]').forEach((a) => {
    a.className = 'nav-cta';
    tools.append(a);
  });

  nav.append(hamburger, brand, tools);

  // --- drawer ---
  const drawer = document.createElement('div');
  drawer.className = 'nav-drawer';
  drawer.id = 'nav-drawer';
  drawer.setAttribute('aria-label', 'Main navigation drawer');
  drawer.hidden = true;

  const drawerNav = document.createElement('nav');
  drawerNav.className = 'nav-drawer-links';
  drawerNav.setAttribute('aria-label', 'Main navigation drawer');
  (linksSection ? [...linksSection.querySelectorAll(':scope > ul')] : []).forEach((ul) => {
    const group = document.createElement('div');
    group.className = 'nav-drawer-group';
    ul.setAttribute('role', 'list');
    group.append(ul);
    drawerNav.append(group);
  });
  drawer.append(drawerNav);

  const region = buildRegionDialog(regionSection);
  if (region) {
    const regionTrigger = createButton('nav-region-trigger', null, ICONS.globe);
    const regionText = document.createElement('span');
    regionText.textContent = region.currentLabel;
    regionTrigger.append(regionText);
    regionTrigger.setAttribute('aria-haspopup', 'dialog');
    regionTrigger.addEventListener('click', () => region.dialog.showModal());
    drawer.append(regionTrigger);
  }

  // small screens: the bar hides its CTA, so the drawer repeats it at the bottom
  const ctas = [...tools.querySelectorAll('a.nav-cta')];
  if (ctas.length) {
    const drawerCta = document.createElement('div');
    drawerCta.className = 'nav-drawer-cta';
    ctas.forEach((a) => drawerCta.append(a.cloneNode(true)));
    drawer.append(drawerCta);
  }

  const overlay = document.createElement('div');
  overlay.className = 'nav-overlay';
  overlay.hidden = true;

  // --- behavior ---
  let closeTimer;
  const isOpen = () => hamburger.getAttribute('aria-expanded') === 'true';

  const setOpen = (open, { focus = true } = {}) => {
    clearTimeout(closeTimer);
    hamburger.setAttribute('aria-expanded', String(open));
    hamburger.setAttribute('aria-label', open ? 'Close main navigation' : 'Open main navigation');
    block.classList.toggle('is-open', open);
    document.body.classList.toggle('nav-locked', open);
    if (open) {
      drawer.hidden = false;
      overlay.hidden = false;
      // next frame so the slide/fade transitions run from the closed state
      requestAnimationFrame(() => requestAnimationFrame(() => {
        drawer.classList.add('is-open');
        overlay.classList.add('is-open');
      }));
      if (focus) drawer.querySelector('a, button')?.focus({ preventScroll: true });
    } else {
      drawer.classList.remove('is-open');
      overlay.classList.remove('is-open');
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      closeTimer = setTimeout(() => {
        drawer.hidden = true;
        overlay.hidden = true;
      }, reduced ? 0 : 500);
      if (focus) hamburger.focus({ preventScroll: true });
    }
  };

  hamburger.addEventListener('click', () => setOpen(!isOpen()));
  overlay.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen() && !region?.dialog.open) setOpen(false);
  });
  drawer.addEventListener('focusout', (e) => {
    // tabbing back to the bar keeps the drawer open; moving focus into the page closes it
    const next = e.relatedTarget;
    if (isOpen() && next && !block.contains(next)) setOpen(false, { focus: false });
  });

  // crossing the breakpoint resets transient UI so the layout never sticks half-open
  BREAKPOINT.addEventListener('change', () => {
    if (region?.dialog.open) region.dialog.close();
    if (isOpen()) setOpen(false, { focus: false });
  });

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper, overlay, drawer);
  if (region) block.append(region.dialog);
}
