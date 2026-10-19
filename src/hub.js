// -----------------------------------------------------------------------------
// The hub: the link to one Dawarich account and everything Gladys sees of it —
// the device, its states, the connection status, the scene events and the
// widget.
//
// Dawarich pushes nothing: the container reads it every `refresh_minutes`
// (15 by default) on its own timer (should_poll: false). A read is the user
// (once), the statistics and the newest point; the points of the day and the
// countries of the last 30 days only when a new point arrived, and every
// country ever visited once an hour.
//
// Privacy: no coordinates, place or country names in the logs, at any level.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { buildDawarichDevice, buildDawarichStates, dawarichIds, parseUserId } from './devices.js';
import { DawarichClient, DawarichError } from './dawarich/client.js';
import { countryName } from './dawarich/countries.js';
import { startOfDay, summarizeStats, trackLength } from './dawarich/model.js';
import { MemoryStore } from './store.js';
import { NO_GEOCODING, STATUS_TEXT, TEST_TEXT, formatDateTime } from './texts.js';

const logger = createLogger({ name: 'dawarich-hub' });

export const WIDGET_KEY = 'travel';
export const TRIGGERS = { newCountry: 'new_country', stopped: 'tracking_stopped' };
/** The silences the "No position received" trigger can wait for, in hours. */
export const SILENCE_HOURS = ['1', '2', '3', '6', '12', '24', '48'];

export const DEFAULT_TIMINGS = {
  // requestWidgetRefresh is dropped by the core beyond one call per 10 s.
  widgetGap: 10_500,
  // An unchanged value is sent again before Gladys calls it stale (48 h).
  heartbeat: 6 * 3_600_000,
  requestTimeout: 20_000,
  // How often every country ever visited is read again (an import of an old
  // history adds some without a new point).
  countriesFullRead: 3_600_000,
};

export const RECENT_DAYS = 30;
// The countries of points imported in bulk would all fire at once: past that
// many in one read, the rest is recorded without firing.
export const MAX_EVENTS_PER_READ = 5;
// `end_at` of the country queries: far enough to include every point.
const FAR_FUTURE = 4_102_444_800; // 2100-01-01

const linkOf = (config) => JSON.stringify([config.url, config.apiKey]);

export class Hub {
  constructor({ gladys, fetch, timings, now = Date.now, store }) {
    this.gladys = gladys;
    this.fetch = fetch;
    this.timings = { ...DEFAULT_TIMINGS, ...timings };
    this.now = now;
    this.store = store ?? new MemoryStore();
    this.config = {
      url: null,
      urlInvalid: false,
      apiKey: '',
      refreshMinutes: 15,
      showPosition: false,
      language: 'fr',
    };
    this.client = null;
    /** the owner of the API key: { id, reverseGeocoding } */
    this.user = null;
    /** the last read: { counters, today, dayStart, latest, countries, recent } */
    this.snapshot = null;
    /** every country ever visited (codes), with the time of the last full read */
    this.allCountries = null;
    this.allCountriesAt = -Infinity;
    /** null (fine), or the kind of the last failure */
    this.failure = null;
    this.announced = false;
    this.lastStatus = '';
    /** what the triggers already saw: { userId, countries, silence: { at, fired } } */
    this.seen = null;
    this.eventFailing = false;
    this.devicesFailing = false;
    this.publishFailing = false;
    this.configuring = Promise.resolve();
    this.refreshTimer = null;
    this.refreshing = null;
    this.refreshAgain = false;
    this.widgetRefreshAt = 0;
    this.widgetTimer = null;
    this.stopped = false;
  }

  get language() {
    return this.config.language;
  }

  get loaded() {
    return this.snapshot !== null;
  }

  async start(config) {
    const saved = await this.store.load();
    const valid =
      typeof saved.userId === 'string' &&
      Array.isArray(saved.countries) &&
      saved.countries.every((code) => typeof code === 'string') &&
      saved.silence &&
      typeof saved.silence === 'object' &&
      Array.isArray(saved.silence.fired);
    // A damaged file is a new baseline, not a crash on every read.
    this.seen = valid ? saved : null;
    await this.reconfigure(config);
  }

  /** One configuration change at a time: a second one waits for the first. */
  reconfigure(config) {
    const run = this.configuring.then(() => this.#reconfigure(config));
    this.configuring = run.catch(() => {});
    return run;
  }

  async #reconfigure(config) {
    const previous = this.config;
    this.config = config;
    const linkChanged = linkOf(previous) !== linkOf(config) || !this.client;
    if (linkChanged || previous.refreshMinutes !== config.refreshMinutes) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (linkChanged) {
      this.client = null;
      this.user = null;
      this.snapshot = null;
      this.allCountries = null;
      this.allCountriesAt = -Infinity;
      this.failure = null;
      this.announced = false;
      if (config.url && config.apiKey) {
        this.client = new DawarichClient({
          url: config.url,
          apiKey: config.apiKey,
          fetch: this.fetch,
          timeout: this.timings.requestTimeout,
        });
      }
    }
    if (this.client && !this.refreshTimer) {
      this.refreshTimer = setInterval(
        () => this.refresh().catch((err) => logger.error('Read failed', err)),
        config.refreshMinutes * 60_000,
      );
      this.refreshTimer.unref?.();
    }
    if (linkChanged) {
      await this.refresh();
    } else {
      // Language, interval or position option only: same data, new names and texts.
      this.gladys.forgetPublishedStates?.();
      await this.#update();
    }
    await this.updateConnectionStatus();
  }

  /** Gladys reconnected (it may have restarted): send everything again. */
  async resync(config) {
    this.gladys.forgetPublishedStates?.();
    this.lastStatus = '';
    await this.reconfigure(config);
  }

  async stop() {
    this.stopped = true;
    clearInterval(this.refreshTimer);
    clearTimeout(this.widgetTimer);
    this.refreshTimer = null;
    await this.store.flush();
  }

  // --- Reading Dawarich -----------------------------------------------------

  /** Read Dawarich (one read at a time; a request during it runs once after). */
  refresh() {
    if (this.refreshing) {
      this.refreshAgain = true;
      return this.refreshing;
    }
    this.refreshing = (async () => {
      do {
        this.refreshAgain = false;
        try {
          await this.#refreshOnce();
        } catch (err) {
          // Never ends the loop: a read queued meanwhile (new address) still runs.
          logger.error('Read failed', err);
        }
      } while (this.refreshAgain && !this.stopped);
    })().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  async #refreshOnce() {
    const client = this.client;
    if (this.stopped) {
      return;
    }
    if (!client) {
      await this.publishDevices();
      return;
    }
    const now = this.now();
    const nowSeconds = Math.floor(now / 1000);
    const dayStart = startOfDay(new Date(now));
    const previous = this.snapshot;
    let user;
    let snapshot;
    let all = null;
    try {
      user = this.user ?? (await client.me());
      const [stats, latest] = await Promise.all([client.stats(), client.latestPoint()]);
      const moved = !previous || previous.latest?.at !== latest?.at;
      let today = 0;
      if (latest && latest.at >= dayStart) {
        today =
          !moved && previous.dayStart === dayStart
            ? previous.today
            : trackLength(await client.points(dayStart, nowSeconds + 60));
      }
      const recent = moved
        ? await client.countries(nowSeconds - RECENT_DAYS * 86_400, FAR_FUTURE)
        : previous.recent;
      if (!this.allCountries || now - this.allCountriesAt >= this.timings.countriesFullRead) {
        all = await client.countries(0, FAR_FUTURE);
      }
      snapshot = {
        counters: summarizeStats(stats, new Date(now)),
        today,
        dayStart,
        latest,
        recent,
        countries: [],
      };
    } catch (err) {
      if (client !== this.client) {
        return;
      }
      this.#fail(err);
      await this.updateConnectionStatus();
      return;
    }
    if (client !== this.client || this.stopped) {
      return;
    }
    this.user = user;
    if (all) {
      this.allCountries = new Map(all.map((c) => [c.code, c]));
      this.allCountriesAt = now;
    }
    for (const country of snapshot.recent) {
      this.allCountries.set(country.code, country);
    }
    snapshot.countries = [...this.allCountries.values()];
    this.snapshot = snapshot;
    this.#recover();
    await this.#update();
    await this.#announce(nowSeconds);
    await this.updateConnectionStatus();
  }

  /** Device, states and widget from the last read. */
  async #update() {
    await this.publishDevices();
    await this.publishStates();
    this.refreshWidget();
  }

  #fail(err) {
    const kind = err instanceof DawarichError ? err.kind : 'unreachable';
    if (this.failure === null) {
      logger.warn(`Dawarich: ${err.message}`);
    } else {
      logger.debug(`Dawarich still failing: ${err.message}`);
    }
    this.failure = kind;
    if (kind === 'unauthorized' || kind === 'invalid' || kind === 'not_found') {
      // Another key may belong to another user.
      this.user = null;
    }
  }

  #recover() {
    const points = this.snapshot.counters.points;
    if (this.failure !== null) {
      logger.info(`Dawarich answers again (${points} points)`);
    } else if (!this.announced) {
      logger.info(`Connected to Dawarich (${points} points)`);
    }
    this.announced = true;
    this.failure = null;
  }

  // --- Scene events ---------------------------------------------------------

  /**
   * Fire the new countries and the silences crossed since the last read. The
   * first read of a Dawarich user is a silent baseline: installing the
   * integration announces nothing already there.
   */
  async #announce(nowSeconds) {
    const userId = this.user.id;
    const known = this.seen?.userId === userId ? this.seen : null;
    const latest = this.snapshot.latest;
    const events = [];
    const countries = new Set(known?.countries ?? []);
    if (known) {
      // Only a country of the last 30 days is new: one that appears with an
      // imported old history is recorded silently.
      for (const country of this.snapshot.recent) {
        if (!countries.has(country.code)) {
          events.push({
            trigger: TRIGGERS.newCountry,
            data: { country: countryName(country, this.language), country_code: country.code },
            country: country.code,
          });
        }
      }
    }
    // The silence thresholds crossed since the newest point.
    let silence = known?.silence ?? { at: null, fired: [] };
    if (latest?.at !== silence.at) {
      silence = { at: latest?.at ?? null, fired: [] };
    }
    const fired = new Set(silence.fired);
    if (latest) {
      const age = nowSeconds - latest.at;
      for (const hours of SILENCE_HOURS) {
        if (age >= Number(hours) * 3600 && !fired.has(hours)) {
          if (known) {
            events.push({
              trigger: TRIGGERS.stopped,
              data: { hours, last_position: formatDateTime(latest.at, this.language) },
              hours,
            });
          } else {
            fired.add(hours);
          }
        }
      }
    }
    const newCountries = events.filter((e) => e.trigger === TRIGGERS.newCountry);
    if (newCountries.length > MAX_EVENTS_PER_READ) {
      logger.info(`${newCountries.length} new countries at once: ${MAX_EVENTS_PER_READ} announced`);
      for (const event of newCountries.slice(MAX_EVENTS_PER_READ)) {
        events.splice(events.indexOf(event), 1);
        countries.add(event.country);
      }
    }
    for (const event of events) {
      logger.debug(`${event.trigger}${event.hours ? ` (${event.hours} h)` : ''}`);
      let taken = true;
      try {
        await this.gladys.publishSceneEvent(event.trigger, event.data);
        if (this.eventFailing) {
          logger.info('Scene events accepted again');
        }
        this.eventFailing = false;
      } catch (err) {
        // A refusal for good (4xx but 429) is not retried: it would be
        // refused at every read.
        const status = err?.status;
        taken = Number.isInteger(status) && status >= 400 && status < 500 && status !== 429;
        if (this.eventFailing) {
          logger.debug(`Cannot fire ${event.trigger}: ${err.message}`);
        } else {
          logger.warn(`Cannot fire ${event.trigger}: ${err.message}`);
        }
        this.eventFailing = true;
      }
      // An event Gladys did not take (disconnected, restarting) is not
      // recorded: the next read fires it again.
      if (taken) {
        if (event.country) {
          countries.add(event.country);
        } else {
          fired.add(event.hours);
        }
      }
    }
    if (!known) {
      for (const country of this.snapshot.countries) {
        countries.add(country.code);
      }
    } else {
      // Countries of an imported history (not recent): known, never announced.
      for (const country of this.snapshot.countries) {
        if (!this.snapshot.recent.some((c) => c.code === country.code)) {
          countries.add(country.code);
        }
      }
    }
    const next = {
      userId,
      countries: [...countries].sort(),
      silence: { at: silence.at, fired: SILENCE_HOURS.filter((h) => fired.has(h)) },
    };
    if (JSON.stringify(next) !== JSON.stringify(this.seen)) {
      this.seen = next;
      await this.store.save(next);
    }
  }

  // --- Device and states ----------------------------------------------------

  #isCreated(externalId) {
    return (this.gladys.devices ?? []).some((device) => device.external_id === externalId);
  }

  buildDevices() {
    if (!this.user || !this.snapshot) {
      return [];
    }
    return [buildDawarichDevice(this.gladys, this.user.id, this.config)];
  }

  async publishDevices() {
    if (this.stopped) {
      return;
    }
    try {
      await this.gladys.publishDiscoveredDevices(this.buildDevices());
    } catch (err) {
      if (this.devicesFailing) {
        logger.debug(`Cannot publish the devices: ${err.message}`);
      } else {
        logger.warn(`Cannot publish the devices: ${err.message}`);
      }
      this.devicesFailing = true;
      return;
    }
    this.devicesFailing = false;
  }

  /**
   * The states of the device, once the user added it (Gladys drops the others).
   * @param {boolean} [force] the device was just added
   */
  async publishStates(force = false) {
    if (!this.user || !this.snapshot || this.stopped) {
      return;
    }
    const deviceId = dawarichIds(this.gladys, this.user.id).device;
    if (!force && !this.#isCreated(deviceId)) {
      return;
    }
    const states = buildDawarichStates(this.gladys, this.user.id, this.snapshot, this.config);
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: this.timings.heartbeat });
    } catch (err) {
      if (this.publishFailing) {
        logger.debug(`Cannot publish the states: ${err.message}`);
      } else {
        logger.warn(`Cannot publish the states: ${err.message}`);
      }
      this.publishFailing = true;
      return;
    }
    if (this.publishFailing) {
      logger.info('States published again');
    }
    this.publishFailing = false;
  }

  /** The user added the device: states sent before were dropped by Gladys. */
  async onDeviceCreated(device) {
    const userId = parseUserId(this.gladys, device?.external_id);
    if (!userId || userId !== this.user?.id) {
      return;
    }
    this.gladys.forgetPublishedStates?.(device.external_id);
    await this.publishStates(true);
    this.refreshWidget();
  }

  /** onPoll (the device is not polled: the container reads on its timer). */
  async poll(device) {
    const userId = parseUserId(this.gladys, device?.external_id);
    if (userId && userId === this.user?.id) {
      await this.publishStates(true);
    }
  }

  // --- Widget ---------------------------------------------------------------

  /** Nudge the open dashboards, with a trailing call inside the core's 10 s gap. */
  refreshWidget() {
    if (this.stopped) {
      return;
    }
    const wait = this.widgetRefreshAt + this.timings.widgetGap - this.now();
    if (wait <= 0) {
      this.widgetRefreshAt = this.now();
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
      return;
    }
    if (!this.widgetTimer) {
      this.widgetTimer = setTimeout(() => {
        this.widgetTimer = null;
        this.refreshWidget();
      }, wait);
      this.widgetTimer.unref?.();
    }
  }

  // --- Connection status ----------------------------------------------------

  statusKey() {
    if (this.config.urlInvalid) {
      return 'invalid';
    }
    if (!this.config.url) {
      return 'none';
    }
    if (!this.config.apiKey) {
      return 'api_key';
    }
    if (this.failure) {
      return (
        { unauthorized: 'unauthorized', invalid: 'invalid_answer', not_found: 'invalid_answer' }[
          this.failure
        ] ?? 'unreachable'
      );
    }
    return null;
  }

  statusMessage() {
    const key = this.statusKey();
    if (!key) {
      return null;
    }
    return Object.fromEntries(
      Object.entries(STATUS_TEXT).map(([language, table]) => [language, table[key]]),
    );
  }

  async updateConnectionStatus() {
    if (this.stopped) {
      return;
    }
    // Nothing to say before the first answer or failure.
    if (this.client && !this.loaded && this.failure === null) {
      return;
    }
    const message = this.statusMessage();
    const connected = Boolean(this.client) && this.loaded && this.failure === null;
    const fingerprint = JSON.stringify({ connected, message });
    if (fingerprint === this.lastStatus) {
      return;
    }
    try {
      await this.gladys.setConnectionStatus(connected, message ?? undefined);
      // Recorded once Gladys took it: a failed call is sent again next time.
      this.lastStatus = fingerprint;
    } catch (err) {
      logger.warn(`Cannot set the connection status: ${err.message}`);
    }
  }

  // --- Actions --------------------------------------------------------------

  /** "Test the connection": a fresh read, then its outcome. */
  async testReport() {
    if (!this.client) {
      return this.statusMessage();
    }
    await this.refresh();
    const message = this.statusMessage();
    if (message) {
      return message;
    }
    return Object.fromEntries(
      Object.entries(TEST_TEXT).map(([language, render]) => [
        language,
        render(this.snapshot.counters.points, this.snapshot.countries.length) +
          (this.user.reverseGeocoding ? '' : ` ${NO_GEOCODING[language]}`),
      ]),
    );
  }
}
