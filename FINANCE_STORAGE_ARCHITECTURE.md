# Finance Storage - Architecture Sécurisée avec Azure

## 🔒 Isolation par Utilisateur

### Architecture

```
┌─────────────────┐
│   Frontend      │
│  (index.html)   │
└────────┬────────┘
         │
         ├─ financeStorageClient.js (Client API)
         │
         ▼
┌─────────────────┐
│   Azure APIs    │
├─────────────────┤
│ /finance/       │
│  conversations  │
│  settings       │
│  invoices       │
│  reports        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ financeStorage  │
│  .js (Backend)  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│   Azure Table Storage            │
├─────────────────────────────────┤
│ • financeconversations          │
│ • financeinvoices               │
│ • financereports                │
│ • financesettings               │
│                                 │
│ PartitionKey = userId           │
│ RowKey = conversationId/        │
│          invoiceId/etc          │
└─────────────────────────────────┘
```

## 📊 Tables Azure

### 1. financeconversations
- **PartitionKey**: `userId` (isolation stricte)
- **RowKey**: `conversationId`
- **Données**: 
  - name
  - historyJson (messages)
  - contextJson (factures, contexte)
  - messageCount
  - lastUpdated

### 2. financeinvoices
- **PartitionKey**: `userId`
- **RowKey**: `invoiceId`
- **Données**:
  - vendor, amount, type, date
  - invoiceNumber, category
  - dataJson (toutes les données)

### 3. financesettings
- **PartitionKey**: `userId`
- **RowKey**: `company_settings`
- **Données**:
  - settingsJson (nom entreprise, devise, etc.)

### 4. financereports
- **PartitionKey**: `userId`
- **RowKey**: `reportId`
- **Données**:
  - name, url (Blob Storage)
  - size, generatedAt
  - metadataJson

## 🔐 Sécurité

### Isolation par userId
- Chaque requête nécessite un `userId` authentifié
- Les données d'un utilisateur ne sont JAMAIS visibles par un autre
- PartitionKey = userId assure l'isolation au niveau base de données

### Authentification
```javascript
// Header requis
Authorization: Bearer <token>

// Le token contient userId
// Backend extrait userId et l'utilise pour PartitionKey
```

### Avantages vs localStorage
| localStorage | Azure Storage |
|-------------|---------------|
| ❌ Partagé entre utilisateurs (même navigateur) | ✅ Isolé par userId |
| ❌ Pas de synchronisation | ✅ Sync multi-appareils |
| ❌ Limité à 5-10MB | ✅ Illimité |
| ❌ Pas de backup | ✅ Backup automatique |
| ❌ Vulnérable au vol | ✅ Protégé par auth |

## 🚀 Utilisation

### 1. Initialisation (Frontend)
```javascript
// Au login
const userId = currentUser.id;
const token = authToken;
window.financeStorageClient.initialize(userId, token);
```

### 2. Sauvegarder une conversation
```javascript
await window.financeStorageClient.saveConversation(
    conversationId,
    {
        name: 'Conversation Jan 2026',
        history: [...messages],
        context: {...financeData},
        messageCount: 15
    }
);
```

### 3. Récupérer une conversation
```javascript
const conv = await window.financeStorageClient.getConversation(conversationId);
```

### 4. À la déconnexion
```javascript
// Nettoyer données locales
window.financeStorageClient.clearUserData();
```

## 📦 Déploiement

### Variables d'environnement requises
```bash
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...
```

### Installation
```bash
npm install @azure/data-tables
```

### Tables à créer (auto-création au premier appel)
- financeconversations
- financeinvoices
- financereports
- financesettings

## 💰 Coûts Azure

### Table Storage
- **Stockage**: ~0.045$/GB/mois
- **Transactions**: 0.00036$/10k opérations
- **Exemple**: 1000 conversations = ~0.01$/mois

### Comparaison
- Redis: 15$/mois minimum
- Cosmos DB: 24$/mois minimum
- Table Storage: 0.045$/mois 📉

## 🔄 Migration depuis localStorage

### Script de migration (à exécuter une fois)
```javascript
async function migrateFromLocalStorage() {
    const userId = currentUser.id;
    const oldData = JSON.parse(localStorage.getItem('financeConversations') || '{}');
    
    for (const [convId, conv] of Object.entries(oldData)) {
        await financeStorageClient.saveConversation(convId, conv);
    }
    
    localStorage.removeItem('financeConversations');
    console.log('✅ Migration terminée');
}
```

## ✅ Checklist Sécurité

- [x] Isolation par userId (PartitionKey)
- [x] Authentification par token
- [x] Pas d'accès direct localStorage entre users
- [x] Nettoyage à la déconnexion
- [x] Fallback localStorage en cas d'erreur réseau
- [x] HTTPS obligatoire en production
- [ ] JWT avec expiration (à implémenter)
- [ ] Rate limiting (à implémenter)
- [ ] Audit logs (à implémenter)

## 📚 APIs Disponibles

### GET /api/finance/conversations
Liste les conversations de l'utilisateur

### POST /api/finance/conversations
Sauvegarde une conversation

### DELETE /api/finance/conversations
Supprime une conversation

### GET /api/finance/settings
Récupère les paramètres entreprise

### POST /api/finance/settings
Sauvegarde les paramètres

---

**Note**: Cette architecture assure une isolation complète des données par utilisateur tout en utilisant l'infrastructure Azure existante.
