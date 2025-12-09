# 🚀 Démarrage Rapide - Azure Storage Configuration

## ⚡ Configuration en 5 Minutes

### Option 1 : Script Automatisé (Recommandé)

```bash
# 1. Se connecter à Azure
az login

# 2. Exécuter le script
cd /workspaces/azuredev-2641
./setup-azure-storage.sh

# 3. Suivre les instructions affichées
```

Le script crée automatiquement:
- ✅ Storage Account
- ✅ Table `responsehistory`
- ✅ Met à jour local.settings.json

**Ensuite:** Copiez la connection string dans Azure Portal Static Web App (instructions affichées à la fin).

---

### Option 2 : Azure Portal Manuel

📖 **Guide complet:** `AZURE_STORAGE_SETUP_GUIDE.md`

**Résumé:**
1. portal.azure.com → Créer Storage Account
2. Nom: `axilumaistorage`, Standard LRS
3. Access keys → Copier connection string
4. Static Web App → Configuration → Ajouter `AZURE_STORAGE_CONNECTION_STRING`

---

## ✅ Vérification Rapide

```bash
# Tester localement
cd api && func start

# Autre terminal
curl -X POST http://localhost:7071/api/agents/axilum/invoke \
  -H "Content-Type: application/json" \
  -d '{"message":"Test"}' | jq '.confidence_metrics.historical_stats.sampleSize'
```

Si le nombre augmente entre les appels: **✅ Storage fonctionne !**

---

## 📚 Documentation

- `AZURE_STORAGE_SETUP_GUIDE.md` - Guide détaillé avec étapes Azure Portal
- `setup-azure-storage.sh` - Script automatisé
- `FINAL_CHECKLIST.md` - Checklist complète de déploiement

**Coût:** ~0.05$/mois (30x moins cher que Redis!)
