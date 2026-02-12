![](https://tokeisrv.sctg.eu.org/b1/github/sctg-development/cnam-simple?category=code)
![](https://tokeisrv.sctg.eu.org/b1/github/sctg-development/cnam-simple?category=comments)
# CNAM+ Simple - Cursus Web Scraper

## 📋 Vue d'ensemble

**CNAM+ Simple** est une application web scraper dédiée à l'extraction et la mise en cache des données de la formation continue du CNAM (Conservatoire National des Arts et Métiers) depuis le portail [bedeo.cnam.fr](https://bedeo.cnam.fr).

Le projet est construit selon une architecture **monorepo Turbo** avec:
- **Frontend**: Application React/Vite (client léger)
- **Backend**: Cloudflare Worker (API serverless)

## 🎯 Objectifs du projet

1. **Scraper les données de cursus** du site CNAM de manière efficace et fiable
2. **Mettre en cache** les résultats pour réduire les appels aux serveurs CNAM
3. **Exposer une API REST** sécurisée avec contrôle de cache
4. **Supporter deux niveaux d'enrichissement**:
   - **Level 1**: Structure curriculaire (années, unités, codes)
   - **Level 2**: Détails complets des unités (objectifs, contenu, bibliographie)

## Note sur le déploiement et les limitations du plan Cloudflare ⚠️
Le projet **fonctionne complètement en local** et **fonctionne également sur un Cloudflare Worker payant** (ce dernier permet des durées CPU par requête plus longues nécessaires pour produire des descriptions complètes). En revanche, la **version actuellement déployée en production utilise un Worker sur le plan gratuit**, dont les limites CPU par requête peuvent empêcher la **génération intégrale** des descriptions longues — d'où des réponses tronquées ou incomplètes en production.

Le fichier [`examples/CYC9101A.md`](examples/CYC9101A.md) a **été généré sur un Worker du plan payant** (c'est pourquoi il contient la description intégrale). Si vous voulez reproduire ce résultat en production, il est recommandé de déployer le service sur un Worker payant ou d'implémenter un job asynchrone côté backend pour traiter les enrichissements longue durée.

## 🏗️ Architecture

```
cnam+simple/
├── apps/
│   ├── client/                 # Frontend React/Vite
│   │   ├── src/
│   │   │   ├── components/     # Composants UI
│   │   │   ├── pages/          # Pages de l'application
│   │   │   └── locales/        # Traductions (i18n)
│   │   └── vite.config.ts
│   └── cloudflare-worker/      # Backend Cloudflare Worker
│       ├── src/
│       │   ├── scraper/        # Logique de scraping
│       │   ├── cache/          # Gestion du cache KV
│       │   ├── routes/         # Handlers API
│       │   ├── utils/          # Utilitaires (validation, etc)
│       │   └── __tests__/      # Tests unitaires
│       ├── vitest.config.ts
│       └── wrangler.jsonc      # Configuration Cloudflare
├── turbo.json                  # Config monorepo
├── package.json
└── .env                        # Variables d'environnement
```

## 🔧 Stack technique

### Frontend (Client)
- **Framework**: React 19 avec TypeScript
- **Build**: Vite
- **Styling**: TailwindCSS + HeroUI
- **i18n**: Support multilingue (FR, EN, ES, AR, HE, ZH)
- **Package Manager**: Yarn

### Backend (Worker)
- **Runtime**: Cloudflare Workers (serverless)
- **Browser**: Cloudflare Playwright (headless automation)
- **Storage**: Cloudflare KV (clé-valeur distribuée)
- **Language**: TypeScript 5.9+
- **Testing**: Vitest 3.2+ avec Cloudflare vitest-pool-workers
- **Timeout**: Limite 30 secondes (contrainte Cloudflare)

### Dépendances critiques
- `@cloudflare/playwright`: Automatisation via navigateur headless
- `jose`: Gestion JWT
- `sha512crypt-node`: Validation de mots de passe SHA512-crypt

## 🔍 Processus de scraping

### Level 1: Structure Curriculaire (5-10s)
1. Navigation vers `https://bedeo.cnam.fr/public/cursus/view/{code}`
2. Extraction XPath du schéma curriculaire (`#cursus_schema`)
3. Récupération:
   - **Années**: Structure d'études
   - **Unités**: Codes, noms, crédits par année
   - **Métadonnées**: Objectifs, audience accessible
4. Mise en cache 24h par défaut

### Level 2: Détails des Unités (requis au niveau 1 + navigation par unité)
1. Pour chaque unité, navigation vers `https://bedeo.cnam.fr/public/unite/view/{code}`
2. Extraction détaillée:
   - **Présentation**: Accès audience, objectifs spécifiques
   - **Contenu**: Description du contenu pédagogique
   - **Bibliographie**: Références et ressources
3. **Concurrence contrôlée**: 2 requêtes simultanées max + délais entre batches
4. **Dégradation gracieuse**: Retourne Level 1 si Level 2 échoue

## 📡 API REST

### Endpoint principal
```
GET /api/cursus/<code>
```

**Exemples de requêtes:**

```bash
# Cursus basic (Level 1 avec cache)
curl "http://localhost:8787/api/cursus/CYC9101A"

# Enrichissement Level 2 (peut être long)
curl "http://localhost:8787/api/cursus/CYC9101A?enrich=true"

# Forcer un refresh (invalidation de cache) — REQUIERT une api-key valide
# Sans api-key la requête `?force=true` est ignorée et le cache est préservé.
curl "http://localhost:8787/api/cursus/CYC9101A?api-key=cleartext&force=true"
```

### Paramètres de requête

| Paramètre | Type | Description |
|-----------|------|-------------|
| `force` | boolean | Demander un scraping frais et invalider le cache **uniquement** si une `api-key` valide est fournie (sinon le paramètre est ignoré). |
| `timeout` | number | Timeout personnalisé en millisecondes (défaut: 30000) |
| `enrich` | boolean | Récupérer Level 2 (détails complets des unités) |
| `api-key` | string | Mot de passe en clair pour bypass cache + invalidation |

### Format de réponse

```json
{
  "success": true,
  "data": {
    "name": "Titre du Cursus",
    "code": "CYC9101A",
    "audience_access": "Tout public",
    "objectives": "Description des objectifs",
    "EU": [
      {
        "year": "1",
        "units": [
          {
            "code": "UTC501",
            "name": "Unité 1",
            "credits": 6,
            "audience_access": "...",
            "objectives": "...",
            "content": "...",
            "bibliography": [
              { "title": "Livre", "author": "Auteur" }
            ]
          }
        ]
      }
    ]
  },
  "cached": false,
  "scrapedAt": "2026-02-10T18:20:00Z"
}
```

### Suppression du cache
```
DELETE /api/cursus/<code>/cache
```

## 🔐 Sécurité

### Validation de mot de passe
- Format: Hashes SHA512-crypt (OpenSSL `openss passwd -6`)
- Stockage: Variable d'env `SCRAPER_CACHE_OVERRIDE`
- Exemple de hash: `$6$CY9bJUwYHGVpqnJx$Yz...`

**Génération de hash:**
```bash
openssl passwd -6
# Entrer le mot de passe et copier le hash résultant
```

### Gestion du cache
- **TTL par défaut**: 30 jours (configurable) via la variable d'environnement `SCRAPER_CACHE_TTL`
- **Invalidation**: Via password-protected endpoint (recommandé : utiliser `api-key` + `force=true` pour invalider)
- **Override forcé**: Requiert désormais une `api-key` valide. Les requêtes avec `?force=true` sans `api-key` ne provoqueront pas d'invalidation du cache (sécurité renforcée). 

**Remarque**: lorsqu'un enrichissement Level 2 (`?enrich=true`) réussit, le résultat enrichi est sauvegardé en cache — les requêtes suivantes peuvent donc retourner des données enrichies même sans `?enrich=true`.

## 📦 Installation et démarrage

### Prérequis
- Node.js 24+
- Yarn 4+
- Compte Cloudflare (pour production)

### Installation
```bash
# Installer les dépendances
yarn install

# Générer les types Cloudflare
cd apps/cloudflare-worker
yarn cf-typegen:env
```

### Développement
```bash
# Démarrer l'environnement complet (client + worker)
yarn dev:env

# Frontend: http://localhost:5173
# Worker: http://localhost:8787
```

### Tests
```bash
cd apps/cloudflare-worker
yarn test --run          # Test une fois
yarn test                # Mode watch
```

## ✅ État du projet

### Phase 1 - Level 1 Scraping ✅ Complétée
- [x] Extraction XPath curriculaire
- [x] Cache KV avec TTL
- [x] Routes API GET/DELETE
- [x] 46 tests unitaires validés

### Phase 2 - Level 2 Scraping ✅ Complétée
- [x] Parsing détails unités (préentation, contenu, bibliographie)
- [x] Concurrence contrôlée (2 max)
- [x] Dégradation gracieuse
- [x] 53 tests totaux validés

### Phase 3 - Contrôle de Cache 🔄 En cours
- [x] Import sha512crypt-node
- [x] Validation password SHA512-crypt
- [x] Query params `?enrich=true` et `?api-key=xxx`
- [x] Invalidation de cache sécurisée
- [ ] Tests d'intégration avec bedeo.cnam.fr réel
- [ ] UI React pour recherche curriculaire
- [ ] Optimisation pour limite 30s

### Phase 4+ - Production 📋 Planifiée
- [ ] Déploiement Cloudflare
- [ ] Configuration CORS
- [ ] Rate limiting
- [ ] Monitoring et logs
- [ ] Documentation API complète

## 🧪 Tests

Le projet utilise **Vitest** avec le pool `@cloudflare/vitest-pool-workers` pour tester dans l'environnement Cloudflare.

```bash
# Tests existants (53 total):
✓ cnam-scraper.test.ts     (20 tests - unitaires)
✓ cursus-routes.test.ts (26 tests - contrats API)
✓ unit-parser.test.ts       (7 tests - Level 2 parsing)
```

## 🚀 Prochaines étapes

1. **Tests réels**: Valider sur bedeo.cnam.fr avec vrais codes curriculaires
2. **Optimisation timeout**: Gérer Level 2 complet malgré limite 30s
3. **Frontend**: Composants React pour recherche et affichage
4. **Déploiement**: Publication sur Cloudflare Workers
5. **Monitoring**: Logs et métriques

## 📝 Variables d'environnement

```env
# Cloudflare
CLOUDFLARE_BACKEND="http://localhost:8787"

# CNAM
CNAM_FORMATION_CODE="CYC9101A" # Code de formation pour les tests (ex: CYC9101A, CYC9202B, etc)
CNAM_BEDEO_URL="https://bedeo.cnam.fr"
CNAM_BEDEO_CURSUS_PATH="public/cursus/view/"
CNAM_BEDEO_UNITE_VIEW_PATH="/public/unite/view/"

# Performance
SCRAPER_CACHE_TTL=2592000 # 30 jours en secondes

# Sécurité
SCRAPER_CACHE_OVERRIDE="$6$..."  # Hash SHA512-crypt
CORS_ORIGIN="http://localhost:5173"
```

## 📄 Licence

MIT License - Copyright (c) 2024-2026 Ronan LE MEILLAT

## 🤝 Contribution

Les contributions sont bienvenues ! Veuillez:
1. Créer une branche feature
2. Écrire des tests
3. Valider avec `yarn test`
4. Soumettre une PR

---

**Dernière mise à jour**: 10 février 2026
