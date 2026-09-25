import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import * as fx from '../fixtures/intervals.js';
import { TEST_BASE_URL } from './mcp.js';

export const api = (path: string) => `${TEST_BASE_URL}/api/v1${path}`;

/** Default happy-path handlers; override per test with `mockApi.use(...)`. */
export const defaultHandlers = [
  http.get(api('/athlete/:id'), () => HttpResponse.json(fx.athlete)),
  http.get(api('/athlete/:id/activities'), () => HttpResponse.json(fx.activities)),
  http.get(api('/activity/:id'), ({ request, params }) => {
    if (params.id !== fx.runActivity.id) {
      return HttpResponse.json({ error: 'Activity not found' }, { status: 404 });
    }
    const withIntervals = new URL(request.url).searchParams.get('intervals') === 'true';
    return HttpResponse.json(
      withIntervals ? { ...fx.runActivity, icu_intervals: fx.runIntervals } : fx.runActivity,
    );
  }),
  http.get(api('/athlete/:id/wellness'), () => HttpResponse.json(fx.wellness)),
  http.get(api('/athlete/:id/athlete-summary'), () => HttpResponse.json(fx.athleteSummary)),
];

export const mockApi = setupServer(...defaultHandlers);
