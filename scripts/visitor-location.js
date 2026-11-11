import { validateProfile } from './visitor-profile.js';

/**
 * The requesting visitor's approximate, CDN-derived location (city, state/region),
 * for defaulting "find a doctor" searches. Same-origin only: no third-party lookup,
 * no geolocation permission prompt, nothing stored. One request per page, shared by
 * every block that asks. Resolves to null when unavailable so callers keep manual entry.
 */
let pending;

function titleCase(value) {
  return value.replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

async function lookup() {
  try {
    const response = await fetch('/api/visitor-profile', {
      method: 'GET',
      mode: 'same-origin',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
    });
    const cache = response.headers.get('cache-control') || '';
    if (!response.ok || !/\bprivate\b/i.test(cache) || !/\bno-store\b/i.test(cache)) return null;
    const profile = validateProfile(await response.json());
    if (!profile.city) return null;
    // Region is the CDN's state/province code when the endpoint returns it; otherwise
    // fall back to the country code so the label is still a geocodable "City, XX".
    const area = profile.region || profile.country;
    const hasCoordinates = profile.latitude !== null && profile.longitude !== null;
    return {
      label: [titleCase(profile.city), area].filter(Boolean).join(', '),
      city: titleCase(profile.city),
      region: profile.region,
      country: profile.country,
      latitude: hasCoordinates ? profile.latitude : null,
      longitude: hasCoordinates ? profile.longitude : null,
    };
  } catch {
    return null;
  }
}

export default function getVisitorLocation() {
  if (!pending) pending = lookup();
  return pending;
}
