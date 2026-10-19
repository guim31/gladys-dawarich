# Dawarich

Connectez Gladys à [Dawarich](https://dawarich.app), l'historique de positions
auto-hébergé (une alternative à Google Timeline) : suivez les distances
parcourues et les pays visités, et soyez prévenu quand votre téléphone n'envoie
plus sa position. Tout reste sur votre réseau local : Gladys ne fait que lire
votre serveur Dawarich, et ne lui envoie rien.

Testée avec un vrai serveur Dawarich 1.16.0 (l'image Docker officielle) et des
trajets simulés, pas avec un téléphone sur la route : vos retours sont les
bienvenus sur le forum Gladys. Pour le suivi GPS en direct, voyez l'intégration
Traccar : celle-ci porte sur l'historique et les statistiques.

## Prérequis

- Gladys Assistant 5.1 ou plus récent.
- Un serveur Dawarich joignable depuis la machine de Gladys, sur le port 3000
  par défaut ou derrière un proxy inverse, et une application de suivi qui lui
  envoie des positions (application Dawarich, OwnTracks, Overland…).
- La clé d'API de votre utilisateur Dawarich : ouvrez le menu de votre compte →
  **Account**, la clé y est affichée.

## Configuration

1. Ouvrez l'onglet **Configuration** de l'intégration.
2. Dans **Adresse de Dawarich**, saisissez l'adresse IP du serveur, par exemple
   `192.168.1.50` : l'intégration utilise alors le port 3000. Ajoutez le port
   s'il est différent (`192.168.1.50:3100`). Derrière un proxy inverse,
   saisissez l'adresse complète (`https://dawarich.example.org`).
3. Collez la **clé d'API**.
4. **Lire Dawarich toutes les** : 5, 15 (par défaut), 30 ou 60 minutes.
5. **Afficher les coordonnées de la dernière position** : désactivé par défaut.
   Activé, l'appareil gagne une fonctionnalité avec la latitude et la longitude
   du dernier point.
6. **Langue des noms** fixe le nom des fonctionnalités (figé à l'ajout de
   l'appareil), le nom des pays et les textes des scènes. Français par défaut.
7. Enregistrez, puis utilisez **Tester la connexion** : elle affiche le nombre
   de points et de pays visités.
8. Dans l'onglet **Découverte**, ajoutez l'appareil **Dawarich**.

## Appareil

**Dawarich** (un appareil pour l'utilisateur de la clé d'API) :

| Fonctionnalité                  | Valeur                                                        |
| ------------------------------- | ------------------------------------------------------------- |
| Distance aujourd'hui            | km parcourus depuis minuit, calculés à partir des points      |
| Distance ce mois-ci             | km du mois, d'après les statistiques de Dawarich              |
| Distance cette année            | km de l'année, d'après les statistiques de Dawarich           |
| Distance totale                 | km depuis votre premier point                                 |
| Pays visités                    | pays de tous vos points                                       |
| Villes visitées                 | villes comptées par Dawarich (géocodage inverse nécessaire)   |
| Points enregistrés              | nombre de positions stockées dans Dawarich                    |
| Dernière position reçue         | date et heure du dernier point, ou « Aucune »                 |
| Dernière position (coordonnées) | « latitude, longitude », seulement avec l'option de l'étape 5 |

Distances et compteurs gardent leur historique : un graphique montre les
kilomètres de chaque jour ou de chaque mois.

## Widget du tableau de bord

**Déplacements** : quatre tuiles (aujourd'hui, ce mois-ci, cette année, pays),
l'ancienneté de la dernière position (vert, jaune après une heure, rouge après
un jour) et les pays des 30 derniers jours. Aucun réglage.

## Déclencheurs de scène

- **Nouveau pays visité** : une position arrive d'un pays jamais visité
  auparavant dans Dawarich. Variables : **Pays** (dans la langue de
  l'intégration) et **Code du pays** (ISO, 3 lettres, par exemple `ITA`). Les
  pays déjà présents dans Dawarich à l'installation de l'intégration, et ceux
  d'un ancien historique importé plus tard, ne sont pas annoncés.
- **Plus de position reçue** : aucun nouveau point depuis au moins la durée
  choisie (1, 2, 3, 6, 12, 24 ou 48 heures). L'application de suivi s'est
  peut-être arrêtée, le téléphone est éteint ou sans réseau. Il se déclenche une
  fois par silence et par durée ; un nouveau point remet le compteur à zéro.
  Variable : **Heure de la dernière position**.

## Exemples de scènes

- **Mode vacances** : quand « Nouveau pays visité » se déclenche, envoyez-vous
  le message « Bienvenue en {{triggerEvent.data.country}} ! » et passez la
  maison en mode vacances.
- **Application de suivi arrêtée** : quand « Plus de position reçue » se
  déclenche pour 6 heures, envoyez le message « Dawarich n'a rien reçu depuis
  {{triggerEvent.data.last_position}} : vérifiez l'application de suivi du
  téléphone. »
- **Bilan de la semaine** : chaque dimanche à 20 h, envoyez un message avec les
  valeurs de « Distance ce mois-ci » et « Pays visités ».

## Dépannage

- **« Dawarich a refusé la clé d'API »** : recopiez la clé depuis la page
  **Account**. Une clé change quand vous la régénérez.
- **« Dawarich ne répond pas »** : vérifiez l'adresse et le port depuis la
  machine de Gladys (`http://<adresse>:3000/api/v1/health` répond
  `{"status":"ok"}`), et que Dawarich est démarré.
- **« Cette adresse ne répond pas comme Dawarich »** : l'adresse mène à un
  autre service ou à la page de connexion d'un proxy inverse.
- **Le mois ou l'année ne bouge pas** : Dawarich recalcule ces statistiques une
  fois par heure, en tâche de fond (Sidekiq). « Distance aujourd'hui » est
  calculée par l'intégration et suit chaque lecture.
- **Les villes restent à 0** : le géocodage inverse est désactivé dans Dawarich
  (Photon, Geoapify… dans ses réglages). Les pays viennent des frontières et
  fonctionnent sans ; **Tester la connexion** signale quand il est désactivé.
- Journaux : dans l'onglet **Journaux** de l'intégration. Plus de détails avec
  `LOG_LEVEL=debug`. Ni coordonnées ni noms de lieux n'y sont jamais écrits.

## Limites

- Lecture seule : l'intégration n'écrit jamais dans Dawarich. Elle ne peut pas
  envoyer à Dawarich les positions d'autres appareils Gladys (une intégration
  ne lit pas les appareils des autres).
- Les kilomètres du mois, de l'année et le total sont des nombres entiers,
  comme Dawarich les donne ; « Distance aujourd'hui » est arrondie à 0,1 km et
  ignore les sauts GPS plus rapides qu'un avion.
- Les déclencheurs réagissent à la lecture suivante : jusqu'à l'intervalle
  choisi de retard.
- Un seul utilisateur Dawarich par intégration : celui de la clé d'API.
- L'option des coordonnées montre votre position à tous les utilisateurs de
  Gladys : laissez-la désactivée si vous n'en avez pas besoin.
- Sans lien avec Dawarich. Développée avec le vrai serveur, sans téléphone sur
  la route : vos retours sont les bienvenus.
