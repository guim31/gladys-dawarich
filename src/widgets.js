// -----------------------------------------------------------------------------
// The "Travels" dashboard widget: the distances of the day, the month and the
// year, the number of countries visited, how long ago the last position
// arrived, and the countries of the last 30 days. Read only.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { countryName } from './dawarich/countries.js';
import { RECENT_DAYS, SILENCE_HOURS, WIDGET_KEY } from './hub.js';
import { formatAge, pick } from './texts.js';

export const TEXT = {
  today: { en: 'Today', fr: "Aujourd'hui", de: 'Heute', es: 'Hoy' },
  month: { en: 'This month', fr: 'Ce mois-ci', de: 'Diesen Monat', es: 'Este mes' },
  year: { en: 'This year', fr: 'Cette année', de: 'Dieses Jahr', es: 'Este año' },
  countries: { en: 'Countries', fr: 'Pays', de: 'Länder', es: 'Países' },
  last_position: {
    en: 'Last position',
    fr: 'Dernière position',
    de: 'Letzte Position',
    es: 'Última posición',
  },
  none: { en: 'None yet', fr: 'Aucune', de: 'Noch keine', es: 'Ninguna' },
  recent: {
    en: `Last ${RECENT_DAYS} days: {list}`,
    fr: `${RECENT_DAYS} derniers jours : {list}`,
    de: `Letzte ${RECENT_DAYS} Tage: {list}`,
    es: `Últimos ${RECENT_DAYS} días: {list}`,
  },
  no_recent: {
    en: `No country in the last ${RECENT_DAYS} days.`,
    fr: `Aucun pays ces ${RECENT_DAYS} derniers jours.`,
    de: `Kein Land in den letzten ${RECENT_DAYS} Tagen.`,
    es: `Ningún país en los últimos ${RECENT_DAYS} días.`,
  },
  unavailable: {
    en: 'Dawarich does not answer right now: values of the last read.',
    fr: 'Dawarich ne répond pas pour le moment : valeurs de la dernière lecture.',
    de: 'Dawarich antwortet gerade nicht: Werte der letzten Abfrage.',
    es: 'Dawarich no responde en este momento: valores de la última lectura.',
  },
  waiting: {
    en: 'Waiting for Dawarich: check the configuration of the integration.',
    fr: "En attente de Dawarich : vérifiez la configuration de l'intégration.",
    de: 'Warte auf Dawarich: Prüfe die Konfiguration der Integration.',
    es: 'Esperando a Dawarich: compruebe la configuración de la integración.',
  },
};

const cut = (text, max) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);
const kmValue = (km) => (km >= 1000 ? Math.round(km) : Math.round(km * 10) / 10);

export function buildContent(hub, { language = 'en' } = {}) {
  const snapshot = hub.snapshot;
  if (!snapshot) {
    return {
      ttl_seconds: 60,
      components: [{ type: 'text', variant: 'body', text: pick(TEXT.waiting, language) }],
    };
  }
  const tile = (key, value, icon, unit) => ({
    type: 'value',
    label: pick(TEXT[key], language),
    value,
    icon,
    ...(unit ? { unit } : {}),
  });
  const components = [
    tile('today', kmValue(snapshot.today), 'navigation', 'km'),
    tile('month', kmValue(snapshot.counters.month), 'calendar', 'km'),
    tile('year', kmValue(snapshot.counters.year), 'map', 'km'),
    tile('countries', snapshot.countries.length, 'globe'),
  ];
  const latest = snapshot.latest;
  const age = latest ? hub.now() / 1000 - latest.at : null;
  // Same thresholds as the "No position received" trigger: yellow past the
  // first one, red past a day.
  const color =
    age === null
      ? WIDGET_COLORS.NEUTRAL
      : age >= 24 * 3600
        ? WIDGET_COLORS.DANGER
        : age >= Number(SILENCE_HOURS[0]) * 3600
          ? WIDGET_COLORS.WARNING
          : WIDGET_COLORS.SUCCESS;
  components.push({
    type: 'status',
    items: [
      {
        label: pick(TEXT.last_position, language),
        value: latest ? formatAge(age, language) : pick(TEXT.none, language),
        icon: 'clock',
        color,
      },
    ],
  });
  const names = snapshot.recent.map((country) => countryName(country, language)).sort();
  components.push({
    type: 'text',
    variant: 'body',
    text:
      names.length > 0
        ? cut(pick(TEXT.recent, language).replace('{list}', names.join(', ')), 300)
        : pick(TEXT.no_recent, language),
  });
  if (hub.failure !== null) {
    components.push({ type: 'text', variant: 'caption', text: pick(TEXT.unavailable, language) });
  }
  // The hub nudges the widget after every read.
  return { ttl_seconds: 300, components };
}

export const WIDGETS = {
  [WIDGET_KEY]: {
    get: (hub, request) => buildContent(hub, request),
  },
};
