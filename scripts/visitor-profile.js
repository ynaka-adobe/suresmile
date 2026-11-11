import { PROFILE_SESSION_KEY, PROFILE_PERMISSION_KEY, clearProfileSession } from './insights-session.js?v=insights-session-2';

function text(value, limit) {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > limit
    || [...value].some((character) => character.charCodeAt(0) < 32
      || character.charCodeAt(0) === 127)) {
    throw new Error('Invalid profile field');
  }
  return value.trim() || null;
}

function validIP(value) {
  if (value === null) return null;
  const ip = text(value, 45);
  if (!ip) return null;
  const ipv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)
    && ip.split('.').every((part) => Number(part) <= 255);
  let ipv6 = false;
  if (ip.includes(':') && /^[a-fA-F0-9:.]+$/.test(ip)) {
    try { ipv6 = Boolean(new URL(`http://[${ip}]/`).hostname); } catch { /* Invalid IP. */ }
  }
  if (!ipv4 && !ipv6) throw new Error('Invalid profile IP');
  return ip;
}

/** CDN point-of-presence code (for example PAO), taken from the response headers. */
function popCode(value) {
  if (typeof value !== 'string' || !/^[A-Za-z]{3,4}$/.test(value)) throw new Error('Invalid profile POP');
  return value.toUpperCase();
}

function popFromHeaders(headers) {
  const served = (headers.get('x-served-by') || '').split(',').pop().trim();
  const code = served.match(/-([A-Za-z]{3,4})$/)?.[1];
  return code ? code.toUpperCase() : null;
}

function titleCase(value) {
  return value ? value.replace(/\b([a-z])/g, (m) => m.toUpperCase()) : value;
}

export function validateProfile(data) {
  if (!data || !['cdn', 'edge'].includes(data.source)) throw new Error('Invalid profile source');
  const latitude = data.latitude === null ? null : data.latitude;
  const longitude = data.longitude === null ? null : data.longitude;
  const coordinates = Number.isFinite(latitude) && Number.isFinite(longitude)
    && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
  if (!coordinates && (latitude !== null || longitude !== null)) {
    throw new Error('Invalid profile coordinates');
  }
  if (data.accuracy !== (coordinates ? 'approximate IP geolocation' : 'unavailable')) {
    throw new Error('Invalid profile accuracy');
  }
  return {
    ip: validIP(data.ip),
    city: text(data.city, 100),
    country: text(data.country, 100),
    region: data.region === undefined ? null : text(data.region, 100),
    latitude,
    longitude,
    pop: data.pop === undefined || data.pop === null ? null : popCode(data.pop),
    source: data.source,
    accuracy: data.accuracy,
  };
}

/** Only this display and its explicitly consented tab cache receive the profile. */
export default function createVisitorProfile(section, onSummary = () => {}) {
  const note = document.createElement('p');
  note.textContent = 'IP-based location from the CDN, not GPS. Loaded automatically once analytics is on; kept only in this tab and never sent to Analytics.';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const fields = document.createElement('dl');
  const allow = document.createElement('button');
  allow.type = 'button';
  allow.textContent = 'Show my IP and approximate location';
  allow.className = 'suresmile-profile-allow';
  const revoke = document.createElement('button');
  revoke.type = 'button';
  revoke.textContent = 'Hide location';
  const refresh = document.createElement('button');
  refresh.type = 'button';
  refresh.textContent = 'Refresh';
  const actions = document.createElement('div');
  actions.className = 'suresmile-profile-actions';
  actions.append(allow, refresh, revoke);
  section.append(note, status, fields, actions);
  let opened = false;
  let granted = false;
  let pending = false;
  let profile = null;
  let error = false;
  let epoch = 0;
  let abort;
  let savedAt = null;
  let restored = false;
  let storageError = false;
  let suppressed = false; // visitor hid the profile; stop auto-loading until they ask again

  function storageFailed() {
    storageError = true;
    // eslint-disable-next-line no-console
    console.warn('insights: visitor profile session storage is unavailable');
  }
  function forget() {
    try { clearProfileSession(); } catch { storageFailed(); }
  }
  function save() {
    try {
      sessionStorage.setItem(PROFILE_SESSION_KEY, JSON.stringify({ version: 1, savedAt, profile }));
      sessionStorage.setItem(PROFILE_PERMISSION_KEY, 'granted');
    } catch {
      storageFailed();
      forget();
    }
  }
  function restore() {
    if (restored || !opened || !granted) return;
    restored = true;
    let cached;
    try {
      if (sessionStorage.getItem(PROFILE_PERMISSION_KEY) !== 'granted') {
        forget();
        return;
      }
      cached = sessionStorage.getItem(PROFILE_SESSION_KEY);
    } catch { storageFailed(); return; }
    if (!cached) return;
    try {
      const data = JSON.parse(cached);
      if (data.version !== 1 || !Number.isFinite(data.savedAt)
        || data.savedAt <= 0 || data.savedAt > Date.now()) throw new Error('Invalid session snapshot');
      profile = validateProfile(data.profile);
      savedAt = data.savedAt;
      save();
    } catch {
      profile = null;
      error = true;
      forget();
      // eslint-disable-next-line no-console
      console.warn('insights: invalid visitor profile session snapshot cleared');
    }
  }

  function render() {
    const coordinates = profile && profile.latitude !== null && profile.longitude !== null
      ? `${profile.latitude.toFixed(2)}, ${profile.longitude.toFixed(2)}` : 'Unavailable';
    const source = { cdn: 'CDN (Fastly)', edge: 'Edge function' };
    const values = [
      ['IP address', profile?.ip || 'Unavailable', 'ip'],
      ['City', titleCase(profile?.city) || 'Unavailable', 'city'],
      ['State / region', profile?.region || 'Not returned by the endpoint', 'region'],
      ['Country', profile?.country || 'Unavailable', 'country'],
      ['Coordinates', coordinates, 'coordinates'],
      ['CDN edge (POP)', profile?.pop || 'Not reported', 'pop'],
      ['Data source', profile ? `${source[profile.source]} · approximate` : 'Unavailable', 'source'],
    ];
    fields.replaceChildren(...values.map(([label, value, field]) => {
      const row = document.createElement('div');
      const key = document.createElement('dt');
      const content = document.createElement('dd');
      key.textContent = label;
      content.textContent = value;
      content.dataset.profileField = field;
      if (field === 'coordinates') {
        const hint = document.createElement('small');
        hint.textContent = 'Approximate, IP-based';
        content.append(hint);
      }
      row.append(key, content);
      return row;
    }));
    fields.hidden = !profile;
    let message = 'Waiting for analytics to be allowed.';
    if (granted) message = suppressed ? 'Location hidden. Use the button to show it again.' : 'Looking up location.';
    if (pending) message = 'Loading visitor profile.';
    if (profile) message = `Live from the CDN at ${new Date(savedAt).toLocaleTimeString()}. Refresh if your network changes.`;
    if (error) message = 'Visitor profile unavailable. Please try again later.';
    if (storageError) message += ' Session storage unavailable; display is limited to this page.';
    status.textContent = message;
    allow.disabled = !opened || !granted || pending || Boolean(profile);
    allow.hidden = Boolean(profile) || pending || (!suppressed && !error);
    refresh.hidden = !profile;
    refresh.disabled = !opened || !granted || pending;
    allow.textContent = error ? 'Retry visitor profile' : 'Show my IP and approximate location';
    revoke.hidden = !profile;
    let location = error ? 'Unavailable' : 'Locating';
    if (profile) {
      location = [titleCase(profile.city), profile.region, profile.country].filter(Boolean).join(', ')
        || 'Unavailable';
    }
    onSummary(location, Boolean(profile));
  }
  function clear(hidden = false) {
    suppressed = hidden;
    epoch += 1;
    abort?.abort();
    abort = undefined;
    pending = false;
    profile = null;
    error = false;
    savedAt = null;
    forget();
    render();
  }
  async function load(refreshing = false) {
    if (!opened || !granted || pending || suppressed || (profile && !refreshing)) return;
    if (refreshing) {
      profile = null;
      savedAt = null;
      forget();
    }
    pending = true;
    error = false;
    abort = new AbortController();
    epoch += 1;
    const current = epoch;
    render();
    try {
      const response = await fetch('/api/visitor-profile', {
        method: 'GET',
        mode: 'same-origin',
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
        signal: abort.signal,
      });
      if (current !== epoch || !opened || !granted) return;
      const cache = response.headers.get('cache-control') || '';
      if (!response.ok || !/\bprivate\b/i.test(cache) || !/\bno-store\b/i.test(cache)) {
        throw new Error('Profile privacy boundary unavailable');
      }
      const pop = popFromHeaders(response.headers);
      const data = validateProfile({ ...(await response.json()), pop });
      if (current !== epoch || !opened || !granted) return;
      profile = data;
      savedAt = Date.now();
      pending = false;
      save();
      render();
    } catch {
      if (current !== epoch || !opened || !granted) return;
      pending = false;
      profile = null;
      error = true;
      render();
    }
  }
  allow.addEventListener('click', () => { suppressed = false; load(); });
  refresh.addEventListener('click', () => load(true));
  revoke.addEventListener('click', () => clear(true));
  render();
  return {
    setOpen(value) {
      opened = value;
      if (!value && pending) {
        epoch += 1;
        abort?.abort();
        pending = false;
      }
      if (value) restore();
      render();
      if (value) load();
    },
    setConsent(value) {
      const next = value === 'granted';
      if (granted === next) {
        if (!next) forget();
        return;
      }
      granted = next;
      if (!next) clear(false);
      else { restore(); render(); load(); }
    },
  };
}
