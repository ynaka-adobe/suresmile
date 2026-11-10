# search-results-map

Custom **search** block. Purpose: API-driven doctor search results: result cards (name, service tags Aligners/Braces/Retainers with tooltip, distance, address, phone link, Google Maps driving instructions), pagination and a results count, beside a sticky Google Map with a marker and info window per doctor. Renders nothing until the page URL carries a search.

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: key | value rows: source (doctors API URL, default https://www.suresmile.com/api/location/doctors); no-results (heading + message, e.g. '**We're sorry**' / 'We couldn't find any SureSmile doctors in this area. Try expanding your search.'); results-label ('{count} results for'); per-page (20). Optional rows: maps-api-key (Google Maps JS key; enables map and address geocoding), map-id, geocode (on/off), directions-label ('Driving instructions'), map-label ('Doctor map'), services-tooltip, aligners, braces, retainers, previous-label, next-label, pagination-label, loading-label, location-label. A single-cell first row is read as the source URL. Reads ?lat=&lng=&radius= or ?address=&radius= from the page URL and calls GET {source}?lat=&lng=&radius=&page=&per_page=&unit=mi.

## Supported variations

No variations.

## Universal Editor fields

N/A (Document Authoring project)
