// -----------------------------------------------------------------------------
// Dawarich -> one Gladys device per Dawarich user (`dawarich:<user id>`, the
// owner of the API key): distances, countries, cities, points, and when the
// last position arrived. Its coordinates only when the user turned the option
// on. Everything is read only.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CAT,
  DEVICE_FEATURE_TYPES as TYPE,
  DEVICE_FEATURE_UNITS as UNIT,
} from '@gladysassistant/integration-sdk';
import { NAMES, NONE, formatDateTime, pick } from './texts.js';

export const DAWARICH_TYPE = 'dawarich';

export const DISTANCES = ['distance_today', 'distance_month', 'distance_year', 'distance_total'];
export const COUNTERS = ['countries', 'cities', 'points'];

const MAX_KM = { distance_today: 100_000, distance_month: 1_000_000 };
const MAX_COUNT = { countries: 300, cities: 1_000_000, points: 1_000_000_000 };

export const dawarichIds = (gladys, userId) => gladys.externalIds(DAWARICH_TYPE, userId);

/**
 * @param {object} gladys
 * @param {string} userId
 * @param {{ language: string, url: string | null, showPosition: boolean }} config
 */
export function buildDawarichDevice(gladys, userId, config) {
  const names = pick(NAMES, config.language);
  const ids = dawarichIds(gladys, userId);
  const feature = (key, fields) => ({
    name: names[key],
    external_id: ids.feature(key),
    read_only: true,
    has_feedback: false,
    ...fields,
  });
  const text = (key) =>
    feature(key, { category: CAT.TEXT, type: TYPE.TEXT.TEXT, min: 0, max: 0, keep_history: false });
  return {
    name: 'Dawarich',
    external_id: ids.device,
    model: 'Dawarich',
    should_poll: false,
    features: [
      ...DISTANCES.map((key) =>
        feature(key, {
          category: CAT.DISTANCE_SENSOR,
          type: TYPE.SENSOR.DECIMAL,
          unit: UNIT.KM,
          min: 0,
          max: MAX_KM[key] ?? 100_000_000,
          keep_history: true,
        }),
      ),
      ...COUNTERS.map((key) =>
        feature(key, {
          category: CAT.COUNTER_SENSOR,
          type: TYPE.SENSOR.INTEGER,
          min: 0,
          max: MAX_COUNT[key],
          keep_history: true,
        }),
      ),
      text('last_point'),
      ...(config.showPosition ? [text('position')] : []),
    ],
    params: [{ name: 'DAWARICH_URL', value: config.url ?? '' }],
  };
}

/**
 * @param {object} gladys
 * @param {string} userId
 * @param {object} snapshot the last read: { counters, today, countries, latest }
 * @param {{ language: string, showPosition: boolean }} config
 */
export function buildDawarichStates(gladys, userId, snapshot, config) {
  const ids = dawarichIds(gladys, userId);
  const values = {
    distance_today: snapshot.today,
    distance_month: snapshot.counters.month,
    distance_year: snapshot.counters.year,
    distance_total: snapshot.counters.total,
    countries: snapshot.countries.length,
    cities: snapshot.counters.cities,
    points: snapshot.counters.points,
  };
  const states = [...DISTANCES, ...COUNTERS].map((key) => ({
    device_feature_external_id: ids.feature(key),
    state: values[key],
  }));
  const latest = snapshot.latest;
  states.push({
    device_feature_external_id: ids.feature('last_point'),
    text: latest ? formatDateTime(latest.at, config.language) : pick(NONE, config.language),
  });
  if (config.showPosition) {
    states.push({
      device_feature_external_id: ids.feature('position'),
      text: latest
        ? `${latest.lat.toFixed(5)}, ${latest.lon.toFixed(5)}`
        : pick(NONE, config.language),
    });
  }
  return states;
}

/** `ext:...:dawarich:2` -> '2', or null when not ours. */
export function parseUserId(gladys, externalId) {
  if (typeof externalId !== 'string') {
    return null;
  }
  const prefix = gladys.externalId(`${DAWARICH_TYPE}:`);
  if (!externalId.startsWith(prefix)) {
    return null;
  }
  const id = externalId.slice(prefix.length).split(':')[0];
  return id === '' ? null : id;
}
