// -----------------------------------------------------------------------------
// The hub against the fake Gladys and a fake Dawarich: device and states,
// distance of the day, scene events (baseline, new countries, silences,
// restart), the container's own timer, the connection status and the widget.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { DawarichClient } from '../src/dawarich/client.js';
import { haversine, summarizeStats, trackLength } from '../src/dawarich/model.js';
import { MemoryStore } from '../src/store.js';
import { API_KEY, FIXTURES, HOST, NOW, createDawarich, settle } from './helpers/fakeDawarich.js';
import { USER, createAll, createWorld, dawarichDevice, dawarichFeature } from './helpers/world.js';

const HOUR = 3_600_000;
const stateOf = (fake, key) => fake.lastState(dawarichFeature(key));

test('the real stats answer gives the counters of the month and the year', () => {
  const counters = summarizeStats(FIXTURES.stats, new Date(NOW));
  assert.deepEqual(counters, { total: 735, year: 735, month: 218, cities: 0, points: 214 });
  // Another year: nothing recorded yet.
  assert.equal(summarizeStats(FIXTURES.stats, new Date(Date.UTC(2027, 0, 5))).year, 0);
});

test('the distance of a track: great circle, GPS jumps left out', () => {
  const toulouse = { lat: 43.6047, lon: 1.4442, at: 0 };
  const paris = { lat: 48.8566, lon: 2.3522, at: 4 * 3600 };
  assert.ok(Math.abs(haversine(toulouse, paris) - 588) < 2);
  assert.equal(trackLength([toulouse, paris]), Math.round(haversine(toulouse, paris) * 10) / 10);
  // 588 km in one minute: a glitch.
  assert.equal(trackLength([toulouse, { ...paris, at: 60 }]), 0);
  assert.equal(trackLength([]), 0);
});

test('one device with the counters, published once the user adds it', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const [device] = world.fake.discoveredDevices;
  assert.equal(device.external_id, dawarichDevice());
  assert.equal(device.should_poll, false);
  assert.deepEqual(
    device.features.map((f) => f.name),
    [
      "Distance aujourd'hui",
      'Distance ce mois-ci',
      'Distance cette année',
      'Distance totale',
      'Pays visités',
      'Villes visitées',
      'Points enregistrés',
      'Dernière position reçue',
    ],
  );
  assert.equal(world.fake.states.length, 0, 'nothing before the device is added');
  await createAll(world.fake);
  const fake = world.fake;
  assert.equal(stateOf(fake, 'distance_month'), 218);
  assert.equal(stateOf(fake, 'distance_year'), 735);
  assert.equal(stateOf(fake, 'countries'), 3);
  assert.equal(stateOf(fake, 'points'), 214);
  // 30 hops of about 0.21 km today.
  const today = stateOf(fake, 'distance_today');
  assert.ok(today > 6 && today < 7, String(today));
  assert.match(stateOf(fake, 'last_point'), /^19\/10\/2026 \d\d:\d\d$/);
  assert.equal(stateOf(fake, 'position'), undefined, 'no coordinates by default');
});

test('the coordinates only with the option, never in another feature', async (t) => {
  const world = await createWorld({
    config: { url: HOST, api_key: API_KEY, show_position: true, language: 'en' },
  });
  t.after(() => world.app.stop());
  await createAll(world.fake);
  assert.equal(stateOf(world.fake, 'position'), '43.64970, 1.39920');
  assert.ok(!stateOf(world.fake, 'last_point').includes('43.6'));
});

test('no point today: 0 km, and the points of the day are not read again for nothing', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createAll(world.fake);
  const pointReads = () =>
    world.server.state.requests.filter((r) => r.startsWith('/api/v1/points?start_at')).length;
  const before = pointReads();
  await world.hub.refresh();
  assert.equal(pointReads(), before, 'same newest point: the day is not read again');
  // The next day, nothing new.
  world.clock.now += 12 * HOUR;
  await world.hub.refresh();
  assert.equal(stateOf(world.fake, 'distance_today'), 0);
});

test('first read is a silent baseline; a new country and silences fire once', async (t) => {
  const store = new MemoryStore();
  const world = await createWorld({ store });
  t.after(() => world.app.stop());
  assert.deepEqual(world.fake.sceneEvents, [], 'nothing on installation');
  assert.deepEqual(store.data.countries, ['BEL', 'ESP', 'FRA']);
  assert.deepEqual(store.data.silence.fired, ['1', '2'], 'the last point is already 2 h old');

  // A country of an old imported history: recorded, never announced.
  world.server.state.countries.push({ iso_a3: 'PRT', name: 'Portugal', at: 1_600_000_000 });
  world.clock.now += HOUR; // the full country list is read once an hour
  world.server.addPoint(60, { country: { code: 'ITA', name: 'Italy' } });
  await world.hub.refresh();
  const countries = world.fake.sceneEvents.filter((e) => e.key === 'new_country');
  assert.deepEqual(
    countries.map((e) => e.data),
    [{ country: 'Italie', country_code: 'ITA' }],
  );
  assert.deepEqual(store.data.countries, ['BEL', 'ESP', 'FRA', 'ITA', 'PRT']);
  await world.hub.refresh();
  assert.equal(world.fake.sceneEvents.filter((e) => e.key === 'new_country').length, 1);

  // Then silence: 1 h, 2 h, 3 h... each threshold once.
  world.clock.now += 2 * HOUR + 120_000;
  await world.hub.refresh();
  await world.hub.refresh();
  const stopped = world.fake.sceneEvents.filter((e) => e.key === 'tracking_stopped');
  assert.deepEqual(
    stopped.map((e) => e.data.hours),
    ['1', '2'],
  );
  assert.match(stopped[0].data.last_position, /^19\/10\/2026 /);
  // A new point resets the silence.
  world.server.addPoint(10);
  await world.hub.refresh();
  assert.deepEqual(store.data.silence.fired, []);
});

test('a country the points get late is announced, not taken for an import', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  // A buffered upload: points of yesterday in Italy, older than the newest
  // point, so the newest point does not change.
  world.server.state.countries.push({
    iso_a3: 'ITA',
    name: 'Italy',
    at: Math.floor(world.clock.now / 1000) - 86_400,
  });
  world.clock.now += HOUR;
  await world.hub.refresh();
  assert.deepEqual(
    world.fake.sceneEvents.filter((e) => e.key === 'new_country').map((e) => e.data.country_code),
    ['ITA'],
  );
});

test('an API key cut by a line break still works, and never reaches the logs', async (t) => {
  const world = await createWorld({
    config: { url: HOST, api_key: `${API_KEY.slice(0, 20)}\n${API_KEY.slice(20)}` },
  });
  t.after(() => world.app.stop());
  assert.equal(world.fake.connectionStatus.connected, true);
});

test('a restart neither announces again nor forgets what was seen', async (t) => {
  const store = new MemoryStore();
  const first = await createWorld({ store });
  first.server.addPoint(60, { country: { code: 'ITA', name: 'Italy' } });
  await first.hub.refresh();
  await first.app.stop();
  assert.equal(first.fake.sceneEvents.length, 1);

  const second = await createWorld({ store, server: first.server, clock: first.clock });
  t.after(() => second.app.stop());
  assert.deepEqual(second.fake.sceneEvents, []);
  // While the integration was off, the phone went silent for 7 hours.
  second.clock.now += 7 * HOUR;
  await second.hub.refresh();
  assert.deepEqual(
    second.fake.sceneEvents.map((e) => e.data.hours),
    ['1', '2', '3', '6'],
  );
});

test('an event Gladys refuses for now is fired again at the next read', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const original = world.gladys.publishSceneEvent.bind(world.gladys);
  let failures = 1;
  world.gladys.publishSceneEvent = async (...args) => {
    if (failures > 0) {
      failures -= 1;
      throw Object.assign(new Error('Gladys restarting'), { status: 503 });
    }
    return original(...args);
  };
  world.server.addPoint(60, { country: { code: 'ITA', name: 'Italy' } });
  await world.hub.refresh();
  assert.equal(world.fake.sceneEvents.length, 0);
  await world.hub.refresh();
  assert.equal(world.fake.sceneEvents.filter((e) => e.key === 'new_country').length, 1);
});

test('the container reads Dawarich on its own timer, without onPoll', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const world = await createWorld({ config: { url: HOST, api_key: API_KEY } });
  t.after(() => world.app.stop());
  await createAll(world.fake);
  const reads = () => world.server.state.requests.filter((r) => r === '/api/v1/stats').length;
  const before = reads();
  world.server.state.stats.totalPointsTracked = 999;
  t.mock.timers.tick(15 * 60_000);
  await settle(20);
  assert.equal(reads(), before + 1);
  assert.equal(stateOf(world.fake, 'points'), 999);
});

test('connection status: wrong key, unreachable, back', async (t) => {
  const world = await createWorld({ config: { url: HOST, api_key: 'wrong' } });
  t.after(() => world.app.stop());
  const last = () => world.fake.connectionStatus;
  assert.equal(last().connected, false);
  assert.match(last().message.en, /refused the API key/);
  assert.equal(world.fake.discoveredDevices.length, 0);

  await world.fake.configUpdated({ url: HOST, api_key: API_KEY });
  await settle(20);
  assert.equal(last().connected, true);
  world.server.goDown();
  await world.hub.refresh();
  assert.match(last().message.fr, /Dawarich ne répond pas/);
  world.server.goUp();
  await world.hub.refresh();
  assert.equal(last().connected, true);
});

test('a page that is not Dawarich is told apart', async (t) => {
  const server = createDawarich();
  server.state.answer = () =>
    new Response('<html>login</html>', { status: 200, headers: { 'content-type': 'text/html' } });
  const world = await createWorld({ server });
  t.after(() => world.app.stop());
  assert.match(world.fake.connectionStatus.message.en, /does not answer like Dawarich/);
});

test('the test action reports the counters, and a missing geocoding', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const ack = await world.fake.action('test_connection', {});
  assert.equal(ack.success, true);
  assert.match(ack.data.message.en, /214 point\(s\) recorded, 3 country\(ies\) visited/);
  assert.match(ack.data.message.en, /Reverse geocoding is off/);
});

test('the widget: valid content, distances, countries of the last 30 days', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const ack = await world.fake.widgetGet('travel', { language: 'fr', settings: {} });
  assert.equal(ack.success, true, ack.error);
  const content = ack.data.content;
  for (const language of ['en', 'fr', 'de', 'es']) {
    const localized = (await world.fake.widgetGet('travel', { language })).data.content;
    assert.deepEqual(validateWidgetContent(localized), [], language);
  }
  const tiles = content.components.filter((c) => c.type === 'value');
  assert.deepEqual(
    tiles.map((c) => [c.label, c.unit ?? null]),
    [
      ["Aujourd'hui", 'km'],
      ['Ce mois-ci', 'km'],
      ['Cette année', 'km'],
      ['Pays', null],
    ],
  );
  const text = content.components.find((c) => c.type === 'text');
  // Belgium (40 days) and Spain (150 days) are older than 30 days.
  assert.equal(text.text, '30 derniers jours : France');
  const status = content.components.find((c) => c.type === 'status');
  assert.equal(status.items[0].color, 'warning', 'last point 2 h ago');
  assert.ok(content.components.length <= 8);
});

test('the widget before the first answer', async (t) => {
  const world = await createWorld({ config: { url: HOST, api_key: '' } });
  t.after(() => world.app.stop());
  const ack = await world.fake.widgetGet('travel', { language: 'de', settings: {} });
  assert.match(ack.data.content.components[0].text, /Warte auf Dawarich/);
});

test('the client pages through a long day', async () => {
  const server = createDawarich();
  const start = Math.floor(NOW / 1000) - 10 * 3600;
  server.state.points = Array.from({ length: 12_000 }, (_, i) => ({
    id: i,
    latitude: '43.6',
    longitude: '1.4',
    timestamp: start + i * 2,
  }));
  const client = new DawarichClient({ url: HOST, apiKey: API_KEY, fetch: server.fetch });
  const points = await client.points(start, start + 86_400);
  assert.equal(points.length, 12_000);
  assert.equal(
    server.state.requests.filter((r) => r.startsWith('/api/v1/points')).length,
    3,
    '3 pages of 5000',
  );
  assert.equal((await client.me()).id, USER);
});
