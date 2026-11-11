/**
 * search-locator: doctor location search.
 * Submits address + radius to the "Find a doctor" page, or the visitor's coordinates
 * when "Use my current location" is chosen.
 *
 * Authoring, one setting per row, in this order (single cell), or as key | value rows:
 *   label       | Search by address or postal code
 *   placeholder | Your location
 *   radius      | 5, 10, 25, 50  (bold value = default; otherwise 10 if listed, else the first)
 *   action      | [Find a doctor](/en-us/find-a-doctor)  (link text = button label)
 *   geolocation | Use my current location  (omit the row to hide the button)
 *
 * With no search in the URL, the address field defaults to the visitor's approximate
 * CDN-derived location (City, State). Submitting it unchanged also sends lat/lng so the
 * results need no geocoding; editing the field searches the typed address instead.
 *
 * On a locale page (for example /ja-jp/) the action's locale folder is swapped for the
 * page's own when that page exists, so authored /en-us/ links stay in the visitor's market.
 *
 * Query parameters sent: address, radius (miles), lat, lng.
 * The results block geocodes manual locations before requesting doctors.
 */

import getVisitorLocation from '../../scripts/visitor-location.js';
import { localizePath } from '../../scripts/locale.js';

const KEYS = ['label', 'placeholder', 'radius', 'action', 'geolocation'];
const DEFAULT_RADII = [5, 10, 25, 50];
const DEFAULT_ACTION = '/en-us/find-a-doctor';

let idCounter = 0;

function normaliseKey(text) {
  const t = text.trim().toLowerCase();
  if (t.startsWith('label')) return 'label';
  if (t.startsWith('placeholder')) return 'placeholder';
  if (t.startsWith('radius') || t.startsWith('distance')) return 'radius';
  if (t.startsWith('action') || t.startsWith('submit') || t.startsWith('button')) return 'action';
  if (t.startsWith('geo') || t.includes('location')) return 'geolocation';
  return null;
}

function readConfig(block) {
  const config = {};
  [...block.children].forEach((row, i) => {
    const cells = [...row.children];
    let key;
    let cell;
    if (cells.length >= 2) {
      key = normaliseKey(cells[0].textContent);
      [, cell] = cells;
    } else {
      key = KEYS[i];
      [cell] = cells;
    }
    if (key && cell) config[key] = cell;
  });
  return config;
}

function parseRadii(cell) {
  if (!cell) return { radii: DEFAULT_RADII, selected: 10 };
  const strong = cell.querySelector('strong, b');
  const preferred = strong ? parseInt(strong.textContent.replace(/\D+/g, ''), 10) : NaN;
  const found = (cell.textContent.match(/\d+/g) || []).map((n) => parseInt(n, 10));
  const radii = found.length ? [...new Set(found)] : DEFAULT_RADII;
  let selected = radii.includes(preferred) ? preferred : null;
  if (selected === null) selected = radii.includes(10) ? 10 : radii[0];
  return { radii, selected };
}

function buildUrl(action, params) {
  const url = new URL(action, window.location.href);
  ['address', 'lat', 'lng', 'page'].forEach((key) => url.searchParams.delete(key));
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });
  url.hash = 'doctor-results';
  return url.href;
}

export default function decorate(block) {
  const config = readConfig(block);
  idCounter += 1;
  const uid = `search-locator-${idCounter}`;

  const labelText = config.label?.textContent.trim() || 'Search by address or postal code';
  const placeholder = config.placeholder?.textContent.trim() || 'Your location';
  const { radii, selected } = parseRadii(config.radius);
  const actionLink = config.action?.querySelector('a');
  const authoredAction = actionLink?.getAttribute('href') || DEFAULT_ACTION;
  // Authored once as /en-us/..., so a /ja-jp/ visitor lands on /ja-jp/... when that page exists.
  let action = authoredAction;
  const localAction = localizePath(authoredAction);
  if (localAction !== authoredAction) {
    fetch(localAction, { method: 'HEAD' })
      .then((response) => { if (response.ok) action = localAction; })
      .catch(() => {});
  }
  const submitText = (actionLink || config.action)?.textContent.trim() || 'Find a doctor';
  const geoText = config.geolocation?.textContent.trim();

  const form = document.createElement('form');
  form.className = 'search-locator-form';
  form.setAttribute('role', 'search');
  form.noValidate = true;

  const label = document.createElement('label');
  label.className = 'search-locator-label';
  label.htmlFor = `${uid}-address`;
  label.textContent = labelText;

  const fields = document.createElement('div');
  fields.className = 'search-locator-fields';

  const inputWrap = document.createElement('div');
  inputWrap.className = 'search-locator-input';
  const input = document.createElement('input');
  input.type = 'text';
  input.id = `${uid}-address`;
  input.name = 'address';
  input.placeholder = placeholder;
  input.autocomplete = 'postal-code';
  input.required = true;
  const query = new URLSearchParams(window.location.search);
  input.value = query.get('address') || '';
  inputWrap.append(input);
  let prefill = null; // visitor location currently shown as the default, if untouched

  const selectWrap = document.createElement('div');
  selectWrap.className = 'search-locator-radius';
  const select = document.createElement('select');
  select.name = 'radius';
  select.setAttribute('aria-label', 'Search radius');
  radii.forEach((r) => {
    const opt = document.createElement('option');
    opt.value = String(r);
    opt.textContent = `within ${r} miles`;
    const queryRadius = Number(query.get('radius'));
    if (r === (radii.includes(queryRadius) ? queryRadius : selected)) opt.selected = true;
    select.append(opt);
  });
  selectWrap.append(select);

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'button search-locator-submit';
  submit.textContent = submitText;

  fields.append(inputWrap, selectWrap, submit);
  form.append(label, fields);

  const status = document.createElement('p');
  status.id = `${uid}-status`;
  status.className = 'search-locator-status';
  status.setAttribute('aria-live', 'polite');
  input.setAttribute('aria-describedby', status.id);
  input.addEventListener('input', () => {
    input.removeAttribute('aria-invalid');
    status.textContent = '';
    if (prefill && input.value.trim() !== prefill.label) prefill = null;
  });

  // Default the location to the visitor's own approximate position (never over a search
  // they already ran, or something they have started typing).
  if (!input.value && !query.has('address') && !query.has('lat')) {
    getVisitorLocation().then((location) => {
      if (!location || input.value) return;
      prefill = location;
      input.value = location.label;
      status.textContent = 'Starting with your approximate location. Change it to search elsewhere.';
    });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const address = input.value.trim();
    if (!address) {
      input.setAttribute('aria-invalid', 'true');
      status.textContent = 'Please enter an address or postal code.';
      input.focus();
      return;
    }
    const params = { address, radius: select.value };
    if (prefill && address === prefill.label && prefill.latitude !== null) {
      params.lat = prefill.latitude.toFixed(6);
      params.lng = prefill.longitude.toFixed(6);
    }
    window.location.href = buildUrl(action, params);
  });

  if (geoText && 'geolocation' in navigator) {
    const geo = document.createElement('button');
    geo.type = 'button';
    geo.className = 'search-locator-geolocate';
    geo.textContent = geoText;
    geo.addEventListener('click', () => {
      geo.disabled = true;
      status.textContent = '';
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          window.location.href = buildUrl(action, {
            lat: coords.latitude.toFixed(6),
            lng: coords.longitude.toFixed(6),
            radius: select.value,
          });
        },
        () => {
          geo.disabled = false;
          status.textContent = 'We could not get your location. Please enter an address or postal code.';
          input.focus();
        },
        { timeout: 10000 },
      );
    });
    form.append(geo);
  }

  form.append(status);
  block.replaceChildren(form);
}
