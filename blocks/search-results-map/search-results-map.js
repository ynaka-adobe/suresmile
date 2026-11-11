/**
 * search-results-map: doctor search results list beside a Google Map.
 *
 * Reads the search from the page URL (?lat=&lng=&radius= or ?address=&radius=, as sent by
 * the search-locator block), calls the doctors API and renders result cards, pagination and,
 * when a Google Maps key is configured, a map with one marker per doctor.
 *
 * Authoring (key | value rows; a single-cell first row is read as `source`):
 *   source            | /api/location/doctors (same-origin)
 *   no-results        | **We're sorry** / We couldn't find any SureSmile doctors ...
 *   results-label     | {count} results for
 *   per-page          | 20
 * Optional rows:
 *   maps-api-key      | Optional override for the shared Google Maps browser key
 *   map-id            | Google Maps map ID (enables advanced markers)
 *   geocode           | on / off (geocode an address-only search; needs maps-api-key)
 *   directions-label  | Driving instructions
 *   map-label         | Doctor map
 *   services-tooltip  | text shown by the (?) button next to the service tags
 *   aligners | braces | retainers  service tag labels
 *   previous-label | next-label | pagination-label | loading-label | location-label
 *   error-label | geocoding-error-label | geocoding-unavailable-label | results-heading
 *
 * Before any search (no query parameters) the block renders nothing.
 */

const DEFAULTS = {
  source: '/api/location/doctors',
  noResultsTitle: 'We\'re sorry',
  noResultsText: 'We couldn\'t find any SureSmile doctors in this area. Try expanding your search.',
  resultsLabel: '{count} results for',
  perPage: 20,
  radius: 10,
  directionsLabel: 'Driving instructions',
  mapLabel: 'Doctor map',
  servicesTooltip: 'Treatments offered by this practice',
  aligners: 'Aligners',
  braces: 'Braces',
  retainers: 'Retainers',
  previousLabel: 'Previous',
  nextLabel: 'Next',
  paginationLabel: 'Results pages',
  loadingLabel: 'Loading results',
  locationLabel: 'your location',
  resultsHeading: 'Doctor search results',
  errorLabel: 'We could not load doctor results. Please try again.',
  geocodingErrorLabel: 'We could not find that location. Check the address or postal code and try again.',
  geocodingUnavailableLabel: 'Address and postal-code search is unavailable. Please use your current location or try again later.',
};

const MAX_RESULTS = 100;
const DESKTOP_QUERY = '(min-width: 900px)';

const KEY_ALIASES = {
  source: 'source',
  'no-results': 'noResults',
  'results-label': 'resultsLabel',
  'per-page': 'perPage',
  'maps-api-key': 'mapsApiKey',
  'map-id': 'mapId',
  geocode: 'geocode',
  'directions-label': 'directionsLabel',
  'map-label': 'mapLabel',
  'services-tooltip': 'servicesTooltip',
  aligners: 'aligners',
  braces: 'braces',
  retainers: 'retainers',
  'previous-label': 'previousLabel',
  'next-label': 'nextLabel',
  'pagination-label': 'paginationLabel',
  'loading-label': 'loadingLabel',
  'location-label': 'locationLabel',
  'results-heading': 'resultsHeading',
  'error-label': 'errorLabel',
  'geocoding-error-label': 'geocodingErrorLabel',
  'geocoding-unavailable-label': 'geocodingUnavailableLabel',
};

let idCounter = 0;
let fetchErrorLogged = false;
let mapsPromise;

/* ---------- configuration ---------- */

function toKey(text) {
  const k = text.trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z-]/g, '');
  return KEY_ALIASES[k] || null;
}

function readConfig(block) {
  const cells = {};
  [...block.children].forEach((row, i) => {
    const cols = [...row.children];
    if (cols.length >= 2) {
      const key = toKey(cols[0].textContent);
      if (key) [, cells[key]] = cols;
    } else if (i === 0 && cols[0]) {
      [cells.source] = cols;
    }
  });

  const text = (key) => cells[key]?.textContent.trim() || '';
  const sourceCell = cells.source;
  const source = sourceCell?.querySelector('a')?.getAttribute('href')
    || text('source') || DEFAULTS.source;
  const perPage = Math.min(Math.max(parseInt(text('perPage'), 10) || DEFAULTS.perPage, 1), MAX_RESULTS);
  const geocode = !/^(off|no|false|0)$/i.test(text('geocode'));

  const config = {
    source,
    perPage,
    geocode,
    mapsApiKey: text('mapsApiKey'),
    mapId: text('mapId'),
    noResultsCell: cells.noResults,
  };
  ['resultsLabel', 'directionsLabel', 'mapLabel', 'servicesTooltip', 'aligners', 'braces',
    'retainers', 'previousLabel', 'nextLabel', 'paginationLabel', 'loadingLabel',
    'locationLabel', 'resultsHeading', 'errorLabel', 'geocodingErrorLabel',
    'geocodingUnavailableLabel'].forEach((key) => {
    config[key] = text(key) || DEFAULTS[key];
  });
  return config;
}

async function loadSharedMapsKey() {
  try {
    const response = await fetch('/.da/google-maps.json', {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Maps configuration request failed');
    const json = await response.json();
    const value = Array.isArray(json.data)
      ? json.data.find((row) => row.key === 'GOOGLE_MAP_KEY')?.value : null;
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error('Maps browser key is missing');
    }
    return value.trim();
  } catch {
    // Do not log configuration values or provider URLs.
    // eslint-disable-next-line no-console
    console.warn('search-results-map: shared Google Maps configuration is unavailable');
    return '';
  }
}

function validCoordinates(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function readQuery() {
  const { search: queryString } = window.location;
  const params = new URLSearchParams(queryString);
  const num = (name) => {
    const raw = params.get(name);
    if (raw === null || raw.trim() === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const address = (params.get('address') || '').trim();
  const lat = num('lat');
  const lng = num('lng');
  const radius = num('radius');
  return {
    address,
    lat,
    lng,
    radius: radius && radius > 0 ? radius : DEFAULTS.radius,
    hasCoords: validCoordinates(lat, lng),
    hasSearch: params.has('address') || params.has('lat') || params.has('lng'),
  };
}

/* ---------- formatting ---------- */

const KEEP_UPPER = new Set(['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW', 'PO', 'DDS', 'DMD', 'MS',
  'MD', 'PC', 'PA', 'LLC', 'PLLC', 'LLP', 'USA', 'II', 'III', 'IV']);
const ADDRESS_WORDS = { STE: 'Suite' };

function titleCaseWord(word, isAddress) {
  const upper = word.toUpperCase();
  if (isAddress && ADDRESS_WORDS[upper]) return ADDRESS_WORDS[upper];
  if (KEEP_UPPER.has(upper.replace(/[.,]/g, ''))) return upper;
  if (/^\d+(ST|ND|RD|TH)$/i.test(word)) return word.toLowerCase();
  if (/\d/.test(word) && /^[\dA-Z-]+$/i.test(word)) return upper; // e.g. 12B, A-1
  return word.toLowerCase()
    .replace(/^[a-z]/, (c) => c.toUpperCase())
    .replace(/([-/(])([a-z])/g, (m, p, c) => p + c.toUpperCase())
    .replace(/^([a-z])'([a-z])/i, (m, a, c) => `${a.toUpperCase()}'${c.toUpperCase()}`);
}

function titleCase(value, isAddress = false) {
  return String(value || '').trim().split(/\s+/).filter(Boolean)
    .map((w) => titleCaseWord(w, isAddress))
    .join(' ');
}

function formatDistance(distance) {
  const n = Number(distance);
  return Number.isFinite(n) ? `${n.toFixed(2)} MI` : '';
}

function telHref(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : '';
}

function directionsHref(doctor) {
  const params = new URLSearchParams({ api: '1' });
  if (Number.isFinite(doctor.latitude) && Number.isFinite(doctor.longitude)) {
    params.set('destination', `${doctor.latitude},${doctor.longitude}`);
  } else {
    params.set('destination', [doctor.street, doctor.city, doctor.state, doctor.zip]
      .filter(Boolean).join(', '));
  }
  return `https://www.google.com/maps/dir/?${params}`;
}

function normaliseDoctor(item) {
  const lat = parseFloat(item.latitude);
  const lng = parseFloat(item.longitude);
  return {
    id: item.office_id || '',
    name: titleCase(item.name),
    street: titleCase(item.address, true),
    city: titleCase(item.city),
    state: String(item.state || '').trim().toUpperCase(),
    zip: String(item.zip || '').trim(),
    phone: String(item.phone || '').trim(),
    website: item.website || '',
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    distance: item.distance,
    services: {
      aligners: Boolean(item.provides_aligners),
      braces: Boolean(item.provides_braces),
      retainers: Boolean(item.provides_retainers),
    },
  };
}

/* ---------- data ---------- */

async function fetchDoctors(config, coords, page) {
  try {
    if (!validCoordinates(coords.lat, coords.lng)) throw new Error('Valid coordinates are required');
    const url = new URL(config.source, window.location.href);
    if (url.origin !== window.location.origin) throw new Error('Doctor API must be same-origin');
    const { searchParams: qs } = url;
    qs.delete('address');
    qs.set('lat', coords.lat);
    qs.set('lng', coords.lng);
    qs.set('radius', coords.radius);
    qs.set('page', page);
    qs.set('per_page', config.perPage);
    qs.set('unit', 'mi');
    const resp = await fetch(url.href, { headers: { Accept: 'application/json' } });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    const items = Array.isArray(json?.items) ? json.items : [];
    const total = Math.min(Number(json?.total_items) || items.length, MAX_RESULTS);
    return { items: items.map(normaliseDoctor), total };
  } catch (e) {
    if (!fetchErrorLogged) {
      fetchErrorLogged = true;
      // eslint-disable-next-line no-console
      console.warn('search-results-map: doctor search failed', e);
    }
    return { items: [], total: 0, error: true };
  }
}

function loadGoogleMaps(key) {
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
  if (!mapsPromise) {
    mapsPromise = new Promise((resolve, reject) => {
      const callback = `searchResultsMapInit${Date.now()}`;
      const script = document.createElement('script');
      const timer = window.setTimeout(() => {
        delete window[callback];
        script.remove();
        reject(new Error('Google Maps loading timed out'));
      }, 15000);
      window[callback] = () => {
        window.clearTimeout(timer);
        delete window[callback];
        resolve(window.google.maps);
      };
      const params = new URLSearchParams({
        key, v: 'weekly', loading: 'async', callback,
      });
      script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
      script.async = true;
      script.onerror = () => {
        window.clearTimeout(timer);
        delete window[callback];
        script.remove();
        reject(new Error('Google Maps failed to load'));
      };
      document.head.append(script);
    }).catch((e) => {
      mapsPromise = null;
      throw e;
    });
  }
  return mapsPromise;
}

async function geocodeAddress(config, address) {
  const maps = await loadGoogleMaps(config.mapsApiKey);
  const { Geocoder } = await maps.importLibrary('geocoding');
  let timer;
  try {
    const { results } = await Promise.race([
      new Geocoder().geocode({ address }),
      new Promise((resolve, reject) => {
        timer = window.setTimeout(() => reject(new Error('Geocoding timed out')), 15000);
      }),
    ]);
    const location = results?.[0]?.geometry?.location;
    const lat = location?.lat();
    const lng = location?.lng();
    return validCoordinates(lat, lng) ? { lat, lng } : null;
  } finally {
    window.clearTimeout(timer);
  }
}

/* ---------- rendering ---------- */

function focusResults(heading) {
  const section = heading.closest('.section');
  const focus = () => window.requestAnimationFrame(() => {
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ behavior: 'auto', block: 'start' });
  });
  if (!section || section.dataset.sectionStatus === 'loaded') {
    focus();
  } else {
    // EDS awaits block decoration before revealing its section.
    const observer = new MutationObserver(() => {
      if (section.dataset.sectionStatus === 'loaded') {
        observer.disconnect();
        focus();
      }
    });
    observer.observe(section, { attributes: true, attributeFilter: ['data-section-status'] });
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function buildNoResults(config) {
  const wrap = el('div', 'search-results-map-empty');
  const cell = config.noResultsCell;
  if (cell && cell.textContent.trim()) {
    const nodes = [...cell.childNodes].map((n) => n.cloneNode(true));
    const onlyText = nodes.every((n) => n.nodeType === Node.TEXT_NODE
      || ['STRONG', 'B', 'EM', 'I', 'BR'].includes(n.nodeName));
    if (onlyText) {
      const p = el('p');
      p.append(...nodes);
      wrap.append(p);
    } else {
      wrap.append(...nodes);
    }
    // the first strong-only paragraph acts as the title
    const first = wrap.firstElementChild;
    if (first?.matches('p') && first.children.length === 1
      && first.firstElementChild.matches('strong, b')
      && first.textContent.trim() === first.firstElementChild.textContent.trim()) {
      first.classList.add('search-results-map-empty-title');
    } else if (first?.matches('h1, h2, h3, h4, h5, h6')) {
      first.classList.add('search-results-map-empty-title');
    }
  } else {
    wrap.append(
      el('p', 'search-results-map-empty-title', DEFAULTS.noResultsTitle),
      el('p', '', DEFAULTS.noResultsText),
    );
  }
  return wrap;
}

function buildCard(doctor, config, uid, index) {
  const li = el('li', 'search-results-map-card');
  li.dataset.index = index;

  const main = el('div', 'search-results-map-card-main');
  main.append(el('h3', 'search-results-map-card-name', doctor.name));

  const offered = ['aligners', 'braces', 'retainers'].filter((s) => doctor.services[s]);
  if (offered.length) {
    const services = el('div', 'search-results-map-services');
    const list = el('ul', 'search-results-map-tags');
    offered.forEach((s) => {
      const tag = el('li', `search-results-map-tag search-results-map-tag-${s}`);
      tag.append(el('span', 'search-results-map-tag-icon'), el('span', '', config[s]));
      tag.firstChild.setAttribute('aria-hidden', 'true');
      list.append(tag);
    });
    const tipId = `${uid}-tip-${index}`;
    const tipWrap = el('span', 'search-results-map-tooltip');
    const tipBtn = el('button', 'search-results-map-tooltip-button');
    tipBtn.type = 'button';
    tipBtn.setAttribute('aria-label', config.servicesTooltip);
    tipBtn.setAttribute('aria-describedby', tipId);
    tipBtn.setAttribute('aria-expanded', 'false');
    const tip = el('span', 'search-results-map-tooltip-text', config.servicesTooltip);
    tip.id = tipId;
    tip.setAttribute('role', 'tooltip');
    tipBtn.addEventListener('click', () => {
      tipBtn.setAttribute('aria-expanded', String(tipBtn.getAttribute('aria-expanded') !== 'true'));
    });
    tipBtn.addEventListener('blur', () => tipBtn.setAttribute('aria-expanded', 'false'));
    tipBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') tipBtn.setAttribute('aria-expanded', 'false');
    });
    tipWrap.append(tipBtn, tip);
    services.append(list, tipWrap);
    main.append(services);
  }

  const location = el('div', 'search-results-map-location');
  const distance = formatDistance(doctor.distance);
  if (distance) location.append(el('p', 'search-results-map-distance', distance));
  const address = el('address', 'search-results-map-address');
  if (doctor.street) address.append(el('span', '', doctor.street));
  const cityLine = [doctor.city, doctor.state].filter(Boolean).join(' ');
  if (cityLine) address.append(el('span', '', cityLine));
  location.append(address);
  main.append(location);

  const actions = el('ul', 'search-results-map-actions');
  const tel = telHref(doctor.phone);
  if (tel) {
    const item = el('li', 'search-results-map-phone');
    const a = el('a', '', doctor.phone);
    a.href = tel;
    item.append(a);
    actions.append(item);
  }
  const dirItem = el('li', 'search-results-map-directions');
  const dir = el('a', '', config.directionsLabel);
  dir.href = directionsHref(doctor);
  dir.target = '_blank';
  dir.rel = 'noopener noreferrer';
  dir.setAttribute('aria-label', `${config.directionsLabel}: ${doctor.name}`);
  dirItem.append(dir);
  actions.append(dirItem);

  li.append(main, actions);
  return li;
}

function buildPagination(state, config, onChange) {
  const totalPages = Math.ceil(state.total / config.perPage);
  if (totalPages <= 1) return null;
  const nav = el('nav', 'search-results-map-pagination');
  nav.setAttribute('aria-label', config.paginationLabel);
  const list = el('ul');

  const addButton = (label, page, { disabled = false, current = false, className = '' } = {}) => {
    const li = el('li', className);
    const btn = el('button', '', label);
    btn.type = 'button';
    btn.disabled = disabled;
    if (current) btn.setAttribute('aria-current', 'page');
    if (!disabled && !current) btn.addEventListener('click', () => onChange(page));
    li.append(btn);
    list.append(li);
    return btn;
  };

  addButton(config.previousLabel, state.page - 1, {
    disabled: state.page <= 1, className: 'search-results-map-pagination-prev',
  });
  for (let p = 1; p <= totalPages; p += 1) {
    const btn = addButton(String(p), p, { current: p === state.page });
    btn.setAttribute('aria-label', `${config.paginationLabel} ${p}`);
  }
  addButton(config.nextLabel, state.page + 1, {
    disabled: state.page >= totalPages, className: 'search-results-map-pagination-next',
  });
  nav.append(list);
  return nav;
}

/* ---------- map ---------- */

function infoContent(doctor, config) {
  const wrap = el('div', 'search-results-map-info');
  wrap.append(el('p', 'search-results-map-info-name', doctor.name));
  const address = el('p', 'search-results-map-info-address');
  address.append(
    doctor.street,
    document.createElement('br'),
    [doctor.city, doctor.state].filter(Boolean).join(' '),
  );
  wrap.append(address);
  const dir = el('a', '', config.directionsLabel);
  dir.href = directionsHref(doctor);
  dir.target = '_blank';
  dir.rel = 'noopener noreferrer';
  wrap.append(dir);
  return wrap;
}

function createMapController(container, config) {
  let map;
  let infoWindow;
  let markers = [];
  let pending = [];
  let ready;

  const clear = () => {
    markers.forEach((m) => {
      if (typeof m.setMap === 'function') m.setMap(null);
      else m.map = null; // eslint-disable-line no-param-reassign
    });
    markers = [];
  };

  const draw = async (doctors) => {
    if (!map) return;
    const { maps } = window.google;
    clear();
    infoWindow?.close();
    const bounds = new maps.LatLngBounds();
    let AdvancedMarker;
    if (config.mapId) {
      try {
        ({ AdvancedMarkerElement: AdvancedMarker } = await maps.importLibrary('marker'));
      } catch (e) {
        AdvancedMarker = null;
      }
    }
    doctors.forEach((doctor) => {
      if (doctor.latitude === null || doctor.longitude === null) return;
      const position = { lat: doctor.latitude, lng: doctor.longitude };
      const marker = AdvancedMarker
        ? new AdvancedMarker({ map, position, title: doctor.name })
        : new maps.Marker({ map, position, title: doctor.name });
      const open = () => {
        infoWindow.setContent(infoContent(doctor, config));
        infoWindow.open({ map, anchor: marker });
      };
      marker.addListener(AdvancedMarker ? 'gmp-click' : 'click', open);
      markers.push(marker);
      bounds.extend(position);
    });
    if (markers.length === 1) {
      map.setCenter(bounds.getCenter());
      map.setZoom(14);
    } else if (markers.length) {
      map.fitBounds(bounds, 48);
    }
  };

  const init = () => {
    if (!ready) {
      ready = loadGoogleMaps(config.mapsApiKey)
        .then((maps) => maps.importLibrary('maps'))
        .then(({ Map, InfoWindow }) => {
          const options = {
            center: { lat: 39.5, lng: -98.35 },
            zoom: 4,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          };
          if (config.mapId) options.mapId = config.mapId;
          map = new Map(container, options);
          infoWindow = new InfoWindow();
          return draw(pending);
        })
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.warn('search-results-map: map unavailable', e);
          container.closest('.search-results-map')?.classList.add('search-results-map-no-map');
        });
    }
    return ready;
  };

  return {
    init,
    async show(doctors) {
      pending = doctors;
      if (map) await draw(doctors);
    },
  };
}

/* ---------- block ---------- */

export default async function decorate(block) {
  const config = readConfig(block);
  const query = readQuery();
  block.textContent = '';

  if (!query.hasSearch) {
    block.classList.add('search-results-map-idle');
    block.hidden = true;
    return;
  }

  if (!config.mapsApiKey && !window.google?.maps?.importLibrary) {
    config.mapsApiKey = await loadSharedMapsKey();
  }

  idCounter += 1;
  const uid = `search-results-map-${idCounter}`;
  const hasMap = Boolean(config.mapsApiKey);
  block.classList.toggle('search-results-map-has-map', hasMap);

  const results = el('div', 'search-results-map-results');
  const status = el('p', 'search-results-map-status');
  status.setAttribute('aria-live', 'polite');
  const summary = el('h2', 'search-results-map-summary', config.resultsHeading);
  summary.id = document.getElementById('doctor-results') ? `${uid}-summary` : 'doctor-results';
  summary.tabIndex = -1;
  const list = el('ol', 'search-results-map-list');
  list.id = `${uid}-list`;
  const pager = el('div', 'search-results-map-pager');
  results.append(summary, status, list, pager);
  block.append(results);

  let mapController;
  let initOnDesktop = () => {};
  if (hasMap) {
    const aside = el('div', 'search-results-map-map');
    const toggle = el('button', 'search-results-map-toggle', config.mapLabel);
    toggle.type = 'button';
    const canvasWrap = el('div', 'search-results-map-canvas-wrap');
    canvasWrap.id = `${uid}-map`;
    const canvas = el('div', 'search-results-map-canvas');
    canvas.setAttribute('role', 'region');
    canvas.setAttribute('aria-label', config.mapLabel);
    canvasWrap.append(canvas);
    toggle.setAttribute('aria-controls', canvasWrap.id);
    toggle.setAttribute('aria-expanded', 'false');
    aside.append(toggle, canvasWrap);
    block.prepend(aside);
    mapController = createMapController(canvas, config);

    const desktop = window.matchMedia(DESKTOP_QUERY);
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      block.classList.toggle('search-results-map-map-open', open);
      if (open) mapController.init();
    });
    initOnDesktop = () => {
      if (desktop.matches) mapController.init();
    };
    desktop.addEventListener('change', initOnDesktop);
  }

  const state = { page: 1, total: 0, coords: { ...query } };
  const where = query.address || config.locationLabel;

  const showEmpty = () => {
    summary.textContent = config.resultsHeading;
    list.replaceChildren();
    pager.replaceChildren(buildNoResults(config));
    block.classList.add('search-results-map-empty-state');
    mapController?.show([]);
  };

  const showError = (message) => {
    summary.textContent = config.resultsHeading;
    status.textContent = message;
    list.replaceChildren();
    pager.replaceChildren();
    block.removeAttribute('aria-busy');
    block.classList.add('search-results-map-empty-state');
    mapController?.show([]);
    focusResults(summary);
  };

  const load = async (page) => {
    state.page = page;
    block.setAttribute('aria-busy', 'true');
    status.textContent = config.loadingLabel;
    const { items, total, error } = await fetchDoctors(config, state.coords, page);
    block.removeAttribute('aria-busy');
    status.textContent = '';

    if (error) {
      showError(config.errorLabel);
      return;
    }
    if (!items.length) {
      state.total = 0;
      showEmpty();
      focusResults(summary);
      return;
    }
    block.classList.remove('search-results-map-empty-state');
    state.total = total;
    summary.textContent = '';
    summary.append(
      el('span', 'search-results-map-count', config.resultsLabel.replace('{count}', total)),
      ' ',
      el('strong', 'search-results-map-query', where),
    );
    list.start = (page - 1) * config.perPage + 1;
    list.replaceChildren(...items.map((d, i) => buildCard(d, config, uid, i)));
    const nav = buildPagination(state, config, load);
    pager.replaceChildren(...(nav ? [nav] : []));

    if (mapController) {
      await mapController.show(items);
      initOnDesktop();
    }
    focusResults(summary);
  };

  try {
    if (!query.hasCoords) {
      if (!query.address) {
        showError(config.geocodingErrorLabel);
        return;
      }
      if (!config.geocode || (!config.mapsApiKey && !window.google?.maps?.importLibrary)) {
        // eslint-disable-next-line no-console
        console.warn('search-results-map: address search requires Google Maps geocoding configuration');
        showError(config.geocodingUnavailableLabel);
        return;
      }
      block.setAttribute('aria-busy', 'true');
      status.textContent = config.loadingLabel;
      try {
        const coordinates = await geocodeAddress(config, query.address);
        if (!coordinates) {
          showError(config.geocodingErrorLabel);
          return;
        }
        Object.assign(state.coords, coordinates);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('search-results-map: geocoding failed', e);
        showError(e?.code === 'ZERO_RESULTS' || e?.status === 'ZERO_RESULTS'
          ? config.geocodingErrorLabel : config.geocodingUnavailableLabel);
        return;
      }
    }
    await load(1);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('search-results-map: unexpected error', e);
    showError(config.errorLabel);
  }
}
