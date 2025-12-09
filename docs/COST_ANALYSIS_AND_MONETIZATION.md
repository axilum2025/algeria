# 💰 Analyse des Coûts et Stratégie de Monétisation - Axilum AI

## 📊 Coûts Mensuels par Utilisateur

### Architecture Actuelle

L'application utilise :
- **Azure Static Web Apps** (Hébergement frontend)
- **Azure Functions** (Backend API)
- **Azure OpenAI Service** (GPT-5.1)
- **Azure Table Storage** (Historique des réponses)
- **Google Fact Check API** (Vérification des faits - Gratuit)

### Calcul des Coûts (basé sur usage moyen)

#### 📈 Hypothèses pour un utilisateur actif
- **30 conversations/mois**
- **10 messages par conversation** = 300 messages/mois
- **Longueur moyenne** : 100 tokens input + 300 tokens output = 400 tokens/message

---

### 💵 Détail des Coûts Azure

#### 1. Azure OpenAI Service (GPT-5.1 / GPT-4)
**Tarif** : ~0.03 USD / 1K tokens input, ~0.06 USD / 1K tokens output

**Calcul par utilisateur/mois** :
- Input : 300 messages × 100 tokens = 30,000 tokens → 30K × $0.03/1K = **$0.90**
- Output : 300 messages × 300 tokens = 90,000 tokens → 90K × $0.06/1K = **$5.40**
- **Total GPT : $6.30/mois**

#### 2. Azure Static Web Apps
**Plan Free** : 
- Hébergement gratuit
- 100 GB bande passante/mois gratuite
- SSL inclus
- **Coût : $0.00**

**Plan Standard** (si nécessaire pour fonctionnalités avancées) :
- $9/mois (fixe, tous utilisateurs)
- 100 GB bande passante incluse
- **Coût proraté : ~$0.05/utilisateur** (si 200 utilisateurs)

#### 3. Azure Functions (Consumption Plan)
**Tarif** :
- 1M exécutions gratuites/mois
- $0.20 par million d'exécutions supplémentaires
- 400,000 GB-s gratuits/mois

**Calcul** :
- 300 requêtes/utilisateur
- Durée moyenne : 2 secondes, Mémoire : 512 MB
- **Coût : $0.00** (largement dans le plan gratuit)

#### 4. Azure Table Storage
**Tarif** :
- $0.045/GB stocké par mois
- $0.00036 par 10,000 transactions

**Calcul par utilisateur/mois** :
- Stockage : ~5 KB/message × 300 = 1.5 MB = 0.0015 GB → **$0.00007**
- Transactions : 300 writes + 100 reads = 400 → **$0.000014**
- **Total Storage : $0.0001** (négligeable)

---

## 💰 Coût Total par Utilisateur

| Service | Coût/mois |
|---------|-----------|
| **Azure OpenAI (GPT)** | **$6.30** |
| Azure Static Web Apps | $0.00 - $0.05 |
| Azure Functions | $0.00 |
| Azure Table Storage | $0.00 |
| Google Fact Check API | $0.00 (gratuit) |
| **TOTAL** | **~$6.35/utilisateur/mois** |

### 📊 Projection par Volume

| Utilisateurs | Coût Total/mois | Coût/utilisateur |
|--------------|-----------------|------------------|
| 10 | $63 | $6.30 |
| 50 | $315 | $6.30 |
| 100 | $630 | $6.30 |
| 500 | $3,150 | $6.30 |
| 1,000 | $6,300 | $6.30 |

> **Note** : Le coût est quasi-linéaire car Azure OpenAI est facturé à l'usage (pay-as-you-go).

---

## 💳 Stratégie de Monétisation Recommandée

### Option 1 : Modèle Freemium + Abonnement

#### Plan Gratuit (Free)
- **5 conversations/mois** (50 messages)
- Accès aux fonctionnalités de base
- Pas de carte de crédit requise
- **Coût pour vous** : ~$1.05/utilisateur/mois
- **Objectif** : Acquisition d'utilisateurs

#### Plan Premium ($9.99/mois)
- **Conversations illimitées**
- Accès prioritaire (réponses plus rapides)
- Historique illimité
- Export des conversations (PDF)
- Support prioritaire
- **Coût estimé** : $6.30/utilisateur actif
- **Marge** : $3.69/utilisateur (37%)

#### Plan Pro ($19.99/mois)
- Tout du Premium
- API Access (intégrations)
- Analyse avancée des conversations
- White-label (enlever branding Axilum)
- **Marge** : $13.69/utilisateur (68%)

---

### Option 2 : Pay-As-You-Go (Crédit prépayé)

- **$0.10 par conversation** (10 messages)
- Pack de $5 = 50 conversations
- Pack de $20 = 220 conversations (10% bonus)
- Pack de $50 = 600 conversations (20% bonus)

**Avantages** :
- Utilisateur paie exactement ce qu'il utilise
- Pas d'engagement mensuel
- Marge de 40-60% selon le pack

---

### Option 3 : Modèle d'Entreprise

#### Plan Team ($49/mois)
- 5 utilisateurs inclus
- Gestion d'équipe
- Analytics avancés
- SSO (Single Sign-On)

#### Plan Enterprise (Sur devis)
- Utilisateurs illimités
- Support dédié
- SLA 99.9%
- Hébergement dédié
- Personnalisation

---

## 🔐 Implémentation : Authentification + Paiement

### Phase 1 : Système d'Authentification

#### Services Recommandés

**Option A : Azure AD B2C** (Recommandé)
- Authentification gérée par Microsoft
- Email/Password, Google, Facebook, etc.
- $0.00225 par authentification active/mois (50K gratuites)
- Conforme RGPD
- **Coût** : ~$0.05/utilisateur/mois

**Option B : Auth0**
- 7,000 utilisateurs gratuits
- Interface simple
- Au-delà : $23/mois + $0.05/utilisateur
- **Coût** : $0.05-0.10/utilisateur/mois

**Option C : Firebase Auth** (Google)
- Gratuit jusqu'à 50K utilisateurs
- Intégration facile
- **Coût** : $0.00 (sous 50K)

#### Implémentation Technique

**1. Backend : Ajouter Azure AD B2C**

```javascript
// api/utils/auth.js
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const client = jwksClient({
  jwksUri: 'https://YOUR_TENANT.b2clogin.com/YOUR_TENANT.onmicrosoft.com/discovery/v2.0/keys?p=B2C_1_signupsignin'
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

function verifyToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, {
      audience: 'YOUR_CLIENT_ID',
      issuer: 'https://YOUR_TENANT.b2clogin.com/YOUR_TENANT_ID/v2.0/'
    }, (err, decoded) => {
      if (err) reject(err);
      else resolve(decoded);
    });
  });
}

module.exports = { verifyToken };
```

**2. Middleware d'authentification**

```javascript
// api/invoke/index.js
const { verifyToken } = require('../utils/auth');

module.exports = async function (context, req) {
    // Vérifier le token JWT
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        context.res = { status: 401, body: { error: 'Non autorisé' } };
        return;
    }

    try {
        const token = authHeader.replace('Bearer ', '');
        const user = await verifyToken(token);
        
        // Vérifier le quota de l'utilisateur
        const usage = await checkUserQuota(user.sub);
        if (usage.exceeded) {
            context.res = { 
                status: 403, 
                body: { error: 'Quota dépassé', upgrade: true } 
            };
            return;
        }
        
        // Continuer avec la logique normale...
        const response = await processMessage(req.body.message, user);
        
        // Incrémenter le compteur d'usage
        await incrementUsage(user.sub);
        
        context.res = { status: 200, body: response };
    } catch (error) {
        context.res = { status: 401, body: { error: 'Token invalide' } };
    }
};
```

**3. Frontend : Intégration auth**

```javascript
// Login/Signup UI
<div id="authModal">
    <h2>Connexion à Axilum AI</h2>
    <button onclick="loginWithAzureAD()">
        Continuer avec Microsoft
    </button>
    <button onclick="loginWithGoogle()">
        Continuer avec Google
    </button>
    <div class="divider">ou</div>
    <form onsubmit="loginWithEmail(event)">
        <input type="email" placeholder="Email" required>
        <input type="password" placeholder="Mot de passe" required>
        <button type="submit">Se connecter</button>
    </form>
    <p>Pas de compte ? <a href="#" onclick="showSignup()">S'inscrire</a></p>
</div>

<script>
// Configuration Azure AD B2C
const msalConfig = {
    auth: {
        clientId: 'YOUR_CLIENT_ID',
        authority: 'https://YOUR_TENANT.b2clogin.com/YOUR_TENANT.onmicrosoft.com/B2C_1_signupsignin',
        redirectUri: window.location.origin
    }
};

const msalInstance = new msal.PublicClientApplication(msalConfig);

async function loginWithAzureAD() {
    try {
        const response = await msalInstance.loginPopup({
            scopes: ['openid', 'profile']
        });
        
        // Stocker le token
        localStorage.setItem('authToken', response.idToken);
        
        // Mettre à jour l'UI
        showLoggedInState(response.account);
    } catch (error) {
        console.error('Erreur login:', error);
    }
}

// Ajouter le token aux requêtes API
async function sendMessage() {
    const token = localStorage.getItem('authToken');
    
    const response = await fetch(AGENT_ENDPOINT, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message })
    });
    
    if (response.status === 401) {
        // Token expiré, redemander login
        showLoginModal();
    } else if (response.status === 403) {
        // Quota dépassé
        showUpgradeModal();
    }
}
</script>
```

---

### Phase 2 : Système de Paiement

#### Services Recommandés

**Option A : Stripe** (Recommandé)
- Standard de l'industrie
- 2.9% + $0.30 par transaction
- Abonnements récurrents intégrés
- Conforme PCI-DSS
- **Coût** : 2.9% des revenus

**Option B : PayPal**
- Connu des utilisateurs
- 3.4% + fixe par transaction
- **Coût** : 3.4% des revenus

#### Implémentation avec Stripe

**1. Backend : Créer un endpoint de paiement**

```javascript
// api/create-checkout/index.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async function (context, req) {
    const { priceId, userId } = req.body;
    
    try {
        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            line_items: [{
                price: priceId, // 'price_premium_monthly'
                quantity: 1
            }],
            success_url: `${process.env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.APP_URL}/pricing`,
            customer_email: userId,
            metadata: {
                userId: userId
            }
        });
        
        context.res = {
            status: 200,
            body: { sessionId: session.id, url: session.url }
        };
    } catch (error) {
        context.res = {
            status: 500,
            body: { error: error.message }
        };
    }
};
```

**2. Webhook pour confirmation de paiement**

```javascript
// api/stripe-webhook/index.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async function (context, req) {
    const sig = req.headers['stripe-signature'];
    
    try {
        const event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
        
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            
            // Activer l'abonnement Premium de l'utilisateur
            await activatePremium(session.metadata.userId);
        }
        
        if (event.type === 'customer.subscription.deleted') {
            // Désactiver l'abonnement
            await deactivatePremium(event.data.object.customer);
        }
        
        context.res = { status: 200, body: { received: true } };
    } catch (error) {
        context.res = { status: 400, body: { error: error.message } };
    }
};
```

**3. Frontend : Bouton de paiement**

```javascript
// Charger Stripe.js
<script src="https://js.stripe.com/v3/"></script>

<div id="pricingModal">
    <h2>Choisissez votre plan</h2>
    
    <div class="plan-card">
        <h3>Free</h3>
        <p class="price">$0<span>/mois</span></p>
        <ul>
            <li>5 conversations/mois</li>
            <li>Fonctionnalités de base</li>
        </ul>
        <button disabled>Plan actuel</button>
    </div>
    
    <div class="plan-card premium">
        <h3>Premium</h3>
        <p class="price">$9.99<span>/mois</span></p>
        <ul>
            <li>Conversations illimitées</li>
            <li>Historique complet</li>
            <li>Export PDF</li>
            <li>Support prioritaire</li>
        </ul>
        <button onclick="upgradeToPremium()">Passer à Premium</button>
    </div>
    
    <div class="plan-card">
        <h3>Pro</h3>
        <p class="price">$19.99<span>/mois</span></p>
        <ul>
            <li>Tout Premium +</li>
            <li>API Access</li>
            <li>Analytics avancés</li>
            <li>White-label</li>
        </ul>
        <button onclick="upgradeToPro()">Passer à Pro</button>
    </div>
</div>

<script>
const stripe = Stripe('YOUR_PUBLISHABLE_KEY');

async function upgradeToPremium() {
    const userId = getCurrentUserId(); // depuis le token JWT
    
    // Créer une session de paiement
    const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
            priceId: 'price_premium_monthly',
            userId: userId
        })
    });
    
    const { url } = await response.json();
    
    // Rediriger vers Stripe Checkout
    window.location.href = url;
}
</script>
```

---

## 📈 Base de Données Utilisateurs

### Schéma Azure Table Storage

```javascript
// Structure de la table "Users"
{
    PartitionKey: 'USER',
    RowKey: 'user_email@domain.com', // ou user_id
    email: 'user@example.com',
    name: 'John Doe',
    plan: 'free', // 'free', 'premium', 'pro'
    stripeCustomerId: 'cus_xxxxx',
    subscriptionId: 'sub_xxxxx',
    usage: {
        conversations: 3,
        messages: 45,
        lastReset: '2025-12-01T00:00:00Z'
    },
    quota: {
        conversationsLimit: 5, // illimité = -1
        messagesLimit: 50
    },
    createdAt: '2025-11-15T10:30:00Z',
    updatedAt: '2025-12-06T14:20:00Z'
}

// Structure de la table "Conversations"
{
    PartitionKey: 'user_id',
    RowKey: 'conversation_id_timestamp',
    userId: 'user_email@domain.com',
    title: 'Conversation sur...',
    messages: [
        { role: 'user', content: '...', timestamp: '...' },
        { role: 'bot', content: '...', timestamp: '...' }
    ],
    metadata: {
        hiAvg: 12.5,
        chrAvg: 8.3,
        confidenceAvg: 87.2
    },
    createdAt: '2025-12-06T10:00:00Z',
    updatedAt: '2025-12-06T14:00:00Z'
}
```

---

## 🎯 Roadmap d'Implémentation

### Phase 1 : MVP Authentification (2-3 semaines)
- [ ] Intégrer Azure AD B2C
- [ ] UI Login/Signup
- [ ] Middleware d'authentification API
- [ ] Système de quotas basique (free = 5 conv/mois)
- [ ] Table Storage pour utilisateurs

### Phase 2 : Système de Paiement (2 semaines)
- [ ] Intégrer Stripe
- [ ] Créer les produits/prix dans Stripe Dashboard
- [ ] Endpoint create-checkout
- [ ] Webhook de confirmation
- [ ] UI de pricing
- [ ] Gestion des abonnements (upgrade/cancel)

### Phase 3 : Fonctionnalités Premium (3 semaines)
- [ ] Export PDF des conversations
- [ ] Analytics avancés (graphiques)
- [ ] API Access avec clés
- [ ] Support prioritaire (système de tickets)
- [ ] Historique illimité

### Phase 4 : Optimisations (continu)
- [ ] Cache Redis pour réduire coûts OpenAI
- [ ] Fine-tuning du modèle (réduire tokens)
- [ ] CDN pour assets statiques
- [ ] Monitoring des coûts (Azure Cost Management)

---

## 💡 Conseils pour Réduire les Coûts

### 1. Cache Intelligent
```javascript
// Cache les réponses fréquentes
const responseCache = new Map();

async function getCachedResponse(message) {
    const hash = hashMessage(message);
    if (responseCache.has(hash)) {
        return responseCache.get(hash);
    }
    
    const response = await callOpenAI(message);
    responseCache.set(hash, response);
    return response;
}
```

### 2. Limiter les Tokens
- Max input tokens : 150 (au lieu de 100)
- Max output tokens : 250 (au lieu de 300)
- **Économie** : ~30% des coûts OpenAI

### 3. Modèle moins cher pour questions simples
- GPT-3.5-Turbo pour salutations/questions courtes
- GPT-4 pour questions complexes
- **Économie** : ~50% sur 30% des requêtes = 15% total

### 4. Compression des conversations
- Ne pas envoyer tout l'historique à chaque message
- Garder seulement les 5 derniers échanges
- **Économie** : ~20% des tokens

---

## 📊 Projection de Rentabilité

### Scénario Conservateur (Plan Premium $9.99)

| Mois | Utilisateurs Free | Utilisateurs Premium | Revenu | Coûts | Profit |
|------|-------------------|----------------------|--------|-------|--------|
| 1 | 50 | 5 | $50 | $83 | **-$33** |
| 3 | 200 | 30 | $300 | $345 | **-$45** |
| 6 | 500 | 100 | $1,000 | $951 | **+$49** |
| 12 | 1,000 | 250 | $2,498 | $1,890 | **+$608** |

### Scénario Optimiste (Mix Premium + Pro)

| Mois | Free | Premium | Pro | Revenu | Coûts | Profit |
|------|------|---------|-----|--------|-------|--------|
| 6 | 500 | 80 | 20 | $1,200 | $951 | **+$249** |
| 12 | 1,000 | 200 | 50 | $3,000 | $1,890 | **+$1,110** |
| 24 | 2,000 | 500 | 150 | $8,000 | $4,095 | **+$3,905** |

---

## ✅ Recommandations Finales

### Pricing Optimal Recommandé

1. **Free** : 5 conversations/mois → Coût $1.05, Revenu $0
2. **Premium** : $9.99/mois → Coût $6.30, Marge $3.69 (37%)
3. **Pro** : $19.99/mois → Coût $6.30, Marge $13.69 (68%)

### Stack Technique Recommandée

- **Auth** : Azure AD B2C (natif Azure, RGPD compliant)
- **Paiement** : Stripe (standard industrie, facile)
- **Base de données** : Azure Table Storage (ultra low-cost)
- **Monitoring** : Application Insights (inclus avec Azure)

### Timeline Réaliste

- **Semaine 1-2** : Auth + Base de données
- **Semaine 3-4** : Intégration Stripe
- **Semaine 5-6** : UI/UX paiement + tests
- **Semaine 7-8** : Bêta test + ajustements
- **Semaine 9** : Lancement public

---

## 📞 Prochaines Étapes

Voulez-vous que je commence l'implémentation de :

1. **Système d'authentification** (Azure AD B2C + UI Login/Signup)
2. **Intégration Stripe** (endpoints + webhooks)
3. **Système de quotas** (limiter messages pour Free users)
4. **UI de pricing** (modal avec plans)

Dites-moi par où vous souhaitez commencer ! 🚀
