/* eslint-disable import/no-cycle */
import { NX_ORIGIN } from './scripts.js';

let expMod;
const DA_EXP = '/public/plugins/exp/exp.js';

async function toggleExp() {
  const exists = document.querySelector('#aem-sidekick-exp');

  // If it doesn't exist, let module side effects run
  if (!exists) {
    expMod = await import(`${NX_ORIGIN}${DA_EXP}`);
    return;
  }

  // Else, cache the module here and toggle it.
  if (!expMod) expMod = await import(`${NX_ORIGIN}${DA_EXP}`);
  expMod.default();
}

async function toggleInsights() {
  if (document.getElementById('suresmile-insights')) {
    window.dispatchEvent(new CustomEvent('suresmile:insights-toggle'));
    return;
  }
  const v = '?v=insights-session-2';
  const [{ default: initAnalytics }, session, { default: initInsights }] = await Promise.all([
    import(`./analytics.js${v}`),
    import(`./insights-session.js${v}`),
    import(`./insights.js${v}`),
  ]);
  try {
    sessionStorage.setItem(session.INSIGHTS_SESSION_KEY, 'enabled');
  } catch { /* Falls back to this document only. */ }
  initInsights(initAnalytics(), session.default());
}

(async function sidekick() {
  const sk = document.querySelector('aem-sidekick');
  if (!sk) return;
  sk.addEventListener('custom:experimentation', toggleExp);
  sk.addEventListener('custom:insights', toggleInsights);
}());
