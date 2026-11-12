import initAnalytics from './analytics.js?v=target-offers-1';
import insightsSession from './insights-session.js?v=insights-session-2';

const analytics = initAnalytics();
const session = insightsSession();
if (session.active) {
  const { default: initInsights } = await import('./insights.js?v=target-offers-1');
  initInsights(analytics, session);
}
