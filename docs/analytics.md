# SureSmile Adobe Analytics and local insights

Implements the supplied eight-page SureSmile build guide with its **exact**
variable numbers, using legacy AppMeasurement, not Web SDK/AEP.

## Runtime and consent

`scripts/delayed.js` starts one adapter per document. The official, unmodified
Adobe AppMeasurement 2.27.0 distribution is vendored in `deps/analytics/`; its
release, source commit, license and checksum are recorded there. Nothing loads
the SDK or sends Analytics hits before consent.

Without a CMP, a small accessible control offers equally available **Allow
analytics** and **Keep analytics off** actions. The essential preference alone
is saved in `localStorage` (`suresmile.analytics.consent.v1`). Reopen it with
**Analytics settings**, the existing footer Cookie settings action, or
`consent:open-preferences`.

If OneTrust is present, its `C0002` group is authoritative, including when it
arrives after a local choice. The local control cannot override it. The adapter
listens for `OneTrustGroupsUpdated`, `OTConsentApplied` and `OneTrustLoaded`,
rechecks on window focus, and checks consent again for every hit. No group
information means no grant. DNT/GPC are displayed as browser signals, not treated
as consent or identity assertions.

Withdrawal cancels pending SDK loading, stops future hits, clears this adapter's
visit attribution, feed and owned data-layer entries, and does not replay missed
events on regrant. It also cancels/clears visitor-profile display and disconnects
local behavioral observers. It cannot retract a request already dispatched or unload
executed JavaScript. AppMeasurement is configured for session cookies, no
third-party cookies and no offline queue. A future CMP must include Adobe's
identity-cookie cleanup in its site-wide cookie policy.

**Collection is restricted to `suresmile.ynaka-adobe.com`.** Preview/local/EDS
hosts show `preview-disabled` after opt-in and do not load the SDK. Neither
`insights=1` nor another query flag bypasses this protection. The explicit test
loader is used only by the isolated SDK-spy harness.

## Exact mapping

Suite: `acsmarketingsuresmile`; both tracking servers:
`acsmarketing.sc.omtrdc.net`; namespace: `acsmarketing`; UTF-8 / USD.

| Variable | Value |
| --- | --- |
| eVar1 / prop2 | `endodontic`, `implant`, `none` |
| eVar2 | `anonymous`; no CRM integration exists and login/demo flags are ignored |
| eVar3 / prop3 | `ai`, `search-organic`, `search-paid`, `direct` |
| eVar4 | Actual rendered `data-analytics-variant` ID; otherwise `none` sentinel |
| eVar5 / prop1 | Stable page/journey type |
| eVar6 / s.campaign | Accepted `utm_campaign` code |
| prop4 | Allowlisted stable CTA label, never arbitrary link text |

`window.adobeDataLayer` receives the guide's `pageView` object, with `page`,
`persona` and `channel`, immediately before `s.t()`. Link hits use `s.tl()`
with explicit `linkTrackVars` and `linkTrackEvents`. Variables are cleared before
and after every hit. Auto exit/download/inline tracking and ActivityMap
link/region capture are disabled to prevent duplicates and free-form text capture.
Exit/download calls use `useBeacon` and `tl(true, ...)` without delaying or
preventing navigation.

| Event | Trigger |
| --- | --- |
| event1 | Legacy SureSmile demo hub view |
| event2 | Persona/journey selection, with that link's persona and channel |
| event3 | Legacy discovery page view |
| event4 | Persona landing view, including recognized current homepage arrivals |
| event5 | Official `dentsplysirona.com` source link |
| event6 | Demo-context link to `/en-us/how-it-works` |
| event7 | SureSmile white-paper resource download |
| event8 | `/en-us/doctors/contact` intent |
| event9 | Becoming-a-provider CTA; includes the actual doctor-page provider section |

The generic decorator stamps `data-analytics-event`, `data-analytics-cta`,
`data-analytics-channel` and `data-analytics-persona` attributes. One delegated
handler covers existing and dynamically added links, including keyboard
activation and middle-click. Author explicit attributes for new channel layouts;
there is no per-block tracking implementation.

Supported CTA labels are `journey-endodontic`, `journey-implant`, `direct-landing`,
`ai-answer`, `sponsored-ad`, `organic-result`, `official-source`,
`suresmile-crosslink`, `download-white-paper`, `contact-us`, `become-provider`.
Only click events `event2` and `event5` through `event9` are accepted in attributes.

## Current arrivals, attribution and privacy

Current arrivals are `/en-us?demo_audience=endodontic|implants` with
`demo_source=chatgpt|seo|ad`. `implants` becomes Analytics `implant`; sources map
to `ai|search-organic|search-paid`. The recognized arrival counts as a landing
visit, **not proof that personalized content rendered**. The pending hero work is
not part of this Analytics change. Its eventual implementation must place the
actual variant ID on its rendered block using `data-analytics-variant`; the data
layer leaves `variantId` empty otherwise. `eVar4=none` explicitly prevents an old
visit-persistent variant from masquerading as an active one.

Legacy paths `/en-us/customer-demo`, `/en-us/demo/endodontic-discovery`,
`/en-us/demo/implant-discovery`, `/en-us/demo/endodontic` and
`/en-us/demo/implants` retain stable `demo:*` names and events. Other supported
routes include the doctors/contact, how-it-works, homepage and locator pages.
Unknown routes use `suresmile:other` and a redacted root page URL.

After consent, enum-only attribution lives in tab-scoped `sessionStorage`
(`suresmile.analytics.visit.v1`) with a 30-minute inactivity limit. It survives
same-origin navigation, not a cross-site identity join. Recognized inbound
selection takes precedence over route/campaign/previous-visit hints. Unknown or
duplicate `demo_audience`, or `demo_reset=1`, clears attribution; the existing
standard-experience return link also clears the stored visit. Unknown discovery
sources become `direct`. Adobe's configured allocation/expiration still controls
server-side reporting; clearing client state does not reset a server-side visit.

UTMs are deliberately vocabulary-limited, not arbitrary free text:

- Campaign: starts with `endo`, `endodontic`, `implant` or `implants`, followed by
  up to four `-` tokens from `aligner`, `aligners`, `suresmile`, `demo`, `campaign`,
  or a `2020`-`2029` year. Example: `endo-aligner-2026`.
- Source: `chatgpt`, `openai`, `google`, `bing`, `email`, `newsletter`, `xsc-demo`,
  `dentsply-sirona`, `suresmile`.
- Medium: `ai`, `organic`, `cpc`, `ppc`, `paid-search`, `email`, `referral`, `social`.

Accepted source/medium go to `contextData['campaign.source']` and
`contextData['campaign.medium']`, without borrowing other eVar numbers. Clearly
named campaigns may seed an **anonymous** persona. Review this vocabulary before
adding other approved campaign codes; do not replace it with a free-form capture.

No raw URL query/hash, referrer, search, address/ZIP/coordinates, doctor/patient
details, form values, CUG codes, names or emails are forwarded. Known page paths
are allowlisted, referrer is the `none` redaction sentinel, and link URLs contain
only the origin; stable names carry intent. The Analytics adapter adds no IP lookup, geolocation request,
identity enrichment, hashing/fingerprinting or new external enrichment service
is added. Native AppMeasurement browser/session handling occurs only after
consent. This is separate from pre-existing EDS RUM/Target/demo-profile behavior.

## SureSmile live insights

Add **`?insights=1`** (or `&insights=1`) to open a SureSmile-branded nonmodal
slide-over. Close/Escape restores focus; its reopen control remains available in
the tab session. Activation and dismissal persist in tab-scoped
`sessionStorage['suresmile.insights.session.v1']`; ordinary same-origin navigation
and reload need no repeated query. Close dismisses, without withdrawing consent;
reopen restores the panel. `?insights=0` disables activation and clears the
profile cache/permission. A later `?insights=1` opts in again. No URL parameters,
auth/CUG values or employee authorization are copied to the session marker.
Unavailable session storage is reported and falls back to this document only.
The panel only shows this visitor's safe local diagnostics.
Compact hit/component/link/scroll counters precede one rounded **VISITOR**
card, initially expanded like XSC. Its native summary toggles with mouse, Enter
or Space; it does not fetch
profile data. A blue location badge reflects actual city/state-region/country
only after explicit profile display; otherwise it says Local only. CDN network
fields and reported browser/device fields live inside that same card. Other
activity/journey details are collapsed, without a section-navigation toolbar.
The four tiles and counted component/link bars follow the XSC layout with
SureSmile branding. Browser rows remain available without Analytics or profile
consent. They come first while no profile is displayed; the CDN group comes
first only when actual consented profile data is available.
Opening/closing focus preserves the underlying page's scroll position.

It consumes the adapter's same data-layer/transport stream, without another
click listener or beacon. Its rolling 30-record buffer distinguishes:

- **Observed**: local data-layer entry.
- **Requested**: `s.t()`/`s.tl()` returned; not proof of dispatch.
- **Dispatched**: AppMeasurement's post-track callback fired; not Adobe receipt
  or report-processing confirmation. Without that hook, dispatch is unconfirmed.

Browser versions use the ordinary reported UA (which browsers may reduce);
OS/device family is reported, not verified. No high-entropy UA probes are used.
Viewport, screen/DPR, language, timezone/local time, coarse connection, DNT/GPC and consent are
transient local displays, not extra custom Analytics variables. Unsupported APIs
show unavailable. Persona/channel/actual variant and the exact eVar/prop mapping
are visible. Session status comes only from consented first-party visit state;
new/returning identity is explicitly not derived. The panel never reads forms,
raw visitor IDs, auth state, CUG codes or other users' information.
Withdrawing consent clears the local hit feed and pauses measurement.

### Optional requesting-visitor profile

Once Analytics consent is granted and the panel is open, the requesting
visitor's own profile loads automatically from the CDN; no extra click is
needed. Consent is still the gate: without Analytics consent nothing is
requested, and withdrawing consent clears the profile. Successful validated
minimal profile fields and snapshot time are saved only in
`sessionStorage['suresmile.visitor-profile.session.v1']`; the separate purpose
marker is `suresmile.visitor-profile.consent.v1`. Activated navigation/reload and
close/reopen restore that snapshot without another lookup or grant. Closing
cancels an unfinished request but preserves successful cached data. A failed
response is never cached. Snapshot time/source are labelled; **Refresh visitor
profile** requests a new snapshot explicitly, never live GPS.

**Hide location** (which also stops automatic reloads until the visitor asks again), Analytics withdrawal (including CMP denial), and
`?insights=0` immediately clear cached data and profile-purpose permission.
Invalid/unknown Analytics consent cannot restore it. Malformed/future-dated
cache data is rejected and visibly reported; storage failures are reported,
with page-only behavior. Tab-session expiration follows browser `sessionStorage`
semantics, not indefinite `localStorage`. After hiding or withdrawal the profile is not requested again until the
visitor re-shows it or re-grants consent. Browser/device fields are never cached.

The client requests only same-origin `GET /api/visitor-profile`, with no query,
`credentials: same-origin`, `cache: no-store` and redirects disallowed. Both
`private` and `no-store` response headers are required. The agreed JSON contract:

```json
{
  "ip": null,
  "city": null,
  "country": null,
  "region": null,
  "latitude": null,
  "longitude": null,
  "source": "cdn",
  "accuracy": "unavailable"
}
```

Present coordinates must be numeric, complete and in range, with accuracy
`approximate IP geolocation`. Country is the observed CDN code or country name.
Optional `region` is the actual Fastly subdivision code, not an inferred state
name. Older responses without it remain compatible. City and region appear
together; coordinates display two decimal places with an approximate IP-based
note. Unsupported postal, ASN and provider-network values are not collected or
invented. Browser effective connection is not labelled as a CDN network type.
Missing fields remain unavailable; malformed responses, missing privacy headers,
HTTP errors and an undeployed endpoint show a visible unavailable status. No
third-party lookup or geolocation permission is requested; this is not GPS,
precise physical location, or a profile of another visitor.

The response exists only in the private display controller and the explicitly
authorized tab cache. IP/city/region/country/
coordinates are never copied to the Analytics snapshot, local event feed,
`adobeDataLayer`, eVars/props/events, other storage, or logs. An abort signal and request
epoch prevent a late response from restoring revoked data. The backend runtime
and Fastly route must be deployed separately; UI installation cannot make an
unavailable endpoint return real fields.

### Local top-level observations

Only the explicitly opened insights feature activates these observers, and only
after Analytics consent. One shared delegated link handler feeds both the
existing guide-mapped Analytics tracker and separately typed **local** diagnostics.
The local summary includes AA transport totals, local event totals, unique
components, repeat component sightings, clicked links, current scroll position
and maximum scroll observed since consent. These are not extra Adobe events.

`IntersectionObserver` measures loaded `main .block` instances using EDS
`data-block-name`, at least 10% in viewport. Offscreen blocks are not counted.
Each instance has a transient sequence number; reentry increments sightings,
not unique count. Dynamic loaded blocks are registered; unsupported visibility
APIs show unavailable. Viewport visibility is not proof of reading or human
attention, and does not measure occlusion by overlays.

Scroll is clamped to 0-100%; a short page is explicitly **100% (whole page
visible)**, not a claimed scroll action. Current/max initialize at grant, not
from preconsent history. Links use stable allowlisted CTA/page names; unknown
destinations are redacted and raw link text/query strings are never recorded.
Current/max are updated continuously, but the technical feed records only newly
reached 25/50/75/100% milestones, not every percentage or backward movement.
Maximum never regresses within the document. The local record buffer holds 30
entries; link counts aggregate at most 30 recent destinations and component bars
aggregate real sightings. Summary counters retain totals.
Withdrawal disconnects observers/cancels animation frames and clears local
state. A new document starts new counters. Impressions/scroll never call the
SDK or enter the Adobe data layer; `event1`-`event9` stay exactly as specified.

### Coherent UI release loading

The EDS static response has a two-hour browser freshness lifetime. Fetching the
latest source does not replace modules already evaluated in an old open page.
The stable `v=insights-session-2` release URL spans the HTML entry, delayed/UI
dependencies and panel CSS, so normal fresh-document navigation loads a coherent
release instead of mixing cached generations. It is not a timestamp/random
cache buster. AEM's entry-script base-path detection accepts that query suffix.
The narrow ESLint URL-query exception accounts for Node resolution not
understanding browser module URLs; browser regressions exercise the actual
dependency graph. The shared Analytics singleton remains unchanged.

## Validation and release boundary

Use an isolated local browser, never a production visitor's storage:

```sh
python3 -m http.server 3039 --bind 127.0.0.1
```

Open `/tools/analytics/fixture.html`, then:

```js
await (await import('/tools/analytics/check-analytics.js')).default();
```

The test-only SDK spy records method arguments, not network beacons. It covers
exact mappings, six arrivals, legacy pages, visit attribution/expiry/reset,
channel-specific/dynamic links, event isolation, consent and late CMP changes,
withdraw-during-load, privacy, missing-SDK handling and the responsive insights
surface. Block external requests when automating. Real-SDK transport validation
must intercept and fulfill **all** `acsmarketing.sc.omtrdc.net` requests locally;
do not deliver test hits to the suite.

```sh
npx eslint scripts/analytics*.js scripts/insights.js scripts/visitor-profile.js scripts/delayed.js tools/analytics/check-analytics.js
npx stylelint styles/analytics-consent.css styles/insights.css
git diff --check
```

No production deployment is authorized by implementation alone. Keep this
change separate from pending demo/personalization files.

### Adobe admin / cross-site work still required

An Adobe Analytics administrator must enable/name eVars1-6, props1-4 and
events1-9, verify existing variable use, and set the guide's allocations/expiries:
eVars1/2/4 Most Recent/Visit, eVar3 Original/Visit, eVar5 Most Recent/Hit,
eVar6 Original/Visit. Configure the specified marketing-channel processing
rules, persona/channel/intent segments, Workspace progression and variant
panels, and appropriate exclusion of demo traffic from production KPI views.
None of these report-suite settings is provisioned by this repository.
In particular, Original/Visit channel allocation can retain a hub's initial
`direct` value for later conversions. `prop3` always captures the actual hit
channel; have the analyst validate allocation/processing rules against the
intended funnel rather than silently changing the guide's configuration.

The real gated discovery hub is now on **xsc-demo**, not SureSmile. A complete
cross-site funnel requires a separately approved xsc-demo slice: compatible
consent handling and the exact suite/mapping for hub event1, journey/channel
selection event2 and discovery event3. Keep the existing six outbound audience/
source URLs; do not propagate CUG codes or identity. Do not copy xsc-demo's
different event map into this suite or double-instrument its existing tracker.
SureSmile-only deployment cannot establish that full cross-site funnel.
