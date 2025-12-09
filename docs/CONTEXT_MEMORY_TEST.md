# 🧠 Test de la Mémoire Contextuelle - Axilum AI

## Changement Apporté

**Problème résolu :** L'agent IA ne se souvenait pas du contexte précédent entre les messages.

**Solution implémentée :**
- ✅ Ajout de l'historique complet de conversation à chaque appel API
- ✅ L'agent reçoit maintenant tous les messages précédents
- ✅ Nettoyage automatique des métriques (HI/CHR) avant envoi au modèle
- ✅ Contexte conservé dans localStorage du navigateur

---

## Comment Tester la Mémoire Contextuelle

### Test 1: Question Simple avec Suivi 🎯

1. **Ouvrir l'application :**
   ```
   https://proud-mushroom-019836d03.3.azurestaticapps.net
   ```

2. **Envoyer le premier message :**
   ```
   Mon nom est Alice et j'adore la programmation Python.
   ```

3. **Attendre la réponse de l'agent**

4. **Envoyer un message de suivi :**
   ```
   Quel est mon nom ?
   ```

5. **Résultat attendu :**
   - ✅ L'agent devrait répondre "Alice" ou "Votre nom est Alice"
   - ❌ Si échec : L'agent dira qu'il ne connaît pas votre nom

---

### Test 2: Conversation Continue 💬

1. **Message 1 :**
   ```
   J'ai un chat noir qui s'appelle Minou.
   ```

2. **Message 2 :**
   ```
   De quelle couleur est mon chat ?
   ```
   **Attendu :** Noir

3. **Message 3 :**
   ```
   Comment s'appelle-t-il ?
   ```
   **Attendu :** Minou

---

### Test 3: Contexte Technique 🛠️

1. **Message 1 :**
   ```
   Je travaille sur un projet React avec TypeScript.
   ```

2. **Message 2 :**
   ```
   Quelles technologies j'utilise ?
   ```
   **Attendu :** React et TypeScript

3. **Message 3 :**
   ```
   Donne-moi des conseils pour mon projet.
   ```
   **Attendu :** Conseils spécifiques à React + TypeScript

---

### Test 4: Mémoire Persistante (Nouvelle Session) 🔄

1. **Envoyer plusieurs messages dans une conversation**

2. **Fermer complètement le navigateur** (ou l'onglet)

3. **Rouvrir l'application**

4. **Cliquer sur la conversation précédente dans la sidebar**

5. **Résultat attendu :**
   - ✅ Tous les messages précédents s'affichent
   - ✅ L'historique est conservé dans localStorage
   - ⚠️ **Note :** Quand vous reprenez la conversation, l'agent devrait avoir accès au contexte

---

## Vérification Technique

### 1. Console du Navigateur (F12)

Ouvrez la console et tapez :
```javascript
JSON.parse(localStorage.getItem('conversations'))
```

**Résultat attendu :**
```json
[
  {
    "id": "conv-123456",
    "title": "Mon nom est Alice...",
    "messages": [
      {
        "user": "Mon nom est Alice...",
        "bot": "Bonjour Alice...",
        "timestamp": 1701987654321,
        "hiScore": 5.2,
        "chrScore": 12.3
      }
    ],
    "timestamp": 1701987654321
  }
]
```

### 2. Logs de l'API (Azure Portal)

Après avoir envoyé un message avec historique :

```
📝 Conversation context: 5 messages (including system prompt)
```

Ce log confirme que l'historique est envoyé à l'API.

---

## Scénarios de Test Avancés

### Test 5: Conversation Longue 📚

Envoyez 10 messages différents sur des sujets variés, puis :

```
Résume notre conversation depuis le début.
```

**Attendu :** L'agent devrait résumer tous les points abordés.

---

### Test 6: Correction et Suivi ✏️

1. **Message 1 :**
   ```
   Paris est la capitale de l'Allemagne.
   ```

2. **Message 2 :**
   ```
   Non, je me suis trompé. Paris est la capitale de la France.
   ```

3. **Message 3 :**
   ```
   Quelle est la capitale de la France ?
   ```

**Attendu :** L'agent devrait dire "Paris" en tenant compte de la correction.

---

### Test 7: Référence Contextuelle 🔗

1. **Message 1 :**
   ```
   JavaScript est un langage de programmation créé en 1995.
   ```

2. **Message 2 :**
   ```
   Et TypeScript ?
   ```

3. **Message 3 :**
   ```
   Compare ces deux langages.
   ```

**Attendu :** L'agent devrait comparer JavaScript (mentionné au message 1) et TypeScript.

---

## Vérification des Logs Azure

### Via Azure CLI

```bash
# Voir les logs en temps réel
az webapp log tail --name proud-mushroom-019836d03 --resource-group <votre-resource-group>
```

### Via Azure Portal

1. Aller sur https://portal.azure.com
2. Rechercher "proud-mushroom-019836d03"
3. Menu gauche > "Monitoring" > "Log stream"
4. Envoyer un message via l'interface
5. Observer les logs :
   ```
   📝 Conversation context: X messages (including system prompt)
   ```

---

## Dépannage

### Problème : L'agent ne se souvient toujours pas

**Vérifications :**

1. **Effacer le cache localStorage :**
   ```javascript
   // Dans la console du navigateur (F12)
   localStorage.clear();
   location.reload();
   ```

2. **Vérifier que les messages sont sauvegardés :**
   ```javascript
   // Dans la console
   console.log(JSON.parse(localStorage.getItem('conversations')));
   ```

3. **Vérifier les logs API :**
   - Chercher `Conversation context: X messages`
   - Si X = 2, seul le message actuel est envoyé (problème)
   - Si X > 2, l'historique est envoyé (OK)

4. **Forcer une nouvelle conversation :**
   - Cliquer sur "+ Nouvelle conversation"
   - Tester à nouveau

---

## Limites Actuelles

### ✅ Ce qui fonctionne

- Historique sauvegardé dans localStorage
- Contexte envoyé à l'API Azure
- Métriques HI/CHR nettoyées avant envoi au modèle
- Conversations multiples gérées séparément

### ⚠️ Limitations Connues

1. **Limite de tokens :**
   - Azure OpenAI a une limite de tokens (~8000-128000 selon le modèle)
   - Les très longues conversations peuvent dépasser cette limite
   - **Solution future :** Implémenter un système de résumé ou truncation

2. **Stockage navigateur :**
   - localStorage limité à ~5-10 MB
   - Si dépassé, les anciennes conversations peuvent être perdues
   - **Solution future :** Backend avec base de données

3. **Conversations non synchronisées :**
   - L'historique est local au navigateur
   - Pas de synchronisation entre appareils
   - **Solution future :** Azure Table Storage ou Cosmos DB

---

## Prochaines Améliorations Possibles

### Court terme
- [ ] Ajouter un indicateur visuel "Contexte : X messages"
- [ ] Limiter l'historique aux 20 derniers messages pour économiser les tokens
- [ ] Afficher un warning si la conversation est trop longue

### Moyen terme
- [ ] Implémenter un système de résumé automatique pour longues conversations
- [ ] Ajouter Azure Table Storage pour persistance serveur
- [ ] Synchronisation multi-appareils

### Long terme
- [ ] Recherche sémantique dans l'historique
- [ ] Export/Import de conversations
- [ ] Partage de conversations

---

## Test Rapide via cURL

### Sans historique (comportement ancien) :
```bash
curl -X POST https://proud-mushroom-019836d03.3.azurestaticapps.net/api/invoke \
  -H "Content-Type: application/json" \
  -d '{"message":"Mon nom est Bob"}' | jq '.response'

# Puis dans une autre requête
curl -X POST https://proud-mushroom-019836d03.3.azurestaticapps.net/api/invoke \
  -H "Content-Type: application/json" \
  -d '{"message":"Quel est mon nom ?"}' | jq '.response'
```

**Résultat attendu (ancien) :** L'agent ne connaît pas votre nom.

### Avec historique (comportement nouveau) :
```bash
curl -X POST https://proud-mushroom-019836d03.3.azurestaticapps.net/api/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Quel est mon nom ?",
    "history": [
      {
        "type": "user",
        "content": "Mon nom est Bob"
      },
      {
        "type": "bot",
        "content": "Bonjour Bob ! Comment puis-je vous aider ?"
      }
    ]
  }' | jq '.response'
```

**Résultat attendu (nouveau) :** "Votre nom est Bob" ou similaire.

---

## Conclusion

✅ **La mémoire contextuelle est maintenant fonctionnelle !**

L'agent Axilum AI peut désormais :
- Se souvenir de vos messages précédents dans une conversation
- Maintenir un contexte cohérent tout au long de l'échange
- Répondre à des questions de suivi qui font référence au passé

**Testez dès maintenant :**
👉 https://proud-mushroom-019836d03.3.azurestaticapps.net

---

**Date :** 7 décembre 2025  
**Version :** 1.1.0 - Mémoire Contextuelle  
**Commit :** 6676974
