# Dawarich

Verbinde Gladys mit [Dawarich](https://dawarich.app), dem selbst gehosteten
Standortverlauf (eine Alternative zu Google Timeline): Verfolge die
zurückgelegten Strecken und besuchten Länder und werde gewarnt, wenn dein
Handy keine Position mehr sendet. Alles bleibt in deinem lokalen Netzwerk:
Gladys liest deinen Dawarich-Server nur und sendet ihm nichts.

Getestet mit einem echten Dawarich-1.16.0-Server (dem offiziellen
Docker-Image) und simulierten Fahrten, nicht mit einem Handy unterwegs:
Rückmeldungen im Gladys-Forum sind willkommen. Für GPS-Tracking in Echtzeit
gibt es die Traccar-Integration: Diese hier dreht sich um Verlauf und
Statistiken.

## Voraussetzungen

- Gladys Assistant 5.1 oder neuer.
- Ein Dawarich-Server, der vom Gladys-Rechner aus erreichbar ist,
  standardmäßig auf Port 3000 oder hinter einem Reverse Proxy, und eine
  Tracking-App, die ihm Positionen schickt (Dawarich-App, OwnTracks,
  Overland…).
- Der API-Schlüssel deines Dawarich-Benutzers: Öffne das Menü deines Kontos →
  **Account**, dort steht der Schlüssel.

## Konfiguration

1. Öffne den Reiter **Konfiguration** der Integration.
2. Gib unter **Dawarich-Adresse** die IP-Adresse des Servers ein, zum Beispiel
   `192.168.1.50`: Die Integration nutzt dann Port 3000. Füge einen Port hinzu,
   wenn deiner abweicht (`192.168.1.50:3100`). Hinter einem Reverse Proxy gibst
   du die volle Adresse ein (`https://dawarich.example.org`).
3. Füge den **API-Schlüssel** ein.
4. **Dawarich abfragen alle**: 5, 15 (Standard), 30 oder 60 Minuten.
5. **Koordinaten der letzten Position anzeigen**: standardmäßig aus.
   Eingeschaltet bekommt das Gerät eine weitere Funktion mit Breiten- und
   Längengrad des neuesten Punkts.
6. **Sprache der Namen** legt die Funktionsnamen (beim Hinzufügen des Geräts
   festgelegt), die Ländernamen und die Szenentexte fest. Standard:
   Französisch.
7. Speichere und nutze dann **Verbindung testen**: Es zeigt die Zahl der Punkte
   und der besuchten Länder.
8. Füge im Reiter **Entdecken** das Gerät **Dawarich** hinzu.

## Gerät

**Dawarich** (ein Gerät für den Benutzer des API-Schlüssels):

| Funktion                      | Wert                                                     |
| ----------------------------- | -------------------------------------------------------- |
| Strecke heute                 | km seit Mitternacht, aus den Punkten des Tages berechnet |
| Strecke diesen Monat          | km des Monats, aus den Statistiken von Dawarich          |
| Strecke dieses Jahr           | km des Jahres, aus den Statistiken von Dawarich          |
| Gesamtstrecke                 | km seit deinem ersten Punkt                              |
| Besuchte Länder               | Länder all deiner Punkte                                 |
| Besuchte Städte               | Städte laut Dawarich (braucht Rückwärts-Geocodierung)    |
| Aufgezeichnete Punkte         | Zahl der in Dawarich gespeicherten Positionen            |
| Letzte empfangene Position    | Datum und Uhrzeit des neuesten Punkts, oder „Noch keine“ |
| Letzte Position (Koordinaten) | „Breite, Länge“, nur mit der Option aus Schritt 5        |

Strecken und Zähler behalten ihren Verlauf: Ein Diagramm zeigt die Kilometer
jedes Tages oder Monats.

## Dashboard-Widget

**Unterwegs**: vier Kacheln (heute, diesen Monat, dieses Jahr, Länder), wie
lange die letzte Position her ist (grün, gelb nach einer Stunde, rot nach einem
Tag) und die Länder der letzten 30 Tage. Keine Einstellung nötig.

## Szenen-Auslöser

- **Neues Land besucht**: Eine Position kommt aus einem Land, das in Dawarich
  noch nie besucht wurde. Variablen: **Land** (in der Sprache der Integration)
  und **Ländercode** (ISO, 3 Buchstaben, zum Beispiel `ITA`). Die Länder, die
  bei der Installation schon in Dawarich sind, und die eines später
  importierten alten Verlaufs werden nicht gemeldet.
- **Keine Position mehr empfangen**: kein neuer Punkt seit mindestens der
  gewählten Dauer (1, 2, 3, 6, 12, 24 oder 48 Stunden). Die Tracking-App ist
  vielleicht gestoppt, das Handy aus oder ohne Netz. Er löst einmal pro Funkstille
  und Dauer aus; ein neuer Punkt beginnt von vorn. Variable: **Zeit der letzten
  Position**.

## Szenen-Beispiele

- **Urlaubsmodus**: Wenn „Neues Land besucht“ auslöst, schick dir die
  Nachricht „Willkommen in {{triggerEvent.data.country}}!“ und schalte das Haus
  in den Urlaubsmodus.
- **Tracking-App gestoppt**: Wenn „Keine Position mehr empfangen“ für 6 Stunden
  auslöst, schick die Nachricht „Dawarich hat seit
  {{triggerEvent.data.last_position}} nichts empfangen: Prüfe die Tracking-App
  auf deinem Handy.“
- **Monatsbilanz**: Am 1. des Monats um 9:00 schick eine Nachricht mit dem Wert
  von „Strecke diesen Monat“, bevor er bei null beginnt.

## Fehlerbehebung

- **„Dawarich hat den API-Schlüssel abgelehnt“**: Kopiere den Schlüssel erneut
  von der Seite **Account**. Ein Schlüssel ändert sich, wenn du ihn neu
  erzeugst.
- **„Dawarich antwortet nicht“**: Prüfe Adresse und Port vom Gladys-Rechner aus
  (`http://<Adresse>:3000/api/v1/health` antwortet `{"status":"ok"}`) und ob
  Dawarich läuft.
- **„Diese Adresse antwortet nicht wie Dawarich“**: Die Adresse führt zu einem
  anderen Dienst oder zur Anmeldeseite eines Reverse Proxy.
- **Monat oder Jahr bewegen sich nicht**: Dawarich berechnet diese Statistiken
  einmal pro Stunde im Hintergrund neu (Sidekiq). „Strecke heute“ berechnet die
  Integration selbst, bei jeder Abfrage.
- **Städte bleiben bei 0**: Die Rückwärts-Geocodierung ist in Dawarich aus
  (Photon, Geoapify… in seinen Einstellungen). Die Länder kommen aus den
  Grenzen und funktionieren ohne; **Verbindung testen** meldet, wenn sie aus
  ist.
- Logs: im Reiter **Logs** der Integration. Mehr Details mit
  `LOG_LEVEL=debug`. Koordinaten und Ortsnamen werden dort nie geschrieben.

## Grenzen

- Nur lesend: Die Integration schreibt nie in Dawarich. Die Positionen anderer
  Gladys-Geräte kann sie nicht an Dawarich senden (eine Integration liest die
  Geräte der anderen nicht).
- Die Kilometer von Monat, Jahr und Gesamt sind ganze Zahlen, so wie Dawarich
  sie liefert; „Strecke heute“ ist auf 0,1 km gerundet und lässt GPS-Sprünge
  aus, die schneller als ein Flugzeug sind.
- Die Auslöser reagieren bei der nächsten Abfrage: bis zum gewählten Intervall
  verspätet.
- Ein Dawarich-Benutzer pro Integration: der des API-Schlüssels.
- Die Koordinaten-Option zeigt deine Position allen Gladys-Benutzern: Lass sie
  aus, wenn du sie nicht brauchst.
- Nicht mit Dawarich verbunden. Mit dem echten Server entwickelt, ohne Handy
  unterwegs: Rückmeldungen willkommen.
