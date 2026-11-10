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
 * Query parameters sent: address, radius (miles), lat, lng.
 */

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
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });
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
  const action = actionLink?.getAttribute('href') || DEFAULT_ACTION;
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
  inputWrap.append(input);

  const selectWrap = document.createElement('div');
  selectWrap.className = 'search-locator-radius';
  const select = document.createElement('select');
  select.name = 'radius';
  select.setAttribute('aria-label', 'Search radius');
  radii.forEach((r) => {
    const opt = document.createElement('option');
    opt.value = String(r);
    opt.textContent = `within ${r} miles`;
    if (r === selected) opt.selected = true;
    select.append(opt);
  });
  selectWrap.append(select);

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'button search-locator-submit';
  submit.textContent = submitText;

  fields.append(inputWrap, selectWrap, submit);
  form.append(label, fields);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const address = input.value.trim();
    if (!address) {
      input.focus();
      return;
    }
    window.location.href = buildUrl(action, { address, radius: select.value });
  });

  if (geoText && 'geolocation' in navigator) {
    const geo = document.createElement('button');
    geo.type = 'button';
    geo.className = 'search-locator-geolocate';
    geo.textContent = geoText;
    const status = document.createElement('p');
    status.className = 'search-locator-status';
    status.setAttribute('aria-live', 'polite');
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
    form.append(geo, status);
  }

  block.replaceChildren(form);
}
