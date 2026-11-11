import { clearProfileSession } from './insights-session.js?v=insights-session-2';

const PREFERENCE_KEY = 'suresmile.analytics.consent.v1';

function warnStorage() {
  // eslint-disable-next-line no-console
  console.warn('analytics: consent preference storage is unavailable');
}

export default function createConsent(onChange) {
  let preference = null;
  let previousFocus;
  try {
    const stored = localStorage.getItem(PREFERENCE_KEY);
    if (stored === 'granted' || stored === 'denied') preference = stored;
  } catch {
    warnStorage();
  }

  const hasCMP = () => Boolean(window.OneTrust
    || typeof window.OnetrustActiveGroups === 'string'
    || typeof window.OptanonActiveGroups === 'string');
  const granted = () => {
    if (!hasCMP()) return preference === 'granted';
    const groups = window.OnetrustActiveGroups ?? window.OptanonActiveGroups ?? '';
    return String(groups).split(',').includes('C0002');
  };

  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('../styles/analytics-consent.css', import.meta.url).href;
  document.head.append(stylesheet);
  const panel = document.createElement('section');
  panel.className = 'analytics-consent';
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-labelledby', 'analytics-consent-heading');
  const heading = document.createElement('h2');
  heading.id = 'analytics-consent-heading';
  heading.textContent = 'Optional audience-journey analytics';
  const description = document.createElement('p');
  description.textContent = 'Allow Adobe Analytics to measure demo journeys and resource clicks? Analytics stays off unless you opt in. When the live insights panel is open, it also shows your IP and approximate CDN-derived location to you; those values stay in this tab and are never sent to Analytics. You can withdraw at any time.';
  const status = document.createElement('p');
  status.className = 'analytics-consent-status';
  status.setAttribute('role', 'status');
  const actions = document.createElement('div');
  const settings = document.createElement('button');
  settings.type = 'button';
  settings.className = 'analytics-settings';
  settings.textContent = 'Analytics settings';
  settings.setAttribute('aria-controls', 'analytics-consent-panel');
  panel.id = 'analytics-consent-panel';

  const sync = () => {
    if (!granted()) {
      try { clearProfileSession(); } catch {
        // eslint-disable-next-line no-console
        console.warn('analytics: visitor profile session storage could not be cleared');
      }
    }
    panel.hidden = hasCMP() || preference !== null;
    settings.setAttribute('aria-expanded', String(!panel.hidden));
    onChange(granted());
  };
  ['Allow analytics', 'Keep analytics off'].forEach((label, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => {
      // A late-loading CMP is authoritative even while this panel is open.
      if (hasCMP()) {
        sync();
        window.OneTrust?.ToggleInfoDisplay?.();
        return;
      }
      preference = index === 0 ? 'granted' : 'denied';
      try {
        localStorage.setItem(PREFERENCE_KEY, preference);
      } catch {
        warnStorage();
      }
      sync();
      (previousFocus?.isConnected ? previousFocus : settings).focus({ preventScroll: true });
    });
    actions.append(button);
  });
  panel.append(heading, description, actions, status);
  document.body.append(panel, settings);

  const open = () => {
    if (hasCMP()) {
      sync();
      window.OneTrust?.ToggleInfoDisplay?.();
      return;
    }
    previousFocus = document.activeElement;
    panel.hidden = false;
    settings.setAttribute('aria-expanded', 'true');
    actions.querySelector('button').focus({ preventScroll: true });
  };
  settings.addEventListener('click', open);
  window.addEventListener('consent:open-preferences', open);
  window.addEventListener('OneTrustGroupsUpdated', sync);
  window.addEventListener('OTConsentApplied', sync);
  window.addEventListener('OneTrustLoaded', sync);
  window.addEventListener('focus', sync);
  return {
    granted,
    status() {
      if (!hasCMP()) return preference || 'unknown';
      if (window.OnetrustActiveGroups === undefined
        && window.OptanonActiveGroups === undefined) return 'unknown';
      return granted() ? 'granted' : 'denied';
    },
    source() { return hasCMP() ? 'OneTrust C0002' : 'Explicit analytics preference'; },
    start: sync,
    setStatus(message, error = false) {
      status.textContent = message;
      settings.title = message;
      if (error && !hasCMP()) {
        panel.hidden = false;
        settings.setAttribute('aria-expanded', 'true');
      }
    },
  };
}
