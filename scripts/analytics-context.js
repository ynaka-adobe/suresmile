export const VISIT_KEY = 'suresmile.analytics.visit.v1';
export const VISIT_TIMEOUT = 30 * 60 * 1000;
export const CHANNELS = ['ai', 'search-organic', 'search-paid', 'direct'];
export const PERSONAS = ['endodontic', 'implant', 'none'];

const SOURCES = { chatgpt: 'ai', seo: 'search-organic', ad: 'search-paid' };
const PAGES = {
  '/en-us': ['suresmile:home', 'patients', 'home'],
  '/en-us/customer-demo': ['demo:hub', 'doctors-demo', 'hub'],
  '/en-us/demo/endodontic-discovery': ['demo:endodontic:discovery', 'doctors-demo', 'discovery', 'endodontic'],
  '/en-us/demo/implant-discovery': ['demo:implant:discovery', 'doctors-demo', 'discovery', 'implant'],
  '/en-us/demo/endodontic': ['demo:endodontic:landing', 'doctors-demo', 'landing', 'endodontic'],
  '/en-us/demo/implants': ['demo:implant:landing', 'doctors-demo', 'landing', 'implant'],
  '/en-us/doctors': ['suresmile:doctors', 'doctors', 'doctors'],
  '/en-us/doctors/contact': ['suresmile:doctors:contact', 'doctors', 'contact'],
  '/en-us/how-it-works': ['suresmile:how-it-works', 'patients', 'how-it-works'],
  '/en-us/find-a-doctor': ['suresmile:find-a-doctor', 'patients', 'locator'],
};
const UTM_SOURCES = ['chatgpt', 'openai', 'google', 'bing', 'email', 'newsletter', 'xsc-demo', 'dentsply-sirona', 'suresmile'];
const UTM_MEDIA = ['ai', 'organic', 'cpc', 'ppc', 'paid-search', 'email', 'referral', 'social'];

export function normalizePersona(value) {
  if (value === 'implants') return 'implant';
  return PERSONAS.includes(value) ? value : null;
}

function single(params, key) {
  const values = params.getAll(key);
  return values.length === 1 ? values[0] : null;
}

// Vocabulary-limited campaign codes, not arbitrary query strings or user input.
export function safeCampaign(value) {
  return /^(?:endo|endodontic|implant|implants)(?:-(?:aligner|aligners|suresmile|demo|campaign|202[0-9])){0,4}$/.test(value || '')
    ? value : '';
}

export function validVisit(value, now = Date.now()) {
  if (!value || !Number.isFinite(value.updatedAt)
    || now - value.updatedAt < 0 || now - value.updatedAt >= VISIT_TIMEOUT) return null;
  return {
    persona: normalizePersona(value.persona) || 'none',
    discovery: CHANNELS.includes(value.discovery) ? value.discovery : 'direct',
    campaign: safeCampaign(value.campaign),
    utmSource: UTM_SOURCES.includes(value.utmSource) ? value.utmSource : '',
    utmMedium: UTM_MEDIA.includes(value.utmMedium) ? value.utmMedium : '',
    updatedAt: value.updatedAt,
  };
}

export function buildContext(url, previous, variantId = '', now = Date.now()) {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const params = url.searchParams;
  const supplied = params.has('demo_audience');
  const selected = normalizePersona(single(params, 'demo_audience'));
  const reset = single(params, 'demo_reset') === '1' || (supplied && (!selected || selected === 'none'));
  const prior = reset ? null : validVisit(previous, now);
  const campaign = reset ? '' : safeCampaign(single(params, 'utm_campaign'));
  const source = single(params, 'utm_source');
  const medium = single(params, 'utm_medium');
  const utmSource = reset ? '' : UTM_SOURCES.find((v) => v === source) || '';
  const utmMedium = reset ? '' : UTM_MEDIA.find((v) => v === medium) || '';
  const pageInfo = PAGES[path] || ['suresmile:other', 'site', 'other'];
  const [, , , routePersona] = pageInfo;
  let [name, section, type] = pageInfo;
  let campaignPersona = null;
  if (campaign) campaignPersona = /^(endo|endodontic)(-|$)/.test(campaign) ? 'endodontic' : 'implant';
  const persona = reset ? 'none'
    : selected || routePersona || campaignPersona || prior?.persona || 'none';
  if (path === '/en-us' && selected && selected !== 'none' && !reset) {
    name = `demo:${selected}:landing`;
    section = 'doctors-demo';
    type = 'landing';
  }
  let discovery = prior?.discovery || 'direct';
  if (supplied) discovery = !reset ? SOURCES[single(params, 'demo_source')] || 'direct' : 'direct';
  else if (utmMedium || utmSource) {
    if (['cpc', 'ppc', 'paid-search'].includes(utmMedium)) discovery = 'search-paid';
    else if (utmMedium === 'organic') discovery = 'search-organic';
    else if (utmMedium === 'ai' || ['chatgpt', 'openai'].includes(utmSource)) discovery = 'ai';
  }
  const visit = {
    persona,
    discovery,
    campaign: campaign || prior?.campaign || '',
    utmSource: utmSource || prior?.utmSource || '',
    utmMedium: utmMedium || prior?.utmMedium || '',
    updatedAt: now,
  };
  return {
    page: {
      name, section, type,
    },
    persona: {
      id: persona,
      source: 'anonymous',
      variantId: /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,63}$/.test(variantId) ? variantId : '',
    },
    channel: { discovery },
    visit,
    // Unknown routes and all query/hash data are deliberately excluded.
    pageURL: `${url.origin}${PAGES[path] ? path : '/'}`,
    event: { hub: 'event1', discovery: 'event3', landing: 'event4' }[type] || '',
  };
}

export function clickContext(context, persona, discovery) {
  const id = normalizePersona(persona) || context.persona.id;
  const channel = CHANNELS.includes(discovery) ? discovery : context.channel.discovery;
  return {
    ...context,
    persona: { ...context.persona, id },
    channel: { discovery: channel },
    visit: {
      ...context.visit, persona: id, discovery: channel, updatedAt: Date.now(),
    },
  };
}

export function hitVariables(context, event = context.event, cta = '') {
  return {
    pageName: context.page.name,
    channel: context.page.section,
    pageURL: context.pageURL,
    referrer: 'none',
    eVar1: context.persona.id,
    eVar2: context.persona.source,
    eVar3: context.channel.discovery,
    eVar4: context.persona.variantId || 'none',
    eVar5: context.page.type,
    eVar6: context.visit.campaign,
    prop1: context.page.type,
    prop2: context.persona.id,
    prop3: context.channel.discovery,
    prop4: cta,
    campaign: context.visit.campaign,
    contextData: {
      'campaign.source': context.visit.utmSource,
      'campaign.medium': context.visit.utmMedium,
    },
    events: event,
  };
}
