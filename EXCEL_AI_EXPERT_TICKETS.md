# Backlog / Tickets — Excel AI Expert (A + C + D)

Date : 2026-01-05

Objectif : transformer le plan en **tickets exécutables** (1 ticket = livrable clair), compatibles Azure + Table Storage, et avec gating **Free/Pro/Entreprise**.

Références :
- Plan : [PLAN_EXCEL_AI_EXPERT_INTEGRATIONS.md](PLAN_EXCEL_AI_EXPERT_INTEGRATIONS.md)
- Stripe/Plans : [docs/STRIPE_BILLING_CREDITS_EUR_ENTERPRISE_SEATS.md](docs/STRIPE_BILLING_CREDITS_EUR_ENTERPRISE_SEATS.md)
- Users storage : [api/utils/userStorage.js](api/utils/userStorage.js)
- Auth helpers : [api/utils/auth.js](api/utils/auth.js)

---

## Epic 0 — Pré-requis (sécurité & infra)

### T0.1 — Variables Azure + Key Vault (baseline)
**But** : préparer les variables nécessaires sans casser la prod.
- Ajouter/valider variables:
  - `AZURE_STORAGE_CONNECTION_STRING`, `AXILUM_AUTH_SECRET`
  - SendGrid: `SENDGRID_API_KEY`, `SENDGRID_SENDER`
  - Feature flags (optionnel): `FEATURE_MS_GRAPH`, `FEATURE_POWER_AUTOMATE`
- (Recommandé) préparer Key Vault pour secrets OAuth Microsoft + webhook.

**Done quand**
- Variables documentées + présentes dans Azure (staging/prod) sans erreur 500.

---

## Epic 1 — Entitlements (plans) + gating + audit minimal

### T1.1 — Normaliser `plan` dans `Users` (Table Storage)
**Scope**
- Ajouter `plan` (free/pro/enterprise) + valeur défaut `free`.
- Ajouter `emailVerified` si pas déjà présent.

**Acceptance**
- Un nouvel utilisateur a `plan=free`.

### T1.2 — Utilitaire `entitlements` (getUserPlan + requireFeature)
**Scope**
- Créer util serveur `getUserPlan(email)` et `requireFeature(featureKey)`.
- Feature keys MVP :
  - `excel_chat`
  - `ms_import`
  - `ms_export`
  - `power_automate`
  - `audit_advanced`

**Acceptance**
- `free` passe sur `ms_import` mais échoue sur `ms_export`.

### T1.3 — AuditEvents (Table Storage) + helper `auditLog()`
**Scope**
- Table `AuditEvents`.
- Helper `auditLog(email, action, status, meta)`.

**Acceptance**
- Chaque action importante (chat / import / export / automation) écrit un événement.

### T1.4 — Quotas par plan pour endpoints Excel
**Scope**
- Étendre le rate limiting existant (ou wrapper) pour différencier `free/pro/enterprise`.

**Acceptance**
- `free` atteint un quota et reçoit un message clair + status cohérent.

---

## Epic 2 — Excel AI Expert : durcissement endpoints (LLM) + PII (D)

### T2.1 — Gating plan sur l’endpoint Excel (LLM)
**Scope**
- Appliquer `requireAuth` + `requireFeature('excel_chat')` sur [api/excelAssistant/index.js](api/excelAssistant/index.js) (ou endpoint réellement utilisé par la page).
- Retour HTTP clair (403/402 selon logique choisie).

**Acceptance**
- Sans auth → 401.
- Free → OK mais quota bas.

### T2.2 — PII detection + redaction avant envoi IA
**Scope**
- Module `piiRedaction` : détecter email/tel/IBAN/ID dans data importée.
- Masquer par défaut dans prompt LLM + audit `pii_detected`.

**Acceptance**
- Les emails ne sont jamais envoyés au LLM en clair en mode Free.

### T2.3 — UI : avertissement “données sensibles détectées”
**Scope**
- Dans [public/excel-ai-expert.html](public/excel-ai-expert.html), afficher un message non bloquant quand PII détectée.

**Acceptance**
- Message visible, sans casser l’upload.

---

## Epic 3 — Microsoft Graph : liaison + import OneDrive (A)

### T3.1 — Création App Entra ID (doc + checklist)
**Scope**
- Documenter pas à pas : App Registration, redirect URIs, scopes.
- Scopes MVP : `Files.Read`, `offline_access`.

**Acceptance**
- L’URL d’auth fonctionne et renvoie un code.

### T3.2 — Table `UserIntegrations` + chiffrement token
**Scope**
- Créer table `UserIntegrations`.
- Implémenter stockage refresh token chiffré (Key Vault recommandé).

**Acceptance**
- Token stocké et relisible, sans exposition côté client.

### T3.3 — OAuth start/callback endpoints
**Scope**
- `GET /api/ms/oauth/start`
- `GET /api/ms/oauth/callback`
- PKCE + state anti-CSRF.

**Acceptance**
- Un user connecté peut lier Microsoft et voir `msLinked=true`.

### T3.4 — Lister fichiers récents OneDrive
**Scope**
- `GET /api/ms/files/recent`
- Filtrer/limiter selon plan.

**Acceptance**
- Free voit une liste limitée (ex: 10).

### T3.5 — Télécharger fichier (import)
**Scope**
- `GET /api/ms/files/download?id=<fileId>`
- Brancher dans UI Excel : “Importer depuis OneDrive”.

**Acceptance**
- Le fichier est importé et affiché comme un upload local.

---

## Epic 4 — Export OneDrive (Pro+) (A)

### T4.1 — Activer scope `Files.ReadWrite` (Pro/Enterprise)
**Scope**
- Mise à jour scopes + re-consent.
- Gating : `ms_export`.

**Acceptance**
- Free reçoit 403 sur export.

### T4.2 — Upload/Update fichier sur OneDrive
**Scope**
- `POST /api/ms/files/upload` (création) + (option) update.
- UI : bouton “Exporter vers OneDrive”.

**Acceptance**
- Pro exporte un fichier, récupère un lien/ID.

---

## Epic 5 — Power Automate (C)

### T5.1 — Flow Power Automate (webhook) : modèle JSON
**Scope**
- Documenter payload standard (user, fileId, action, result summary).

**Acceptance**
- Flow reçoit et log l’événement.

### T5.2 — Endpoint trigger Power Automate (Pro/Enterprise)
**Scope**
- `POST /api/automations/power-automate/trigger`
- Quota + audit.

**Acceptance**
- Pro déclenche manuellement, Free est bloqué.

### T5.3 — (Option Enterprise) Queue + retry
**Scope**
- Stocker job dans `AutomationJobs`, worker/cron (selon archi) ou exécution différée.

**Acceptance**
- Retry en cas d’échec temporaire.

---

## Epic 6 — Entreprise : gouvernance (A + D)

### T6.1 — Politiques tenant / domaines (Enterprise)
**Scope**
- Allowlist domaines emails.
- (Option) allowlist tenantId Microsoft.

**Acceptance**
- Un user hors policy est bloqué et audité.

### T6.2 — Audit avancé (export + rétention)
**Scope**
- Export audit CSV.
- Rétention (job de purge) selon configuration.

**Acceptance**
- Un admin Enterprise peut exporter 30j d’audit.

---

## Epic 7 — Finitions UX & Qualité

### T7.1 — Écrans “Upgrade plan” cohérents
**Scope**
- UI: si feature bloquée → CTA “Passer à Pro/Entreprise” (sans finaliser prix).

**Acceptance**
- Message actionnable, pas d’erreurs silencieuses.

### T7.2 — Tests minimaux API (smoke)
**Scope**
- Ajouter tests simples (si infra existante) ou scripts curl documentés.

**Acceptance**
- Tester `401/403` et un cas succès par feature.

---

## Ordre recommandé (exécution rapide)
1) Epic 1 (gating + audit + quotas)
2) Epic 2 (PII + durcissement endpoint Excel)
3) Epic 3 (Graph connect + import OneDrive)
4) Epic 4 (export Pro)
5) Epic 5 (Power Automate)
6) Epic 6 (Entreprise)
