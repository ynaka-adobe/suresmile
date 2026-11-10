import decorateResults from '../../blocks/search-results-map/search-results-map.js';

const coordinates = { latitude: 37.7813454, longitude: -122.497668 };
const path = '/en-us/find-a-doctor';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitFor(check, description) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (check()) return;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => { window.setTimeout(resolve, 50); });
  }
  throw new Error(`Timed out: ${description}`);
}

function measureFocus(doc) {
  const heading = doc.querySelector('#doctor-results');
  const bounds = heading.getBoundingClientRect();
  const header = doc.querySelector('header').getBoundingClientRect();
  assert(doc.activeElement === heading, 'Results heading receives accessible focus');
  assert(bounds.top >= header.bottom - 1, 'Results are below the sticky header');
  assert(bounds.top < doc.defaultView.innerHeight / 2, 'Results are visible without scrolling');
  assert(doc.defaultView.scrollY > 0, 'Search moves away from the top of the page');
  return { top: bounds.top, headerBottom: header.bottom, scrollY: doc.defaultView.scrollY };
}

async function checkFrame(scenario) {
  const requests = [];
  const geocodes = [];
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, options) => {
    const url = new URL(input, window.location.href);
    if (url.pathname === '/api/location/doctors') {
      requests.push(url);
      if (scenario === 'empty') {
        return Promise.resolve(new Response(JSON.stringify({ items: [], total_items: 0 })));
      }
      if (scenario === 'api-error') return Promise.resolve(new Response('', { status: 503 }));
    }
    return originalFetch(input, options);
  };
  if (scenario !== 'missing-provider') {
    // Explicit provider double: validates integration, not real Google authorization.
    // Coordinates are a controlled test response, never a production ZIP fallback.
    window.google = {
      maps: {
        async importLibrary(name) {
          assert(name === 'geocoding', 'Only geocoding is requested without a map key');
          return {
            Geocoder: class {
              // eslint-disable-next-line class-methods-use-this
              async geocode({ address }) {
                geocodes.push(address);
                if (scenario === 'provider-error') throw new Error('REQUEST_DENIED test fixture');
                if (scenario === 'bad-zip') return { results: [] };
                if (scenario === 'invalid-geocode') {
                  const location = { lat: () => 999, lng: () => 0 };
                  return { results: [{ geometry: { location } }] };
                }
                assert(address === '94121', 'Exact manual ZIP reaches the geocoder');
                return {
                  results: [{
                    geometry: {
                      location: {
                        lat: () => coordinates.latitude,
                        lng: () => coordinates.longitude,
                      },
                    },
                  }],
                };
              }
            },
          };
        },
      },
    };
  }
  const response = await originalFetch(`${path}.plain.html`);
  assert(response.ok, 'Authored locator content loads');
  const source = new DOMParser().parseFromString(await response.text(), 'text/html');
  const block = source.querySelector('.search-results-map');
  if (scenario === 'zip') {
    const row = [...block.children]
      .find((item) => item.firstElementChild.textContent.trim() === 'per-page');
    row.lastElementChild.textContent = '2';
  }
  document.querySelector('.search-results-map').replaceWith(block);
  await decorateResults(block);
  await new Promise((resolve) => { window.requestAnimationFrame(resolve); });
  const focus = measureFocus(document);
  const status = block.querySelector('.search-results-map-status').textContent;
  if (scenario === 'zip') {
    assert(geocodes.length === 1, 'ZIP is geocoded once');
    assert(block.querySelectorAll('.search-results-map-card').length === 2, 'Live API results render');
    const firstDoctor = block.querySelector('.search-results-map-card-name').textContent;
    block.querySelector('.search-results-map-pagination-next button').click();
    await waitFor(
      () => block.getAttribute('aria-busy') !== 'true'
        && block.querySelector('.search-results-map-list').start === 3,
      'Live pagination',
    );
    await new Promise((resolve) => { window.requestAnimationFrame(resolve); });
    measureFocus(document);
    assert(block.querySelector('.search-results-map-card-name').textContent !== firstDoctor, 'Page changes');
    assert(requests.length === 2 && geocodes.length === 1, 'Pagination reuses coordinates');
    assert(requests[1].searchParams.get('page') === '2', 'Second page requested');
  } else if (scenario === 'empty') {
    assert(block.querySelector('.search-results-map-empty'), 'Empty result message renders');
    assert(!status, 'Empty results are not provider errors');
  } else if (scenario === 'api-error') {
    assert(status.includes('could not load doctor results'), 'API failure has a distinct error');
    assert(!block.querySelector('.search-results-map-empty'), 'API errors are not empty results');
  } else {
    assert(requests.length === 0, 'No doctor request without valid geocoding');
    const unavailable = ['missing-provider', 'provider-error'].includes(scenario);
    assert(status.includes(unavailable ? 'unavailable' : 'could not find'), 'Clear geocoding failure');
  }
  requests.forEach((url) => {
    assert(url.origin === window.location.origin, 'Doctor lookup is same-origin');
    assert(!url.searchParams.has('address'), 'Never send an address-only doctor query');
    assert(Number(url.searchParams.get('lat')) === coordinates.latitude, 'Geocoded latitude');
    assert(Number(url.searchParams.get('lng')) === coordinates.longitude, 'Geocoded longitude');
    assert(url.searchParams.get('radius') === '10', 'Radius preserved');
  });
  return { scenario, focus, doctorRequests: requests.map((url) => url.pathname + url.search) };
}

/** Run on the local EDS server pointed at the live custom origin/API. */
export default async function checkLocator() {
  assert(['localhost', '127.0.0.1'].includes(window.location.hostname), 'Use a local EDS preview');
  const frame = document.createElement('iframe');
  frame.title = 'Locator functional checks';
  frame.style.cssText = 'position:fixed;left:0;top:0;height:900px;border:0;z-index:10000;background:white';
  document.body.append(frame);
  const results = [];
  let visitCounter = 0;
  async function visit(query = '') {
    const previousDocument = frame.contentDocument;
    const url = new URL(path + query, window.location.origin);
    visitCounter += 1;
    url.searchParams.set('_locator_test', visitCounter);
    frame.src = url.href;
    await waitFor(
      () => frame.contentDocument !== previousDocument
        && frame.contentDocument.querySelector('.search-results-map')?.dataset.blockStatus === 'loaded',
      `Results block decoration: ${query || 'idle'}`,
    );
    return frame.contentDocument;
  }
  async function scenario(name) {
    const doc = frame.contentDocument;
    const script = doc.createElement('script');
    script.type = 'module';
    script.nonce = doc.querySelector('script[nonce]')?.nonce || '';
    script.src = `/tools/locator/check-locator.js?frame=${name}`;
    doc.head.append(script);
    await waitFor(() => frame.contentWindow.locatorChecks, `${name}: frame checks`);
    return frame.contentWindow.locatorChecks;
  }
  try {
    /* eslint-disable no-await-in-loop, no-restricted-syntax */
    for (const width of [390, 1280]) {
      frame.style.width = `${width}px`;
      let doc = await visit();
      assert(doc.querySelector('.search-results-map').hidden, 'No query stays idle');
      const form = doc.querySelector('.search-locator-form');
      const input = form.querySelector('input');
      form.requestSubmit();
      assert(doc.activeElement === input && input.getAttribute('aria-invalid') === 'true', 'Empty input focus/error');
      assert(doc.querySelector('.search-locator-status').textContent.includes('Please enter'), 'Empty input message');
      Object.defineProperty(frame.contentWindow.navigator, 'geolocation', {
        configurable: true,
        value: { getCurrentPosition(success, error) { error({ code: 1 }); } },
      });
      form.querySelector('.search-locator-geolocate').click();
      assert(doc.activeElement === input, 'Denied geolocation focuses manual input');
      assert(doc.querySelector('.search-locator-status').textContent.includes('could not get your location'), 'Denied location message');
      Object.defineProperty(frame.contentWindow.navigator, 'geolocation', {
        configurable: true,
        value: { getCurrentPosition(success) { success({ coords: coordinates }); } },
      });
      form.querySelector('.search-locator-geolocate').click();
      await waitFor(
        () => frame.contentWindow.location.search.includes('lat=')
          && frame.contentDocument.querySelector('.search-results-map-card'),
        'Current location search',
      );
      await new Promise((resolve) => { window.setTimeout(resolve, 100); });
      doc = frame.contentDocument;
      assert(doc.querySelectorAll('.search-results-map-card').length === 8, 'Live current-location results');
      assert(frame.contentWindow.location.hash === '#doctor-results', 'Navigation targets results');
      results.push({ width, scenario: 'geolocation', focus: measureFocus(doc) });

      doc = await visit();
      const manual = doc.querySelector('.search-locator-form');
      manual.querySelector('input').value = '94121';
      manual.requestSubmit();
      await waitFor(
        () => frame.contentWindow.location.search.includes('address=94121')
          && frame.contentDocument.querySelector('.search-results-map-status')?.textContent.includes('unavailable'),
        'Manual ZIP navigation and current missing-provider state',
      );
      assert(frame.contentDocument.querySelector('.search-locator input').value === '94121', 'Manual query retained');
      results.push({ width, ...await scenario('zip') });
    }
    for (const name of ['bad-zip', 'invalid-geocode', 'provider-error', 'missing-provider', 'empty', 'api-error']) {
      await visit(`?address=${name === 'bad-zip' ? 'not-a-place' : '94121'}&radius=10#doctor-results`);
      results.push(await scenario(name));
    }
    for (const query of ['?lat=999&lng=0', '?lat=37x&lng=-122', '?address=']) {
      const doc = await visit(query);
      assert(!doc.querySelector('.search-results-map-card'), 'Invalid query has no doctor results');
      assert(doc.querySelector('.search-results-map-status').textContent.includes('could not find'), 'Invalid query error');
      results.push({ scenario: query, focus: measureFocus(doc) });
    }
    /* eslint-enable no-await-in-loop, no-restricted-syntax */
    return results;
  } finally {
    frame.remove();
  }
}

const frameScenario = new URL(import.meta.url).searchParams.get('frame');
if (frameScenario && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
  window.locatorChecks = checkFrame(frameScenario);
}
