import initAnalytics from './analytics.js';

const analytics = initAnalytics();
if (new URLSearchParams(window.location.search).get('insights') === '1') {
  const { default: initInsights } = await import('./insights.js');
  initInsights(analytics);
}
