import { matchedVariantId } from './audiences.js';
import createConsent from './analytics-consent.js?v=insights-session-2';
import createObservations from './analytics-observations.js?v=insights-session-2';
import {
  buildContext, clickContext, hitVariables, normalizePersona, validVisit, VISIT_KEY, CHANNELS,
} from './analytics-context.js';

const INSTANCE = Symbol.for('suresmile.analytics');
const RSID = 'acsmarketingsuresmile';
const CLICK_EVENTS = ['event2', 'event5', 'event6', 'event7', 'event8', 'event9'];
const LABELS = ['journey-endodontic', 'journey-implant', 'direct-landing', 'ai-answer',
  'sponsored-ad', 'organic-result', 'official-source', 'suresmile-crosslink',
  'download-white-paper', 'contact-us', 'become-provider'];

function warn(message) {
  // Never include URLs, query strings, SDK errors or user-provided values.
  // eslint-disable-next-line no-console
  console.warn(`analytics: ${message}`);
}

async function loadTracker(signal) {
  if (signal.aborted) throw new Error('SDK loading cancelled');
  if (typeof window.s_gi !== 'function') {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('../deps/analytics/AppMeasurement.js', import.meta.url).href;
      script.nonce = document.querySelector('script[nonce]')?.nonce || '';
      script.async = true;
      let timer;
      const cancel = () => {
        signal.removeEventListener('abort', cancel);
        window.clearTimeout(timer);
        script.remove();
        reject(new Error('SDK loading cancelled'));
      };
      timer = window.setTimeout(cancel, 10000);
      signal.addEventListener('abort', cancel, { once: true });
      script.onload = () => {
        signal.removeEventListener('abort', cancel);
        window.clearTimeout(timer);
        resolve();
      };
      script.onerror = () => {
        signal.removeEventListener('abort', cancel);
        window.clearTimeout(timer);
        script.remove();
        reject(new Error('SDK unavailable'));
      };
      document.head.append(script);
    });
  }
  if (signal.aborted) throw new Error('SDK loading cancelled');
  if (typeof window.s_gi !== 'function') throw new Error('SDK unavailable');
  return window.s_gi(RSID);
}

function configure(s) {
  if (!s || !['t', 'tl', 'clearVars'].every((name) => typeof s[name] === 'function')) {
    throw new Error('Invalid AppMeasurement instance');
  }
  Object.assign(s, {
    trackingServer: 'acsmarketing.sc.omtrdc.net',
    trackingServerSecure: 'acsmarketing.sc.omtrdc.net',
    visitorNamespace: 'acsmarketing',
    charSet: 'UTF-8',
    currencyCode: 'USD',
    trackDownloadLinks: false,
    trackExternalLinks: false,
    trackInlineStats: false,
    trackOffline: false,
    linkLeaveQueryString: false,
    usePlugins: false,
    useBeacon: true,
    disableThirdPartyCookies: true,
    cookieLifetime: 'SESSION',
  });
  if (s.ActivityMap) {
    s.ActivityMap.link = () => null;
    s.ActivityMap.region = () => null;
  }
  return s;
}

function inferDiscovery(link, target) {
  const source = target.searchParams.get('demo_source');
  if (source === 'chatgpt') return ['ai', 'ai-answer'];
  if (source === 'seo') return ['search-organic', 'organic-result'];
  if (source === 'ad') return ['search-paid', 'sponsored-ad'];
  const cell = link.closest('.demo-discovery .demo-cell');
  if (/^Channel A \/ Simulated AI answer$/.test(cell?.firstElementChild?.textContent.trim() || '')) {
    return ['ai', 'ai-answer'];
  }
  const label = link.closest('h3')?.previousElementSibling?.textContent.trim() || '';
  if (cell && /^Sponsored\b/.test(label)) return ['search-paid', 'sponsored-ad'];
  if (cell && /^Organic\b/.test(label)) return ['search-organic', 'organic-result'];
  return ['direct', 'direct-landing'];
}

function tagLink(link, page) {
  if (link.hasAttribute('data-analytics-event')) return;
  let url;
  try { url = new URL(link.href); } catch { return; }
  if (!['https:', 'http:'].includes(url.protocol)) return;
  const sameSite = url.origin === window.location.origin;
  const path = url.pathname.replace(/\/+$/, '');
  const target = buildContext(url, null);
  let event;
  let cta;
  if (sameSite && ['landing', 'discovery'].includes(target.page.type)) {
    event = 'event2';
    const [channel, label] = inferDiscovery(link, url);
    cta = target.page.type === 'discovery' ? `journey-${target.persona.id}` : label;
    link.dataset.analyticsPersona = target.persona.id;
    link.dataset.analyticsChannel = channel;
  } else if (/(^|\.)dentsplysirona\.com$/i.test(url.hostname)) {
    event = 'event5';
    cta = 'official-source';
  } else if (sameSite && path === '/en-us/how-it-works' && page.section === 'doctors-demo') {
    event = 'event6';
    cta = 'suresmile-crosslink';
  } else if (sameSite && /^\/assets\/files\/suresmile-white-paper-[a-z0-9-]+(?:\.pdf)?$/i.test(path)) {
    event = 'event7';
    cta = 'download-white-paper';
  } else if (sameSite && path === '/en-us/doctors/contact') {
    const provider = /becom(?:e|ing) (?:a )?provider/i.test(link.textContent)
      || Boolean(link.closest('.columns-media-text')
        ?.querySelector('#interested-in-becoming-a-provider'));
    event = provider ? 'event9' : 'event8';
    cta = provider ? 'become-provider' : 'contact-us';
  }
  if (event) {
    link.dataset.analyticsEvent = event;
    link.dataset.analyticsCta = cta;
  }
  if (sameSite && path === '/en-us' && !url.searchParams.has('demo_audience')
    && link.closest('.demo-audience-navigation')) link.dataset.analyticsReset = 'true';
}

/**
 * One instance per document, including DA reinitialization. loadTracker is an
 * isolated-test seam; production always loads the licensed core SDK above.
 */
export default function initAnalytics({ loadTracker: acquireTracker = loadTracker } = {}) {
  if (window[INSTANCE]) return window[INSTANCE];
  let tracker;
  let loading;
  let pageSent = false;
  let pageAttempted = false;
  let consent;
  let consentEpoch = 0;
  let activeLoad;
  let sdkStatus = 'waiting-for-consent';
  let diagnostics = [];
  let diagnosticTotals = { observed: 0, requested: 0, dispatched: 0 };
  let localDiagnosticsEnabled = false;
  let observations;
  const subscribers = new Set();
  const ownedEntries = new Set();

  function removeVisit() {
    try { sessionStorage.removeItem(VISIT_KEY); } catch { warn('visit storage unavailable'); }
  }
  function readVisit() {
    try {
      const stored = sessionStorage.getItem(VISIT_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      warn('visit storage unavailable or invalid');
      return null;
    }
  }
  function saveVisit(visit) {
    try {
      sessionStorage.setItem(VISIT_KEY, JSON.stringify(visit));
    } catch { warn('visit storage unavailable'); }
  }
  function context(includeVisit = true) {
    const variant = document.querySelector('main [data-analytics-variant]')?.dataset.analyticsVariant
      || matchedVariantId();
    return buildContext(new URL(window.location.href), includeVisit ? readVisit() : null, variant);
  }
  function snapshot() {
    const granted = consent.granted();
    let session = 'Not measured before consent';
    if (granted) {
      session = validVisit(readVisit())
        ? 'Active consented visit; anonymous' : 'No stored analytics visit';
    }
    return {
      consent: consent.status(),
      consentSource: consent.source(),
      sdkStatus,
      context: context(granted),
      session,
      records: [...diagnostics],
      totals: { ...diagnosticTotals },
      observations: observations.snapshot(),
    };
  }
  function notify(stage, detail) {
    if (stage && consent.granted()) {
      if (Object.hasOwn(diagnosticTotals, stage)) diagnosticTotals[stage] += 1;
      diagnostics.push({ stage, detail, time: Date.now() });
      diagnostics = diagnostics.slice(-30);
    }
    subscribers.forEach((listener) => {
      try { listener(snapshot()); } catch { warn('diagnostic consumer failed; transport unaffected'); }
    });
  }
  observations = createObservations(() => notify());
  function clearHit() {
    tracker.clearVars();
    const empty = hitVariables(buildContext(new URL(window.location.origin), null));
    Object.keys(empty).forEach((key) => {
      tracker[key] = key === 'contextData' ? {} : '';
    });
    tracker.linkURL = '';
    tracker.linkTrackVars = 'None';
    tracker.linkTrackEvents = 'None';
  }
  function send(hit, link) {
    if (!tracker || !consent.granted()) return false;
    try {
      clearHit();
      const variables = hitVariables(hit, link?.event ?? hit.event, link?.cta || '');
      Object.assign(tracker, variables);
      tracker.abort = false;
      window.adobeDataLayer = window.adobeDataLayer || [];
      const entry = {
        event: link ? 'linkClick' : 'pageView',
        page: { ...hit.page },
        persona: { ...hit.persona },
        channel: { ...hit.channel },
        ...(link ? { cta: { id: link.cta, event: link.event } } : {}),
      };
      ownedEntries.add(entry);
      window.adobeDataLayer.push(entry);
      notify('observed', { entry, variables });
      if (link) {
        tracker.linkURL = link.url;
        tracker.linkTrackVars = [...Object.keys(variables).filter((key) => key !== 'contextData'),
          'contextData.campaign.source', 'contextData.campaign.medium', 'linkURL'].join(',');
        tracker.linkTrackEvents = link.event;
        tracker.tl(true, link.type, link.cta);
      } else {
        tracker.t();
        pageSent = true;
      }
      notify('requested', { method: link ? 's.tl()' : 's.t()', variables });
      saveVisit(hit.visit);
      return true;
    } catch {
      warn('hit failed; no retry or queued replay');
      consent.setStatus('Analytics is unavailable. Please try again later.', true);
      notify('failed');
      return false;
    } finally {
      clearHit();
    }
  }
  async function enable() {
    if (!consent.granted()) return;
    if (acquireTracker === loadTracker && window.location.hostname !== 'suresmile.ynaka-adobe.com') {
      sdkStatus = 'preview-disabled';
      consent.setStatus('Analytics collection is disabled on preview hosts. Use the isolated validation harness.');
      notify();
      return;
    }
    const epoch = consentEpoch;
    try {
      if (!tracker) {
        if (!loading) {
          activeLoad = new AbortController();
          const { signal } = activeLoad;
          sdkStatus = 'loading';
          notify();
          loading = Promise.resolve().then(() => {
            if (signal.aborted || !consent.granted()) throw new Error('SDK loading cancelled');
            return acquireTracker(signal);
          }).then((s) => {
            if (signal.aborted || !consent.granted()) throw new Error('SDK loading cancelled');
            configure(s);
            if (typeof s.registerPostTrackCallback === 'function') {
              // No callback arguments/URLs are read or retained.
              s.registerPostTrackCallback(() => notify('dispatched'));
            }
            return s;
          });
        }
        const prepared = await loading;
        if (epoch !== consentEpoch || !consent.granted()) return;
        tracker = prepared;
      }
      if (!consent.granted()) { tracker.abort = true; return; }
      sdkStatus = 'ready';
      tracker.abort = false;
      if (!pageAttempted) {
        pageAttempted = true;
        if (!send(context())) return;
      }
      if (!pageSent) return;
      consent.setStatus('Analytics is on. Choose Keep analytics off to withdraw consent.');
      notify();
    } catch {
      if (epoch !== consentEpoch || !consent.granted()) return;
      loading = null;
      sdkStatus = 'unavailable';
      warn('official AppMeasurement.js is unavailable; collection remains off');
      consent.setStatus('Analytics could not start. No measurement data has been sent.', true);
      notify();
    }
  }
  const consentChanged = (granted) => {
    if (granted) {
      if (localDiagnosticsEnabled) observations.start();
      enable();
    } else {
      consentEpoch += 1;
      activeLoad?.abort();
      activeLoad = null;
      loading = null;
      if (tracker) { tracker.abort = true; clearHit(); }
      removeVisit();
      diagnostics = [];
      diagnosticTotals = { observed: 0, requested: 0, dispatched: 0 };
      observations.stop();
      if (Array.isArray(window.adobeDataLayer)) {
        for (let i = window.adobeDataLayer.length - 1; i >= 0; i -= 1) {
          if (ownedEntries.has(window.adobeDataLayer[i])) window.adobeDataLayer.splice(i, 1);
        }
      }
      ownedEntries.clear();
      sdkStatus = 'waiting-for-consent';
      notify();
    }
  };
  consent = createConsent(consentChanged);
  const { page } = buildContext(new URL(window.location.href), null);
  const outdatedClaims = [
    ['The audience choice is explicit; nothing is inferred or tracked.',
      'The audience choice is explicit. Optional journey analytics runs only with your consent.'],
    ['This is an explicitly selected journey, not a personalized profile or a tracked campaign.',
      'This is an explicitly selected journey. Optional journey analytics runs only with your consent.'],
    ['No live AI, ad buying, search ranking, audience tracking or clinical decision-making is part of this demo.',
      'No live AI, ad buying, search ranking or clinical decision-making is part of this demo. Optional journey analytics runs only with your consent.'],
  ];
  document.querySelectorAll('.demo-journey p').forEach((paragraph) => {
    outdatedClaims.forEach(([oldCopy, newCopy]) => {
      paragraph.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          node.textContent = node.textContent.replace(oldCopy, newCopy);
        }
      });
    });
  });
  const decorateLinks = (root) => root.querySelectorAll('a[href]').forEach((link) => tagLink(link, page));
  decorateLinks(document);
  const observer = new MutationObserver((changes) => {
    changes.forEach((change) => change.addedNodes.forEach((node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (node.matches('a[href]')) tagLink(node, page);
      decorateLinks(node);
    }));
  });
  observer.observe(document.body, { childList: true, subtree: true });

  const click = (event) => {
    if ((event.type === 'click' && event.button !== 0)
      || (event.type === 'auxclick' && event.button !== 1)) return;
    const link = event.target.closest?.('a[href]');
    if (!link || !consent.granted()) return;
    tagLink(link, page);
    const target = new URL(link.href);
    if (['http:', 'https:'].includes(target.protocol)) {
      const destination = buildContext(target, null);
      const known = target.origin === window.location.origin && destination.page.type !== 'other';
      const official = /(^|\.)dentsplysirona\.com$/i.test(target.hostname);
      let label = 'Other link';
      let href = 'Redacted';
      if (known) { label = destination.page.name; href = destination.pageURL; }
      if (official) href = `${target.origin}/`;
      if (LABELS.includes(link.dataset.analyticsCta)) label = link.dataset.analyticsCta;
      observations.link({
        label, href,
      });
    }
    if (link.dataset.analyticsReset === 'true') { removeVisit(); return; }
    const data = link.dataset;
    if (!data.analyticsEvent) return;
    if (!CLICK_EVENTS.includes(data.analyticsEvent) || !LABELS.includes(data.analyticsCta)
      || (data.analyticsPersona && !normalizePersona(data.analyticsPersona))
      || (data.analyticsChannel && !CHANNELS.includes(data.analyticsChannel))) {
      warn('unsupported event, CTA or audience tag; hit not sent');
      return;
    }
    const hit = clickContext(context(), data.analyticsPersona, data.analyticsChannel);
    if (!['http:', 'https:'].includes(target.protocol)) return;
    let type = target.origin === window.location.origin ? 'o' : 'e';
    if (data.analyticsEvent === 'event7') type = 'd';
    send(hit, {
      event: data.analyticsEvent,
      cta: data.analyticsCta,
      type,
      // Link names carry intent; no destination query, fragment or free-form path is sent.
      url: `${target.origin}${target.origin === window.location.origin ? '/' : ''}`,
    });
  };
  document.addEventListener('click', click, true);
  document.addEventListener('auxclick', click, true);
  const controller = {
    consent,
    ready: enable,
    enableLocalDiagnostics() {
      localDiagnosticsEnabled = true;
      if (consent.granted()) observations.start();
    },
    snapshot,
    subscribe(listener) {
      subscribers.add(listener);
      listener(snapshot());
      return () => subscribers.delete(listener);
    },
  };
  window[INSTANCE] = controller;
  consent.start();
  return controller;
}
