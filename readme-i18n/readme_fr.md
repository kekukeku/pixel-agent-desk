# Pixel Agent Desk

[![CI](https://github.com/kekukeku/pixel-agent-desk/actions/workflows/test.yml/badge.svg)](https://github.com/kekukeku/pixel-agent-desk/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-42+-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)

> Un bureau pixel en temps réel pour vos agents de codage IA.
>
> Fork de [Mgpixelart/pixel-agent-desk](https://github.com/Mgpixelart/pixel-agent-desk), maintenu indépendamment avec des intégrations étendues et des fonctionnalités de tableau de bord.

## Des Gardiens dans la Machine

Jadis, nul artisan ne maniait l'encre sans un gardien invisible à ses côtés pour guider sa plume. Les parchemins ont beau s'être changés en écrans de verre, et ces esprits bienveillants avoir revêtu des armures de pixels et de code binaire, leur mission demeure.
Le *Pixel Agent Desk* offre à ces précieux veilleurs un refuge en deux dimensions : un petit bureau où vos agents de codage IA pensent, s'activent et s'assoupissent.
Ouvrez le tiroir, matérialisez l'invisible, et laissez la magie du débogage opérer sous vos yeux.

*[Lire le prélude complet](docs/readme-prelude.md) — Des Gardiens dans la Machine*

Pixel Agent Desk est une application Electron autonome qui surveille les événements du cycle de vie des agents et restitue les sessions IA actives sous forme de personnages pixel animés dans un bureau en 2D. Elle prend en charge cinq espaces de travail d'agents majeurs dès l'installation :

- **Claude Cowork**
- **Codex**
- **Grok Build**
- **Antigravity**
- **OpenWork**

L'application est une couche d'observation et de visualisation. Elle ne dispatche pas le travail, n'assigne pas de tâches ni ne contrôle vos agents.

![Demo](docs/demo.gif)

| | | |
|---|---|---|
| ![](docs/screenshot-1.png) | ![](docs/screenshot-2.png) | ![](docs/screenshot-4.png) |
| ![](docs/screenshot-5.png) | | |

## Points Forts

- **Observateur Autonome** — PAD fonctionne indépendamment comme observateur pour les espaces de travail d'agents GUI et TUI.
- **Bureau Pixel** — Un bureau virtuel en 2D où les agents actifs apparaissent sous forme de personnages pixel animés, pilotés par les événements du cycle de vie.
- **Roster Système** — Cartes de tableau de bord en direct affichant l'état de l'agent, les outils actifs, les sources, l'utilisation des jetons et le coût mesuré lorsqu'il est disponible.
- **Cinq Intégrations Optionnelles** — Claude Cowork, Codex, Grok Build, Antigravity et OpenWork, avec compatibilité OpenCode via le noyau OpenWork.
- **Analytique Jetons & Coûts** — Affiche la visibilité des jetons pour les agents pris en charge sauf Antigravity, et estime les coûts uniquement lorsque des données de tarification fiables sont disponibles.
- **Maillage d'Activité & Revue GroupChat** — Accès aux replays de sessions historiques et aux matrices d'activité de carte thermique visuelle.
- **API d'Événements Générique** — Les outils externes personnalisés peuvent poster des événements normalisés via `POST /events/agent`.
- **Récupération Automatique** — Restaure en toute sécurité les sessions d'agents actives au redémarrage de l'application en utilisant des PID vérifiés ou des configurations de tolérance.

## Prérequis

**Pour exécuter Pixel Agent Desk :**
- **macOS (recommandé) :** aucune installation Node séparée requise — [`Install.command`](Install.command) télécharge Node.js 22 portable dans `~/.local/node` lors du premier lancement.
- **Windows / Linux / macOS manuel :** **Node.js** 20 ou ultérieur et **npm**
- **macOS, Windows ou Linux**

*Note : Les espaces de travail d'agents **ne sont pas** des prérequis pour exécuter l'application. Pixel Agent Desk fonctionne comme un observateur indépendant. Les plateformes manquantes seront signalées dans les diagnostics mais ne provoqueront jamais de plantage ou de blocage du tableau de bord.*

## Démarrage Rapide

### macOS — Démarrage Bureau (Recommandé)

1. **Configuration Initiale** : Double-cliquez sur [`Install.command`](Install.command) à la racine du dépôt.
   - Télécharge les binaires officiels Node.js dans `~/.local/node` si vous n'avez pas encore Node 20+.
   - Exécute `npm install` pour les dépendances de Pixel Agent Desk.
   - Nécessite un accès réseau lors du premier lancement.
2. **Lancer le Tableau de Bord** : Double-cliquez sur [`Start.command`](Start.command).
   - Utilise le même Node.js (`~/.local/node` ou un Node 20+ système existant).
   - Ouvre la fenêtre du tableau de bord via `npm start`.
   - *Note Gatekeeper : Si macOS bloque l'exécution, faites un clic droit sur le fichier `.command` et sélectionnez **Ouvrir**, ou exécutez `chmod +x Install.command Start.command` dans le Terminal.*

### Toutes les Plateformes — Démarrage depuis les Sources

Pour cloner et exécuter manuellement depuis les sources :

```bash
git clone https://github.com/kekukeku/pixel-agent-desk.git
cd pixel-agent-desk
npm install
npm start
```

Au lancement :
- La fenêtre du tableau de bord Pixel Agent Desk s'ouvre (affichant dynamiquement `Le Bureau de {username}` correspondant au profil de votre compte OS).
- Le serveur de passerelle d'événements local commence à écouter sur `127.0.0.1:47821`.
- Les observateurs configurés et les intégrations de réacheminement s'enregistrent et se préparent à recevoir les événements des agents.

### Diagnostics

Pour inspecter l'état de détection de vos intégrations d'agents locales sans écrire de crochet de configuration ni démarrer d'observateurs :

```bash
npm run diagnose:integrations
```

## Vues du Tableau de Bord

La navigation de la barre latérale fournit quatre modes de vue principaux pour surveiller et explorer vos sessions d'agents :

| Vue | Objectif | Détails |
|---|---|---|
| **Overview** | Toile du bureau 2D principale & Roster en direct | Visualisez les sprites pixel animés se déplaçant et travaillant, aux côtés de cartes d'état d'agent en temps réel. Prend en charge la fenêtre PiP (Image dans l'image). |
| **Activity Mesh** | Matrice de carte thermique interactive | Affiche la fréquence et les pics d'événements quotidiens/horaires. |
| **GroupChat Review** | Replay de session local | Rejoue les discussions multi-agents enregistrées (`groupchat_*.json`) directement sur la toile visuelle du bureau 2D. |
| **Metered API Usage** | Tableau de bord d'utilisation des jetons et de facturation | Affiche les comptes de jetons pour les agents pris en charge, les coûts estimés lorsque la tarification est fiable, et l'utilisation de la fenêtre de contexte de pointe (CTX%) pour Grok Build. |

## Intégrations

| Agent | Mécanisme | Chemin de Configuration / Données | Écrit la Configuration ? | Notes |
|---|---|---|---|---|
| Claude Cowork | Réachemineur d'événements | `~/.claude/settings.json` | Oui | Enregistre automatiquement les crochets appartenant à PAD ; migre les crochets HTTP hérités si présents |
| Codex | Observateur JSONL en lecture seule | `~/.codex/` | Non | Analyse les fichiers de session toutes les ~2 secondes |
| Grok Build | Réachemineur d'événements + observateur | `~/.grok/hooks/pixel-agent-desk.json` + `~/.grok/sessions/**/signals.json` | Oui | Le crochet gère le cycle de vie ; l'observateur suit les jetons et le CTX% |
| Antigravity | Réachemineur d'événements | `~/.gemini/config/hooks.json` | Oui | Intègre directement l'exécutable du réachemineur |
| OpenWork / OpenCode | Plugin compatible OpenCode | `~/.config/opencode/plugins/pad-adapter.js` | Oui | OpenWork est pris en charge via son noyau compatible OpenCode |

Dans les builds empaquetées, les fichiers auxiliaires sont matérialisés sous `~/.pixel-agent-desk/runtime/` pour exécuter les réachemineurs via le binaire Electron en utilisant `ELECTRON_RUN_AS_NODE=1`. En mode développement source, les réachemineurs s'exécutent directement depuis le dossier source du dépôt.

Consultez [docs/integration-smoke-test.md](docs/integration-smoke-test.md) pour un guide de test d'intégration complet.

*Note Importante : Si aucun agent n'est actif, un **bureau virtuel vide** est normal et ne signifie pas que PAD défaille. Les personnages animés n'apparaissent qu'après que leur agent respectif ait envoyé au moins un événement (par exemple, ouvrir un espace de travail pris en charge ou envoyer une invite).*

Pour déconnecter les intégrations Pixel Agent Desk, supprimez uniquement les configurations de crochet/plugin ou clés appartenant à PAD :

| Agent | Élément à supprimer |
|---|---|
| Claude Cowork | Supprimez les entrées de crochet appartenant à PAD de `~/.claude/settings.json` |
| Grok Build | Supprimez `~/.grok/hooks/pixel-agent-desk.json` |
| Antigravity | Supprimez la clé `"pixel-agent-desk"` de `~/.gemini/config/hooks.json` |
| OpenWork / OpenCode | Supprimez `~/.config/opencode/plugins/pad-adapter.js` |
| Codex | Aucune configuration n'est écrite — quittez simplement PAD pour déconnecter |

Cache optionnel (sûr à supprimer ; PAD le recrée au prochain lancement) :

```text
~/.pixel-agent-desk/runtime/
```

Redémarrez l'espace de travail de l'agent affecté après modification pour recharger les configurations.

## Configuration

Pixel Agent Desk lit la configuration utilisateur optionnelle depuis :

```text
~/.pixel-agent-desk/config.json
```

Exemple :

```json
{
  "integrations": {
    "claude": {
      "enabled": true
    },
    "opencode": {
      "enabled": true
    }
  }
}
```

Barrières de configuration actuelles :

- `integrations.claude.enabled: false` ignore l'enregistrement du crochet Claude Cowork et l'analyse des transcriptions.
- `integrations.opencode.enabled: false` ignore l'enregistrement du plugin OpenCode.

Les autres intégrations sont détectées par capacité et échouent en mode ouvert si leur plateforme n'est pas installée.

## API d'Événements d'Agent Normalisés

Les outils personnalisés peuvent signaler une activité en envoyant des événements normalisés à :

```text
POST http://127.0.0.1:47821/events/agent
Content-Type: application/json
```

Exemple :

```json
{
  "event": "agent.working",
  "agent_id": "custom-session-1",
  "source": "my-custom-agent",
  "name": "Research Agent",
  "project_path": "/path/to/project",
  "model": "gpt-4o",
  "tool": "Bash",
  "parent_id": null,
  "pid": 12345,
  "timestamp": 1781550497208,
  "token_usage": {
    "input_tokens": 1200,
    "cached_input_tokens": 500,
    "output_tokens": 400
  },
  "context_usage": {
    "kind": "snapshot",
    "tokens_used": 50000,
    "window_tokens": 200000,
    "percent": 25
  },
  "metadata": {}
}
```

### Événements Pris en Charge

- `agent.started` — Enregistre ou rafraîchit une session d'agent.
- `agent.thinking` — Affiche l'état de réflexion et peut accumuler l'utilisation de jetons.
- `agent.working` — Affiche l'état de travail et l'outil actif.
- `agent.idle` — Affiche l'état de repos/inactivité.
- `agent.done` — Marque une action terminée.
- `agent.error` — Affiche l'état d'erreur.
- `agent.help` — Affiche l'état d'autorisation/d'aide.
- `agent.removed` — Retire le personnage du bureau.

## Récupération de Session et Noms d'Affichage

Pixel Agent Desk persiste les sessions actives et tente la récupération au redémarrage lorsque la source peut être vérifiée en toute sécurité.

Fichiers de mappage locaux optionnels :

- `~/.pixel-agent-desk/name-map.json` mappe les IDs de session stables à des noms d'affichage.
- `~/.pixel-agent-desk/watcher-allowlist.json` est un nom de fichier hérité utilisé comme liste d'autorisation de récupération pour les sessions personnalisées/manuelles. Il n'est pas lié à l'observateur Python supprimé.

Exemple de `name-map.json` :

```json
{
  "codex-main": "Codex",
  "antigravity-ui": "Antigravity"
}
```

## Personnalisation de l'Avatar

Les sélections d'avatars sont stockées localement dans le stockage du navigateur :

```text
Clé localStorage : pixel-agent-desk.avatarOverrides.v1
```

La valeur mappe les IDs d'agent stables à des indices d'avatar. Sélectionner "Réinitialiser par défaut" supprime la substitution.

## Affichage des Jetons et des Coûts

Pixel Agent Desk affiche l'utilisation des ressources en fonction des données fournies par l'agent :

- **Agents à visibilité de jetons** : Claude Cowork, Codex, Grok Build et OpenWork/OpenCode peuvent afficher l'utilisation de jetons lorsque leurs données d'événement ou de session locales l'exposent.
- **Agents sensibles aux coûts** : Lorsque l'utilisation de jetons peut être mise en correspondance avec un tarif fiable dans [src/pricing.js](src/pricing.js), Pixel Agent Desk estime le coût. Sinon, il affiche l'utilisation sans inventer un montant de facturation.
- **Agents sensibles au contexte (par exemple Grok Build)** : Affiche le pourcentage de pointe de la fenêtre de contexte (`CTX: N tok` ou pression en pourcentage). Les valeurs d'instantané de contexte ne sont pas accumulées. La carte thermique quotidienne enregistre les jetons de contexte de pointe journaliers.
- **Antigravity** : La visibilité du cycle de vie est prise en charge, mais la détection de jetons n'est actuellement pas disponible.

Consultez [docs/integration-smoke-test.md](docs/integration-smoke-test.md) §5.3 pour la vérification du CTX de Grok.

*Note : Assurez-vous que `npm start` est fermé lors de la validation des crochets empaquetés, car une seule instance de PAD peut se lier au port du serveur d'événements local (`47821`).*

## Avancé : Build Empaquetée

Bien que l'exécution depuis les sources soit recommandée, vous pouvez construire une application autonome empaquetée localement :

```bash
npm run dist:mac
```

Puis lancez :

```text
release/mac/Pixel Agent Desk.app
```

## Journal de Débogage

Pixel Agent Desk écrit les journaux d'exécution dans `debug.log` :

- **Depuis les sources (`npm start`)** : `src/debug.log` à l'intérieur du dépôt cloné
- **Application empaquetée (macOS)** : `~/Library/Application Support/pixel-agent-desk/debug.log`
- **Application empaquetée (Windows)** : `%APPDATA%/pixel-agent-desk/debug.log`
- **Application empaquetée (Linux)** : `~/.config/pixel-agent-desk/debug.log`

Recherchez les lignes `[Processor]` et `[Event]` lors de la vérification que les événements d'agent atteignent le bureau.

## Dépannage

| Symptôme | Cause Probable | Solution |
|---|---|---|
| Aucun personnage n'apparaît | Aucun événement d'agent n'a encore atteint PAD | Démarrez une session d'agent une fois, puis vérifiez `debug.log` (voir Journal de Débogage ci-dessus) pour les lignes `[Processor]` |
| Bureau vide (aucun personnage) | État normal au démarrage ou en sessions inactives | Les personnages animés n'apparaissent qu'après que leurs agents aient envoyé au moins un événement (par exemple, ouvrir un espace de travail pris en charge ou envoyer une invite). Confirmez que `debug.log` contient des événements `[Processor]`. |
| Le diagnostic indique Codex `active=false` | Le diagnostic est en lecture seule et ne démarre pas d'observateurs | Utilisez `npm start` ; Codex devrait devenir actif s'il est installé |
| Grok ou Antigravity n'apparaissent pas dans l'app empaquetée | La commande de crochet pointe encore vers un ancien chemin source | Redémarrez l'app empaquetée pour que les crochets soient rafraîchis ; inspectez la config du crochet pour `~/.pixel-agent-desk/runtime/forwarders/` |
| La commande de crochet utilise `node` dans la validation empaquetée | La config du crochet a été générée par l'app de développement ou une ancienne version | Fermez PAD de développement, ouvrez l'`.app` empaquetée, puis revérifiez la config du crochet |
| OpenCode n'apparaît pas | Le plugin n'a pas été installé ou OpenCode ne l'a pas chargé | Vérifiez `~/.config/opencode/plugins/pad-adapter.js`, puis redémarrez OpenCode/OpenWork |
| Claude Cowork n'apparaît pas | Crochets Claude Cowork manquants ou désactivés | Exécutez `npm run diagnose:integrations` et inspectez `~/.claude/settings.json` |
| Un personnage obsolète persiste | La récupération de session persistée a toujours un ID correspondant | Supprimez les entrées obsolètes de `name-map.json` ou `watcher-allowlist.json`, puis redémarrez |

## Commandes de Développement

```bash
npm start                  # Exécuter l'application Electron depuis les sources
npm test                   # Exécuter la suite de tests
npm run diagnose:integrations
npm run dist:mac           # Construire le package macOS
```

## Contribution

Consultez [PR_TEMPLATE.md](PR_TEMPLATE.md) pour le résumé de PR attendu, les notes de test et la vérification de la portée.

## Licence

- **Code source :** [Licence MIT](LICENSE)
- **Ressources artistiques** (`public/characters/`, `public/office/`) : [Licence restrictive personnalisée](LICENSE-ASSETS) — pas de redistribution ni de modification.
