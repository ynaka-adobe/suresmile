# search-locator

Search navigation targets `#doctor-results`. The results block waits until its
EDS section is visible before scrolling below the sticky header and focusing
the results heading. Manual input is retained in the URL/form for correction
and is geocoded by `search-results-map` before any doctor lookup. Empty input
has an inline live error and accessible input focus; denied geolocation keeps
the manual input available. See the results block README for provider setup and
end-to-end validation.

Custom **search** block. Purpose: doctor location finder (address input, radius select, submit, use current location) that hands off to the find-a-doctor page; not a site content search.

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: one setting per row in this order, or key | value rows: (1) label text 'Search by address or postal code'; (2) input placeholder 'Your location'; (3) radius list in miles, e.g. '5, 10, 25, 50' (a bold value is the default, otherwise 10); (4) submit link 'Find a doctor' to /en-us/find-a-doctor (link text is the button label); (5) 'Use my current location' text (omit the row to hide the geolocation button). Sends address, radius, lat and lng query parameters.

## Supported variations

No variations.

## Universal Editor fields

N/A (Document Authoring project)
