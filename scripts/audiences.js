import getVisitorLocation from './visitor-location.js';
import { localizePath, pageLocale } from './locale.js';

/**
 * Audiences for the experimentation plugin (plugins/experimentation).
 *
 * Authors never touch this file. On a page, a section's metadata table lists rows such as
 *   Audience: Japan    | /en-us/fragments/hero-japan
 *   Audience: Implant  | /en-us/fragments/hero-implant
 * and the plugin swaps the section for the first matching variant (rows are in priority order).
 * Variants are ordinary documents, so they go through the normal translation workflow.
 *
 * Signals (all first-party, nothing identifies a person):
 *  - country: the visitor's CDN-derived country (/api/visitor-profile), or ?country=JP to simulate;
 *  - interest: the doctor journey the visitor viewed this session (behavior), or ?interest=implant.
 * The plugin also supports ?audience=japan to force a variant (author simulation).
 */

const INTEREST_KEY = 'suresmile.interest';
const COUNTRY_KEY = 'suresmile.country.override';
const COUNTRY_WAIT_MS = 600; // the hero waits at most this long for the country, then shows default

function read(key) {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

function write(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch { /* storage unavailable: URL params still work */ }
}

/**
 * Records the interest signal for this tab session: from ?interest=, or from viewing one of the
 * doctor journey pages. Called on every page so the signal is there for later pages.
 */
export function rememberInterest() {
  const params = new URLSearchParams(window.location.search);
  const explicit = (params.get('interest') || '').toLowerCase();
  if (['implant', 'endodontic', 'none'].includes(explicit)) {
    write(INTEREST_KEY, explicit);
    return;
  }
  const { pathname } = window.location;
  if (/\/demo\/implant/.test(pathname)) write(INTEREST_KEY, 'implant');
  else if (/\/demo\/endodontic/.test(pathname)) write(INTEREST_KEY, 'endodontic');
}

export function currentInterest() {
  const value = read(INTEREST_KEY);
  return value === 'none' ? null : value;
}

/** Visitor country as an upper-case code, or null. A ?country= override wins and is remembered. */
export async function visitorCountry() {
  const override = (new URLSearchParams(window.location.search).get('country') || '').toUpperCase();
  if (/^[A-Z]{2}$/.test(override)) write(COUNTRY_KEY, override);
  if (override === 'NONE') { write(COUNTRY_KEY, ''); return null; }
  const remembered = read(COUNTRY_KEY);
  if (remembered) return remembered;
  const timeout = new Promise((resolve) => {
    window.setTimeout(() => resolve(null), COUNTRY_WAIT_MS);
  });
  const location = await Promise.race([getVisitorLocation(), timeout]);
  return location?.country ? location.country.toUpperCase() : null;
}

export const AUDIENCES = {
  japan: async () => (await visitorCountry()) === 'JP',
  implant: () => currentInterest() === 'implant',
  endodontic: () => currentInterest() === 'endodontic',
};

function hasAudienceRows(main) {
  return [...main.querySelectorAll('.section-metadata > div > div:first-child, .metadata > div > div:first-child')]
    .some((cell) => /^audience/i.test(cell.textContent.trim()));
}

/**
 * Variant links are authored once (for example /en-us/fragments/hero-japan) and metadata is not
 * translated, so on a translated page point them at the page's own locale when that variant
 * exists, and keep the authored link otherwise.
 */
async function localizeAudienceLinks(main) {
  if (!pageLocale()) return;
  const links = [...main.querySelectorAll('.section-metadata a[href], .metadata a[href]')];
  await Promise.all(links.map(async (a) => {
    const original = new URL(a.getAttribute('href'), window.location.href).pathname;
    const localized = localizePath(original);
    if (localized === original) return;
    try {
      const response = await fetch(localized, { method: 'HEAD' });
      if (response.ok) a.setAttribute('href', localized);
    } catch { /* keep the authored link */ }
  }));
}

/**
 * Runs the experimentation plugin when (and only when) the page declares audiences, before the
 * sections are decorated so a swapped-in variant is decorated like any other content.
 * @param {HTMLElement} main
 */
export async function applyAudiences(main) {
  rememberInterest();
  if (!hasAudienceRows(main)) return;
  try {
    await localizeAudienceLinks(main);
    // eslint-disable-next-line import/no-relative-packages
    const { loadEager } = await import('../plugins/experimentation/src/index.js');
    await loadEager(document, { audiences: AUDIENCES });
    // Sections that declare audiences but matched none keep their default content; mark them
    // so authors and the live insights panel can see "default" as an explicit outcome.
    main.querySelectorAll('.section-metadata').forEach((meta) => {
      const section = meta.parentElement;
      const declares = [...meta.querySelectorAll(':scope > div > div:first-child')]
        .some((cell) => /^audience/i.test(cell.textContent.trim()));
      if (declares && !section.dataset.audience) section.dataset.audience = 'default';
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('audiences: showing default content', e);
  }
}
