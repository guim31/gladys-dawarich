# Dawarich for Gladys Assistant

A [Gladys Assistant](https://gladysassistant.com) integration for
[Dawarich](https://dawarich.app), the self-hosted location history (an
alternative to Google Timeline): the distances you travel and the countries you
visit become Gladys features, and scenes react to a new country or to a phone
that stopped sending its position.

Tested against a real Dawarich 1.16.0 server (official Docker image, PostGIS,
Redis, Sidekiq) with simulated trips, not with a phone on the road: feedback
welcome. For live GPS tracking, see
[gladys-traccar](https://github.com/guim31/gladys-traccar): this integration is
about history and statistics.

## Features

- **One device** for the Dawarich user of the API key: distance today, this
  month, this year and in total (km), countries and cities visited, points
  recorded, time of the last position. The coordinates of the last position are
  an option, **off by default**.
- **Scene triggers**: new country visited (with its name and ISO code), no
  position received for 1, 2, 3, 6, 12, 24 or 48 hours (the tracking app
  stopped).
- **Dashboard widget** "Travels": the distances, the countries, how long ago the
  last position arrived and the countries of the last 30 days.
- **Private**: read only, local network only; no coordinates, place or country
  names in the logs.
- English, French, German and Spanish.

## Requirements

- Gladys Assistant 5.1 or later.
- A Dawarich server reachable from Gladys (checked on 1.16.0), and its API key
  (account menu → **Account**).

## Installation

1. In Gladys, open **Integrations → Install from GitHub** and enter
   `https://github.com/guim31/gladys-dawarich` (or find **Dawarich** in the
   catalog).
2. In **Configuration**, enter the address of Dawarich (`192.168.1.50`, port
   3000 by default) and the API key, save, and click **Test the connection**.
3. Add the **Dawarich** device from the **Discovery** tab.

The user guide is in [`docs/en.md`](docs/en.md) (also in
[French](docs/fr.md), [German](docs/de.md) and [Spanish](docs/es.md)); Gladys
links it from the Configuration screen.

## How it works

Every 15 minutes (5 to 60), the container reads `GET /api/v1/stats` (whole
kilometres per month and year, recomputed by Dawarich every hour) and the newest
point (`GET /api/v1/points?order=desc&per_page=1&slim=true`). When a new point
arrived, it reads the points of the day to sum today's distance (great circle,
GPS jumps faster than a plane left out) and the countries of the last 30 days
(`GET /api/v1/countries/visited`, from the PostGIS borders: no reverse geocoding
needed). Every country ever visited is read once an hour. The first read is a
silent baseline, kept in `/data`, so neither an installation nor a restart
announces anything already there.

## Limitations

- Read only: positions of other Gladys devices cannot be sent to Dawarich (an
  integration does not read the devices of the others).
- Cities need reverse geocoding enabled in Dawarich; countries do not.
- The triggers react at the next read, up to the chosen interval late.
- One Dawarich user per integration.

## Development

```bash
npm ci
npm run format:check && npm run lint && npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests run against the SDK's fake Gladys and a fake Dawarich answering with
bodies recorded on a real Dawarich 1.16.0 server (`test/fixtures/dawarich/`,
simulated trips only).

## Credits

- [Dawarich](https://github.com/Freika/dawarich), by Freika and contributors
  (AGPL-3.0): this integration only talks to its REST API and
  contains none of its code. The ISO 3166 alpha-3 → alpha-2 table comes from
  its `countries` table (Natural Earth, public domain).
- [dawarich-api](https://pypi.org/project/dawarich-api/), by Albin Lindqvist
  (AGPL-3.0), the Python client of the Home Assistant integration: read for
  the map of the endpoints, none of its code is used.
- The cover shows the official Dawarich icon (`public/icon.svg` of the Dawarich
  repository).

## Disclaimer

This project is not affiliated with, endorsed or sponsored by the Dawarich
project.

## License

Apache-2.0, see [`LICENSE`](LICENSE).
