// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys (a real GladysIntegration on an
// in-memory transport), the integration wired on it by registerHandlers, and
// a fake Dawarich.
// -----------------------------------------------------------------------------

import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { MemoryStore } from '../../src/store.js';
import { API_KEY, HOST, NOW, createDawarich, settle } from './fakeDawarich.js';

export const FAST_TIMINGS = { widgetGap: 0, requestTimeout: 200 };

export async function createWorld({
  clock = { now: NOW },
  server = createDawarich({ now: () => clock.now }),
  config = { url: HOST, api_key: API_KEY },
  devices = [],
  connect = true,
  store = new MemoryStore(),
} = {}) {
  const gladys = createFakeGladys({ config, devices });
  const app = registerHandlers(gladys, {
    fetch: server.fetch,
    timings: FAST_TIMINGS,
    now: () => clock.now,
    store,
  });
  if (connect) {
    await gladys.connect();
    await settle(20);
  }
  return { gladys, app, hub: app.hub, server, store, clock, fake: gladys.fake };
}

// The Dawarich user of the fixtures.
export const USER = '2';
export const dawarichDevice = (user = USER) => `ext:test-integration:dawarich:${user}`;
export const dawarichFeature = (key, user = USER) => `${dawarichDevice(user)}:${key}`;

/** Add every discovered device to Gladys, as the user would. */
export async function createAll(fake) {
  for (const device of fake.discoveredDevices) {
    await fake.deviceCreated(device);
  }
  await settle();
}
