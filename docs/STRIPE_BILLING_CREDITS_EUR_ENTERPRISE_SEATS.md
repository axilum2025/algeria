# Proposition : Billing Stripe (crédits EUR + Enterprise par siège)

Date : 2026-01-03

## Objectif
Mettre en place 3 modes d’accès :

- **Free** : accès à tout ce qui ne coûte pas (ou coût négligeable) côté infra.
- **Pro (Top-up)** : **sans abonnement**, l’utilisateur recharge un **solde en crédits EUR**, puis consomme **au coût réel** (usage mesuré).
- **Enterprise (par siège)** : **abonnement Stripe Billing** avec `quantity = nb de sièges`, accès à tous les modules/outils.

Le but : aligner revenus ↔ coûts (LLM, OCR, vision, stockage), limiter la friction d’entrée, et permettre une offre B2B scalable.

---

## Principes produit

### 1) Monnaie : crédits EUR
- Unité de compte interne : **crédits en EUR**, stockés en **centimes** (`balanceEurCents` en entier).
- UX : afficher **solde** + **historique** (recharge, débits), sans exposer “tokens LLM” directement.

### 2) Pro = prépayé + coût réel
- Le Pro achète des crédits via **Stripe Checkout (paiement unique)**.
- Chaque action “payante” débite le solde **selon l’usage réel** et un pricing interne.

### 3) Enterprise = abonnement par siège
- L’Enterprise paie un abonnement mensuel/annuel.
- `quantity` = nombre de sièges achetés.
- Enforcement : empêcher d’activer plus de membres que les sièges.

---

## Stripe : produits & prix recommandés

### A) Pro Top-up (paiement unique)
Créer des **Prices one-time** pour des packs simples (exemples) :
- `topup_10_eur` (10€)
- `topup_25_eur` (25€)
- `topup_50_eur` (50€)
- `topup_100_eur` (100€)

Notes :
- Éviter un “montant libre” au début (risque d’abus/QA/support). Ajouter plus tard si besoin.
- Le webhook crédite exactement `amount_total` en centimes, moins éventuellement une logique interne si tu veux absorber les frais (ou non).

### B) Enterprise Seats (abonnement)
Créer un **Product** `enterprise_seat` avec 2 Prices :
- Mensuel : `enterprise_seat_monthly`
- Annuel : `enterprise_seat_yearly`

La checkout session (ou billing portal) fixe `quantity = seatsPurchased`.

---

## Données : schéma Azure Table Storage (proposé)
Le repo utilise déjà `@azure/data-tables` (voir `api/utils/userStorage.js`). On peut rester cohérent avec ce stockage.

> Contrainte Azure Tables : pas d’array natif → stocker JSON en string quand nécessaire.

### 1) Table `Users` (existant) : champs à ajouter
PartitionKey: `user`
RowKey: email (déjà utilisé)

Ajouter (exemples) :
- `plan` : `free | pro | enterprise`
- `stripeCustomerId` : `cus_...`
- `defaultOrgId` : `org_...` (si l’utilisateur appartient à une org)
- `proBalanceEurCents` : entier
- `billingStatus` : `active | delinquent | blocked` (optionnel)

### 2) Table `Organizations`
PartitionKey: `org`
RowKey: `org_<uuid>`

Champs :
- `name`
- `ownerEmail`
- `stripeCustomerId`
- `stripeSubscriptionId`
- `seatsPurchased` (entier)
- `plan` : `enterprise`
- `createdAt`, `updatedAt`

### 3) Table `OrgMembers`
PartitionKey: `org_<uuid>`
RowKey: `member_<emailLower>`

Champs :
- `email`
- `role` : `owner | admin | member`
- `status` : `active | invited | disabled`
- `createdAt`, `updatedAt`

### 4) Table `WalletLedger`
Objectif : audit + idempotence + recomposition du solde.

PartitionKey: `wallet_<scope>` où scope = `user_<email>` ou `org_<uuid>`
RowKey: `ts_<ISO>_<random>` (ou uuid)

Champs :
- `direction` : `credit | debit`
- `amountEurCents` : entier
- `reason` : `topup | llm | ocr | vision | storage | image | adjustment`
- `refType` : `stripe_payment_intent | stripe_event | usage_record | manual`
- `refId` : id Stripe / id usage
- `meta` : JSON string (modèle utilisé, tokens, etc.)

### 5) Table `UsageRecords`
PartitionKey: `usage_<scope>` (même scope)
RowKey: `usage_<uuid>`

Champs :
- `kind` : `llm | ocr | vision | storage | image`
- `provider` : `azure | groq | ...`
- `units` : ex: tokens, pages, images
- `costEurCents` : entier (coût final)
- `meta` : JSON string
- `createdAt`

### 6) Table `StripeEvents` (idempotence webhook)
PartitionKey: `stripe`
RowKey: `evt_<id>`

Champs :
- `type`
- `processedAt`
- `status` : `ok | skipped | failed`

---

## Pricing interne (coût réel)

### Principe
On ne facture pas “au doigt mouillé” : on mesure l’usage, puis on applique une table de prix interne en EUR.

### Recommandation
- Garder un module/config unique, ex : `api/utils/billingPricing.js` (ou JSON) qui contient :
  - prix EUR par 1K tokens (input/output) et par provider/modèle
  - prix par page OCR, par image, par requête vision, par Mo/jour stockage, etc.

### Conversion
- Comme tu as choisi **crédits EUR**, garder les prix directement en EUR.
- Tu peux mettre à jour ces valeurs manuellement quand les providers changent leurs prix.

---

## Flux techniques

### 1) Top-up Pro (Checkout one-time)
1. Frontend appelle : `POST /api/billing/topup/create-checkout`
2. Backend crée une `checkout.session` (mode `payment`)
   - `customer_email = email`
   - `metadata.userEmail = email` (ou `userId`)
   - `line_items = priceId topup_x_eur`
3. Stripe redirige vers success_url.
4. Webhook `checkout.session.completed` (ou `payment_intent.succeeded`) :
   - idempotence via `StripeEvents`
   - retrouver l’utilisateur (email/metadata)
   - ajouter une ligne `WalletLedger` crédit
   - mettre à jour `Users.proBalanceEurCents`

### 2) Consommation (appel d’un module payant)
Pour chaque endpoint payant (LLM/OCR/Vision/etc.) :

**Pré-check**
- Identifier l’utilisateur via `requireAuth()` (`api/utils/auth.js`).
- Résoudre le scope :
  - Enterprise : `orgId` (via membership)
  - Pro : scope user
  - Free : pas de débit, mais gating (voir ci-dessous)

**Mesure & débit (coût réel)**
- Appeler le provider (LLM/OCR/Vision…)
- Obtenir l’usage réel (tokens, pages, images…)
- Calculer `costEurCents`
- Si Pro :
  - vérifier solde suffisant (avec une marge minimale recommandée)
  - écrire `UsageRecord`
  - écrire `WalletLedger` debit
  - mettre à jour balance
- Si Enterprise :
  - écrire `UsageRecord` (pour observabilité interne)
  - pas de débit

**Idempotence**
- Pour éviter double débit : chaque action doit générer un `usageId` et les débits doivent référencer `usageId`.

### 3) Enterprise seats (subscription)
1. Créer une organisation + owner.
2. Checkout abonnement seats avec `quantity = seatsPurchased`.
3. Webhook `customer.subscription.created/updated/deleted` :
   - mettre à jour `Organizations.seatsPurchased` et `stripeSubscriptionId`
   - mettre `plan=enterprise`
4. Enforcement :
   - à l’invite/activation d’un membre : vérifier `activeMembers <= seatsPurchased`.

---

## Gating : règles simples

### Free
- Autoriser uniquement les actions **coût=0** (ou très faible) :
  - fonctions “offline”, logique locale, modules qui n’appellent pas d’API payante.
- Interdire : OCR, vision, génération d’images, LLM payant…

### Pro
- Autoriser toutes les actions payantes si `balanceEurCents > 0`.
- Si solde insuffisant : renvoyer `402 Payment Required` + message “Recharge nécessaire”.

### Enterprise
- Accès à toutes les actions.
- Bloquer uniquement si abonnement non actif (delinquent/canceled) ou dépassement de sièges.

---

## API endpoints (proposition)

### Billing Pro
- `POST /api/billing/topup/create-checkout`
  - body: `{ priceId }`
  - returns: `{ url }`

### Billing Enterprise
- `POST /api/billing/enterprise/create-checkout`
  - body: `{ orgId, seats }`
  - returns: `{ url }`

### Webhook
- `POST /api/billing/stripe-webhook`
  - vérifie signature (`STRIPE_WEBHOOK_SECRET`)
  - traite topups + subscriptions

### Wallet / usage
- `GET /api/billing/wallet` → solde + ledger
- `GET /api/billing/usage` → historique usage (optionnel)

---

## Variables d’environnement (à prévoir)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `APP_URL` (success/cancel URLs)
- `BILLING_ENABLED=true|false`
- `BILLING_CURRENCY=EUR`

---

## Sécurité & anti-abus (minimum viable)
- Idempotence webhook : table `StripeEvents`.
- Idempotence débit : `usageId` unique + vérification de doublon.
- Rate limiting sur endpoints payants (il existe déjà `api/utils/rateLimiter.js`).
- Ne jamais créditer le wallet depuis le frontend : uniquement via webhook Stripe validé.

---

## Plan d’implémentation (pragmatique)

### Étape 1 — Pro Top-up minimal (valide en prod)
- Endpoints `topup/create-checkout` + `stripe-webhook`.
- Stockage balance dans `Users` + ledger minimal.
- UI : bouton “Recharger” + affichage solde.

### Étape 2 — Mesure usage + débit coût réel
- Instrumenter d’abord les routes les plus coûteuses (OCR/Vision/LLM principal).
- Ajouter `UsageRecords` et débit idempotent.

### Étape 3 — Enterprise par siège
- Ajouter tables org/members.
- Abonnement seats + enforcement.

---

## Décisions prises (confirmées)
- Crédit en **EUR**.
- Pro : **top-up uniquement**, facturation **au coût réel**.
- Enterprise : **par siège**.
- Tous les services payants (LLM/OCR/Vision/Image/Storage) sont facturés (Pro) / suivis (Enterprise).
