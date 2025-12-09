# 🛡️ Système de Protection Anti-Hallucination Automatique

## ❌ Le Problème

**Scénario dangereux :**
```
Conversation longue (20+ messages)
├─ Message 1-5 : HI faible (5-10%) ✅ OK
├─ Message 6-10 : HI moyen (15-20%) ⚠️ Attention
├─ Message 11-15 : HI élevé (30-45%) 🚨 DANGER
└─ Message 16+ : HI très élevé (60%+) 💀 CRITIQUE

Problème : L'IA construit sur des erreurs précédentes
→ Effet "boule de neige" des hallucinations
→ L'utilisateur fait confiance mais reçoit des mensonges
```

---

## ✅ Solution : Intervention Automatique Progressive

### 1️⃣ **Système d'Alerte en Temps Réel**

#### Niveau 1 : Avertissement Discret (HI 20-30%)

```javascript
// Détection automatique dans la réponse

if (currentHI >= 20 && currentHI < 30) {
    showWarningBadge({
        level: 'warning',
        message: '⚠️ Attention : Incertitude détectée',
        action: 'suggest_verification'
    });
}
```

**Affichage UI :**
```html
<div class="message bot">
    <div class="message-content">
        [Réponse de l'IA...]
    </div>
    
    <!-- Badge d'avertissement -->
    <div class="warning-badge yellow">
        <span class="icon">⚠️</span>
        <span class="text">
            Cette réponse contient des incertitudes (HI: 24%)
        </span>
        <button onclick="verifyResponse()">Vérifier</button>
    </div>
</div>
```

---

#### Niveau 2 : Alerte Forte + Suggestion (HI 30-50%)

```javascript
if (currentHI >= 30 && currentHI < 50) {
    showStrongWarning({
        level: 'danger',
        message: '🚨 Prudence requise : Risque élevé d\'inexactitudes',
        suggestions: [
            'Vérifier avec sources externes',
            'Commencer une nouvelle conversation',
            'Passer en Mode Vérification Extrême'
        ]
    });
}
```

**Affichage UI :**
```html
<div class="message bot danger">
    <div class="message-content blurred">
        [Réponse floue pour signaler le danger]
    </div>
    
    <!-- Overlay d'alerte -->
    <div class="danger-overlay">
        <div class="danger-icon">🚨</div>
        <h3>Risque d'Inexactitudes Élevé</h3>
        <p>
            Cette réponse a un HI de <strong>42%</strong><br>
            Nous vous recommandons de :
        </p>
        <div class="suggestions">
            <button class="btn-primary" onclick="startFreshConversation()">
                🔄 Nouvelle conversation propre
            </button>
            <button class="btn-secondary" onclick="activateExtremeVerification()">
                🔬 Mode Vérification Extrême
            </button>
            <button class="btn-ghost" onclick="showSourcesOnly()">
                📚 Voir sources externes
            </button>
        </div>
        <button class="btn-reveal" onclick="revealResponse()">
            Voir quand même (non recommandé)
        </button>
    </div>
</div>
```

---

#### Niveau 3 : BLOCAGE + Redirection Forcée (HI ≥ 50%)

```javascript
if (currentHI >= 50) {
    blockResponse({
        level: 'critical',
        message: '🛑 Réponse bloquée : Trop d\'hallucinations détectées',
        action: 'force_new_conversation',
        explanation: 'Cette conversation a accumulé trop d\'incertitudes. Pour votre sécurité, nous recommandons fortement de recommencer.'
    });
    
    // Forcer la création d'une nouvelle conversation
    autoCreateFreshConversation();
}
```

**Affichage UI :**
```html
<div class="message bot blocked">
    <!-- Réponse complètement cachée -->
    
    <div class="critical-block">
        <div class="block-icon">🛑</div>
        <h2>Réponse Bloquée pour Votre Protection</h2>
        
        <div class="explanation">
            <p>
                Cette conversation a atteint un <strong>HI de 67%</strong>,
                indiquant un risque critique d'informations inexactes.
            </p>
            <p>
                Pour votre sécurité, Axilum a bloqué cette réponse.
            </p>
        </div>
        
        <div class="forced-action">
            <h3>🔄 Nouvelle Conversation Créée</h3>
            <p>
                Nous avons automatiquement démarré une conversation propre
                avec un contexte réinitialisé.
            </p>
            <button class="btn-primary btn-large" onclick="goToFreshConversation()">
                Continuer dans la nouvelle conversation →
            </button>
        </div>
        
        <details class="tech-details">
            <summary>Détails techniques</summary>
            <ul>
                <li>HI actuel : 67%</li>
                <li>HI moyen conversation : 38%</li>
                <li>Messages dans conversation : 23</li>
                <li>Seuil critique : 50%</li>
            </ul>
        </details>
    </div>
</div>
```

---

### 2️⃣ **Système de Détection d'Escalade**

#### Analyse de l'évolution du HI

```javascript
// api/utils/conversationHealthMonitor.js

class ConversationHealthMonitor {
    constructor(conversationId) {
        this.conversationId = conversationId;
        this.hiHistory = [];
        this.threshold = {
            warning: 20,
            danger: 30,
            critical: 50
        };
    }
    
    async analyzeConversationHealth(newHI) {
        this.hiHistory.push({
            hi: newHI,
            timestamp: Date.now(),
            messageIndex: this.hiHistory.length
        });
        
        // 1. HI actuel
        const currentHI = newHI;
        
        // 2. Moyenne des 5 derniers messages
        const recent5 = this.hiHistory.slice(-5);
        const avgRecent = recent5.reduce((sum, h) => sum + h.hi, 0) / recent5.length;
        
        // 3. Tendance (en augmentation?)
        const trend = this.calculateTrend();
        
        // 4. Variance (instabilité?)
        const variance = this.calculateVariance(recent5);
        
        return {
            currentHI,
            avgRecent,
            trend, // 'increasing', 'stable', 'decreasing'
            variance,
            overallHealth: this.determineHealth(currentHI, avgRecent, trend, variance),
            recommendation: this.getRecommendation(currentHI, avgRecent, trend)
        };
    }
    
    calculateTrend() {
        if (this.hiHistory.length < 3) return 'stable';
        
        const last3 = this.hiHistory.slice(-3);
        const differences = [
            last3[1].hi - last3[0].hi,
            last3[2].hi - last3[1].hi
        ];
        
        const avgDiff = differences.reduce((a, b) => a + b, 0) / differences.length;
        
        if (avgDiff > 5) return 'increasing'; // +5% par message = problème
        if (avgDiff < -5) return 'decreasing';
        return 'stable';
    }
    
    calculateVariance(data) {
        const mean = data.reduce((sum, h) => sum + h.hi, 0) / data.length;
        const squaredDiffs = data.map(h => Math.pow(h.hi - mean, 2));
        return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / data.length);
    }
    
    determineHealth(currentHI, avgRecent, trend, variance) {
        // Variance élevée = instable = dangereux
        if (variance > 15) return 'unstable';
        
        // HI critique immédiat
        if (currentHI >= this.threshold.critical) return 'critical';
        
        // Tendance croissante + HI élevé = danger
        if (trend === 'increasing' && avgRecent >= this.threshold.danger) {
            return 'deteriorating';
        }
        
        // HI élevé mais stable
        if (currentHI >= this.threshold.danger) return 'warning';
        
        // Tout va bien
        if (currentHI < this.threshold.warning) return 'healthy';
        
        return 'caution';
    }
    
    getRecommendation(currentHI, avgRecent, trend) {
        const health = this.determineHealth(currentHI, avgRecent, trend);
        
        const recommendations = {
            'critical': {
                action: 'force_new_conversation',
                message: 'Conversation bloquée. Nouvelle conversation créée automatiquement.',
                severity: 'critical'
            },
            'deteriorating': {
                action: 'strong_suggest_new',
                message: 'Qualité en baisse rapide. Recommandation forte de redémarrer.',
                severity: 'danger'
            },
            'unstable': {
                action: 'suggest_verification',
                message: 'Réponses instables détectées. Mode vérification recommandé.',
                severity: 'warning'
            },
            'warning': {
                action: 'show_caution',
                message: 'Incertitude modérée. Vérifier avec sources externes.',
                severity: 'warning'
            },
            'caution': {
                action: 'show_info',
                message: 'Légère incertitude. Continuer avec prudence.',
                severity: 'info'
            },
            'healthy': {
                action: 'none',
                message: 'Conversation saine. Continuez.',
                severity: 'success'
            }
        };
        
        return recommendations[health];
    }
    
    async shouldForceNewConversation() {
        const health = await this.analyzeConversationHealth();
        return health.recommendation.action === 'force_new_conversation';
    }
}

module.exports = ConversationHealthMonitor;
```

---

### 3️⃣ **Intégration dans l'API**

```javascript
// api/invoke/index.js

const ConversationHealthMonitor = require('../utils/conversationHealthMonitor');

module.exports = async function (context, req) {
    const message = req.body.message;
    const conversationId = req.body.conversationId;
    const history = req.body.history || [];
    
    // 1. Initialiser le moniteur
    const monitor = new ConversationHealthMonitor(conversationId);
    
    // Charger l'historique HI de cette conversation
    await monitor.loadHistory(conversationId);
    
    // 2. Générer la réponse
    const response = await callOpenAI(message, history);
    
    // 3. Calculer HI
    const hiScore = calculateHI(response);
    
    // 4. ANALYSER LA SANTÉ DE LA CONVERSATION
    const health = await monitor.analyzeConversationHealth(hiScore);
    
    context.log('Conversation Health:', health);
    
    // 5. DÉCISION D'INTERVENTION
    if (health.recommendation.action === 'force_new_conversation') {
        // BLOCAGE TOTAL
        context.res = {
            status: 200,
            body: {
                blocked: true,
                blockReason: 'critical_hallucination_risk',
                currentHI: health.currentHI,
                avgHI: health.avgRecent,
                trend: health.trend,
                message: '🛑 Cette conversation a été bloquée pour votre protection.',
                recommendation: health.recommendation,
                newConversationId: generateNewConversationId(),
                action: 'force_redirect'
            }
        };
        return;
    }
    
    // 6. Ajouter les avertissements appropriés
    const enrichedResponse = {
        response: response.content,
        hi: hiScore,
        chr: calculateCHR(response),
        confidence: response.confidence,
        conversationHealth: {
            status: health.overallHealth,
            currentHI: health.currentHI,
            avgRecent: health.avgRecent,
            trend: health.trend,
            recommendation: health.recommendation
        }
    };
    
    // 7. Si danger ou critique, ajouter flag
    if (health.recommendation.severity === 'danger' || 
        health.recommendation.severity === 'critical') {
        enrichedResponse.warning = {
            level: health.recommendation.severity,
            message: health.recommendation.message,
            suggestedAction: health.recommendation.action
        };
    }
    
    context.res = {
        status: 200,
        body: enrichedResponse
    };
};
```

---

### 4️⃣ **Frontend : Gestion des Interventions**

```javascript
// index.html - dans la fonction sendMessage()

async function sendMessage() {
    const input = document.getElementById('userInput');
    const message = input.value.trim();
    if (!message) return;
    
    // Ajouter message utilisateur
    addMessage(message, 'user');
    input.value = '';
    
    // Afficher typing
    showTyping();
    
    try {
        const response = await fetch(AGENT_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                conversationId: currentConversationId,
                history: getConversationHistory()
            })
        });
        
        const data = await response.json();
        hideTyping();
        
        // ✅ VÉRIFIER SI BLOQUÉ
        if (data.blocked) {
            handleBlockedResponse(data);
            return;
        }
        
        // ✅ VÉRIFIER SI AVERTISSEMENT
        if (data.warning) {
            handleWarningResponse(data);
        } else {
            // Réponse normale
            addMessage(data.response, 'bot', data);
        }
        
    } catch (error) {
        hideTyping();
        addMessage('Erreur de connexion', 'error');
    }
}

function handleBlockedResponse(data) {
    // 1. Afficher le message de blocage
    const blockedDiv = document.createElement('div');
    blockedDiv.className = 'message bot blocked';
    blockedDiv.innerHTML = `
        <div class="critical-block">
            <div class="block-icon">🛑</div>
            <h2>Réponse Bloquée pour Votre Protection</h2>
            
            <div class="explanation">
                <p>
                    Cette conversation a atteint un <strong>HI de ${data.currentHI.toFixed(1)}%</strong>,
                    indiquant un risque critique d'informations inexactes.
                </p>
                <p>${data.message}</p>
            </div>
            
            <div class="health-details">
                <div class="health-metric">
                    <span class="label">HI actuel</span>
                    <span class="value danger">${data.currentHI.toFixed(1)}%</span>
                </div>
                <div class="health-metric">
                    <span class="label">Moyenne récente</span>
                    <span class="value">${data.avgHI.toFixed(1)}%</span>
                </div>
                <div class="health-metric">
                    <span class="label">Tendance</span>
                    <span class="value ${data.trend === 'increasing' ? 'danger' : ''}">${data.trend}</span>
                </div>
            </div>
            
            <div class="forced-action">
                <h3>🔄 Nouvelle Conversation Créée</h3>
                <p>
                    Nous avons automatiquement démarré une conversation propre
                    avec un contexte réinitialisé pour garantir des réponses fiables.
                </p>
                <button class="btn-primary btn-large" onclick="switchToNewConversation('${data.newConversationId}')">
                    Continuer dans la nouvelle conversation →
                </button>
            </div>
        </div>
    `;
    
    document.getElementById('chatMessages').appendChild(blockedDiv);
    
    // 2. Créer automatiquement la nouvelle conversation dans la sidebar
    createNewConversationInSidebar(data.newConversationId, '🔄 Conversation Propre');
    
    // 3. Désactiver l'input dans cette conversation
    document.getElementById('userInput').disabled = true;
    document.getElementById('userInput').placeholder = 'Cette conversation a été fermée pour votre protection';
    document.getElementById('sendBtn').disabled = true;
}

function handleWarningResponse(data) {
    const warningLevel = data.warning.level; // 'warning' ou 'danger'
    
    if (warningLevel === 'danger') {
        // Forte alerte avec overlay
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot danger';
        messageDiv.innerHTML = `
            <div class="message-content blurred">${data.response}</div>
            
            <div class="danger-overlay">
                <div class="danger-icon">🚨</div>
                <h3>Risque d'Inexactitudes Élevé</h3>
                <p>${data.warning.message}</p>
                <p>HI : <strong>${data.hi.toFixed(1)}%</strong> | Moyenne récente : <strong>${data.conversationHealth.avgRecent.toFixed(1)}%</strong></p>
                
                <div class="suggestions">
                    <button class="btn-primary" onclick="startFreshConversation()">
                        🔄 Nouvelle conversation propre
                    </button>
                    <button class="btn-secondary" onclick="activateExtremeVerification()">
                        🔬 Mode Vérification Extrême
                    </button>
                </div>
                
                <button class="btn-reveal" onclick="revealDangerousResponse(this)">
                    Voir quand même (non recommandé)
                </button>
            </div>
        `;
        
        document.getElementById('chatMessages').appendChild(messageDiv);
        
    } else if (warningLevel === 'warning') {
        // Avertissement discret
        addMessage(data.response, 'bot', data);
        
        // Ajouter badge warning après le message
        const lastMessage = document.querySelector('.message-wrapper.bot:last-child');
        const warningBadge = document.createElement('div');
        warningBadge.className = 'warning-badge yellow';
        warningBadge.innerHTML = `
            <span class="icon">⚠️</span>
            <span class="text">${data.warning.message} (HI: ${data.hi.toFixed(1)}%)</span>
            <button class="btn-small" onclick="verifyResponse()">Vérifier</button>
        `;
        lastMessage.appendChild(warningBadge);
    }
}

function switchToNewConversation(newConversationId) {
    // Changer de conversation
    currentConversationId = newConversationId;
    
    // Clear chat
    clearChat();
    
    // Réactiver l'input
    document.getElementById('userInput').disabled = false;
    document.getElementById('userInput').placeholder = 'Écrivez votre message...';
    document.getElementById('sendBtn').disabled = false;
    
    // Afficher message de bienvenue
    addMessage('Nouvelle conversation propre démarrée. Vous pouvez maintenant poser vos questions en toute sécurité.', 'system');
    
    // Focus input
    document.getElementById('userInput').focus();
}

function startFreshConversation() {
    newConversation();
    showToast('✅ Nouvelle conversation propre créée', 'success');
}

function revealDangerousResponse(button) {
    const overlay = button.closest('.danger-overlay');
    const content = overlay.previousElementSibling;
    
    // Retirer le flou
    content.classList.remove('blurred');
    
    // Cacher l'overlay
    overlay.style.display = 'none';
    
    // Afficher un disclaimer persistant
    const disclaimer = document.createElement('div');
    disclaimer.className = 'disclaimer-persistent';
    disclaimer.innerHTML = `
        ⚠️ Vous avez choisi de voir cette réponse malgré le risque élevé (HI: ${data.hi.toFixed(1)}%).
        Vérifiez toujours avec des sources externes fiables.
    `;
    content.after(disclaimer);
}
```

---

### 5️⃣ **Styles CSS pour les Alertes**

```css
/* Message bloqué */
.message.blocked {
    background: transparent;
    border: none;
}

.critical-block {
    background: linear-gradient(135deg, #FEE2E2 0%, #FEF3C7 100%);
    border: 2px solid #DC2626;
    border-radius: 16px;
    padding: 32px;
    text-align: center;
}

.block-icon {
    font-size: 64px;
    margin-bottom: 16px;
}

.critical-block h2 {
    color: #DC2626;
    font-size: 24px;
    margin-bottom: 16px;
}

.explanation {
    background: white;
    border-radius: 12px;
    padding: 20px;
    margin: 20px 0;
}

.health-details {
    display: flex;
    gap: 20px;
    justify-content: center;
    margin: 24px 0;
}

.health-metric {
    background: white;
    border-radius: 8px;
    padding: 12px 20px;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.health-metric .label {
    font-size: 12px;
    color: #6B7280;
}

.health-metric .value {
    font-size: 20px;
    font-weight: bold;
    color: #1F2937;
}

.health-metric .value.danger {
    color: #DC2626;
}

.forced-action {
    background: white;
    border-radius: 12px;
    padding: 24px;
    margin-top: 24px;
}

.forced-action h3 {
    color: #059669;
    margin-bottom: 12px;
}

/* Message avec danger overlay */
.message.danger {
    position: relative;
}

.message-content.blurred {
    filter: blur(8px);
    user-select: none;
    pointer-events: none;
}

.danger-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.98);
    border-radius: 12px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
}

.danger-icon {
    font-size: 48px;
    margin-bottom: 12px;
}

.suggestions {
    display: flex;
    gap: 12px;
    margin: 20px 0;
}

.btn-reveal {
    margin-top: 12px;
    background: transparent;
    border: 1px solid #9CA3AF;
    color: #6B7280;
    font-size: 13px;
}

/* Warning badge */
.warning-badge {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 8px;
    margin-top: 12px;
    font-size: 14px;
}

.warning-badge.yellow {
    background: #FEF3C7;
    border: 1px solid #F59E0B;
    color: #92400E;
}

.warning-badge .icon {
    font-size: 20px;
}

.disclaimer-persistent {
    background: #FEF3C7;
    border: 1px solid #F59E0B;
    border-radius: 8px;
    padding: 12px 16px;
    margin-top: 12px;
    font-size: 13px;
    color: #92400E;
}
```

---

## 📊 Tableau Récapitulatif des Interventions

| HI | État | Action | UI |
|----|------|--------|-----|
| **0-20%** | ✅ Sain | Aucune | Normal |
| **20-30%** | ⚠️ Attention | Badge warning discret | Jaune |
| **30-50%** | 🚨 Danger | Overlay + suggestions fortes | Rouge + flou |
| **50%+** | 🛑 Critique | **BLOCAGE** + redirection forcée | Bloqué |

### Tendances Détectées

| Tendance | Description | Action Supplémentaire |
|----------|-------------|----------------------|
| **Increasing** | HI monte rapidement | Réduire seuil d'intervention (-10%) |
| **Stable** | HI constant | Surveillance normale |
| **Decreasing** | HI diminue | Relaxer légèrement (+5%) |

---

## 🎯 Avantages de ce Système

### 1. **Protection Proactive**
- L'utilisateur est protégé AVANT de recevoir une info dangereuse
- Pas de "trop tard, vous avez déjà lu"

### 2. **Transparence Totale**
- L'utilisateur comprend POURQUOI on intervient
- Affichage des métriques (HI, tendance, moyenne)

### 3. **Flexibilité**
- Choix de voir quand même (niveau warning/danger)
- Blocage dur seulement au niveau critique (50%+)

### 4. **UX Optimale**
- Nouvelle conversation créée automatiquement
- Pas de friction, transition fluide
- Historique préservé (consultation en lecture seule)

### 5. **Marketing Puissant**
- "Axilum vous protège activement des hallucinations"
- Aucun concurrent ne fait ça
- Justifie l'abonnement Premium/Pro

---

## 💡 Recommandation d'Implémentation

### Phase 1 (Cette semaine) : MVP Protection
```javascript
// Implémenter juste le blocage critique (HI ≥ 50%)
if (hiScore >= 50) {
    blockResponse();
    createNewConversation();
}
```

### Phase 2 (Semaine 2) : Alertes Progressives
- Warning badges (HI 20-30%)
- Danger overlays (HI 30-50%)

### Phase 3 (Semaine 3) : Analyse Avancée
- Détection de tendances
- Variance/instabilité
- Recommandations intelligentes

---

## 🚀 Impact Marketing

**Message Clé :**
> "Axilum ne vous laisse JAMAIS dans une conversation dangereuse. 
> Si le risque d'hallucination devient trop élevé, 
> nous vous protégeons automatiquement en créant une nouvelle conversation propre."

**Comparaison Concurrents :**
- ❌ ChatGPT : Aucune protection, continues à mentir
- ❌ Claude : Aucune alerte, vous êtes seul
- ❌ Gemini : Pas de détection d'escalade
- ✅ **Axilum : Protection active automatique** 🛡️

---

Voulez-vous que j'implémente le système de protection maintenant ? Je peux commencer par le MVP (blocage critique) qui prend 1-2 jours. 🚀
