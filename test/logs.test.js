// What reaches `docker logs` at the default level (info): the lifecycle only.
// A normal cycle (reads, published states, events, polls) writes nothing at
// info, an outage logs one line, and its recovery one more. No API key, no
// coordinates and no country name at any level.
//
// The SDK logger writes through console.log (debug, info) and console.error
// (warn, error), re-reading LOG_LEVEL on every call: the tests capture both.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOST, createDawarich } from './helpers/fakeDawarich.js';
import { createAll, createWorld } from './helpers/world.js';

function captureLogs(t) {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = 'debug';
  const captured = [];
  const record = (...args) => captured.push(args.map(String).join(' '));
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.after(() => {
    if (previous === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = previous;
    }
  });
  return {
    all: () => [...captured],
    lines: () =>
      captured.filter((line) => !line.includes('[DEBUG]') && line.includes('[dawarich-')),
    reset: () => captured.splice(0),
  };
}

test('a normal cycle writes nothing at info: reads, states, events, polls', async (t) => {
  const logs = captureLogs(t);
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createAll(world.fake);
  const start = logs.lines();
  assert.equal(start.length, 1, start.join('\n'));
  assert.match(start[0], /Connected to Dawarich \(214 points\)/);
  logs.reset();
  world.server.addPoint(30, { country: { code: 'ITA', name: 'Italy' } });
  for (let i = 0; i < 4; i += 1) {
    world.clock.now += 3_600_000;
    await world.hub.refresh();
  }
  await world.fake.poll(world.fake.discoveredDevices[0]);
  await world.fake.widgetGet('travel', { settings: {} });
  assert.ok(world.fake.sceneEvents.length >= 4, 'events were fired');
  assert.deepEqual(logs.lines(), [], 'nothing at info or above');
});

test('Dawarich down: one warning, nothing per attempt, one line when it is back', async (t) => {
  const logs = captureLogs(t);
  const world = await createWorld();
  t.after(() => world.app.stop());
  logs.reset();
  world.server.goDown();
  for (let i = 0; i < 4; i += 1) {
    await world.hub.refresh();
  }
  const down = logs.lines();
  assert.equal(down.length, 1, down.join('\n'));
  assert.match(down[0], /\[WARN\].*Dawarich unreachable \(ECONNREFUSED\)/);
  logs.reset();
  world.server.goUp();
  await world.hub.refresh();
  const back = logs.lines();
  assert.equal(back.length, 1, back.join('\n'));
  assert.match(back[0], /\[INFO\].*Dawarich answers again \(214 points\)/);
});

test('no API key, coordinates nor place names in the logs, even in debug', async (t) => {
  const logs = captureLogs(t);
  for (const apiKey of [
    's3cr3t_wrong_key',
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  ]) {
    const world = await createWorld({
      server: createDawarich(),
      config: { url: HOST, api_key: apiKey, show_position: true },
    });
    await createAll(world.fake);
    world.server.addPoint(30, {
      lat: 41.9028,
      lon: 12.4964,
      country: { code: 'ITA', name: 'Italy' },
    });
    world.clock.now += 7 * 3_600_000;
    await world.hub.refresh();
    await world.app.stop();
  }
  const all = logs.all().join('\n');
  for (const secret of [
    's3cr3t_wrong_key',
    '0123456789abcdef',
    '41.90',
    '12.49',
    '43.6',
    'Ital',
    'France',
    'Spain',
  ]) {
    assert.ok(!all.includes(secret), secret);
  }
});
