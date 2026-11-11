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

/**
 * Swaps a leading locale folder in a site path for the page's own locale, so a block authored
 * once as /en-us/find-a-doctor sends a /ja-jp/ visitor to /ja-jp/find-a-doctor.
 * Returns the path unchanged outside a locale, for external URLs, or when already local.
 * @param {string} path Site path or URL, for example "/en-us/find-a-doctor"
 * @returns {string}
 */
export function localizePath(path) {
  const locale = pageLocale();
  const match = locale && /^\/([a-z]{2}(?:-[a-z]{2})?)(\/.*)?$/i.exec(path || '');
  if (!match || match[1].toLowerCase() === locale) return path;
  return `/${locale}${match[2] || '/'}`;
}

const DEFAULT_LOCALE = 'en-us';
const COOKIE = 'NEXT_LOCALE';
const CHOSEN_KEY = 'suresmile.locale.chosen';

function readCookie() {
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${COOKIE}=`));
  return match ? match.slice(COOKIE.length + 1) : null;
}

function writeCookie(value) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE}=${value}; Path=/; SameSite=Lax${secure}`;
}

/**
 * The CDN's first-visit language redirect (the NEXT_LOCALE cookie, same name as the existing
 * suresmile.com) only runs while that cookie is absent, and sends a returning visitor back to
 * the locale in it. So the cookie must mean "this visitor settled on a market", not "this
 * visitor once viewed an English page":
 *  - a non-default locale is remembered automatically (for example after the Japanese redirect);
 *  - the default locale is only remembered when the visitor chose it in the region chooser,
 *    and a stale automatic copy is removed so English pages never pin English.
 * A session cookie holding only a locale folder name; it identifies no one.
 */
export function rememberLocale() {
  const locale = pageLocale();
  if (!locale) return;
  try {
    if (locale !== DEFAULT_LOCALE) {
      writeCookie(locale);
    } else if (readCookie() === DEFAULT_LOCALE && !sessionStorage.getItem(CHOSEN_KEY)) {
      document.cookie = `${COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    }
  } catch { /* cookies unavailable: the visitor is simply re-detected next time */ }
}

/**
 * Records an explicit market choice from the region chooser, including the default locale.
 * @param {string|null} locale Locale folder such as "en-us" or "ja-jp"
 */
export function chooseLocale(locale) {
  if (!locale) return;
  try {
    sessionStorage.setItem(CHOSEN_KEY, locale);
    writeCookie(locale);
  } catch { /* cookies unavailable */ }
}
