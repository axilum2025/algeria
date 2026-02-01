# Guide de Dépannage - Problèmes de Facturation Codespace

## 🚨 Problème : Codespace Arrêté pour Problème de Facturation

Si votre Codespace s'est arrêté avec un message indiquant un problème de facturation, suivez ces étapes :

### 1. Vérifier l'État de Votre Compte GitHub

#### A. Vérifier les Paiements
1. Allez sur : https://github.com/settings/billing
2. Vérifiez que votre mode de paiement est valide
3. Vérifiez qu'il n'y a pas de paiements en attente ou échoués

#### B. Vérifier les Limites de Dépenses
1. Allez sur : https://github.com/settings/billing/spending_limit
2. Vérifiez la limite de dépenses pour Codespaces
3. Si la limite est à 0 USD, augmentez-la selon vos besoins

### 2. Problèmes Courants et Solutions

#### Problème : Paiement Effectué Mais Non Reconnu

**Symptôme** : Vous avez payé hier mais le service ne fonctionne toujours pas aujourd'hui.

**Solutions** :

1. **Délai de Traitement** : Les paiements peuvent prendre 24-48 heures pour être traités
   - Attendez quelques heures supplémentaires
   - Vérifiez votre email pour une confirmation de paiement

2. **Vérifier la Méthode de Paiement** :
   ```
   GitHub Settings → Billing → Payment information
   ```
   - Assurez-vous que la carte n'a pas expiré
   - Vérifiez que les fonds sont suffisants

3. **Contacter le Support GitHub** :
   - Allez sur : https://support.github.com/
   - Sélectionnez "Billing and payments"
   - Expliquez votre situation avec les détails du paiement

#### Problème : Limite de Dépenses Atteinte

**Solution** :
1. Allez sur : https://github.com/settings/billing/spending_limit
2. Augmentez la limite de dépenses pour Codespaces
3. Configurez des alertes de facturation pour éviter les interruptions

### 3. Alternatives Temporaires

En attendant la résolution du problème de facturation :

#### Option 1 : Développement Local
```bash
# Cloner le repository localement
git clone https://github.com/axilum2025/algeria.git
cd algeria

# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev
```

#### Option 2 : Utiliser un Autre Compte
- Si urgent, créez un nouveau compte GitHub
- Profitez des heures gratuites de Codespaces
- Transférez votre travail une fois le problème résolu

#### Option 3 : Utiliser GitHub CLI Localement
```bash
# Installer GitHub CLI
# Sur macOS
brew install gh

# Sur Windows
winget install --id GitHub.cli

# Sur Linux
sudo apt install gh

# S'authentifier
gh auth login

# Travailler avec les repositories
gh repo clone axilum2025/algeria
```

### 4. Prévention Future

#### Configurer des Alertes de Facturation
1. Allez sur : https://github.com/settings/billing
2. Configurez des alertes email à 50%, 75% et 90% de votre limite
3. Surveillez régulièrement votre utilisation

#### Optimiser l'Utilisation de Codespaces
1. **Arrêter les Codespaces** inutilisés :
   ```
   https://github.com/codespaces
   ```
   - Arrêtez manuellement les instances inactives
   - Configurez l'arrêt automatique après 30 minutes d'inactivité

2. **Utiliser des Machines Plus Petites** :
   - Choisissez 2-core au lieu de 4-core si possible
   - Réduisez les coûts de 50%

3. **Travailler en Local** pour le développement quotidien :
   - Utilisez Codespaces uniquement pour les tâches spécifiques
   - Développez localement pour les tâches courantes

### 5. Informations de Contact Support

#### Support GitHub
- **URL** : https://support.github.com/
- **Email** : support@github.com
- **Temps de réponse** : Généralement 24-48 heures

#### Documentation Officielle
- **Billing** : https://docs.github.com/en/billing
- **Codespaces** : https://docs.github.com/en/codespaces
- **Pricing** : https://docs.github.com/en/billing/managing-billing-for-github-codespaces/about-billing-for-github-codespaces

### 6. Checklist de Dépannage

Avant de contacter le support, vérifiez :

- [ ] Le paiement a bien été débité de mon compte bancaire
- [ ] Ma carte de crédit n'a pas expiré
- [ ] J'ai vérifié mes limites de dépenses sur GitHub
- [ ] J'ai attendu au moins 24 heures après le paiement
- [ ] J'ai vérifié mes emails pour des notifications de GitHub
- [ ] J'ai essayé de redémarrer mon Codespace
- [ ] J'ai consulté la page de status GitHub : https://www.githubstatus.com/

### 7. Message Type pour le Support

Si vous devez contacter le support GitHub, utilisez ce modèle :

```
Objet : Problème de Facturation Codespace - Paiement Non Reconnu

Bonjour,

Mon Codespace s'est arrêté avec un message de problème de facturation.

Détails :
- Nom d'utilisateur GitHub : [votre_username]
- Repository concerné : axilum2025/algeria
- Date du paiement : [date]
- Montant payé : [montant]
- Méthode de paiement : [carte/PayPal/etc.]
- Statut actuel : Le service n'est toujours pas actif après 24h

J'ai déjà vérifié :
- Ma méthode de paiement est valide
- Le paiement a été débité de mon compte
- Mes limites de dépenses

Merci de m'aider à résoudre ce problème rapidement.

Cordialement,
[Votre nom]
```

---

## 🆘 Besoin d'Aide Urgente ?

Si vous avez un besoin urgent de continuer à travailler :

1. **Téléchargez votre travail** depuis le Codespace (s'il est accessible en lecture seule)
2. **Travaillez localement** en suivant les instructions dans ce guide
3. **Contactez le support** en parallèle pour résoudre le problème de facturation

## 📚 Ressources Additionnelles

- [Documentation Officielle Codespaces](https://docs.github.com/en/codespaces)
- [Tarification Codespaces](https://github.com/pricing/calculator)
- [Forum Communauté GitHub](https://github.community/)
- [Status GitHub](https://www.githubstatus.com/)
