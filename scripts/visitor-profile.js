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

export function validateProfile(data) {
  if (!data || data.source !== 'cdn') throw new Error('Invalid profile source');
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
    source: 'cdn',
    accuracy: data.accuracy,
  };
}

/** The private response stays in this display only, never the Analytics stream. */
export default function createVisitorProfile(section, onSummary = () => {}) {
  const note = document.createElement('p');
  note.textContent = 'Optional IP-based location. Not GPS; never sent to Analytics or saved.';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const fields = document.createElement('dl');
  const allow = document.createElement('button');
  allow.type = 'button';
  allow.textContent = 'Show my IP and approximate location';
  const revoke = document.createElement('button');
  revoke.type = 'button';
  revoke.textContent = 'Remove visitor profile';
  const actions = document.createElement('div');
  actions.className = 'suresmile-profile-actions';
  actions.append(allow, revoke);
  section.append(note, status, fields, actions);
  let opened = false;
  let granted = false;
  let permission = false;
  let pending = false;
  let profile = null;
  let error = false;
  let epoch = 0;
  let abort;

  function render() {
    const coordinates = profile && profile.latitude !== null && profile.longitude !== null
      ? `${profile.latitude.toFixed(2)}, ${profile.longitude.toFixed(2)}` : 'Unavailable';
    const city = profile ? [profile.city, profile.region].filter(Boolean).join(', ') : '';
    const values = [
      ['IP address', profile?.ip || 'Unavailable', 'ip'],
      ['City', city || 'Unavailable', 'city'],
      ['Country', profile?.country || 'Unavailable', 'country'],
      ['Coordinates', coordinates, 'coordinates'],
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
      if (field === 'city' && profile?.region) {
        const hint = document.createElement('small');
        hint.textContent = 'Includes state/region code';
        content.append(hint);
      }
      row.append(key, content);
      return row;
    }));
    let message = 'Profile off. Allow analytics, then choose profile display.';
    if (granted) message = 'Profile off until you choose to show it.';
    if (pending) message = 'Loading visitor profile.';
    if (profile) message = 'Approximate CDN location for this visitor.';
    if (error) message = 'Visitor profile unavailable. Please try again later.';
    status.textContent = message;
    allow.disabled = !opened || !granted || pending || Boolean(profile);
    allow.textContent = error ? 'Retry visitor profile' : 'Show my IP and approximate location';
    revoke.hidden = !permission;
    let location = error ? 'Unavailable' : 'Local only';
    if (profile) {
      location = [profile.city, profile.region, profile.country].filter(Boolean).join(', ')
        || 'Unavailable';
    }
    onSummary(location);
  }
  function clear() {
    epoch += 1;
    abort?.abort();
    abort = undefined;
    permission = false;
    pending = false;
    profile = null;
    error = false;
    render();
  }
  async function load() {
    if (!opened || !granted || pending || profile) return;
    permission = true;
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
      const data = validateProfile(await response.json());
      if (current !== epoch || !opened || !granted) return;
      profile = data;
      pending = false;
      render();
    } catch {
      if (current !== epoch || !opened || !granted) return;
      pending = false;
      profile = null;
      error = true;
      render();
    }
  }
  allow.addEventListener('click', load);
  revoke.addEventListener('click', clear);
  render();
  return {
    setOpen(value) {
      opened = value;
      if (!value) clear();
      else render();
    },
    setConsent(value) {
      const next = value === 'granted';
      if (granted === next) return;
      granted = next;
      if (!next) clear();
      else render();
    },
  };
}
