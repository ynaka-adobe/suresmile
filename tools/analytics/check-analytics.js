import initAnalytics from '../../scripts/analytics.js';
import initInsights, { browserInformation } from '../../scripts/insights.js';
import { validateProfile } from '../../scripts/visitor-profile.js';
import {
  buildContext, hitVariables, validVisit, VISIT_KEY, VISIT_TIMEOUT,
} from '../../scripts/analytics-context.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitFor(check, description) {
  const deadline = Date.now() + 10000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${description}`);
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => { window.setTimeout(resolve, 10); });
  }
}

/** Test-only SDK spy: records method arguments, never implements/sends beacons. */
export function fixture() {
  const calls = [];
  const accounts = [];
  let postTrack;
  const spy = {
    clearVars() {},
    registerPostTrackCallback(callback) { postTrack = callback; },
    t() {
      calls.push({
        method: 't',
        variables: JSON.parse(JSON.stringify(this)),
        dataLayer: JSON.parse(JSON.stringify(window.adobeDataLayer.at(-1))),
      });
      postTrack?.();
    },
    tl(skip, type, name) {
      calls.push({
        method: 'tl', skip, type, name, variables: JSON.parse(JSON.stringify(this)),
      });
      postTrack?.();
    },
  };
  window.s_gi = (account) => { accounts.push(account); return spy; };
  return {
    calls,
    spy,
    accounts,
    init(options = {}) {
      return initAnalytics({
        loadTracker: () => window.s_gi('acsmarketingsuresmile'),
        ...options,
      });
    },
    insights: initInsights,
    environment: browserInformation,
    allow() { document.querySelector('.analytics-consent button').click(); },
    deny() { document.querySelectorAll('.analytics-consent button')[1].click(); },
    openPreferences() { window.dispatchEvent(new CustomEvent('consent:open-preferences')); },
    move(path) { window.history.replaceState(null, '', path); },
    cmp(groups) {
      window.OneTrust = { ToggleInfoDisplay() {} };
      window.OnetrustActiveGroups = groups;
      window.dispatchEvent(new Event('OneTrustGroupsUpdated'));
    },
  };
}

function checkContexts() {
  const previous = {
    persona: 'endodontic',
    discovery: 'ai',
    campaign: 'endo-aligner-2026',
    utmSource: 'chatgpt',
    utmMedium: 'ai',
    updatedAt: Date.now(),
  };
  const base = 'https://suresmile.ynaka-adobe.com';
  Object.entries({ chatgpt: 'ai', seo: 'search-organic', ad: 'search-paid' }).forEach(([source, channel]) => {
    ['endodontic', 'implants'].forEach((audience) => {
      const hit = buildContext(new URL(`${base}/en-us?demo_audience=${audience}&demo_source=${source}`), null);
      assert(hit.persona.id === (audience === 'implants' ? 'implant' : audience), 'Arrival persona');
      assert(hit.channel.discovery === channel && hit.event === 'event4', 'Arrival channel/event');
      assert(hitVariables(hit).eVar4 === 'none', 'Never invent a personalized variant');
    });
  });
  [
    ['/en-us/customer-demo', 'event1'], ['/en-us/demo/endodontic-discovery', 'event3'],
    ['/en-us/demo/implant-discovery', 'event3'], ['/en-us/demo/endodontic', 'event4'],
    ['/en-us/demo/implants', 'event4'], ['/en-us/doctors', ''],
  ].forEach(([path, event]) => {
    assert(buildContext(new URL(base + path), null).event === event, path);
  });
  const downstream = buildContext(new URL(`${base}/en-us/doctors`), previous);
  assert(downstream.persona.id === 'endodontic' && downstream.channel.discovery === 'ai', 'Downstream attribution');
  const old = { ...previous, updatedAt: Date.now() - VISIT_TIMEOUT - 1 };
  assert(validVisit(old) === null, 'Inactive visits expire');
  ['?demo_audience=unknown', '?demo_audience=implants&demo_audience=endodontic', '?demo_reset=1'].forEach((query) => {
    const hit = buildContext(new URL(`${base}/en-us${query}`), previous);
    assert(hit.persona.id === 'none' && hit.channel.discovery === 'direct' && !hit.visit.campaign, 'Reset clears attribution');
  });
  const campaign = buildContext(new URL(`${base}/en-us?utm_campaign=endo-aligner-2026&utm_source=google&utm_medium=cpc&loggedin=1&crm=1`), null);
  assert(campaign.persona.id === 'endodontic' && campaign.persona.source === 'anonymous', 'Campaign seeding is anonymous');
  assert(campaign.channel.discovery === 'search-paid' && hitVariables(campaign).campaign === 'endo-aligner-2026', 'Campaign mapping');
  const privateURL = new URL(`${base}/en-us/find-a-doctor?address=94121&lat=37.78&lng=-122.49&code=secret-code&utm_campaign=private@example.invalid&utm_source=secret-code&utm_medium=94121#secret`);
  const serialized = JSON.stringify(hitVariables(buildContext(privateURL, null)));
  ['94121', '37.78', '-122.49', 'secret', 'private@'].forEach((value) => assert(!serialized.includes(value), 'Query privacy'));
  const nullable = {
    ip: null, city: null, country: null, latitude: null, longitude: null, source: 'cdn', accuracy: 'unavailable',
  };
  assert(validateProfile(nullable).latitude === null, 'Unavailable CDN coordinates remain null');
  assert(validateProfile({ ...nullable, ip: '2001:db8::1' }).ip === '2001:db8::1', 'IPv6 profile shape');
  [{ ip: '999.1.1.1' }, { ip: '::::' }, { latitude: 91, longitude: 0 },
    { latitude: 0, longitude: null }, { country: 'Bad\nField' }].forEach((invalid) => {
    let rejected = false;
    try { validateProfile({ ...nullable, ...invalid }); } catch { rejected = true; }
    assert(rejected, 'Invalid profile response must fail clearly');
  });
}

/** Run in a local, isolated browser; no licensed SDK or production hits required. */
export default async function checkAnalytics() {
  assert(['localhost', '127.0.0.1'].includes(window.location.hostname), 'Use isolated local preview');
  checkContexts();
  const results = ['context, routes, six arrivals, campaign privacy and visit expiry'];
  let frame;
  async function setup(path = '/en-us?demo_audience=implants&demo_source=seo&insights=1', preserve = false) {
    frame?.remove();
    // This test must run in a disposable browser: clears only this implementation's keys.
    if (!preserve) {
      localStorage.removeItem('suresmile.analytics.consent.v1');
      sessionStorage.removeItem(VISIT_KEY);
    }
    frame = document.createElement('iframe');
    frame.title = 'Isolated Analytics regression fixture';
    frame.style.cssText = 'position:fixed;inset:0;width:390px;height:740px;z-index:20000;background:white';
    const loaded = new Promise((resolve) => { frame.onload = resolve; });
    frame.src = '/tools/analytics/fixture.html';
    document.body.append(frame);
    await loaded;
    const doc = frame.contentDocument;
    const script = doc.createElement('script');
    script.type = 'module';
    script.textContent = `history.replaceState(null,'',${JSON.stringify(path)});const m=await import('${window.location.origin}/tools/analytics/check-analytics.js');window.fixture=m.fixture();`;
    doc.head.append(script);
    await waitFor(() => frame.contentWindow.fixture, 'Fixture module');
    doc.addEventListener('click', (event) => {
      if (event.target.closest('a')) {
        assert(!event.defaultPrevented, 'Adapter does not break navigation');
        event.preventDefault();
      }
    });
    return { doc, win: frame.contentWindow, test: frame.contentWindow.fixture };
  }
  try {
    let { doc, win, test } = await setup();
    let controller = test.init();
    test.insights(controller);
    assert(!win.adobeDataLayer && !test.calls.length && !test.accounts.length, 'No preconsent SDK/beacons/dataLayer');
    assert(!win.sessionStorage.getItem(VISIT_KEY), 'No preconsent attribution storage');
    assert(!doc.querySelector('#suresmile-insights').hidden, 'Explicit query opens panel');
    await waitFor(() => win.getComputedStyle(doc.querySelector('#suresmile-insights')).position === 'fixed', 'Insights stylesheet');
    assert(doc.activeElement.getAttribute('aria-label') === 'Close SureSmile live insights', 'Panel opening focus');
    assert(win.scrollY === 0, 'Opening booklet never scrolls the underlying page');
    [...doc.querySelectorAll('.suresmile-insights-nav button')]
      .find((button) => button.textContent === 'Profile').click();
    assert(doc.activeElement.textContent === 'Visitor profile - optional CDN display', 'Profile navigation focus');
    assert(win.scrollY === 0, 'Section navigation scrolls booklet only');
    assert(doc.querySelector('#suresmile-insights').textContent.includes('Paused'), 'Preconsent panel paused');
    assert(!doc.querySelector('#suresmile-insights').textContent.includes('secret'), 'Panel redaction');
    assert(doc.querySelector('#suresmile-insights').getBoundingClientRect().width <= 390, 'Mobile panel width');
    frame.style.width = '320px';
    await waitFor(() => win.innerWidth === 320, 'Narrow mobile viewport');
    const bounds = doc.querySelector('.analytics-consent').getBoundingClientRect();
    assert(bounds.left >= 0 && bounds.right <= 320, 'Consent controls do not overflow mobile');
    assert(doc.querySelector('#suresmile-insights').getBoundingClientRect().right <= 320, 'Insights narrow-mobile bounds');
    doc.querySelector('#suresmile-insights button').click();
    assert(doc.querySelector('#suresmile-insights').hidden, 'Close');
    doc.querySelector('.suresmile-insights-toggle').click();
    doc.querySelector('#suresmile-insights').dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert(doc.querySelector('#suresmile-insights').hidden, 'Escape close');
    test.deny();
    assert(!test.calls.length && !test.accounts.length, 'Denial stays off');
    test.openPreferences();
    test.allow();
    await controller.ready();
    assert(test.calls.length === 1 && test.accounts[0] === 'acsmarketingsuresmile', 'One consented page view to exact suite');
    assert(test.calls[0].dataLayer.event === 'pageView', 'Data layer precedes SDK call');
    const page = test.calls[0].variables;
    assert(page.eVar1 === 'implant' && page.eVar2 === 'anonymous' && page.eVar3 === 'search-organic', 'Exact persona mapping');
    assert(page.events === 'event4' && page.eVar4 === 'none' && page.eVar5 === 'landing', 'Page mapping without fake variant');
    assert(page.trackingServer === 'acsmarketing.sc.omtrdc.net' && page.visitorNamespace === 'acsmarketing', 'SDK configuration');
    assert(!page.trackExternalLinks && !page.trackDownloadLinks && page.useBeacon, 'No auto link doubles; beacon transport');
    assert(test.init() === controller && doc.querySelectorAll('.analytics-consent').length === 1, 'Initialization deduplicated');
    await controller.ready();
    assert(test.calls.length === 1, 'Page view deduplicated');
    const links = [...doc.querySelectorAll('main a')];
    links.forEach((link) => link.click());
    assert(test.calls.slice(1).map((call) => call.variables.events).join(',') === 'event8,event9,event7,event5,event6', 'Value events match guide');
    assert(test.calls[3].type === 'd' && test.calls[4].type === 'e', 'Download and exit hit types');
    assert(test.calls.slice(1).every((call) => call.skip === true && !call.variables.linkURL.includes('?')), 'Navigation-safe, sanitized links');
    assert(test.calls[1].variables.linkTrackVars.includes('eVar2') && test.calls[1].variables.linkTrackEvents === 'event8', 'Explicit link variables/events');
    assert(test.spy.events === '' && test.spy.prop4 === '' && test.spy.linkTrackVars === 'None', 'Hit state cleared');
    const dynamic = doc.createElement('a');
    dynamic.href = '/en-us?demo_audience=endodontic&demo_source=chatgpt';
    dynamic.textContent = 'AI result';
    doc.querySelector('main').append(dynamic);
    dynamic.click();
    const selected = test.calls.at(-1).variables;
    assert(selected.events === 'event2' && selected.eVar1 === 'endodontic' && selected.eVar3 === 'ai', 'Dynamic journey selection');
    const beforeInvalidTags = test.calls.length;
    ['analyticsEvent', 'analyticsCta', 'analyticsPersona', 'analyticsChannel'].forEach((attribute) => {
      const invalid = dynamic.cloneNode(true);
      invalid.dataset[attribute] = 'unsupported-value';
      doc.querySelector('main').append(invalid);
      invalid.click();
      invalid.remove();
    });
    assert(test.calls.length === beforeInvalidTags, 'Unsupported explicit event, CTA, persona and channel tags cannot send hits');
    const body = doc.querySelector('#suresmile-insights').textContent;
    assert(body.includes('eVar1 / prop2') && body.includes('Journey selected') && body.includes('dispatched:'), 'Same-stream insights updates');
    assert(!body.includes('secret') && !body.includes('private@'), 'Event-feed privacy');
    doc.querySelector('.suresmile-insights-toggle').click();
    const summary = doc.querySelector('#suresmile-insights details summary');
    summary.click();
    summary.focus();
    win.dispatchEvent(new Event('resize'));
    assert(doc.activeElement === summary && summary.parentElement.open, 'Live refresh preserves keyboard/read state');
    const count = test.calls.length;
    test.openPreferences();
    test.deny();
    links[0].click();
    assert(test.calls.length === count && !win.sessionStorage.getItem(VISIT_KEY), 'Withdrawal stops hits and clears visit');
    assert(controller.snapshot().records.length === 0 && !win.adobeDataLayer.length, 'Withdraw clears owned local history, no replay');
    test.openPreferences();
    test.allow();
    await controller.ready();
    assert(test.calls.length === count, 'Regrant does not duplicate page view');
    test.cmp(',C0001,');
    links[0].click();
    assert(test.calls.length === count && controller.snapshot().consent === 'denied', 'Late CMP overrides local grant');
    test.cmp(',C0001,C0002,');
    await controller.ready();
    links[0].click();
    assert(test.calls.length === count + 1, 'CMP C0002 enables future hits only');
    results.push('consent lifecycle, CMP precedence, exact page/link mapping, dynamic tags, hit isolation');
    results.push('insights query, keyboard, mobile, shared stream, privacy and no duplicate hits');

    ({ doc, win, test } = await setup('/en-us/doctors', true));
    controller = test.init();
    test.insights(controller);
    assert(!doc.querySelector('#suresmile-insights'), 'Absent query keeps insights off');
    await controller.ready();
    assert(test.calls[0].variables.eVar1 === 'implant' && test.calls[0].variables.eVar3 === 'search-organic', 'Visit attribution across documents');
    const providerSection = doc.createElement('div');
    providerSection.className = 'columns-media-text';
    providerSection.innerHTML = '<h2 id="interested-in-becoming-a-provider">Interested in becoming a provider?</h2><p><a href="/en-us/doctors/contact">Contact Us</a></p>';
    doc.querySelector('main').append(providerSection);
    providerSection.querySelector('a').click();
    assert(test.calls.at(-1).variables.events === 'event9', 'Actual doctor-page provider section');
    test.move('/en-us?demo_audience=unknown&code=secret');
    providerSection.querySelector('a').click();
    assert(test.calls.at(-1).variables.eVar1 === 'none' && test.calls.at(-1).variables.eVar3 === 'direct', 'Unknown audience resets stored attribution');
    const standard = doc.createElement('div');
    standard.className = 'demo-audience-navigation';
    standard.innerHTML = '<a href="/en-us">View standard SureSmile experience</a>';
    doc.querySelector('main').append(standard);
    standard.querySelector('a').click();
    assert(!win.sessionStorage.getItem(VISIT_KEY), 'Standard-experience return clears visit attribution');
    results.push('cross-document attribution, unknown/reset and actual provider-section tagging');

    ({ doc, win, test } = await setup('/en-us/demo/endodontic-discovery'));
    controller = test.init();
    test.allow();
    await controller.ready();
    assert(test.calls[0].variables.events === 'event3', 'Discovery page view');
    const channels = doc.createElement('div');
    channels.className = 'demo-discovery';
    channels.innerHTML = '<div class="demo-cell"><p>Channel A / Simulated AI answer</p><p><a href="/en-us/demo/endodontic">AI</a></p></div><div class="demo-cell"><p>Sponsored - Simulated ad</p><h3><a href="/en-us/demo/endodontic">Ad</a></h3><p>Organic - Simulated SEO result</p><h3><a href="/en-us/demo/endodontic">SEO</a></h3></div>';
    doc.querySelector('main').append(channels);
    channels.querySelectorAll('a').forEach((link) => link.click());
    assert(test.calls.slice(1).map((call) => call.variables.eVar3).join(',') === 'ai,search-paid,search-organic', 'Each discovery link captures its own channel');
    assert(test.calls.slice(1).every((call) => call.variables.events === 'event2'), 'Discovery selection event');
    results.push('legacy discovery channel-specific declarative tags');

    ({ doc, win, test } = await setup('/en-us/doctors?insights=0'));
    controller = test.init();
    test.insights(controller);
    assert(!doc.querySelector('#suresmile-insights'), 'No query opt-in means no panel');
    test.allow();
    await controller.ready();
    const marker = doc.createElement('div');
    marker.dataset.analyticsVariant = 'heroA-endo-v1';
    doc.querySelector('main').append(marker);
    doc.querySelector('main a').click();
    assert(test.calls.at(-1).variables.eVar4 === 'heroA-endo-v1', 'Actual rendered variant only');
    test.move('/en-us/how-it-works');
    doc.querySelector('main a').click();
    assert(test.calls.at(-1).variables.eVar1 === 'none', 'No invented persona');
    results.push('no-trigger panel and actual DOM variant signal');

    ({ win, test } = await setup('/en-us?insights=1&code=secret&address=94121'));
    controller = test.init();
    Object.defineProperty(win.navigator, 'userAgent', { configurable: true, value: '' });
    Object.defineProperty(win.navigator, 'connection', { configurable: true, value: undefined });
    Object.defineProperty(win.navigator, 'language', { configurable: true, value: '' });
    Object.defineProperty(win.navigator, 'globalPrivacyControl', { configurable: true, value: true });
    test.insights(controller);
    const environment = test.environment();
    assert(environment.some(([key, value]) => key === 'Browser (reported)' && value === 'Unavailable'), 'Browser fallback');
    assert(environment.some(([key, value]) => key === 'Connection (coarse)' && value === 'Unavailable'), 'Connection fallback');
    assert(environment.some(([key, value]) => key === 'Global Privacy Control' && value === 'true'), 'GPC is reported, not equated with consent');
    assert(controller.snapshot().consent === 'unknown' && !test.accounts.length && !win.sessionStorage.getItem(VISIT_KEY), 'Diagnostics do not grant consent');
    results.push('environment API fallbacks, GPC and preconsent diagnostics privacy');

    ({ doc, win, test } = await setup('/en-us?insights=1'));
    controller = test.init();
    let profileRequests = 0;
    let requestOptions;
    const profileData = {
      ip: '198.51.100.27',
      city: 'Fixture City',
      country: 'ZZ',
      latitude: 12.345,
      longitude: 67.89,
      source: 'cdn',
      accuracy: 'approximate IP geolocation',
    };
    const profileResponse = () => new win.Response(JSON.stringify(profileData), {
      status: 200, headers: { 'cache-control': 'private, no-store', 'content-type': 'application/json' },
    });
    win.fetch = async (url, options) => {
      assert(url === '/api/visitor-profile', 'Only same-origin own-profile endpoint');
      profileRequests += 1;
      requestOptions = options;
      return profileResponse();
    };
    test.insights(controller);
    const profileButton = () => doc.querySelector('.suresmile-visitor-profile button');
    assert(profileButton().disabled && profileRequests === 0, 'No profile request before consent');
    test.allow();
    await controller.ready();
    assert(profileRequests === 0, 'Analytics-only consent never assumes profile purpose');
    profileButton().click();
    profileButton().click();
    await waitFor(() => doc.querySelector('.suresmile-visitor-profile').textContent.includes(profileData.ip), 'Explicit profile display');
    assert(profileRequests === 1 && requestOptions.cache === 'no-store'
      && requestOptions.credentials === 'same-origin' && requestOptions.redirect === 'error', 'One uncached own-profile request');
    const noProfileInTracking = () => {
      const serialized = JSON.stringify({
        calls: test.calls,
        layer: win.adobeDataLayer,
        snapshot: controller.snapshot(),
        local: { ...win.localStorage },
        session: { ...win.sessionStorage },
      });
      [profileData.ip, profileData.city,
        String(profileData.latitude), String(profileData.longitude)]
        .forEach((value) => {
          assert(!serialized.includes(value), 'Profile values stay outside tracking/storage');
        });
    };
    doc.querySelector('main a').click();
    noProfileInTracking();
    doc.querySelector('.suresmile-visitor-profile button:last-child').click();
    assert(!doc.querySelector('.suresmile-visitor-profile').textContent.includes(profileData.ip), 'Remove clears profile display');
    let resolveProfile;
    win.fetch = (url, options) => {
      profileRequests += 1;
      requestOptions = options;
      return new Promise((done) => { resolveProfile = done; });
    };
    profileButton().click();
    test.openPreferences();
    test.deny();
    assert(requestOptions.signal.aborted, 'Withdraw cancels profile request');
    resolveProfile(profileResponse());
    await new Promise((done) => { window.setTimeout(done, 20); });
    assert(!doc.querySelector('.suresmile-visitor-profile').textContent.includes(profileData.ip), 'Late response cannot restore withdrawn profile');
    test.openPreferences();
    test.allow();
    await controller.ready();
    assert(profileRequests === 2, 'Regrant does not replay profile consent');
    win.fetch = async () => new win.Response(JSON.stringify(profileData), { status: 200 });
    profileButton().click();
    await waitFor(() => doc.querySelector('.suresmile-visitor-profile').textContent.includes('could not be verified'), 'Missing private/no-store error');
    win.fetch = async () => profileResponse();
    profileButton().click();
    await waitFor(() => doc.querySelector('.suresmile-visitor-profile').textContent.includes(profileData.ip), 'Explicit profile retry');
    doc.querySelector('#suresmile-insights button').click();
    doc.querySelector('.suresmile-insights-toggle').click();
    assert(!doc.querySelector('.suresmile-visitor-profile').textContent.includes(profileData.ip), 'Close/reopen clears transient profile and does not reuse it');
    noProfileInTracking();
    results.push('explicit new-scope profile consent, no-store, withdrawal/races/retry and privacy separation');

    ({ doc, win, test } = await setup('/en-us?insights=1'));
    const seenBlock = doc.createElement('div');
    seenBlock.className = 'block';
    seenBlock.dataset.blockName = 'hero-split';
    seenBlock.dataset.blockStatus = 'loaded';
    seenBlock.style.cssText = 'height:120px; background:white';
    const unseenBlock = seenBlock.cloneNode();
    unseenBlock.dataset.blockName = 'columns';
    unseenBlock.style.cssText = 'position:absolute;top:2000px;height:120px;width:100px';
    doc.querySelector('main').append(seenBlock, unseenBlock);
    controller = test.init();
    test.insights(controller);
    assert(!controller.snapshot().observations.active
      && !controller.snapshot().observations.components.length, 'No preconsent behavioral observations');
    test.allow();
    await controller.ready();
    await waitFor(() => controller.snapshot().observations.components.length === 1, 'Actual viewport component');
    assert(controller.snapshot().observations.components[0].name === 'hero-split', 'Offscreen block is not counted');
    const dynamicBlock = seenBlock.cloneNode();
    dynamicBlock.dataset.blockName = 'cards';
    doc.querySelector('main').append(dynamicBlock);
    await waitFor(() => controller.snapshot().observations.components.length === 2, 'Dynamic loaded block visibility');
    seenBlock.style.display = 'none';
    await new Promise((done) => { window.setTimeout(done, 100); });
    seenBlock.style.display = 'block';
    await waitFor(() => controller.snapshot().observations.sightings >= 3, 'Repeat component sighting');
    assert(controller.snapshot().observations.components.length === 2, 'Unique instances differ from repeat sightings');
    doc.querySelector('main a').click();
    const beforeOtherLink = test.calls.length;
    const unsafeLink = doc.createElement('a');
    unsafeLink.href = 'https://private-id.invalid/patient?code=secret&address=94121';
    unsafeLink.textContent = 'PatientName-94121';
    doc.querySelector('main').append(unsafeLink);
    unsafeLink.click();
    assert(test.calls.length === beforeOtherLink, 'Unmapped local click creates no Adobe event');
    assert(controller.snapshot().observations.clicks === 2, 'One shared delegated observer per click');
    const localSerialized = JSON.stringify(controller.snapshot().observations);
    ['secret', '94121', 'PatientName', 'private-id'].forEach((value) => assert(!localSerialized.includes(value), 'Local link redaction'));
    assert(win.adobeDataLayer.every((entry) => ['pageView', 'linkClick'].includes(entry.event)), 'No impressions or scroll in Adobe data layer');
    win.scrollTo(0, doc.documentElement.scrollHeight);
    await waitFor(() => controller.snapshot().observations.scroll.current === 100, 'Scroll to end');
    win.scrollTo(0, 0);
    await waitFor(() => controller.snapshot().observations.scroll.current === 0, 'Scroll position changes');
    assert(controller.snapshot().observations.scroll.maximum === 100, 'Maximum scroll retained');
    unseenBlock.remove();
    unsafeLink.remove();
    win.dispatchEvent(new Event('resize'));
    await waitFor(() => controller.snapshot().observations.scroll.wholePageVisible, 'Whole short page visible');
    assert(controller.snapshot().observations.scroll.current === 100, 'Short page labels complete visibility');
    test.openPreferences();
    test.deny();
    const paused = controller.snapshot().observations;
    assert(!paused.active && !paused.components.length && !paused.links.length
      && !paused.records.length && paused.totalEvents === 0, 'Withdrawal disconnects and clears behavioral diagnostics');
    results.push('real viewport visibility, repeats/dynamic blocks, local-only links, scroll edge cases and withdrawal');

    ({ doc, win, test } = await setup());
    let resolve;
    const pending = new Promise((done) => { resolve = done; });
    controller = test.init({ loadTracker: () => pending });
    test.allow();
    await new Promise((done) => { window.setTimeout(done, 0); });
    test.openPreferences();
    test.deny();
    resolve(test.spy);
    await new Promise((done) => { window.setTimeout(done, 20); });
    assert(test.calls.length === 0 && controller.snapshot().sdkStatus === 'waiting-for-consent', 'Withdraw during SDK load cannot send');
    results.push('withdraw-in-flight race');

    ({ doc, test } = await setup());
    controller = test.init({ loadTracker: () => Promise.reject(new Error('Test unavailable SDK')) });
    test.allow();
    await controller.ready();
    assert(controller.snapshot().sdkStatus === 'unavailable' && !test.calls.length, 'Missing licensed SDK is honest and fail-closed');
    results.push('official SDK unavailable boundary');

    ({ doc, test } = await setup());
    test.spy.t = () => { throw new Error('SDK test failure'); };
    controller = test.init();
    test.allow();
    await controller.ready();
    assert(!doc.querySelector('.analytics-consent').hidden && doc.querySelector('.analytics-consent-status').textContent.includes('unavailable'), 'SDK failure is visible, not success-shaped');
    assert(controller.snapshot().records.some((record) => record.stage === 'failed'), 'SDK failure is distinct from dispatch');
    results.push('visible SDK hit failure');
    return results;
  } finally {
    frame?.remove();
    localStorage.removeItem('suresmile.analytics.consent.v1');
    sessionStorage.removeItem(VISIT_KEY);
  }
}
