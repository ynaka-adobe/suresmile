export const INSIGHTS_SESSION_KEY = 'suresmile.insights.session.v1';
export const PROFILE_SESSION_KEY = 'suresmile.visitor-profile.session.v1';
export const PROFILE_PERMISSION_KEY = 'suresmile.visitor-profile.consent.v1';

export function clearProfileSession() {
  sessionStorage.removeItem(PROFILE_SESSION_KEY);
  sessionStorage.removeItem(PROFILE_PERMISSION_KEY);
}

export default function insightsSession() {
  const flags = new URLSearchParams(window.location.search).getAll('insights');
  let state = null;
  let unavailable = false;
  function warn() {
    unavailable = true;
    // eslint-disable-next-line no-console
    console.warn('insights: tab-session storage is unavailable');
  }
  try {
    state = sessionStorage.getItem(INSIGHTS_SESSION_KEY);
    if (flags.length === 1 && flags[0] === '0') {
      sessionStorage.removeItem(INSIGHTS_SESSION_KEY);
      clearProfileSession();
      return { active: false };
    }
  } catch { warn(); }
  const explicit = flags.length === 1 && flags[0] === '1';
  if (flags.length && !explicit) return { active: false };
  if (!explicit && !['enabled', 'dismissed'].includes(state)) return { active: false };
  return {
    active: true,
    open: explicit || state === 'enabled',
    get unavailable() { return unavailable; },
    setOpen(open) {
      try {
        sessionStorage.setItem(INSIGHTS_SESSION_KEY, open ? 'enabled' : 'dismissed');
      } catch { warn(); }
    },
  };
}
