/**
 * Locale helpers for fragments that are translated per market (nav, footer).
 * A page under /ja-jp/ loads /ja-jp/nav and /ja-jp/footer; pages outside any locale
 * folder, and locales without their own copy yet, fall back to the site root.
 */

/** Locale folder of the current page, for example "ja-jp", or null outside a locale. */
export function pageLocale(pathname = window.location.pathname) {
  const [segment] = pathname.split('/').filter(Boolean);
  return /^[a-z]{2}(?:-[a-z]{2})?$/i.test(segment || '') ? segment.toLowerCase() : null;
}

/**
 * Fetches `${name}.plain.html` for the page's locale, then the site root.
 * /content/... is tried first for local preview. Resolves to the first OK response, or null.
 * @param {string} name Fragment name, for example "nav" or "footer"
 * @returns {Promise<Response|null>}
 */
export async function fetchLocaleFragment(name) {
  const locale = pageLocale();
  const bases = locale ? [`/content/${locale}`, `/${locale}`] : [];
  bases.push('/content', '');
  for (let i = 0; i < bases.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const response = await fetch(`${bases[i]}/${name}.plain.html`);
    if (response.ok) return response;
  }
  return null;
}
