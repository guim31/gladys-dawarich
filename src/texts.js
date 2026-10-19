// -----------------------------------------------------------------------------
// Every text the container produces, in the four languages of the Gladys
// interface. German says "du", Spanish "usted" (test/i18n.test.js).
// -----------------------------------------------------------------------------

// Feature names (frozen by Gladys at creation).
export const NAMES = {
  en: {
    distance_today: 'Distance today',
    distance_month: 'Distance this month',
    distance_year: 'Distance this year',
    distance_total: 'Total distance',
    countries: 'Countries visited',
    cities: 'Cities visited',
    points: 'Points recorded',
    last_point: 'Last position received',
    position: 'Last position (coordinates)',
  },
  fr: {
    distance_today: "Distance aujourd'hui",
    distance_month: 'Distance ce mois-ci',
    distance_year: 'Distance cette année',
    distance_total: 'Distance totale',
    countries: 'Pays visités',
    cities: 'Villes visitées',
    points: 'Points enregistrés',
    last_point: 'Dernière position reçue',
    position: 'Dernière position (coordonnées)',
  },
  de: {
    distance_today: 'Strecke heute',
    distance_month: 'Strecke diesen Monat',
    distance_year: 'Strecke dieses Jahr',
    distance_total: 'Gesamtstrecke',
    countries: 'Besuchte Länder',
    cities: 'Besuchte Städte',
    points: 'Aufgezeichnete Punkte',
    last_point: 'Letzte empfangene Position',
    position: 'Letzte Position (Koordinaten)',
  },
  es: {
    distance_today: 'Distancia hoy',
    distance_month: 'Distancia este mes',
    distance_year: 'Distancia este año',
    distance_total: 'Distancia total',
    countries: 'Países visitados',
    cities: 'Ciudades visitadas',
    points: 'Puntos registrados',
    last_point: 'Última posición recibida',
    position: 'Última posición (coordenadas)',
  },
};

/** The "Last position received" text of an empty account. */
export const NONE = { en: 'None yet', fr: 'Aucune', de: 'Noch keine', es: 'Ninguna' };

export const STATUS_TEXT = {
  en: {
    none: 'Enter the address of Dawarich and an API key in the configuration.',
    invalid: 'The Dawarich address is not valid: enter an address like 192.168.1.50:3000.',
    api_key: 'Enter the API key shown in Dawarich → Account.',
    unauthorized: 'Dawarich refused the API key: copy it again from the Account page.',
    unreachable: 'Dawarich does not answer: check its address and that it is running.',
    invalid_answer: 'This address does not answer like Dawarich: check the address and the port.',
  },
  fr: {
    none: "Saisissez l'adresse de Dawarich et une clé d'API dans la configuration.",
    invalid:
      "L'adresse de Dawarich n'est pas valide : saisissez une adresse comme 192.168.1.50:3000.",
    api_key: "Saisissez la clé d'API affichée dans Dawarich → Account.",
    unauthorized: "Dawarich a refusé la clé d'API : recopiez-la depuis la page Account.",
    unreachable: "Dawarich ne répond pas : vérifiez son adresse et qu'il est démarré.",
    invalid_answer: "Cette adresse ne répond pas comme Dawarich : vérifiez l'adresse et le port.",
  },
  de: {
    none: 'Gib in der Konfiguration die Adresse von Dawarich und einen API-Schlüssel ein.',
    invalid: 'Die Dawarich-Adresse ist ungültig: Gib eine Adresse wie 192.168.1.50:3000 ein.',
    api_key: 'Gib den API-Schlüssel aus Dawarich → Account ein.',
    unauthorized:
      'Dawarich hat den API-Schlüssel abgelehnt: Kopiere ihn erneut von der Seite Account.',
    unreachable: 'Dawarich antwortet nicht: Prüfe die Adresse und ob es läuft.',
    invalid_answer: 'Diese Adresse antwortet nicht wie Dawarich: Prüfe Adresse und Port.',
  },
  es: {
    none: 'Introduzca la dirección de Dawarich y una clave de API en la configuración.',
    invalid:
      'La dirección de Dawarich no es válida: introduzca una dirección como 192.168.1.50:3000.',
    api_key: 'Introduzca la clave de API que muestra Dawarich → Account.',
    unauthorized: 'Dawarich rechazó la clave de API: cópiela de nuevo desde la página Account.',
    unreachable: 'Dawarich no responde: compruebe su dirección y que esté en marcha.',
    invalid_answer: 'Esta dirección no responde como Dawarich: compruebe la dirección y el puerto.',
  },
};

/** "Test the connection" once Dawarich answered. */
export const TEST_TEXT = {
  en: (points, countries) =>
    `Connected to Dawarich: ${points} point(s) recorded, ${countries} country(ies) visited.`,
  fr: (points, countries) =>
    `Connecté à Dawarich : ${points} point(s) enregistré(s), ${countries} pays visité(s).`,
  de: (points, countries) =>
    `Mit Dawarich verbunden: ${points} Punkt(e) aufgezeichnet, ${countries} Land/Länder besucht.`,
  es: (points, countries) =>
    `Conectado a Dawarich: ${points} punto(s) registrado(s), ${countries} país(es) visitado(s).`,
};

/** Added to the test report when Dawarich has no reverse geocoding. */
export const NO_GEOCODING = {
  en: 'Reverse geocoding is off in Dawarich: cities stay at 0.',
  fr: 'Le géocodage inverse est désactivé dans Dawarich : les villes restent à 0.',
  de: 'Die Rückwärts-Geocodierung ist in Dawarich aus: Städte bleiben bei 0.',
  es: 'La geocodificación inversa está desactivada en Dawarich: las ciudades quedan en 0.',
};

export const INIT_FAILED = {
  en: 'The integration could not start: see its logs.',
  fr: "L'intégration n'a pas pu démarrer : consultez ses journaux.",
  de: 'Die Integration konnte nicht starten: Sieh dir ihre Logs an.',
  es: 'La integración no pudo iniciarse: consulte sus registros.',
};

export const pick = (table, language) => table[language] ?? table.en;

const LOCALES = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };

/** "19/10/2026 18:42", in the time zone of the container (the one of Gladys). */
export function formatDateTime(unixSeconds, language) {
  return new Date(unixSeconds * 1000).toLocaleString(LOCALES[language] ?? 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "2 h ago", "3 days ago": how old the last position is. */
export function formatAge(seconds, language) {
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto', style: 'short' });
  const minutes = Math.max(0, Math.round(seconds / 60));
  if (minutes < 60) {
    return format.format(-minutes, 'minute');
  }
  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return format.format(-hours, 'hour');
  }
  return format.format(-Math.round(hours / 24), 'day');
}
