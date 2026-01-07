# Roadmap — AI Vision PRO + Agent Eve (contexte SaaS PME)

Objectif : transformer *photo → productivité* via des sorties exploitables (données structurées + actions), sans complexifier l’UX.

Ce document est un repère pour revenir plus tard et développer de façon itérative.

---

## 0) Principes produit (PME)

- **Fiabilité > sophistication** : réduire les erreurs, expliquer les limites.
- **1 action = 1 résultat utile** : résumé + liste d’items + prochaines actions.
- **Sorties exportables** : texte, JSON, CSV, pièces jointes.
- **Conformité et confiance** : minimisation des données, auditabilité, suppression.

---

## 1) Vision PRO — améliorations UX immédiates (1–3 jours)

### 1.1 Upload & parcours “sans friction”
- Upload possible **sans choisir d’action** (déjà fait) : auto-description + réponse Eve.
- Afficher un état clair : *Upload → Conversion → Analyse → Résultat*.
- Ajouter un bouton “Réinitialiser” (effacer image + résultats + sélection).

### 1.2 Résultats “exploitables”
- **Analyse** : description + tags + objets + marques + couleurs + catégories (déjà enrichi).
- **OCR** : aperçu lignes + copier + télécharger .txt (déjà fait).
- Standardiser l’affichage :
  - Un bloc `Résumé`
  - Un bloc `Détails`
  - Un bloc `Actions`

### 1.3 Messages d’erreurs compréhensibles
- Erreurs structurées : `error`, `hint`, `details` (déjà amélioré côté UI).
- Pour les erreurs Azure fréquentes : proposer 1 recommandation (taille, format, luminosité).

---

## 2) Agent Eve — améliorer la valeur (1 semaine)

### 2.1 Eve doit produire des sorties “métier”
Objectif : Eve ne “bavarde” pas, elle **synthétise et propose des actions**.

Format de réponse recommandé (stable) :
- **Résumé (3–6 lignes)**
- **Points clés** (liste courte)
- **Actions suivantes** (2–4 suggestions)

Exemples d’actions suivantes (PME) :
- “Extraire champs facture”
- “Générer un rapport chantier”
- “Créer un ticket incident”
- “Exporter JSON/CSV”

### 2.2 Eve comme copilote de workflow (pas seulement Q/R)
- Quand une analyse est disponible, Eve doit pouvoir :
  - Reformuler les résultats
  - Proposer un template de rapport
  - Proposer une classification (document, produit, défaut, logo)

### 2.3 Garde-fous
- Toujours rappeler : limitations + besoin de validation humaine.
- Ne pas inventer des infos non présentes (pas de “hallucination”).

---

## 3) “Photo → Action” (2–3 semaines)

### 3.1 Export & intégration (valeur SaaS)
Créer des sorties que les PME peuvent réutiliser :
- Export **.txt** (OCR) (déjà)
- Export **JSON** (analyse + OCR + objets + marques)
- Export **CSV** (listes d’objets/marques)

### 3.2 Ticketing / tâches
- À partir d’une photo, générer un “ticket” :
  - titre
  - description
  - priorité (manuel)
  - pièce jointe (photo)
  - tags (issus de l’analyse)

Cibles d’intégration plus tard :
- Task manager interne
- Email (notification)
- (Optionnel) connecteurs : Trello/Jira/HubSpot

---

## 4) Agents visuels “par métier” (3–6 semaines)

Principe : **1 agent = 1 job** (et 1 écran/flow principal).

### 4.1 Agent Documents (ROI immédiat)
- OCR + extraction + validation simple
- Cas PME : factures, bons de livraison, contrats signés
- Sorties : champs structurés + export + archivage

### 4.2 Agent Qualité
- Détection d’objets + checklist non-conformités (semi-automatique)
- Sorties : rapport + photo + items détectés + actions

### 4.3 Agent Chantier
- Résumé photo + catégorisation (sécurité/avancement/incident)
- Rapport hebdo consolidé (multi-photos)

### 4.4 Agent Stock & Livraison
- Lecture étiquettes + anomalies livraison
- Sorties : liste d’écarts + preuve photo

---

## 5) Sécurité, conformité, multi-tenant (en continu)

### 5.1 Données & rétention
- Durée de conservation par tenant (ex: 7j / 30j / 90j)
- Suppression manuelle et automatique

### 5.2 Privacy tooling
- Redaction (masquage zones texte) configurable
- Journaux d’accès (audit)

### 5.3 Observabilité
- `requestId` partout
- métriques : latence, taux d’erreur, quotas, taille des images

---

## 6) Dépendances techniques (notes)

### 6.1 Endpoints existants utiles
- Vision : analyze / ocr / detect / brand
- Reverse links : liens Google/Lens/Bing (pas de reverse API Google fiable)

### 6.2 Améliorations backend “low risk”
- Normaliser les erreurs : toujours retourner JSON `{ error, hint?, details? }`
- Ajouter une route “export” (plus tard) : renvoyer un bundle JSON consolidé

---

## 7) Prochaines étapes (choix)

Choisis 1 axe pour la prochaine itération :
- A) Export JSON/CSV (rapide, très SaaS)
- B) Ticket automatique (photo → incident/tâche)
- C) Redaction (privacy) (fort différenciant B2B)
- D) Rapport “chantier” (template + export)
