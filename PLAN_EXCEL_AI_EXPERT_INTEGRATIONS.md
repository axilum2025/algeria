# Plan de développement — Excel AI Expert (Intégrations A + C + D)

Date : 2026-01-05

## Objectif
Mettre en place un **Excel AI Expert** “premium-ready” sur Azure, avec :
- **A) Intégration Microsoft 365 (Graph)** : lier un compte Microsoft et importer/exporter des fichiers OneDrive/SharePoint.
- **C) Automatisation** : déclencher des flows (Power Automate) après analyse/édition.
- **D) Sécurité & conformité** : masquage PII, audit log, quotas.

Le tout avec un modèle **Free / Pro / Entreprise** :
- Free : accès limité (fonctions peu coûteuses / quotas stricts / peu d’intégrations)
- Pro : accès plus vaste (export, automations, quotas plus élevés)
- Entreprise : accès complet (politiques, audit avancé, SharePoint, gouvernance)

Contrainte confirmée :
- Stockage : **Azure Table Storage** (déjà dispo en prod)
- Auth Entreprise : **login classique + liaison Microsoft** (pas SSO obligatoire)
- Email verification : déjà intégré via **SendGrid**, nécessite surtout réglages Azure

---

## État actuel (repo)
- Page Excel : [public/excel-ai-expert.html](public/excel-ai-expert.html)
  - Sur mobile/tablette (≤1024px) : chat en drawer à droite (80vw) + bouton header.
- Auth côté API : [api/utils/auth.js](api/utils/auth.js)
  - Supporte `x-ms-client-principal` (SWA), JWT signé (Bearer) + fallback dev.
- Stockage Users : [api/utils/userStorage.js](api/utils/userStorage.js)
  - Table `Users` (PartitionKey = `user`, RowKey = email)
- Endpoint Excel LLM : [api/excelAssistant/index.js](api/excelAssistant/index.js)
  - Appelle Groq (Llama 3.3 70B). (Actuellement sans gating plan.)
- Plan/Billing Stripe (doc) : [docs/STRIPE_BILLING_CREDITS_EUR_ENTERPRISE_SEATS.md](docs/STRIPE_BILLING_CREDITS_EUR_ENTERPRISE_SEATS.md)
- Email/SendGrid (docs) : [SENDGRID_SETUP.md](SENDGRID_SETUP.md) + [RESUME_FIX_EMAIL.md](RESUME_FIX_EMAIL.md)

---

## Architecture cible (simple, évolutive)
### 1) Identité utilisateur
- **Login classique** (email + mot de passe hashé) → JWT signé (réutiliser `AXILUM_AUTH_SECRET`).
- Vérification email via SendGrid (déjà présent) → prérequis pour activer certaines features (ex: lier Microsoft).

### 2) Entitlements (Free/Pro/Entreprise)
- Source de vérité : champ `plan` dans `Users` (ou `Organizations` plus tard).
- Middleware d’autorisation :
  - `requireAuth()` (existant)
  - `getUserPlan(email)`
  - `requirePlan(minPlan)` / `requireFeature(featureKey)`

### 3) Intégrations
- **Microsoft Graph** : liaison OAuth par utilisateur.
- **Power Automate** : déclenchement via webhook HTTP (Flow) + option queue (Enterprise).

### 4) Sécurité
- Masquage PII avant envoi IA.
- Audit log systématique.
- Quotas/rate limiting par plan.

---

## Modèle de données (Azure Table Storage)
> Garder le modèle cohérent avec [api/utils/userStorage.js](api/utils/userStorage.js).

### Table `Users` (existant) — champs à ajouter/standardiser
PartitionKey: `user` — RowKey: `emailLower`
- `plan`: `free | pro | enterprise` (défaut `free`)
- `emailVerified`: `true|false`
- `msLinked`: `true|false` (dérivé, optionnel)
- `createdAt`, `updatedAt`

### Table `UserIntegrations` (à créer)
PartitionKey: `user_<emailLower>`
RowKey: `microsoft` (ou `microsoft_<tenantId>` si multi-tenant)
- `provider`: `microsoft`
- `msAccountId`, `tenantId` (si dispo)
- `scopes` (JSON string)
- `refreshTokenEnc` (string chiffré)
- `accessTokenCacheEnc` (optionnel)
- `linkedAt`, `updatedAt`

### Table `AuditEvents` (à créer)
PartitionKey: `audit_user_<emailLower>` (ou `audit_org_<orgId>` plus tard)
RowKey: `ts_<ISO>_<random>`
- `action`: `excel_import | excel_export | excel_chat | power_automate_trigger | pii_detected | ...`
- `status`: `ok | blocked | failed`
- `plan`: `free|pro|enterprise`
- `meta` (JSON string, sans PII)

### Table `AutomationJobs` (optionnel mais recommandé)
PartitionKey: `auto_user_<emailLower>`
RowKey: `job_<uuid>`
- `type`: `power_automate`
- `payload` (JSON string)
- `status`: `queued | sent | ok | failed`
- `lastError`, `createdAt`, `updatedAt`

---

## Matrice d’accès recommandée (Excel AI Expert)
> Ajustable quand pricing finalisé.

| Feature | Free | Pro | Entreprise |
|---|---:|---:|---:|
| Chat Excel (LLM) | ✅ (quota bas) | ✅ (quota moyen/haut) | ✅ |
| Import local (upload) | ✅ | ✅ | ✅ |
| Import OneDrive (Graph) | ✅ (lecture seule, 1 compte) | ✅ | ✅ |
| Export OneDrive (Graph) | ❌ | ✅ | ✅ |
| SharePoint/Sites (Graph) | ❌ | ❌ (ou limité) | ✅ |
| Power Automate (webhook) | ❌ | ✅ (limité) | ✅ |
| PII masquage automatique | ✅ (toujours ON) | ✅ (option “inclure PII” = OFF par défaut) | ✅ (policies) |
| Audit basic (actions) | ✅ | ✅ | ✅ |
| Audit avancé (rétention, export) | ❌ | ❌ | ✅ |

---

## Plan d’exécution par étapes (à reprendre plus tard)

### Phase 0 — Stabilisation UX (déjà fait)
- Drawer chat à droite sur mobile + bouton header.
- Objectif : UX stable avant d’ajouter OAuth/automations.

### Phase 1 — Base “Plans & gating” (MVP technique)
**But** : pouvoir activer/désactiver des features sans refaire le code.
- Ajouter dans API une util `entitlements` :
  - `getUserPlan(email)` (depuis `Users.plan`, défaut `free`)
  - `requireFeature(featureKey)`
- Brancher ce gating sur :
  - endpoints Excel (ex: `api/excelAssistant`, `api/invoke-v2` si utilisé par Excel page)
  - endpoints d’intégration (Graph / Automations)
- Ajouter **quotas par plan** (réutiliser [api/utils/rateLimiter.js](api/utils/rateLimiter.js) ou étendre).
- Audit minimal (log action `excel_chat` et blocages).

**Critères d’acceptation**
- Un user `free` se fait refuser proprement sur un endpoint “pro-only” (HTTP 403) + message UI clair.
- Les endpoints payants respectent un quota free.

### Phase 2 — Liaison Microsoft (Graph) + import OneDrive
**But** : “Connecter Microsoft” + lister fichiers + importer.
- Créer un enregistrement Entra ID App (Azure) :
  - Redirect URI vers ton domaine `/api/ms/oauth/callback`
  - Scopes MVP: `Files.Read`, `offline_access`
- Endpoints :
  - `GET /api/ms/oauth/start` → URL auth (PKCE)
  - `GET /api/ms/oauth/callback` → échange code → tokens
  - `GET /api/ms/files/recent` → liste fichiers
  - `GET /api/ms/files/download` → récupère contenu
- Stockage tokens : table `UserIntegrations`.
- UI Excel : bouton “Connecter Microsoft” + “Importer depuis OneDrive”.

**Gating**
- Free : 1 compte, lecture/import only.

### Phase 3 — Export OneDrive (Pro+) + versionning simple
- Scopes additionnels : `Files.ReadWrite`.
- Endpoint : `POST /api/ms/files/upload` (upload ou update).
- UI : bouton “Exporter vers OneDrive”.

### Phase 4 — Power Automate (Pro/Entreprise)
**But** : automatiser après analyse.
- MVP : Flow Power Automate “When an HTTP request is received”.
- Endpoint : `POST /api/automations/power-automate/trigger`
  - Vérifie plan, quota, et écrit `AuditEvents`.
- Pro : exécution directe.
- Entreprise : option queue + retry (si besoin).

### Phase 5 — Sécurité D : PII + audit avancé + policies
- Ajout d’un module `piiRedaction` :
  - détecte colonnes (emails/tél/IBAN) + masquage avant IA.
- UI : badges “Données sensibles détectées” + explication.
- Enterprise : allowlist domaines, policy “jamais envoyer PII”.
- Audit avancé : export CSV + rétention configurée.

### Phase 6 — Entreprise : SharePoint/Sites + gouvernance
- Support “Sites/Drives” Graph.
- Option de lier plusieurs tenants (si requis).
- Préparer l’intégration Org/seats (alignée avec [docs/STRIPE_BILLING_CREDITS_EUR_ENTERPRISE_SEATS.md](docs/STRIPE_BILLING_CREDITS_EUR_ENTERPRISE_SEATS.md)).

---

## Variables Azure (prévision)
- Auth : `AXILUM_AUTH_SECRET`
- Storage : `AZURE_STORAGE_CONNECTION_STRING`
- SendGrid : `SENDGRID_API_KEY`, `SENDGRID_SENDER`
- Microsoft OAuth :
  - `MS_CLIENT_ID`
  - `MS_CLIENT_SECRET` (si tu utilises un flow côté serveur)
  - `MS_REDIRECT_URI`
  - `MS_TENANT` (optionnel)
- Power Automate :
  - `POWER_AUTOMATE_WEBHOOK_URL`
- Feature flags (optionnel) :
  - `FEATURE_MS_GRAPH=true|false`
  - `FEATURE_POWER_AUTOMATE=true|false`

---

## Checklist de sécurité (minimum)
- Tokens Microsoft stockés chiffrés (Key Vault recommandé).
- PII masquée par défaut, surtout pour Free.
- Audit sans contenu sensible (pas de dump du fichier).
- Idempotence des automations (éviter double déclenchement).

---

## Points ouverts (à trancher plus tard)
1) Où stocker les fichiers “temp” importés (si nécessaire) : mémoire, blob, ou uniquement client ?
2) Politique de rétention des audit logs (surtout Entreprise).
3) Quotas exacts Free/Pro/Entreprise (dépend du pricing final).
4) Doit-on supporter multi-compte Microsoft (Pro/Entreprise) ?

---

## Références internes
- Billing/plans : [docs/STRIPE_BILLING_CREDITS_EUR_ENTERPRISE_SEATS.md](docs/STRIPE_BILLING_CREDITS_EUR_ENTERPRISE_SEATS.md)
- Auth API : [api/utils/auth.js](api/utils/auth.js)
- Users storage : [api/utils/userStorage.js](api/utils/userStorage.js)
- SendGrid : [SENDGRID_SETUP.md](SENDGRID_SETUP.md)
