# MCP (Model Context Protocol) - Implémentation

## 📊 État: Fonctionnel ✅

### Architecture
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   dev-server    │────▶│   mcp-server    │
│   (index.html)  │     │   (Port 8080)   │     │   (Port 3001)   │
│                 │◀────│   /mcp proxy    │◀────│                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Outils Disponibles (8)

| Outil | Description | Paramètres | API |
|-------|-------------|------------|-----|
| `list_tools` | Liste les outils MCP | - | Local |
| `get_employees` | Données RH employés | - | Local JSON |
| `web_search` | Recherche web | `query`, `max_results` | Brave API / Simulation |
| `get_exchange_rate` | Taux de change | `from`, `to` | exchangerate-api.com ✅ |
| `get_datetime` | Date/heure actuelle | `timezone` | Local |
| `calculate` | Calculatrice | `expression` | Local |
| `generate_uuid` | Génère UUID | - | Local |
| `get_external_data` | API externe | `url` | Simulation |

### Interface Utilisateur

**Paramètres (Settings) → MCP Tools**
- Toggle ON/OFF global
- Permissions granulaires:
  - ✅ Web Search
  - ✅ Finance  
  - ☐ Communication

### Utilisation

#### Commande Manuelle
```
/mcp get_exchange_rate from=USD to=EUR
/mcp calculate expression=100*1.19
/mcp web_search query=actualités algérie
```

#### Appel Automatique par l'IA
L'IA peut appeler les outils en répondant avec:
```
[CALL_TOOL:get_exchange_rate:{"from":"USD","to":"DZD"}]
```

### Configuration API Externe

#### Brave Search (Optionnel)
```bash
# Dans api/.env ou .env.local
BRAVE_API_KEY=your_brave_api_key
```

### Fichiers Clés

- `mcp-server.js` - Serveur MCP (Port 3001)
- `dev-server.js` - Proxy /mcp → localhost:3001
- `public/index.html` - UI Settings + Fonctions JS MCP

### Tests

```bash
# Liste des outils
curl http://localhost:8080/mcp/tools

# Taux de change
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"tool":"get_exchange_rate","params":{"from":"USD","to":"DZD"}}'

# Calculatrice
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"tool":"calculate","params":{"expression":"2+2*10"}}'
```

### TODO (Améliorations futures)

- [ ] Intégrer le contexte MCP dans le prompt système de l'IA
- [ ] Ajouter plus d'outils (météo, crypto, notifications)
- [ ] Quotas réels par utilisateur (base de données)
- [ ] Logs d'audit des appels MCP
- [ ] Interface visuelle des résultats d'outils

---
*Dernière mise à jour: 1 Février 2026*
