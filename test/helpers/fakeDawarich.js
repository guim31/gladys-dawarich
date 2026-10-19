// -----------------------------------------------------------------------------
// A fake Dawarich behind a fake `fetch`, answering like the real server
// (Dawarich 1.16.0, see test/fixtures/dawarich/): users/me, stats, points,
// countries/visited. Its state is plain data the tests change.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/dawarich/${name}.json`, import.meta.url), 'utf8'));

export const HOST = 'http://192.0.2.10:3000';
export const API_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
// 2026-10-19 16:00 UTC (18:00 in Paris).
export const NOW = Date.UTC(2026, 9, 19, 16, 0, 0);
const HOUR = 3600;

/** Lets the pending promises and the fake Gladys settle. */
export const settle = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));

export const FIXTURES = {
  me: fixture('me'),
  stats: fixture('stats'),
  countries: fixture('countries'),
  latest: fixture('latest'),
  today: fixture('today'),
};

/** A point of the slim answer. */
export function slimPoint(id, lat, lon, timestamp, country = 'France') {
  return {
    id,
    latitude: String(lat),
    longitude: String(lon),
    timestamp,
    velocity: '20',
    country_name: country,
    tracker_id: 'test-phone',
  };
}

export function createDawarich({ now = () => NOW } = {}) {
  const nowSeconds = Math.floor(NOW / 1000);
  const state = {
    up: true,
    apiKey: API_KEY,
    me: structuredClone(FIXTURES.me),
    stats: structuredClone(FIXTURES.stats),
    // One hour of driving today (about 6.4 km), the last point 2 h ago.
    points: Array.from({ length: 31 }, (_, i) =>
      slimPoint(
        100 + i,
        43.6047 + i * 0.0015,
        1.4442 - i * 0.0015,
        nowSeconds - 3 * HOUR + i * 120,
      ),
    ),
    // Countries of the points, with the time they were last visited.
    countries: [
      { iso_a3: 'BEL', name: 'Belgium', at: nowSeconds - 40 * 24 * HOUR },
      { iso_a3: 'ESP', name: 'Spain', at: nowSeconds - 150 * 24 * HOUR },
      { iso_a3: 'FRA', name: 'France', at: nowSeconds - HOUR },
    ],
    requests: [],
    answer: null,
  };

  function json(status, body, headers = {}) {
    return new Response(body === undefined ? '' : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json', ...headers },
    });
  }

  async function fetch(input, init = {}) {
    if (!state.up) {
      const err = new TypeError('fetch failed');
      err.cause = { code: 'ECONNREFUSED' };
      throw err;
    }
    const url = new URL(String(input));
    state.requests.push(`${url.pathname}${url.search}`);
    if (state.answer) {
      return state.answer(url);
    }
    if (init.headers?.Authorization !== `Bearer ${state.apiKey}`) {
      return new Response('', { status: 401 });
    }
    const q = url.searchParams;
    switch (url.pathname) {
      case '/api/v1/users/me':
        return json(200, state.me);
      case '/api/v1/stats':
        return json(200, state.stats);
      case '/api/v1/countries/visited': {
        const from = Number(q.get('start_at'));
        const to = Number(q.get('end_at'));
        const countries = state.countries
          .filter((c) => c.at >= from && c.at <= to)
          .map(({ iso_a3, name }) => ({ iso_a3, name }));
        return json(200, { countries });
      }
      case '/api/v1/points': {
        const from = q.has('start_at') ? Number(q.get('start_at')) : 0;
        const to = q.has('end_at') ? Number(q.get('end_at')) : Math.floor(now() / 1000);
        const perPage = Number(q.get('per_page') ?? 100);
        const page = Number(q.get('page') ?? 1);
        const sorted = state.points
          .filter((p) => p.timestamp >= from && p.timestamp <= to)
          .sort((a, b) =>
            q.get('order') === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp,
          );
        return json(200, sorted.slice((page - 1) * perPage, page * perPage), {
          'x-total-pages': String(Math.ceil(sorted.length / perPage)),
        });
      }
      default:
        return json(404, { error: 'Not found' });
    }
  }

  return {
    state,
    fetch,
    goDown() {
      state.up = false;
    },
    goUp() {
      state.up = true;
    },
    /** A new point, `secondsAgo` before now, in a country (ISO alpha-3). */
    addPoint(secondsAgo, { lat = 43.7, lon = 1.3, country } = {}) {
      const at = Math.floor(now() / 1000) - secondsAgo;
      state.points.push(slimPoint(1000 + state.points.length, lat, lon, at));
      if (country) {
        const known = state.countries.find((c) => c.iso_a3 === country.code);
        if (known) {
          known.at = Math.max(known.at, at);
        } else {
          state.countries.push({ iso_a3: country.code, name: country.name, at });
        }
      }
    },
  };
}
