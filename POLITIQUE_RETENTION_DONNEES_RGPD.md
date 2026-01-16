# Politique de Rétention des Données - RGPD

## 📋 Introduction

Cette politique définit les règles de conservation et de suppression des données personnelles pour l'application Axilum, conformément au Règlement Général sur la Protection des Données (RGPD - UE 2016/679).

**Date d'entrée en vigueur** : Janvier 2026  
**Dernière mise à jour** : Janvier 2026

---

## 🎯 Principes fondamentaux

### 1. Minimisation des données
Seules les données strictement nécessaires au fonctionnement de l'application sont collectées.

### 2. Limitation de la conservation
Les données ne sont conservées que pendant la durée nécessaire aux finalités pour lesquelles elles ont été collectées.

### 3. Droit à l'effacement
Les utilisateurs peuvent demander la suppression de leurs données à tout moment.

---

## 📊 Durées de rétention par catégorie

### Module Finance

| Type de données | Durée de rétention | Justification |
|-----------------|-------------------|---------------|
| Conversations IA | 2 ans | Historique comptable |
| Factures scannées | 10 ans | Obligation légale fiscale |
| Rapports financiers | 10 ans | Obligation légale fiscale |
| Paramètres société | Jusqu'à suppression compte | Configuration utilisateur |

### Module RH (à migrer)

| Type de données | Durée de rétention | Justification |
|-----------------|-------------------|---------------|
| Fiches employés | 5 ans après départ | Obligation légale travail |
| Bulletins de paie | 50 ans | Obligation légale retraite |
| Évaluations | 5 ans | Gestion des carrières |
| Contrats | 5 ans après fin | Obligation légale |
| Congés/Absences | 5 ans | Obligation légale |

### Module R&D (à migrer)

| Type de données | Durée de rétention | Justification |
|-----------------|-------------------|---------------|
| Projets | Illimité ou jusqu'à suppression | Propriété intellectuelle |
| Documents techniques | Illimité ou jusqu'à suppression | Propriété intellectuelle |
| Notes de recherche | 5 ans après clôture projet | Documentation |

### Module Marketing (à migrer)

| Type de données | Durée de rétention | Justification |
|-----------------|-------------------|---------------|
| Campagnes | 3 ans | Analyse performance |
| Budgets | 5 ans | Comptabilité |
| Analytics | 2 ans | Amélioration service |

### Données d'authentification

| Type de données | Durée de rétention | Justification |
|-----------------|-------------------|---------------|
| Compte utilisateur | Jusqu'à suppression | Fonctionnement service |
| Tokens JWT | 24 heures | Sécurité |
| Logs de connexion | 1 an | Sécurité / Audit |
| Quotas/Crédits | Jusqu'à suppression compte | Facturation |

---

## 🔄 Procédures de suppression

### Suppression automatique

Les données dépassant leur durée de rétention sont supprimées automatiquement par un job Azure Functions planifié (à implémenter).

```javascript
// Exemple de job de purge (à implémenter)
async function purgeExpiredData() {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    
    // Supprimer conversations Finance > 2 ans
    await financeStorage.deleteConversationsOlderThan(twoYearsAgo);
}
```

### Suppression sur demande utilisateur

1. L'utilisateur fait une demande via l'interface ou par email
2. L'administrateur vérifie l'identité
3. Toutes les données associées au `userId` sont supprimées
4. Confirmation envoyée sous 30 jours (délai RGPD)

### Script de suppression complète

```bash
# Suppression de toutes les données d'un utilisateur
az storage entity delete --table financeconversations --partition-key "USER_ID"
az storage entity delete --table financeinvoices --partition-key "USER_ID"
az storage entity delete --table financereports --partition-key "USER_ID"
az storage entity delete --table financesettings --partition-key "USER_ID"
# ... autres tables
```

---

## 🔒 Sécurité des données

### Stockage

| Mesure | Implémentation |
|--------|----------------|
| Chiffrement au repos | Azure Storage Service Encryption (AES-256) |
| Chiffrement en transit | TLS 1.2 minimum |
| Isolation multi-tenant | PartitionKey = userId |
| Contrôle d'accès | RBAC Azure + JWT |

### Localisation

| Environnement | Région Azure | Conformité |
|---------------|--------------|------------|
| Production | France Central | RGPD ✅ |
| Backup | West Europe | RGPD ✅ |

> ⚠️ **Important** : Vérifier que le compte Azure Storage est bien configuré en région Europe.

---

## 📤 Portabilité des données

### Droit à la portabilité (Article 20 RGPD)

Sur demande, l'utilisateur peut exporter toutes ses données dans un format lisible par machine (JSON).

```javascript
// API d'export (à implémenter)
GET /api/user/export
Authorization: Bearer <token>

// Réponse
{
    "user": { ... },
    "finance": {
        "conversations": [...],
        "invoices": [...],
        "reports": [...]
    },
    "hr": { ... },
    "rnd": { ... },
    "marketing": { ... }
}
```

---

## 📝 Registre des traitements

| Traitement | Base légale | Finalité | Destinataires |
|------------|-------------|----------|---------------|
| Conversations Finance IA | Contrat | Assistance comptable | Utilisateur seul |
| Scan factures | Contrat | Extraction données | Utilisateur + Azure Vision |
| Gestion RH | Obligation légale | Gestion du personnel | Utilisateur + Employés concernés |
| Projets R&D | Intérêt légitime | Innovation | Utilisateur seul |
| Campagnes Marketing | Contrat | Marketing | Utilisateur seul |

---

## 🚨 Procédure de violation de données

En cas de violation de données (Article 33 RGPD) :

1. **Détection** : Monitoring Azure et alertes
2. **Évaluation** : Analyse de l'impact sous 24h
3. **Notification CNIL** : Si risque, sous 72h
4. **Notification utilisateurs** : Si risque élevé, sans délai
5. **Documentation** : Rapport complet dans le registre

---

## 📞 Contact DPO

Pour toute question relative à la protection des données :

- **Email** : dpo@axilum.com (à configurer)
- **Délai de réponse** : 30 jours maximum

---

## ✅ Checklist conformité RGPD

- [x] Isolation des données par utilisateur
- [x] Authentification obligatoire
- [x] Chiffrement au repos et en transit
- [x] Hébergement en Europe
- [x] Droit de suppression implémenté
- [ ] Job de purge automatique (à implémenter)
- [ ] API d'export portabilité (à implémenter)
- [ ] Page politique de confidentialité (à créer)
- [ ] Bandeau cookies (à vérifier)
- [ ] Registre des traitements complet (à finaliser)

---

## 📜 Références légales

- [RGPD - Règlement UE 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
- [CNIL - Guide RGPD](https://www.cnil.fr/fr/rgpd-de-quoi-parle-t-on)
- [Azure Compliance - GDPR](https://docs.microsoft.com/en-us/azure/compliance/offerings/offering-gdpr)
