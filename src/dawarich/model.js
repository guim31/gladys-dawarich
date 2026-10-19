// -----------------------------------------------------------------------------
// Pure helpers on the answers of Dawarich: the counters of the device and the
// distance travelled today, summed from the points of the day.
// -----------------------------------------------------------------------------

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

const count = (value) => (Number.isFinite(value) && value >= 0 ? Math.round(value) : 0);
const km = (value) => (Number.isFinite(value) && value >= 0 ? value : 0);

/**
 * The counters of `/stats` for the month and year of `date` (local time).
 * @param {object} stats the raw answer
 * @param {Date} date
 */
export function summarizeStats(stats, date) {
  const year = stats.yearlyStats.find((entry) => entry?.year === date.getFullYear());
  return {
    total: km(stats.totalDistanceKm),
    year: km(year?.totalDistanceKm),
    month: km(year?.monthlyDistanceKm?.[MONTHS[date.getMonth()]]),
    cities: count(stats.totalCitiesVisited),
    points: count(stats.totalPointsTracked),
  };
}

const EARTH_RADIUS_KM = 6371.0088;
const radians = (degrees) => (degrees * Math.PI) / 180;

/** Great-circle distance between two points, in km. */
export function haversine(a, b) {
  const dLat = radians(b.lat - a.lat);
  const dLon = radians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The length of a track, in km, rounded to 0.1. A hop faster than an
 * airliner (a GPS glitch Dawarich did not flag) is left out.
 * @param {{ lat: number, lon: number, at: number }[]} points oldest first
 */
export function trackLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const hop = haversine(points[i - 1], points[i]);
    const hours = Math.max(points[i].at - points[i - 1].at, 1) / 3600;
    if (hop / hours <= 1200) {
      total += hop;
    }
  }
  return Math.round(total * 10) / 10;
}

/** Local midnight of `date`, in Unix seconds (the container runs in the TZ of Gladys). */
export function startOfDay(date) {
  const midnight = new Date(date);
  midnight.setHours(0, 0, 0, 0);
  return Math.floor(midnight.getTime() / 1000);
}
