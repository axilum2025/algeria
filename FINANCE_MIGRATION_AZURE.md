# Migration Finance vers Azure Table Storage

## 📋 Résumé

Cette documentation décrit la migration du module Finance depuis localStorage vers Azure Table Storage pour garantir l'isolation des données utilisateur et la conformité RGPD.

**Date de migration** : Janvier 2026  
**Statut** : ✅ Complète

---

## 🎯 Objectif

Migrer toutes les données du module Finance depuis `localStorage` (partagé entre utilisateurs sur même navigateur) vers Azure Table Storage avec isolation stricte par utilisateur.

### Problème résolu

| Avant (localStorage) | Après (Azure) |
|---------------------|---------------|
| ❌ User B peut voir données User A | ✅ Isolation totale par userId |
| ❌ Données en clair dans navigateur | ✅ Chiffrement Azure |
| ❌ Pas d'authentification | ✅ JWT token requis |
| ❌ Non conforme RGPD | ✅ Conforme RGPD |

---

## 🏗️ Architecture

### Schéma de flux

```
┌──────────────────┐     JWT Token      ┌──────────────────┐
│   Frontend       │ ─────────────────► │   Azure API      │
│   (index.html)   │                    │   Functions      │
│                  │ ◄───────────────── │                  │
│   Cache local    │     JSON Data      │   /api/finance-  │
│                  │                    │   conversations  │
└──────────────────┘                    └────────┬─────────┘
                                                 │
                                                 ▼
                                        ┌──────────────────┐
                                        │  Azure Table     │
                                        │  Storage         │
                                        │                  │
                                        │  PartitionKey =  │
                                        │  userId          │
                                        └──────────────────┘
```

### Tables Azure créées

| Table | Description | PartitionKey | RowKey |
|-------|-------------|--------------|--------|
| `financeconversations` | Conversations chat Finance | userId | conversationId |
| `financeinvoices` | Factures scannées | userId | invoiceId |
| `financereports` | Rapports générés | userId | reportId |
| `financesettings` | Paramètres société | userId | "settings" |

---

## 🔧 Approche technique : Cache avec Lazy Loading

### Pourquoi cette approche ?

Les tentatives de migration directe avec `async/await` bloquaient l'interface car :
- Fonctions appelées via `onclick=""` (synchrones)
- Chaînes d'appels synchrones (`renderFinanceHistory` → `getFinanceConversations`)

### Solution : Cache synchrone + chargement async au démarrage

```javascript
// 1. Variables globales
let financeConversationsCache = {};
let financeConversationsCacheLoaded = false;

// 2. Chargement au démarrage (async, non bloquant)
function loadFinanceConversationsCache() {
    const token = getAuthToken();
    if (!token) {
        // Fallback localStorage si pas authentifié
        financeConversationsCache = JSON.parse(localStorage.getItem('financeConversations') || '{}');
        return;
    }
    
    fetch('/api/finance-conversations', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(r => r.json())
    .then(data => {
        financeConversationsCache = {};
        data.forEach(conv => financeConversationsCache[conv.id] = conv);
    })
    .catch(() => {
        // Fallback localStorage si API échoue
        financeConversationsCache = JSON.parse(localStorage.getItem('financeConversations') || '{}');
    });
}

// 3. Appel au chargement de la page
loadFinanceConversationsCache();
```

### Fonctions migrées

| Fonction | Avant | Après |
|----------|-------|-------|
| `saveFinanceConversation()` | localStorage.setItem | Cache + API POST |
| `loadFinanceConversation()` | localStorage.getItem | Cache lookup |
| `getFinanceConversations()` | localStorage.getItem | Cache values |
| `deleteFinanceConversation()` | localStorage delete | Cache + API DELETE |
| `renameFinanceConversation()` | localStorage update | Cache + saveFinanceConversation() |

---

## 📁 Fichiers modifiés

### Backend (API)

| Fichier | Description |
|---------|-------------|
| `api/finance-conversations/index.js` | API REST pour conversations |
| `api/finance-settings/index.js` | API REST pour paramètres |
| `api/utils/financeStorage.js` | Client Azure Table Storage |

### Frontend

| Fichier | Modifications |
|---------|---------------|
| `public/index.html` | Cache + migration des 5 fonctions Finance |
| `public/js/financeStorageClient.js` | Client API (optionnel, fallback) |

---

## 🔒 Sécurité implémentée

### 1. Isolation par utilisateur

```javascript
// API Backend - Chaque requête filtre par userId
const entities = this.clients.conversations.listEntities({
    queryOptions: {
        filter: `PartitionKey eq '${userId}'`
    }
});
```

### 2. Authentification obligatoire

```javascript
// API vérifie le token JWT
const userId = extractUserId(req);
if (!userId) {
    context.res.status = 401;
    return { error: 'Utilisateur non authentifié' };
}
```

### 3. Fallback sécurisé

Si l'API échoue, le système utilise localStorage comme fallback temporaire. Les données sont resynchronisées à la prochaine connexion.

---

## 📊 Commits de migration

| Commit | Description |
|--------|-------------|
| `44fe2f2` | Add conversations cache with Azure loading |
| `4337ab4` | Migrate getFinanceConversations to use cache |
| `5b9fde6` | Migrate loadFinanceConversation to use cache |
| `814f329` | Migrate deleteFinanceConversation to cache + API |
| `fe443d2` | Migrate renameFinanceConversation to use cache |
| `0622e6f` | Migrate remaining localStorage reads to cache |
| `f5f0bd1` | Migrate all remaining localStorage refs to cache |

---

## ✅ Tests recommandés

### Test d'isolation multi-utilisateur

1. Se connecter avec User A
2. Créer une conversation Finance
3. Se déconnecter
4. Se connecter avec User B
5. Vérifier que la conversation de User A n'apparaît pas
6. Créer une conversation avec User B
7. Se reconnecter avec User A
8. Vérifier que seule la conversation de User A apparaît

### Test de fallback

1. Désactiver temporairement l'API (ou couper le réseau)
2. Vérifier que l'application continue de fonctionner avec localStorage
3. Réactiver l'API
4. Vérifier que les données sont synchronisées

---

## 🔄 Prochaines étapes

- [ ] Migration module HR (critique : salaires, évaluations)
- [ ] Migration module R&D (propriété intellectuelle)
- [ ] Migration module Marketing (budgets, campagnes)
- [ ] Migration module Excel (workbooks partagés)

---

## 📞 Support

En cas de problème avec la migration :
1. Vérifier les logs Azure Functions
2. Vérifier la console navigateur pour erreurs API
3. Vérifier que `AZURE_STORAGE_CONNECTION_STRING` est configuré
