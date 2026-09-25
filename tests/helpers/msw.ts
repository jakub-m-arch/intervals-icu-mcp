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
  http.get(api('/athlete/:id/activities/search'), () => HttpResponse.json([fx.runActivity])),
  http.get(api('/athlete/:id/activities/interval-search'), () =>
    HttpResponse.json([fx.runActivity]),
  ),
  http.get(api('/activity/:id/messages'), () => HttpResponse.json(fx.comments)),
  http.get(api('/activity/:id/streams'), ({ request }) => {
    const types = new URL(request.url).searchParams.get('types')?.split(',') ?? [];
    return HttpResponse.json(fx.streams.filter((s) => types.includes(s.type)));
  }),
  http.get(api('/activity/:id/hr-histogram'), () => HttpResponse.json(fx.hrHistogram)),
  http.get(api('/activity/:id/best-efforts'), () => HttpResponse.json(fx.bestEfforts)),
  http.get(api('/activity/:id/interval-stats'), () => HttpResponse.json(fx.intervalStats)),
  http.get(api('/athlete/:id/pace-curves'), () => HttpResponse.json(fx.paceCurves)),
  http.get(api('/athlete/:id/hr-curves'), () => HttpResponse.json(fx.hrCurves)),
  http.get(api('/athlete/:id/events'), () => HttpResponse.json(fx.events)),
  http.get(api('/athlete/:id/events/:eventId'), ({ params }) => {
    const event = fx.events.find((e) => String(e.id) === params.eventId);
    return event
      ? HttpResponse.json(event)
      : HttpResponse.json({ error: 'Event not found' }, { status: 404 });
  }),
  http.get(api('/athlete/:id/folders'), () => HttpResponse.json(fx.folders)),
  http.get(api('/athlete/:id/workouts/:workoutId'), () => HttpResponse.json(fx.workout)),
  http.get(api('/athlete/:id/training-plan'), () => HttpResponse.json({})),
  http.get(api('/athlete/:id/gear'), () => HttpResponse.json(fx.gear)),
];

export const mockApi = setupServer(...defaultHandlers);
