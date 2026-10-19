# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.0] - 2026-10-19

### Added

- A **Dawarich** device for the user of the API key: distance of the day, the
  month, the year and in total (km), countries and cities visited, points
  recorded, time of the last position, and its coordinates as an option (off by
  default).
- Scene triggers **New country visited** and **No position received** (1 to 48
  hours: the tracking app stopped).
- Dashboard widget **Travels**: distances, countries, age of the last position
  and countries of the last 30 days.
- **Test the connection** action, which also tells when reverse geocoding is
  off in Dawarich.
- English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-dawarich/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/guim31/gladys-dawarich/releases/tag/v1.0.0
