# Plan d’intégration MCP (Model Context Protocol) — vision entreprise & roadmap

Date: 2026-01-25  
Statut: brouillon v1 (à valider avec Sécurité, Produit, IT)

## 1) Résumé exécutif

**MCP (Model Context Protocol)** est un protocole standardisé permettant à un Agent IA de **consommer des outils externes** via une interface cohérente, sans coupler l’agent aux implémentations.

- **Copilot SDK / framework d’agent = le “cerveau”** (raisonnement, orchestration, choix des actions)
- **MCP = les “bras”** (accès standardisé aux outils : GitHub, DB, CRM/ERP, fichiers, APIs, etc.)

Objectif entreprise: **industrialiser** l’intégration d’outils, la sécurité, et la personnalisation multi-clients/multi-équipes, en réduisant le time-to-integrate.

## 2) Proposition de valeur (pour le plan d’entreprise)

### 2.1 Pourquoi maintenant
- Les plateformes d’agents deviennent vite ingérables si chaque outil est intégré “à la main” (couplage, dette, risques)
- Les besoins “Lovable/Devin/Cursor-like” exigent des outils **dynamiques** (par user/tenant) et **auditables**

### 2.2 Bénéfices attendus
- **Plug & Play**: ajout d’outils plus rapide, réutilisable entre agents
- **Sécurité**: isolation, policies centralisées, moindres privilèges, audit
- **Scalabilité**: multi-tenant, activation/désactivation par client/équipe
- **Extensibilité**: base pour un **catalogue d’outils** (interne puis partenaires)

## 3) Positionnement architecture (modèle mental)

Éviter le couplage direct:

- Couplage: `Agent → Tool (implémentation)`
- Cible: `Agent → MCP Client → MCP Server → Tool`

Responsabilités:
- L’agent décide **quoi** faire (tool calling)
- MCP exécute **comment** le faire (outils, permissions, sandbox)

## 4) Axes stratégiques

### Axe A — Plateforme
Standardiser l’intégration d’outils via MCP afin d’accélérer l’ajout de nouvelles capacités.

### Axe B — Sécurité & conformité
Mettre en place une couche d’autorisation et d’audit centralisée, avec isolation d’exécution, redaction/PII et contrôle des sorties réseau.

### Axe C — Go-to-market
Développer un catalogue d’outils et un modèle de “capabilities” activables par client/équipe.

## 5) Roadmap (phases)

### Phase 0 (2–4 semaines) — Cadrage & design
**Livrables**
- Liste priorisée des 10–20 outils (ROI + risques)
- Modèle d’autorisations (RBAC/ABAC), périmètres, politiques de données
- Décision d’hébergement (MCP server interne, réseau privé, egress control)
- Convention de contrats: schémas d’input/output, erreurs, timeouts

**Décisions à figer**
- Multi-tenant: isolation logique vs isolation infra
- Gestion secrets: vault/managed secrets, rotation, scopes

### Phase 1 (4–8 semaines) — MVP industrialisable (5–8 outils)
**Cibles**
- 1 MCP server + 1 MCP client (backend)
- 5–8 outils à fort impact (ex: recherche KB, DB read-only, GitHub, ticketing, fetch API)

**Non-négociables**
- Observabilité: logs, traces, métriques, coûts
- Sécurité: allowlist, quotas, rate limiting, validation schémas
- Audit: qui / quoi / quand / résultat / ressources touchées

### Phase 2 (8–16 semaines) — Multi-tenant, personnalisation, qualité
**Ajouts**
- Activation/désactivation des outils par client/équipe (feature flags)
- Politiques fines: data scopes, redaction PII, egress allowlist
- Human-in-the-loop sur actions critiques (paiement, suppression, envoi externe)
- Tests contractuels et sandbox de dev pour “tool authors”

### Phase 3 (T+1 trimestre) — Catalogue / marketplace interne
**Ajouts**
- Templates de tool + checklist sécurité + CI
- “Tool onboarding” (objectif: 1 tool en 1 jour)
- Gouvernance: scoring risques, revues sécurité obligatoires

## 6) Gouvernance (Operating Model)

### 6.1 Ownership
- **Équipe Platform/AI Enablement**: MCP server, standards, policies, observabilité
- **Équipes métiers**: ownership des tools métier, SLO et maintenance
- **Sécurité/Conformité**: validation des catégories d’outils et des accès données

### 6.2 Process (Tool Intake)
1. Demande d’outil (use case + données + risques)
2. Évaluation sécurité (scopes, PII, egress, audit)
3. Implémentation + tests contractuels
4. Mise en production progressive (feature flags)
5. Monitoring, quotas, amélioration continue

## 7) Sécurité & conformité (à documenter explicitement)

### Contrôles minimum
- **Least privilege**: scopes minimaux, tokens par tenant
- **Isolation**: exécution contrôlée (réseau/IAM/sandbox)
- **Validation**: schémas d’entrée, taille payload, timeouts
- **Audit**: journalisation + traçabilité exploitable (SIEM si besoin)
- **Protection données**: redaction/PII, chiffrement, rétention
- **Anti-abus**: rate limit, quotas par tenant, détection exfiltration

## 8) KPIs (pilotage)

- Time-to-integrate d’un nouvel outil (objectif: ÷3 à ÷5)
- Taux de réutilisation des tools entre agents/produits
- Latence médiane + P95 par tool / par tenant
- Coût moyen par tâche automatisée + taux d’escalade humaine
- Incidents liés aux intégrations (objectif: baisse)

## 9) Risques & réponses

- Trop d’outils → catalogue, standards, ownership, tests contractuels
- Fuite de données → scopes minimaux, audit, redaction, egress control
- Couplage fournisseur → MCP standardise, vous gardez l’exécution des tools

## 10) Checklist “Plan 90 jours” (à adapter)

### Semaines 1–2
- Choisir 3 workflows cibles (ex: Support, Finance, RH)
- Lister 10 outils candidats + classification données (PII/Confidentiel/Public)

### Semaines 3–6
- Déployer MCP server + client backend
- Livrer 3–5 tools “read-only” (faible risque) + observabilité

### Semaines 7–10
- Ajouter 2–3 tools “write” avec approbation humaine
- Mettre en place quotas/rate limiting + policies PII

### Semaines 11–12
- Packager le processus “tool intake” + templates + CI
- Démarrer le catalogue interne (docs + ownership + SLO)

## Annexes (templates)

### A) Modèle d’enregistrement d’un tool
- Nom: 
- Description: 
- Données consultées/écrites: 
- Niveau de risque: 
- Scopes requis: 
- Contraintes (timeouts, size limits): 
- Audit requis: 
- Owner (équipe): 

### B) Politique d’activation par utilisateur/tenant (exemple)
```json
{
  "user_id": "123",
  "tenant_id": "acme",
  "enabled_tools": ["filesystem_read", "github", "database_read"],
  "tool_limits": {"requests_per_min": 60}
}
```
