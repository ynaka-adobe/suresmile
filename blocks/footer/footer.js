/*
 * Footer: optional page footnotes band + primary link band + slim legal bar.
 * Copy, links and images come from the footer fragment (content/footer.plain.html):
 *   1. links - <ul> of primary links
 *   2. slim  - logo link, <ul> of legal links, copyright <p>, partner logo link
 * Page footnotes stay in the page (a section styled "footnotes") and are moved into
 * the top of the footer here, so each page carries its own footnotes.
 */

import { fetchLocaleFragment } from '../../scripts/locale.js';

/**
 * Fetches the footer fragment (metadata-independent): /content first (local preview),
 * then the page's locale folder, then the site root. Relative media URLs resolve against
 * the fragment.
 * @returns {Promise<HTMLElement|null>}
 */
async function fetchFooterFragment() {
  const resp = await fetchLocaleFragment('footer');
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

function createBand(className, label) {
  const band = document.createElement(label ? 'nav' : 'div');
  band.className = `footer-band ${className}`;
  if (label) band.setAttribute('aria-label', label);
  const inner = document.createElement('div');
  inner.className = 'footer-inner';
  band.append(inner);
  return { band, inner };
}

/** Labels a link that only wraps an image with that image's alt text. */
function labelImageLink(a) {
  if (a.textContent.trim()) return;
  const alt = a.querySelector('img')?.alt;
  if (alt) a.setAttribute('aria-label', alt);
}

/**
 * Moves the page's footnotes section into the footer and links each footnote
 * with its in-page reference (the matching <sup> number) in both directions.
 * @returns {HTMLElement|null} the footnotes band
 */
function buildFootnotes() {
  const section = document.querySelector('main .section.footnotes');
  const list = section?.querySelector('ol, ul');
  if (!list) return null;

  const { band, inner } = createBand('footer-footnotes');
  band.setAttribute('aria-label', 'Footnotes');
  band.setAttribute('role', 'region');
  list.setAttribute('role', 'list');
  inner.append(list);
  section.remove();

  [...list.children].forEach((li) => {
    const number = li.querySelector('sup')?.textContent.trim();
    if (!number) return;
    li.id = `footnote-${number}`;
    const ref = [...document.querySelectorAll('main sup')]
      .find((sup) => sup.textContent.trim() === number && !sup.closest('.footer'));
    if (!ref) return;

    // reference -> footnote
    const refButton = document.createElement('button');
    refButton.type = 'button';
    refButton.className = 'footnote-ref';
    refButton.id = `footnote-ref-${number}`;
    refButton.setAttribute('aria-label', `Footnote ${number}`);
    ref.replaceWith(refButton);
    refButton.append(ref);
    refButton.addEventListener('click', () => {
      li.scrollIntoView({ behavior: 'smooth', block: 'center' });
      li.setAttribute('tabindex', '-1');
      li.focus({ preventScroll: true });
    });

    // footnote -> reference
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'footnote-back';
    back.setAttribute('aria-label', `Back to reference ${number}`);
    back.textContent = '↩';
    back.addEventListener('click', () => {
      refButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
      refButton.focus({ preventScroll: true });
    });
    li.append(' ', back);
  });
  return band;
}

export default async function decorate(block) {
  const fragment = await fetchFooterFragment();
  block.textContent = '';
  if (!fragment) return;

  const [linksSection, slimSection] = [...fragment.children];
  const footnotes = buildFootnotes();
  if (footnotes) block.append(footnotes);

  // primary link band
  const linksList = linksSection?.querySelector('ul');
  if (linksList) {
    const { band, inner } = createBand('footer-links', 'Patient navigation');
    linksList.setAttribute('role', 'list');
    linksList.querySelectorAll('a').forEach((a) => {
      const label = document.createElement('span');
      label.className = 'footer-link-label';
      label.append(...a.childNodes);
      a.append(label);
    });
    inner.append(linksList);
    block.append(band);
  }

  // slim legal bar: brand logo | legal links + copyright | partner logo
  if (slimSection) {
    const { band, inner } = createBand('footer-slim');
    band.setAttribute('role', 'region');
    band.setAttribute('aria-label', 'Footer navigation and legal links');
    const logoLinks = [...slimSection.querySelectorAll(':scope > p')]
      .map((p) => p.querySelector('a'))
      .filter((a) => a && a.querySelector('img'));
    const [brandLink, partnerLink] = logoLinks;

    const legal = document.createElement('div');
    legal.className = 'footer-legal';
    const legalList = slimSection.querySelector('ul');
    if (legalList) {
      const legalNav = document.createElement('nav');
      legalNav.setAttribute('aria-label', 'Legal navigation');
      legalList.setAttribute('role', 'list');
      legalNav.append(legalList);
      legal.append(legalNav);
      // "#cookie-settings" is an action, not a page: render it as a button that opens
      // the consent manager's preference center when one is present
      legalList.querySelectorAll('a[href="#cookie-settings"]').forEach((a) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'footer-cookie-settings';
        button.textContent = a.textContent.trim();
        button.addEventListener('click', () => {
          if (window.OneTrust?.ToggleInfoDisplay) window.OneTrust.ToggleInfoDisplay();
          else window.dispatchEvent(new CustomEvent('consent:open-preferences'));
        });
        a.replaceWith(button);
      });
    }
    [...slimSection.querySelectorAll(':scope > p')]
      .filter((p) => !p.querySelector('img'))
      .forEach((p) => {
        p.className = 'footer-copyright';
        legal.append(p);
      });

    if (brandLink) {
      brandLink.className = 'footer-logo footer-logo-brand';
      labelImageLink(brandLink);
      inner.append(brandLink);
    }
    inner.append(legal);
    if (partnerLink) {
      partnerLink.className = 'footer-logo footer-logo-partner';
      labelImageLink(partnerLink);
      inner.append(partnerLink);
    }
    block.append(band);
  }
}
