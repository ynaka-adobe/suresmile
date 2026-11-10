/* eslint-disable */
/* global WebImporter */

/**
 * SureSmile (Next.js) cleanup transformer.
 *
 * beforeTransform:
 *  - expands collapsed radix accordion steps (How it works stepper) and restores
 *    the panel text of unmounted steps from the Next.js RSC payload (or a fallback map)
 *  - resolves /_next/image?url=... sources to the original asset URL
 *  - removes site chrome (header, footer, OneTrust, skip link, decorative shapes,
 *    carousel prev/next controls) so it cannot interfere with block matching
 *
 * afterTransform:
 *  - removes remaining non-authorable elements and tracking attributes
 *    (HTML comments are intentionally preserved)
 */

const ORIGIN = 'https://www.suresmile.com';

// Fallback copy for stepper panels that radix unmounts while collapsed.
const STEP_FALLBACK = {
  'Personalized consultation': "Your doctor will talk with you about your oral health goals and how teeth straightening can help. Your doctor will take photos and a digital scan, and you'll receive a consultation to see if SureSmile is right for you.",
  'Customized treatment plan': 'Your doctor will prescribe a personal treatment plan that meets your unique needs and send it to the SureSmile digital lab.',
  'Starting treatment': 'After your treatment plan is approved, your doctor will receive your aligners or other mode of treatment, and you’ll return to the doctor to pick up supplies and go over instructions.',
};

function getRscPayload(document) {
  let text = '';
  document.querySelectorAll('script').forEach((s) => {
    const t = s.textContent || '';
    if (t.includes('self.__next_f')) text += t;
  });
  if (!text) return '';
  return text.replace(/\\"/g, '"').replace(/\\u003c/gi, '<').replace(/\\u003e/gi, '>');
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function lookupStepContent(payload, title) {
  if (payload) {
    const re = new RegExp(`"title":"${escapeRegExp(title)}","content":"((?:[^"\\\\]|\\\\.)*)"`);
    const m = payload.match(re);
    if (m && m[1]) {
      const value = m[1]
        .replace(/<Footnote>[\s\S]*?<\/Footnote>/g, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\\n/g, ' ')
        .replace(/\\(.)/g, '$1')
        .trim();
      if (value) return value;
    }
  }
  return STEP_FALLBACK[title] || '';
}

function expandAccordions(element, document) {
  const payload = getRscPayload(document);
  element.querySelectorAll('h3 > button[id^="radix-"]').forEach((button) => {
    const h3 = button.parentElement;
    const panel = h3.nextElementSibling;
    if (!panel) return;

    // force panels open
    [button, panel].forEach((el) => {
      el.removeAttribute('hidden');
      el.setAttribute('data-state', 'open');
      el.removeAttribute('style');
    });
    button.setAttribute('aria-expanded', 'true');

    if (panel.textContent.trim()) return;
    const spans = button.querySelectorAll('span');
    const title = spans.length ? spans[spans.length - 1].textContent.trim() : '';
    const content = title ? lookupStepContent(payload, title) : '';
    if (!content) return;
    const wrap = document.createElement('div');
    wrap.className = 'mt-8';
    const p = document.createElement('p');
    p.textContent = content;
    wrap.append(p);
    panel.append(wrap);
  });
}

function resolveNextImage(src) {
  if (!src || !src.includes('/_next/image')) return src;
  try {
    const u = new URL(src, ORIGIN);
    const original = u.searchParams.get('url');
    if (!original) return src;
    return new URL(original, ORIGIN).href;
  } catch (e) {
    return src;
  }
}

function resolveImages(element) {
  element.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src');
    const resolved = resolveNextImage(src);
    if (resolved !== src) img.setAttribute('src', resolved);
    img.removeAttribute('srcset');
    img.removeAttribute('srcSet');
    img.removeAttribute('sizes');
    img.removeAttribute('loading');
    img.removeAttribute('decoding');
    img.removeAttribute('data-nimg');
  });
  element.querySelectorAll('picture source').forEach((s) => s.remove());
}

export default function transform(hookName, element, payload) {
  const document = element.ownerDocument || payload.document;

  if (hookName === 'beforeTransform') {
    // must run before scripts are removed (reads the RSC payload)
    expandAccordions(element, document);
    resolveImages(element);

    WebImporter.DOMUtils.remove(element, [
      '#onetrust-consent-sdk',
      '#onetrust-banner-sdk',
      '#onetrust-pc-sdk',
      '.onetrust-pc-dark-filter',
      'iframe.ot-text-resize',
      'header#header',
      '.header-io-marker',
      'footer.footer-base',
      'a[href="#main-content"]',
      '.blooth',
    ]);

    // carousel prev/next controls
    element.querySelectorAll('button').forEach((btn) => {
      const sr = btn.querySelector('.sr-only');
      if (sr && /^(previous|next) slide$/i.test(sr.textContent.trim())) btn.remove();
    });
  }

  if (hookName === 'afterTransform') {
    // header/footer chrome already removed in beforeTransform; only catch stragglers
    // outside forms (the doctor locator form uses <header> to wrap its label)
    element.querySelectorAll('header, footer, nav').forEach((el) => {
      if (!el.closest('form')) el.remove();
    });
    WebImporter.DOMUtils.remove(element, [
      'script',
      'style',
      'noscript',
      'iframe',
      'link',
      'template',
    ]);

    element.querySelectorAll('*').forEach((el) => {
      [...el.attributes].forEach((attr) => {
        const n = attr.name;
        if (
          n.startsWith('data-radix')
          || n.startsWith('data-gtm')
          || n.startsWith('data-analytics')
          || n.startsWith('data-track')
          || n === 'data-state'
          || n === 'data-orientation'
          || n === 'data-value'
          || n === 'onclick'
        ) {
          el.removeAttribute(n);
        }
      });
    });
  }
}
