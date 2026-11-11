import initAnalytics from './analytics.js?v=insights-session-2';
import insightsSession from './insights-session.js?v=insights-session-2';

const analytics = initAnalytics();
const session = insightsSession();
if (session.active) {
  const { default: initInsights } = await import('./insights.js?v=insights-session-2');
  initInsights(analytics, session);
}
