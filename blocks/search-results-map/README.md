# search-results-map

Custom **search** block. Purpose: API-driven doctor search results: result cards (name, service tags Aligners/Braces/Retainers with tooltip, distance, address, phone link, Google Maps driving instructions), pagination and a results count, beside a sticky Google Map with a marker and info window per doctor. Renders nothing until the page URL carries a search.

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: key | value rows: source (same-origin doctors API path, default `/api/location/doctors`); no-results (heading + message, e.g. '**We're sorry**' / 'We couldn't find any SureSmile doctors in this area. Try expanding your search.'); results-label ('{count} results for'); per-page (20). Optional rows: maps-api-key (authorized Google Maps browser key; enables map and address geocoding), map-id, geocode (on/off), directions-label ('Driving instructions'), map-label ('Doctor map'), services-tooltip, aligners, braces, retainers, previous-label, next-label, pagination-label, loading-label, location-label. A single-cell first row is read as the source URL. Reads ?lat=&lng=&radius= or ?address=&radius= from the page URL and calls GET {source}?lat=&lng=&radius=&page=&per_page=&unit=mi.

Address/postal-code input must first resolve through the existing Google Maps
JavaScript Geocoder. Configure `maps-api-key` with a browser key authorized for
this site's referrer, with Maps JavaScript and Geocoding enabled, or reuse an
already loaded Maps library. Do not copy a key from the original external site.
With no authorized provider, address search displays an explicit unavailable
message and does not request doctors. Empty/failed/invalid geocoding also stops
the doctor request; there is no address-only or default-coordinate fallback.
Disabling `geocode` supports coordinate-only searches, not address-only API calls.

Coordinates must be finite and within latitude/longitude ranges. Pagination
reuses the resolved coordinates and radius. A successful empty API response uses
the authored no-results content; an API failure is a distinct error.

Additional optional labels: `results-heading` (Doctor search results),
`error-label`, `geocoding-error-label`, and `geocoding-unavailable-label`.
The results heading is focusable and becomes the `#doctor-results` navigation
target. Initial searches, pagination, empty results and errors move focus and
scroll to it only after EDS reveals the containing section. Its scroll margin
accounts for the sticky header.

## Validation and activation

Start a local EDS server against the custom origin so `/api/location/doctors`
reaches the existing live proxy:

```sh
CHOKIDAR_USEPOLLING=true aem up --port 3038 --no-open --no-livereload --stop-other=false --url https://suresmile.ynaka-adobe.com
npx eslint blocks/search-locator/search-locator.js blocks/search-results-map/search-results-map.js tools/locator/check-locator.js
npx stylelint blocks/search-results-map/search-results-map.css
```

In the local browser:

```js
await (await import('/tools/locator/check-locator.js')).default();
```

The browser checks use the live same-origin doctor proxy, controlled
geolocation callbacks, and an explicitly mocked Google Geocoder response.
They measure actual focus/scroll/header geometry on desktop and mobile, click
both form paths and pagination, and exercise denied location, empty/bad ZIP,
provider/configuration failures, invalid coordinates, empty results and API
errors. The mock verifies coordinate hand-off, **not real Google authorization**.

Deploy only the changed locator JS/CSS through an approved repository workflow.
Real-provider ZIP verification additionally requires the authorized Maps
configuration above; the hosted block currently has no `maps-api-key` row.

## Supported variations

No variations.

## Universal Editor fields

N/A (Document Authoring project)
