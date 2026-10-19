// -----------------------------------------------------------------------------
// The REST API of Dawarich (`<base>/api/v1/...`), the few read-only calls the
// integration needs, authenticated by the API key of a user
// (`Authorization: Bearer`).
//
// Facts checked on a real server, Dawarich 1.16.0 (freikin/dawarich), see
// test/fixtures/dawarich/:
// - a wrong key is a bare 401 (empty body);
// - `GET /users/me` answers `{ user: { id, email, settings: { timezone } },
//   features: { reverse_geocoding } }`;
// - `GET /stats` carries whole kilometres (Dawarich truncates), recomputed by
//   a background job every hour; its countries and cities come from reverse
//   geocoding, and stay at 0 without it;
// - `GET /countries/visited?start_at&end_at` (Unix seconds) lists
//   `{ iso_a3, name }` from the country of each point (PostGIS borders, no
//   geocoding needed);
// - `GET /points?slim=true` gives `{ latitude, longitude }` as strings and a
//   Unix `timestamp`, paged by `page` / `per_page` (X-Total-Pages header),
//   anomalies left out.
// -----------------------------------------------------------------------------

export const DEFAULT_TIMEOUT = 20_000;
// A whole day of a tracker reporting every second stays under this.
export const MAX_DAY_POINTS = 100_000;
const PAGE_SIZE = 5_000;

export class DawarichError extends Error {
  /**
   * @param {'unreachable' | 'unauthorized' | 'not_found' | 'timeout' | 'http' | 'invalid'} kind
   * @param {string} message never carries a credential nor a position
   * @param {number} [status]
   */
  constructor(kind, message, status) {
    super(message);
    this.name = 'DawarichError';
    this.kind = kind;
    this.status = status;
  }
}

export class DawarichClient {
  /**
   * @param {object} options
   * @param {string} options.url normalized base URL (see normalizeUrl)
   * @param {string} options.apiKey
   * @param {typeof fetch} [options.fetch]
   * @param {number} [options.timeout]
   */
  constructor({ url, apiKey, fetch: fetchImpl, timeout }) {
    this.url = url;
    this.apiKey = apiKey;
    this.fetch = fetchImpl ?? globalThis.fetch;
    this.timeout = timeout ?? DEFAULT_TIMEOUT;
  }

  async #get(path) {
    const headers = { Accept: 'application/json', Authorization: `Bearer ${this.apiKey}` };
    const where = path.split('?')[0];
    let response;
    let raw;
    try {
      response = await this.fetch(`${this.url}/api/v1${path}`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(this.timeout),
        redirect: 'follow',
      });
      raw = await response.text();
    } catch (err) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        throw new DawarichError('timeout', `No answer from Dawarich within ${this.timeout} ms`);
      }
      // The code only: a message may quote a header, so the API key.
      const cause = err?.cause?.code ?? err?.code ?? err?.name ?? 'error';
      throw new DawarichError('unreachable', `Dawarich unreachable (${cause})`);
    }
    if (!response.ok) {
      const status = response.status;
      const kind =
        status === 401 || status === 402 || status === 403
          ? 'unauthorized'
          : status === 404
            ? 'not_found'
            : 'http';
      let detail = `HTTP ${status}`;
      try {
        const data = JSON.parse(raw);
        if (typeof data?.error === 'string') {
          detail = `${detail} ${data.error}`;
        }
      } catch {
        // empty or HTML body
      }
      throw new DawarichError(kind, `${where}: ${detail.slice(0, 120)}`, status);
    }
    try {
      return { data: JSON.parse(raw), headers: response.headers };
    } catch {
      // A proxy login page answering 200 in HTML, for instance.
      throw new DawarichError('invalid', `${where}: the answer is not JSON (is this Dawarich?)`);
    }
  }

  /** `{ id, timezone, reverseGeocoding }`: the owner of the API key. */
  async me() {
    const { data } = await this.#get('/users/me');
    const user = data?.user;
    if (!user || (typeof user.id !== 'number' && typeof user.id !== 'string')) {
      throw new DawarichError('invalid', 'This address does not answer like Dawarich');
    }
    return {
      id: String(user.id),
      timezone: typeof user.settings?.timezone === 'string' ? user.settings.timezone : null,
      reverseGeocoding: data.features?.reverse_geocoding === true,
    };
  }

  /** The raw `/stats` answer (see summarizeStats). */
  async stats() {
    const { data } = await this.#get('/stats');
    if (!data || typeof data.totalDistanceKm !== 'number' || !Array.isArray(data.yearlyStats)) {
      throw new DawarichError('invalid', 'Dawarich did not answer its statistics');
    }
    return data;
  }

  /**
   * The countries of the points between two Unix times.
   * @returns {Promise<{ code: string, name: string }[]>} `code`: ISO 3166-1 alpha-3
   */
  async countries(startAt, endAt) {
    const query = new URLSearchParams({ start_at: String(startAt), end_at: String(endAt) });
    const { data } = await this.#get(`/countries/visited?${query}`);
    if (!data || !Array.isArray(data.countries)) {
      throw new DawarichError('invalid', 'Dawarich did not answer the visited countries');
    }
    return data.countries
      .filter((c) => c && typeof c.iso_a3 === 'string' && c.iso_a3 !== '')
      .map((c) => ({ code: c.iso_a3, name: typeof c.name === 'string' ? c.name : c.iso_a3 }));
  }

  /** The newest point, or null for an empty account. */
  async latestPoint() {
    const { data } = await this.#get('/points?order=desc&per_page=1&slim=true');
    if (!Array.isArray(data)) {
      throw new DawarichError('invalid', 'Dawarich did not answer its points');
    }
    return data.length > 0 ? toPoint(data[0]) : null;
  }

  /** The points between two Unix times, oldest first, MAX_DAY_POINTS at most. */
  async points(startAt, endAt) {
    const found = [];
    for (let page = 1; found.length < MAX_DAY_POINTS; page += 1) {
      const query = new URLSearchParams({
        start_at: String(startAt),
        end_at: String(endAt),
        order: 'asc',
        slim: 'true',
        per_page: String(PAGE_SIZE),
        page: String(page),
      });
      const { data, headers } = await this.#get(`/points?${query}`);
      if (!Array.isArray(data)) {
        throw new DawarichError('invalid', 'Dawarich did not answer its points');
      }
      found.push(...data.map(toPoint).filter(Boolean));
      const pages = Number(headers?.get?.('x-total-pages'));
      if (data.length < PAGE_SIZE || !(pages > page)) {
        break;
      }
    }
    return found.slice(0, MAX_DAY_POINTS);
  }
}

/** `{ lat, lon, at }` (Unix seconds), or null when unusable. */
export function toPoint(raw) {
  const lat = Number(raw?.latitude);
  const lon = Number(raw?.longitude);
  const at = Number(raw?.timestamp);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(at)) {
    return null;
  }
  return { lat, lon, at };
}
