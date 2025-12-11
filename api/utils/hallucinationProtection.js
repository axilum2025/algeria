// 🛡️ Système de Protection contre Accumulation d'Hallucinations
// Détecte et intervient automatiquement quand le risque devient trop élevé

class HallucinationProtection {
    constructor() {
        // Seuils de déclenchement
        this.THRESHOLDS = {
            WARNING: 30,      // HI moyen > 30% = Avertissement
            DANGER: 50,       // HI moyen > 50% = Intervention requise
            CRITICAL: 70,     // HI > 70% = Blocage immédiat
            MAX_MESSAGES: 15  // Limite avant vérification obligatoire
        };
        
        // Compteurs par conversation
        this.conversationStats = new Map();
    }
    
    /**
     * Analyse le risque d'une conversation en cours
     */
    analyzeConversationRisk(conversationId, messages) {
        const stats = this.calculateStats(messages);
        
        // Mise à jour des stats
        this.conversationStats.set(conversationId, stats);
        
        // Déterminer le niveau de risque
        const riskLevel = this.determineRiskLevel(stats);
        
        return {
            level: riskLevel,
            stats: stats,
            action: this.getRecommendedAction(riskLevel, stats),
            shouldIntervene: riskLevel !== 'safe',
            shouldBlock: riskLevel === 'critical'
        };
    }
    
    /**
     * Calcule les statistiques d'hallucination
     */
    calculateStats(messages) {
        const botMessages = messages.filter(m => m.type === 'bot' && m.hiScore !== undefined);
        
        if (botMessages.length === 0) {
            return {
                avgHI: 0,
                maxHI: 0,
                recentAvgHI: 0,
                totalMessages: 0,
                highRiskCount: 0,
                trend: 'stable'
            };
        }
        
        // HI moyen global
        const avgHI = botMessages.reduce((sum, m) => sum + m.hiScore, 0) / botMessages.length;
        
        // HI maximum rencontré
        const maxHI = Math.max(...botMessages.map(m => m.hiScore));
        
        // HI moyen des 5 derniers messages (tendance récente)
        const recentMessages = botMessages.slice(-5);
        const recentAvgHI = recentMessages.reduce((sum, m) => sum + m.hiScore, 0) / recentMessages.length;
        
        // Nombre de messages à haut risque (HI > 30%)
        const highRiskCount = botMessages.filter(m => m.hiScore > 30).length;
        
        // Déterminer la tendance
        const trend = this.calculateTrend(botMessages);
        
        return {
            avgHI: Math.round(avgHI * 10) / 10,
            maxHI: Math.round(maxHI * 10) / 10,
            recentAvgHI: Math.round(recentAvgHI * 10) / 10,
            totalMessages: botMessages.length,
            highRiskCount: highRiskCount,
            trend: trend
        };
    }
    
    /**
     * Calcule la tendance d'évolution du HI
     */
    calculateTrend(messages) {
        if (messages.length < 3) return 'stable';
        
        const recent = messages.slice(-3);
        const older = messages.slice(-6, -3);
        
        if (older.length === 0) return 'stable';
        
        const recentAvg = recent.reduce((sum, m) => sum + m.hiScore, 0) / recent.length;
        const olderAvg = older.reduce((sum, m) => sum + m.hiScore, 0) / older.length;
        
        const diff = recentAvg - olderAvg;
        
        if (diff > 10) return 'rising';      // Augmentation significative
        if (diff < -10) return 'falling';    // Diminution significative
        return 'stable';
    }
    
    /**
     * Détermine le niveau de risque
     */
    determineRiskLevel(stats) {
        // CRITIQUE : HI immédiat > 70% OU moyenne > 50% avec tendance montante
        if (stats.maxHI > this.THRESHOLDS.CRITICAL || 
            (stats.avgHI > this.THRESHOLDS.DANGER && stats.trend === 'rising')) {
            return 'critical';
        }
        
        // DANGER : HI moyen > 50% OU récent > 60%
        if (stats.avgHI > this.THRESHOLDS.DANGER || stats.recentAvgHI > 60) {
            return 'danger';
        }
        
        // AVERTISSEMENT : HI moyen > 30% OU 3+ messages à haut risque
        if (stats.avgHI > this.THRESHOLDS.WARNING || stats.highRiskCount >= 3) {
            return 'warning';
        }
        
        // SÛR
        return 'safe';
    }
    
    /**
     * Recommande l'action à prendre
     */
    getRecommendedAction(riskLevel, stats) {
        switch (riskLevel) {
            case 'critical':
                return {
                    type: 'BLOCK',
                    message: '⛔ Conversation suspendue pour votre protection',
                    description: `Le taux d'hallucination a atteint un niveau critique (${stats.recentAvgHI}%). Pour garantir des informations fiables, cette conversation doit être redémarrée.`,
                    actions: [
                        { 
                            label: '🔄 Nouvelle conversation', 
                            action: 'restart',
                            primary: true
                        },
                        { 
                            label: '📋 Exporter l\'historique', 
                            action: 'export'
                        }
                    ],
                    icon: '⛔',
                    color: '#EF4444'
                };
            
            case 'danger':
                return {
                    type: 'STRONG_WARNING',
                    message: '⚠️ Attention : Fiabilité en baisse',
                    description: `Le taux d'hallucination moyen est de ${stats.avgHI}%. Nous recommandons fortement de redémarrer une conversation pour des réponses plus fiables.`,
                    actions: [
                        { 
                            label: '🔄 Redémarrer maintenant', 
                            action: 'restart',
                            primary: true
                        },
                        { 
                            label: '🔬 Activer Vérification Extrême', 
                            action: 'extreme_verify',
                            premium: true
                        },
                        { 
                            label: 'Continuer (non recommandé)', 
                            action: 'continue'
                        }
                    ],
                    icon: '⚠️',
                    color: '#F59E0B'
                };
            
            case 'warning':
                return {
                    type: 'SOFT_WARNING',
                    message: '💡 Suggestion : Vérifiez les informations',
                    description: `Le taux d'hallucination est de ${stats.avgHI}%. Certaines réponses peuvent nécessiter une vérification supplémentaire.`,
                    actions: [
                        { 
                            label: '✓ J\'ai compris', 
                            action: 'acknowledge'
                        },
                        { 
                            label: '🔄 Nouvelle conversation', 
                            action: 'restart'
                        }
                    ],
                    icon: '💡',
                    color: '#3B82F6'
                };
            
            default:
                return null;
        }
    }
    
    /**
     * Génère un message de synthèse avant redémarrage
     */
    generateSummary(messages) {
        const userMessages = messages.filter(m => m.type === 'user').slice(-10);
        const topics = this.extractTopics(userMessages);
        
        return {
            topics: topics,
            messageCount: messages.length,
            suggestion: `Vous avez discuté de : ${topics.join(', ')}. Pour continuer sur ces sujets avec une meilleure fiabilité, démarrez une nouvelle conversation.`
        };
    }
    
    /**
     * Extrait les sujets principaux
     */
    extractTopics(messages) {
        // Analyse simple par mots-clés (à améliorer avec NLP)
        const text = messages.map(m => m.content).join(' ').toLowerCase();
        const keywords = text.split(/\s+/).filter(w => w.length > 5);
        
        // Fréquence des mots
        const frequency = {};
        keywords.forEach(word => {
            frequency[word] = (frequency[word] || 0) + 1;
        });
        
        // Top 5 mots les plus fréquents
        return Object.entries(frequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([word]) => word);
    }
    
    /**
     * Vérifie si un nouveau message devrait être bloqué
     */
    shouldBlockNewMessage(conversationId, newMessageHI) {
        const stats = this.conversationStats.get(conversationId);
        
        if (!stats) return false;
        
        // Bloquer si le nouveau message a un HI > 70%
        if (newMessageHI > this.THRESHOLDS.CRITICAL) {
            return true;
        }
        
        // Bloquer si la moyenne est déjà haute et le nouveau message empire
        if (stats.avgHI > this.THRESHOLDS.DANGER && newMessageHI > this.THRESHOLDS.WARNING) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Reset stats pour une nouvelle conversation
     */
    resetConversation(conversationId) {
        this.conversationStats.delete(conversationId);
    }
}

module.exports = new HallucinationProtection();
