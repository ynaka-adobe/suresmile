import createVisitorProfile from './visitor-profile.js';

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export function browserInformation() {
  const ua = navigator.userAgent || '';
  const browser = [
    ['Edge', /Edg\/([\d.]+)/], ['Opera', /OPR\/([\d.]+)/], ['Firefox', /Firefox\/([\d.]+)/],
    ['Chrome', /Chrome\/([\d.]+)/], ['Safari', /Version\/([\d.]+).*Safari/],
  ].find(([, expression]) => expression.test(ua));
  let os = 'Unavailable';
  if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS X/.test(ua)) os = 'macOS';
  else if (/CrOS/.test(ua)) os = 'Chrome OS';
  else if (/Linux/.test(ua)) os = 'Linux';
  let timezone = 'Unavailable';
  let localTime = '';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || timezone;
    localTime = Intl.DateTimeFormat(undefined, {
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
    }).format(new Date());
  } catch { /* Optional browser API. */ }
  const languages = Array.isArray(navigator.languages) ? navigator.languages : [navigator.language];
  const language = languages
    .filter((value) => /^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8}){0,3}$/.test(value || ''))
    .slice(0, 5).join(', ') || 'Unavailable';
  const dnt = navigator.doNotTrack ?? window.doNotTrack;
  let dntLabel = 'Not reported';
  if (dnt === '1') dntLabel = 'Requested';
  if (dnt === '0') dntLabel = 'Not requested (reported)';
  let device = 'Unavailable';
  if (/iPad|Tablet/.test(ua)) device = 'Tablet (reported)';
  else if (navigator.userAgentData?.mobile || /Mobile|iPhone|Android/.test(ua)) device = 'Mobile (reported)';
  else if (os !== 'Unavailable') device = 'Desktop (reported)';
  const dpr = Number.isFinite(window.devicePixelRatio) && window.devicePixelRatio > 0
    ? ` @${window.devicePixelRatio}x` : '';
  return [
    ['Browser (reported)', browser ? `${browser[0]} ${ua.match(browser[1])[1]}` : 'Unavailable'],
    ['OS (reported)', os],
    ['Device type (reported)', device],
    ['Viewport', `${window.innerWidth} x ${window.innerHeight} CSS px`],
    ['Screen (reported)', window.screen?.width && window.screen?.height
      ? `${window.screen.width} x ${window.screen.height}${dpr} CSS px` : 'Unavailable'],
    ['Language', language],
    ['Timezone (reported)', `${timezone}${localTime ? ` | ${localTime}` : ''}`],
    ['Network', navigator.onLine === undefined ? 'Unavailable' : String(navigator.onLine ? 'Online' : 'Offline')],
    ['Connection (coarse)', ['slow-2g', '2g', '3g', '4g'].includes(navigator.connection?.effectiveType)
      ? navigator.connection.effectiveType : 'Unavailable'],
    ['Data saver', navigator.connection?.saveData === undefined
      ? 'Unavailable' : String(navigator.connection.saveData)],
    ['Do Not Track', dntLabel],
    ['Global Privacy Control', navigator.globalPrivacyControl === undefined
      ? 'Not reported' : String(navigator.globalPrivacyControl)],
  ];
}

function rows(list, values) {
  list.replaceChildren(...values.map(([label, value]) => {
    const row = element('div');
    row.append(element('dt', label), element('dd', value || 'Not reported'));
    return row;
  }));
}

const EVENTS = {
  event1: 'Demo hub view',
  event2: 'Journey selected',
  event3: 'Discovery view',
  event4: 'Persona landing view',
  event5: 'Official source click',
  event6: 'SureSmile cross-link',
  event7: 'White paper download',
  event8: 'Contact intent',
  event9: 'Provider interest',
};

/** A local consumer of the adapter stream, never an instrumenter or SDK loader. */
export default function initInsights(analytics) {
  const flags = new URLSearchParams(window.location.search).getAll('insights');
  if (flags.length !== 1 || flags[0] !== '1' || document.getElementById('suresmile-insights')) return;
  const style = element('link');
  style.rel = 'stylesheet';
  style.href = new URL('../styles/insights.css', import.meta.url).href;
  document.head.append(style);
  const panel = element('aside', undefined, 'suresmile-insights');
  panel.id = 'suresmile-insights';
  panel.setAttribute('aria-labelledby', 'suresmile-insights-title');
  const header = element('div', undefined, 'suresmile-insights-header');
  const title = element('h2', 'SureSmile live insights');
  title.id = 'suresmile-insights-title';
  const close = element('button', 'Close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close SureSmile live insights');
  header.append(title, close);
  const content = element('div', undefined, 'suresmile-insights-content');
  const disclaimer = element('p', 'Observed here, not Adobe reporting.', 'suresmile-insights-note');
  const status = element('p');
  status.setAttribute('role', 'status');
  const preferences = element('button', 'Analytics preferences');
  preferences.type = 'button';
  preferences.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('consent:open-preferences'));
  });
  function section(label, className = '') {
    const wrapper = element('details', undefined, `suresmile-insights-detail ${className}`);
    const heading = element('summary');
    const count = element('span', '', 'suresmile-detail-count');
    heading.append(element('span', label), count);
    const body = element('div', undefined, 'suresmile-detail-body');
    wrapper.append(heading, body);
    content.append(wrapper);
    return { wrapper, body, count };
  }
  content.append(status, preferences);
  const summary = element('dl', undefined, 'suresmile-overview');
  content.append(summary);
  const visitorCard = section('VISITOR', 'suresmile-visitor-card');
  visitorCard.count.className = 'suresmile-location-badge';
  const networkTitle = element('h3', 'NETWORK - FROM THE CDN');
  visitorCard.body.append(networkTitle);
  const profileSection = element('div', undefined, 'suresmile-visitor-profile');
  visitorCard.body.append(profileSection);
  const profile = createVisitorProfile(profileSection, (location) => {
    visitorCard.count.textContent = location;
  });
  const visitor = element('dl');
  visitor.className = 'suresmile-device-fields';
  visitorCard.body.append(element('h3', 'BROWSER - REPORTED BY THIS DEVICE'), visitor);
  const components = element('ol');
  const componentCard = section('Components seen');
  componentCard.body.append(
    element('p', 'Loaded blocks at least 10% in viewport. Unique instances; repeat sightings counted separately.'),
    components,
  );
  const links = element('ol');
  const linkCard = section('Links clicked');
  linkCard.body.append(
    element('p', 'Recent clicks with safe labels and destinations.'),
    links,
  );
  const localFeed = element('ol');
  const localCard = section('Local activity');
  localCard.body.append(localFeed);
  const journey = element('dl');
  const journeySection = section('Journey');
  journeySection.body.append(journey);
  const counters = element('p');
  const feed = element('ol');
  const events = section('Live hit stream');
  events.body.append(
    counters,
    element('p', 'Observed = data-layer entry. Requested = SDK method called. '
      + 'Dispatched = AppMeasurement post-track callback. '
      + 'None confirms Adobe receipt or report processing.'),
    feed,
  );
  content.append(disclaimer);
  panel.append(header, content);
  const toggle = element('button', 'SureSmile insights', 'suresmile-insights-toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-controls', panel.id);
  document.body.append(panel, toggle);
  let priorFocus = document.activeElement;
  function setOpen(open) {
    panel.hidden = !open;
    profile.setOpen(open);
    toggle.setAttribute('aria-expanded', String(open));
    if (open) {
      priorFocus = document.activeElement;
      close.focus({ preventScroll: true });
    } else {
      (priorFocus?.isConnected && priorFocus !== document.body ? priorFocus : toggle)
        .focus({ preventScroll: true });
    }
  }
  close.addEventListener('click', () => setOpen(false));
  toggle.addEventListener('click', () => setOpen(panel.hidden));
  document.addEventListener('keydown', (event) => {
    if (!panel.hidden && event.key === 'Escape') { event.preventDefault(); setOpen(false); }
  });
  const rendered = new Map();
  const empty = element('li', 'No consented hits observed in this document.');
  function render(snapshot) {
    const { context, records } = snapshot;
    profile.setConsent(snapshot.consent);
    const local = snapshot.observations;
    rows(summary, [
      ['AA hits', String(snapshot.totals.observed)],
      ['Components', local.visibilityAvailable ? String(local.components.length) : 'Unavailable'],
      ['Links clicked', String(local.clicks)],
      ['Scroll / max', local.active ? `${local.scroll.current}% / ${local.scroll.maximum}%` : 'Paused'],
    ]);
    componentCard.count.textContent = String(local.components.length);
    linkCard.count.textContent = String(local.clicks);
    localCard.count.textContent = String(local.totalEvents);
    events.count.textContent = String(snapshot.totals.observed);
    components.replaceChildren(...local.components.map((component) => (
      element('li', `${component.name} #${component.id}`)
    )));
    links.replaceChildren(...local.links.map((link) => element('li', `${link.label} | ${link.href}`)));
    localFeed.replaceChildren(...local.records.slice().reverse().map((record) => {
      let detail = record.type;
      if (record.type === 'scroll') detail = `Scroll ${record.current}% | max ${record.maximum}%`;
      if (record.type === 'componentSeen') {
        detail = `Component ${record.component.name} #${record.component.id} | ${record.repeat ? 'repeat' : 'first sighting'}`;
      }
      if (record.type === 'linkClick') detail = `Link ${record.link.label} | ${record.link.href}`;
      return element('li', `${detail} | ${new Date(record.time).toLocaleTimeString()}`);
    }));
    status.textContent = snapshot.consent === 'granted'
      ? `Analytics on | ${snapshot.sdkStatus}`
      : 'Paused | Analytics off';
    const deviceFields = browserInformation();
    const names = {
      'Browser (reported)': 'Browser',
      'OS (reported)': 'Platform',
      'Device type (reported)': 'Device type',
      Language: 'Language',
      'Timezone (reported)': 'Time zone',
      'Screen (reported)': 'Screen',
      Viewport: 'Viewport',
      'Connection (coarse)': 'Effective connection',
      'Do Not Track': 'Do Not Track',
      'Global Privacy Control': 'Global Privacy Control',
    };
    rows(visitor, deviceFields.filter(([label]) => names[label])
      .map(([label, value]) => [names[label], value]));
    rows(journey, [
      ['Page name', context.page.name],
      ['eVar1 / prop2 - persona', context.persona.id],
      ['eVar2 - source', context.persona.source],
      ['eVar3 / prop3 - channel', context.channel.discovery],
      ['eVar4 - actual variant', context.persona.variantId || 'No active variant ID reported (sentinel: none)'],
      ['eVar5 / prop1 - step', context.page.type],
      ['eVar6 / campaign', context.visit.campaign || 'None'],
      ['prop4 - CTA', 'Stable label on each link hit'],
    ]);
    counters.textContent = `AA transport totals | ${['observed', 'requested', 'dispatched']
      .map((stage) => `${stage}: ${snapshot.totals[stage]}`)
      .join(' | ')}`;
    rendered.forEach((item, record) => {
      if (!records.includes(record)) { item.remove(); rendered.delete(record); }
    });
    records.forEach((record) => {
      if (rendered.has(record)) return;
      const item = element('li');
      const variables = record.detail?.variables;
      const event = variables?.events;
      item.append(element('strong', `${record.stage} | ${EVENTS[event] || event || 'transport status'}`));
      item.append(element('span', ` | ${new Date(record.time).toLocaleTimeString()}`));
      if (variables) {
        const detail = element('details');
        detail.append(element('summary', 'Safe hit variables'));
        const code = element('pre', JSON.stringify(variables, null, 2));
        detail.append(code);
        item.append(detail);
      }
      rendered.set(record, item);
      feed.prepend(item);
    });
    if (!records.length) feed.append(empty);
    else empty.remove();
  }
  analytics.enableLocalDiagnostics();
  analytics.subscribe(render);
  ['resize', 'online', 'offline'].forEach((name) => {
    window.addEventListener(name, () => render(analytics.snapshot()));
  });
  navigator.connection?.addEventListener?.('change', () => render(analytics.snapshot()));
  setOpen(true);
}
