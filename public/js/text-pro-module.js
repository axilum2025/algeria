/**
 * Module Text Pro - Traitement de texte professionnel
 * Ce module est chargé séparément pour éviter de bloquer l'application principale
 */

(function() {
    'use strict';
    
    // Variables du module
    let textProChatHistory = [];
    let textProOverlay = null;
    let isRecording = false;
    let mediaRecorder = null;
    let audioChunks = [];
    let recognition = null;
    let speechSynthesis = window.speechSynthesis;
    let currentUtterance = null;
    
    // Variables pour la traduction vocale instantanée
    let isTranslating = false;
    let translationRecognition = null;
    let sourceLang = 'fr-FR';
    let targetLang = 'en';
    
    // Variables pour les modes de traduction
    let currentTranslationMode = 'general';
    
    // Variables pour la vue comparaison
    let comparisonMode = false;
    let lastSourceText = '';
    let lastTranslatedText = '';
    
    // Définition des modes de traduction
    const translationModes = {
        general: {
            name: 'Général',
            description: 'Traduction standard polyvalente',
            prompt: 'Tu es un traducteur professionnel généraliste.'
        },
        academic: {
            name: 'Académique',
            description: 'Style formel pour travaux universitaires',
            prompt: 'Tu es un traducteur académique spécialisé. Utilise un style formel, précis et respectueux des normes universitaires. Privilégie la clarté et la rigueur scientifique.'
        },
        scientific: {
            name: 'Scientifique',
            description: 'Terminologie scientifique et technique',
            prompt: 'Tu es un traducteur scientifique expert. Utilise la terminologie scientifique précise, respecte les conventions de notation et préserve l\'exactitude des concepts techniques.'
        },
        legal: {
            name: 'Juridique',
            description: 'Vocabulaire juridique et contractuel',
            prompt: 'Tu es un traducteur juridique spécialisé. Utilise le vocabulaire juridique approprié, respecte les formulations légales et maintiens la précision contractuelle.'
        },
        medical: {
            name: 'Médical',
            description: 'Termes médicaux et pharmaceutiques',
            prompt: 'Tu es un traducteur médical expert. Utilise la terminologie médicale et pharmaceutique correcte, respecte les noms de pathologies et de traitements.'
        },
        technical: {
            name: 'Technique',
            description: 'Jargon IT, ingénierie et technologie',
            prompt: 'Tu es un traducteur technique spécialisé en IT et ingénierie. Utilise le jargon technique approprié, respecte les termes informatiques et technologiques.'
        },
        business: {
            name: 'Business',
            description: 'Langage professionnel et commercial',
            prompt: 'Tu es un traducteur business spécialisé. Utilise un langage professionnel, adapté au monde des affaires, avec un ton approprié pour la communication d\'entreprise.'
        }
    };
    
    /**
     * Bibliothèque d'icônes SVG
     */
    const SVGIcons = {
        microphone: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="23"></line>
            <line x1="8" y1="23" x2="16" y2="23"></line>
        </svg>`,
        
        microphoneOff: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="1" y1="1" x2="23" y2="23"></line>
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
            <line x1="12" y1="19" x2="12" y2="23"></line>
            <line x1="8" y1="23" x2="16" y2="23"></line>
        </svg>`,
        
        speaker: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        </svg>`,
        
        send: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>`,
        
        file: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
            <polyline points="13 2 13 9 20 9"></polyline>
        </svg>`,
        
        download: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>`,
        
        upload: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>`,
        
        translate: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="5 9 2 9 2 15 5 15"></polyline>
            <path d="M10 3h3a6 6 0 0 1 6 6v0a6 6 0 0 1-6 6h-3"></path>
            <path d="M10 15h3a6 6 0 0 1 6 6v0a6 6 0 0 1-6 6h-3"></path>
            <line x1="2" y1="12" x2="10" y2="12"></line>
        </svg>`,
        
        edit: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>`,
        
        check: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>`,
        
        list: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
        </svg>`,
        
        globe: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>`,
        
        settings: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"></path>
        </svg>`,
        
        compare: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="18" rx="1"></rect>
            <rect x="14" y="3" width="7" height="18" rx="1"></rect>
            <line x1="10" y1="12" x2="14" y2="12"></line>
            <polyline points="12 10 14 12 12 14"></polyline>
        </svg>`,
        
        closeCompare: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>`,
        
        sync: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>`,
        
        arrows: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="17 11 12 6 7 11"></polyline>
            <polyline points="17 18 12 13 7 18"></polyline>
        </svg>`,
        
        trash: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>`,
        
        arrowRight: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
        </svg>`,
        
        copy: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>`
    };
    
    /**
     * Ouvrir l'interface Text Pro
     */
    window.openTextProModule = function() {
        try {
            // Fermer tout overlay existant
            closeTextProModule();
            
            // Créer l'overlay avec chat intégré
            textProOverlay = createTextProInterface();
            document.body.appendChild(textProOverlay);

            // Responsive mobile: le panneau latéral ne doit pas recouvrir l'écran
            setupTextProResponsiveSidebar();
            
            // Initialiser les badges de langue dans la vue comparaison
            setTimeout(() => {
                const textarea = document.getElementById('textProChatInput');
                if (textarea) textarea.focus();
                
                // Mettre à jour les badges de langue avec les valeurs par défaut
                window.updateTranslationLanguages();
                
                // Ajouter le message d'accueil
                const welcomeMessage = `Bienvenue dans AI Text Pro
Votre assistant intelligent de traitement et traduction de texte.

CAPACITÉS PRINCIPALES
• Traduction professionnelle dans 7 langues
• 7 modes spécialisés : Général, Académique, Scientifique, Juridique, Médical, Technique, Business
• Correction orthographique et grammaticale
• Résumé et synthèse de documents
• Réécriture et optimisation de style
• Analyse et structuration de contenu

OUTILS DISPONIBLES
• Vue Comparaison source/cible
• Export multi-format (PDF, TXT, DOCX)
• Copie instantanée
• Synthèse vocale et dictation
• Traduction vocale en temps réel
• Import de fichiers
• Compteur de mots et caractères

Pour commencer, sélectionnez vos langues dans le panneau latéral et saisissez votre texte.`;
                addTextProMessage(welcomeMessage, 'assistant');
            }, 300);
            
            console.log('Text Pro Module chargé avec succès');
        } catch (error) {
            console.error('Erreur lors de l\'ouverture de Text Pro:', error);
            alert('Erreur lors de l\'ouverture de Text Pro. Veuillez réessayer.');
        }
    };
    
    /**
     * Fermer l'interface Text Pro
     */
    window.closeTextProModule = function() {
        const overlay = document.getElementById('textProModuleOverlay');
        if (overlay) {
            overlay.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => overlay.remove(), 300);
        }

        // Nettoyer les listeners (évite l'accumulation après plusieurs ouvertures)
        if (window.__textProResizeHandler) {
            window.removeEventListener('resize', window.__textProResizeHandler);
            window.__textProResizeHandler = null;
        }
        textProChatHistory = [];
    };
    
    /**
     * Créer l'interface Text Pro
     */
    function createTextProInterface() {
        const overlay = document.createElement('div');
        overlay.id = 'textProModuleOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(180deg, #05060a, #000000);
            z-index: 10001;
            animation: fadeIn 0.3s ease;
            display: flex;
            -webkit-text-size-adjust: 100%;
            text-size-adjust: 100%;
        `;
        
        overlay.innerHTML = getTextProHTML();
        
        return overlay;
    }
    
    /**
     * HTML de l'interface
     */
    function getTextProHTML() {
        return `
            <style>
                ${getTextProStyles()}
            </style>
            
            <div class="textpro-layout">
                <!-- Panneau d'informations -->
                <div class="textpro-info-panel">
                    <div class="textpro-info-header">
                        <button class="textpro-sidebar-close-btn" onclick="window.toggleTextProSidebar(false)" title="Fermer le panneau">
                            ${SVGIcons.closeCompare}
                        </button>
                        <h1 class="textpro-info-title">AI Text Pro</h1>
                        <p class="textpro-info-subtitle">Traitement de texte intelligent</p>
                    </div>
                    
                    <!-- Sélecteur de mode de traduction -->
                    <div class="textpro-mode-section">
                        <h3 class="textpro-section-title">
                            ${SVGIcons.settings} Mode de traduction
                        </h3>
                        <select id="translationModeSelect" class="textpro-mode-select" onchange="window.changeTranslationMode(this.value)">
                            <option value="general">Général</option>
                            <option value="academic">Académique</option>
                            <option value="scientific">Scientifique</option>
                            <option value="legal">Juridique</option>
                            <option value="medical">Médical</option>
                            <option value="technical">Technique</option>
                            <option value="business">Business</option>
                        </select>
                        <div id="modeDescription" class="textpro-mode-description">
                            Traduction standard polyvalente
                        </div>
                    </div>
                    
                    <!-- Sélection des langues -->
                    <div class="textpro-lang-section">
                        <h3 class="textpro-section-title">
                            ${SVGIcons.globe} Langues de traduction
                        </h3>
                        <div class="textpro-lang-controls">
                            <div class="textpro-lang-selector">
                                <label>De:</label>
                                <select id="sourceLangSelect" onchange="window.updateTranslationLanguages()">
                                    <option value="fr-FR">Français</option>
                                    <option value="en-US">Anglais</option>
                                    <option value="es-ES">Espagnol</option>
                                    <option value="de-DE">Allemand</option>
                                    <option value="it-IT">Italien</option>
                                    <option value="ar-SA">Arabe</option>
                                    <option value="zh-CN">Chinois</option>
                                </select>
                            </div>
                            <div class="textpro-lang-arrow">${SVGIcons.arrowRight}</div>
                            <div class="textpro-lang-selector">
                                <label>Vers:</label>
                                <select id="targetLangSelect" onchange="window.updateTranslationLanguages()">
                                    <option value="en">Anglais</option>
                                    <option value="fr">Français</option>
                                    <option value="es">Espagnol</option>
                                    <option value="de">Allemand</option>
                                    <option value="it">Italien</option>
                                    <option value="ar">Arabe</option>
                                    <option value="zh">Chinois</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Bouton Vue Comparaison -->
                    <div class="textpro-comparison-toggle">
                        <button id="comparisonToggleBtn" class="textpro-compare-btn" onclick="window.toggleComparisonMode()" title="Activer la vue comparaison">
                            ${SVGIcons.compare}
                            <span>Vue Comparaison</span>
                        </button>
                    </div>
                    
                    <div class="textpro-upload-section">
                        <h3 class="textpro-section-title">Upload de fichier</h3>
                        <button class="textpro-upload-btn" onclick="document.getElementById('textProFileInput').click()">
                            ${SVGIcons.upload}
                            <span>Choisir un fichier</span>
                        </button>
                        <input type="file" id="textProFileInput" accept=".txt,.pdf,.doc,.docx" style="display: none;" onchange="window.handleTextProFileUpload(event)">
                        <div id="textProFileStatus" class="textpro-file-status"></div>
                    </div>
                    
                    <div class="textpro-examples">
                        <h3 class="textpro-section-title">Exemples de commandes</h3>
                        
                        <div class="textpro-example-card">
                            <div class="textpro-example-icon">${SVGIcons.translate}</div>
                            <div>
                                <h4>Traduction</h4>
                                <p>Traduis en anglais professionnel</p>
                            </div>
                        </div>
                        
                        <div class="textpro-example-card">
                            <div class="textpro-example-icon">${SVGIcons.check}</div>
                            <div>
                                <h4>Correction</h4>
                                <p>Corrige l'orthographe et la grammaire</p>
                            </div>
                        </div>
                        
                        <div class="textpro-example-card">
                            <div class="textpro-example-icon">${SVGIcons.list}</div>
                            <div>
                                <h4>Résumé</h4>
                                <p>Résume ce texte en 3 points</p>
                            </div>
                        </div>
                        
                        <div class="textpro-example-card">
                            <div class="textpro-example-icon">${SVGIcons.edit}</div>
                            <div>
                                <h4>Réécriture</h4>
                                <p>Réécris de façon plus formelle</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="textpro-features">
                        <h3 class="textpro-section-title">Fonctionnalités</h3>
                        <div class="textpro-feature-list">
                            <div class="textpro-feature-item">${SVGIcons.microphone} Speech-to-Text</div>
                            <div class="textpro-feature-item">${SVGIcons.speaker} Text-to-Speech</div>
                            <div class="textpro-feature-item">${SVGIcons.file} Upload de fichiers</div>
                            <div class="textpro-feature-item">${SVGIcons.download} Téléchargement PDF</div>
                        </div>
                    </div>
                </div>
                
                <!-- Panneau de chat -->
                <div class="textpro-chat-panel">
                    <div class="textpro-chat-header">
                        <div class="textpro-chat-header-left">
                            <button class="textpro-sidebar-toggle-btn" onclick="window.toggleTextProSidebar()" title="Ouvrir le panneau">
                                ${SVGIcons.settings}
                            </button>
                            <div>
                                <h2 class="textpro-chat-title">Agent Tony</h2>
                                <p class="textpro-chat-subtitle">Assistant de traitement de texte</p>
                            </div>
                        </div>
                        <div class="textpro-chat-actions" style="display: flex; gap: 12px; align-items: center;">
                            <button class="textpro-clear-history-btn" onclick="window.clearTextProHistory()" title="Effacer l'historique">
                                ${SVGIcons.trash}
                            </button>
                            <button class="textpro-close-btn" onclick="window.closeTextProModule()" title="Fermer">
                                ${SVGIcons.closeCompare}
                            </button>
                        </div>
                    </div>
                    
                    <div class="textpro-chat-messages" id="textProMessages">
                    </div>
                    
                    <div class="textpro-chat-input-area">
                        <div class="textpro-input-wrapper">
                            <div class="input-wrapper textpro-input-bar">
                                <textarea 
                                    id="textProChatInput" 
                                    class="textpro-chat-textarea textpro-chat-textarea--inline" 
                                    placeholder="Collez votre texte ou posez votre question..."
                                    onkeydown="if(event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); window.sendTextProMessage(); }"
                                    oninput="window.updateTextProCounter()"
                                ></textarea>
                                <button class="textpro-icon-btn textpro-send-btn" onclick="window.sendTextProMessage()" title="Envoyer le message">
                                    ${SVGIcons.send}
                                </button>
                                <button class="textpro-icon-btn textpro-mic-btn" id="textProMicBtn" onclick="window.toggleTextProRecording()" title="Enregistrer un message vocal">
                                    ${SVGIcons.microphone}
                                </button>
                                <button class="textpro-icon-btn textpro-translate-btn" id="textProTranslateBtn" onclick="window.toggleInstantTranslation()" title="Traduction vocale instantanée">
                                    ${SVGIcons.globe}
                                </button>
                            </div>
                            <div id="textProCounter" class="textpro-counter">0 caractère | 0 mot</div>
                        </div>
                    </div>
                </div>
                
                <!-- Vue Comparaison (cachée par défaut) -->
                <div id="comparisonView" class="textpro-comparison-view" style="display: none;">
                    <div class="textpro-comparison-header">
                        <h3>${SVGIcons.compare} Vue Comparaison Source / Traduction</h3>
                        <button class="textpro-close-comparison-btn" onclick="window.toggleComparisonMode()" title="Fermer la vue comparaison">
                            ${SVGIcons.closeCompare}
                        </button>
                    </div>
                    
                    <div class="textpro-comparison-content">
                        <div class="textpro-comparison-panel textpro-source-panel">
                            <div class="textpro-comparison-panel-header">
                                <h4>${SVGIcons.file} Texte Original</h4>
                                <span id="sourceLangLabel" class="textpro-lang-badge">FR</span>
                            </div>
                            <div id="sourceTextDisplay" class="textpro-comparison-text">
                                <div class="textpro-comparison-placeholder">
                                    Le texte original apparaîtra ici après la traduction
                                </div>
                            </div>
                        </div>
                        
                        <div class="textpro-comparison-divider">
                            ${SVGIcons.arrows}
                        </div>
                        
                        <div class="textpro-comparison-panel textpro-target-panel">
                            <div class="textpro-comparison-panel-header">
                                <h4>${SVGIcons.translate} Traduction</h4>
                                <span id="targetLangLabel" class="textpro-lang-badge">EN</span>
                            </div>
                            <div id="targetTextDisplay" class="textpro-comparison-text">
                                <div class="textpro-comparison-placeholder">
                                    La traduction apparaîtra ici
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="textpro-comparison-footer">
                        <button class="textpro-clear-comparison-btn" onclick="window.clearComparison()" title="Effacer la comparaison">
                            ${SVGIcons.trash}
                            <span>Effacer</span>
                        </button>
                        <button class="textpro-sync-btn" onclick="window.syncComparisonScroll()" title="Synchroniser le défilement">
                            ${SVGIcons.sync}
                            <span>Synchroniser</span>
                        </button>
                        <button class="textpro-download-comparison-btn" onclick="window.downloadComparison()" title="Télécharger la comparaison">
                            ${SVGIcons.download}
                            <span>Télécharger</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Styles CSS
     */
    function getTextProStyles() {
        return `
            .textpro-layout {
                display: flex;
                width: 100%;
                height: 100%;

                --tp-primary: #3b82f6;
                --tp-primary-2: #06b6d4;
                --tp-border: rgba(59, 130, 246, 0.3);
                --tp-border-strong: rgba(59, 130, 246, 0.4);
                --tp-panel-bg: rgba(255, 255, 255, 0.05);
                --tp-panel-bg-strong: rgba(255, 255, 255, 0.08);
                --tp-muted: rgba(255, 255, 255, 0.6);
                --tp-muted-2: rgba(255, 255, 255, 0.7);
                --tp-danger: #ef4444;
                --tp-success: #10b981;
            }

            .textpro-chat-header-left {
                display: flex;
                align-items: center;
                gap: 12px;
                min-width: 0;
                flex: 1;
            }

            .textpro-chat-actions {
                flex-shrink: 0;
            }

            .textpro-sidebar-toggle-btn {
                display: none;
                width: 40px;
                height: 40px;
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.18);
                border-radius: 10px;
                color: white;
                cursor: pointer;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
                flex-shrink: 0;
            }

            .textpro-sidebar-toggle-btn svg {
                width: 18px;
                height: 18px;
            }

            .textpro-sidebar-toggle-btn:hover {
                background: rgba(255, 255, 255, 0.12);
            }

            .textpro-sidebar-close-btn {
                display: none;
            }
            
            .textpro-info-panel {
                width: 350px;
                background: rgba(0, 0, 0, 0.22);
                border-right: 1px solid var(--tp-border);
                overflow-y: auto;
                padding: 24px;
            }
            
            .textpro-info-header {
                margin-bottom: 24px;
            }
            
            .textpro-info-title {
                font-size: 24px;
                font-weight: 700;
                background: linear-gradient(135deg, var(--tp-primary), var(--tp-primary-2));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                margin: 0 0 8px;
            }
            
            .textpro-info-subtitle {
                font-size: 13px;
                color: var(--tp-muted);
                margin: 0;
            }
            
            .textpro-section-title {
                font-size: 15px;
                font-weight: 700;
                color: white;
                margin: 0 0 12px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .textpro-mode-section {
                background: rgba(59, 130, 246, 0.1);
                border: 1px solid var(--tp-border);
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 20px;
            }
            
            .textpro-lang-section {
                background: rgba(59, 130, 246, 0.08);
                border: 1px solid var(--tp-border);
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 20px;
            }
            
            .textpro-lang-controls {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
            }
            
            .textpro-mode-select {
                width: 100%;
                padding: 10px 12px;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(59, 130, 246, 0.4);
                border-radius: 8px;
                color: white;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.3s ease;
                margin-bottom: 8px;
            }
            
            .textpro-mode-select:hover {
                background: rgba(255, 255, 255, 0.15);
                border-color: rgba(59, 130, 246, 0.6);
            }
            
            .textpro-mode-select:focus {
                outline: none;
                border-color: #3b82f6;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
            }
            
            .textpro-mode-select option {
                background: #1e293b;
                color: white;
                padding: 8px;
            }
            
            .textpro-mode-description {
                font-size: 12px;
                color: rgba(255, 255, 255, 0.6);
                font-style: italic;
                line-height: 1.4;
            }
            
            .textpro-upload-section {
                background: var(--tp-panel-bg);
                border: 1px solid var(--tp-border);
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 20px;
            }
            
            .textpro-upload-btn {
                width: 100%;
                padding: 10px 20px;
                background: linear-gradient(135deg, #3b82f6, #06b6d4);
                border: none;
                border-radius: 8px;
                color: white;
                font-weight: 600;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            
            .textpro-upload-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
            }
            
            .textpro-file-status {
                margin-top: 12px;
                font-size: 12px;
                color: rgba(255, 255, 255, 0.7);
            }
            
            .textpro-examples {
                margin-top: 20px;
            }
            
            .textpro-example-card {
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(59, 130, 246, 0.3);
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 12px;
                display: flex;
                align-items: flex-start;
                gap: 12px;
                transition: all 0.3s ease;
            }
            
            .textpro-example-card:hover {
                background: rgba(255, 255, 255, 0.08);
                border-color: rgba(59, 130, 246, 0.5);
                transform: translateX(4px);
            }
            
            .textpro-example-icon {
                flex-shrink: 0;
                width: 36px;
                height: 36px;
                background: rgba(59, 130, 246, 0.2);
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #3b82f6;
            }
            
            .textpro-example-icon svg {
                width: 18px;
                height: 18px;
            }
            
            .textpro-example-card > div:last-child {
                flex: 1;
            }
            
            .textpro-example-card h4 {
                font-size: 14px;
                font-weight: 700;
                color: white;
                margin: 0 0 6px;
            }
            
            .textpro-example-card p {
                font-size: 12px;
                color: rgba(255, 255, 255, 0.7);
                margin: 0;
            }
            
            .textpro-features {
                margin-top: 20px;
            }
            
            .textpro-feature-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .textpro-feature-item {
                background: rgba(59, 130, 246, 0.1);
                border: 1px solid rgba(59, 130, 246, 0.3);
                border-radius: 6px;
                padding: 8px 12px;
                font-size: 12px;
                color: rgba(255, 255, 255, 0.8);
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .textpro-feature-item svg {
                width: 16px;
                height: 16px;
                color: #3b82f6;
                flex-shrink: 0;
            }
            
            .textpro-comparison-toggle {
                margin-bottom: 20px;
            }
            
            .textpro-compare-btn {
                width: 100%;
                padding: 12px 20px;
                background: linear-gradient(135deg, var(--tp-primary), var(--tp-primary-2));
                border: none;
                border-radius: 8px;
                color: white;
                font-weight: 600;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
            }
            
            .textpro-compare-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 16px rgba(59, 130, 246, 0.4);
            }
            
            .textpro-compare-btn.active {
                background: linear-gradient(135deg, #ef4444, #dc2626);
            }
            
            .textpro-comparison-view {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.95);
                z-index: 1000;
                display: flex;
                flex-direction: column;
                animation: fadeIn 0.3s ease;
            }
            
            .textpro-comparison-header {
                background: rgba(59, 130, 246, 0.18);
                border-bottom: 1px solid var(--tp-border);
                padding: 16px 24px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .textpro-comparison-header h3 {
                margin: 0;
                font-size: 18px;
                font-weight: 700;
                color: white;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .textpro-close-comparison-btn {
                background: rgba(239, 68, 68, 0.2);
                border: 1px solid rgba(239, 68, 68, 0.4);
                border-radius: 6px;
                color: #ef4444;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .textpro-close-comparison-btn:hover {
                background: rgba(239, 68, 68, 0.3);
                transform: rotate(90deg);
            }
            
            .textpro-comparison-content {
                flex: 1;
                display: grid;
                grid-template-columns: 1fr auto 1fr;
                gap: 0;
                overflow: hidden;
            }
            
            .textpro-comparison-panel {
                display: flex;
                flex-direction: column;
                border-right: 1px solid rgba(59, 130, 246, 0.2);
            }
            
            .textpro-target-panel {
                border-right: none;
                border-left: 1px solid rgba(59, 130, 246, 0.2);
            }
            
            .textpro-comparison-panel-header {
                background: rgba(0, 0, 0, 0.3);
                padding: 16px 20px;
                border-bottom: 1px solid rgba(59, 130, 246, 0.3);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .textpro-comparison-panel-header h4 {
                margin: 0;
                font-size: 15px;
                font-weight: 600;
                color: white;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .textpro-lang-badge {
                background: rgba(59, 130, 246, 0.2);
                border: 1px solid rgba(59, 130, 246, 0.4);
                border-radius: 6px;
                padding: 4px 10px;
                font-size: 11px;
                font-weight: 700;
                color: #3b82f6;
                text-transform: uppercase;
            }
            
            .textpro-comparison-text {
                flex: 1;
                padding: 24px;
                overflow-y: auto;
                font-size: 15px;
                line-height: 1.8;
                color: rgba(255, 255, 255, 0.9);
            }
            
            .textpro-comparison-placeholder {
                color: rgba(255, 255, 255, 0.4);
                font-style: italic;
                text-align: center;
                padding-top: 60px;
            }
            
            .textpro-comparison-divider {
                width: 60px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(0, 0, 0, 0.3);
                border-left: 1px solid rgba(59, 130, 246, 0.2);
                border-right: 1px solid rgba(59, 130, 246, 0.2);
                color: rgba(59, 130, 246, 0.6);
            }
            
            .textpro-comparison-divider svg {
                width: 24px;
                height: 24px;
                animation: pulse 2s infinite;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 0.5; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.1); }
            }
            
            .textpro-comparison-footer {
                background: rgba(0, 0, 0, 0.3);
                border-top: 1px solid var(--tp-border);
                padding: 16px 24px;
                display: flex;
                gap: 12px;
                justify-content: center;
            }
            
            .textpro-sync-btn,
            .textpro-download-comparison-btn,
            .textpro-clear-comparison-btn {
                padding: 10px 20px;
                background: rgba(59, 130, 246, 0.2);
                border: 1px solid var(--tp-border-strong);
                border-radius: 8px;
                color: var(--tp-primary);
                font-weight: 600;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .textpro-sync-btn:hover,
            .textpro-download-comparison-btn:hover,
            .textpro-clear-comparison-btn:hover {
                background: rgba(59, 130, 246, 0.3);
                transform: translateY(-2px);
            }
            
            .textpro-clear-comparison-btn {
                background: rgba(239, 68, 68, 0.2);
                border-color: rgba(239, 68, 68, 0.4);
                color: #ef4444;
            }
            
            .textpro-clear-comparison-btn:hover {
                background: rgba(239, 68, 68, 0.3);
            }
            
            .textpro-chat-panel {
                flex: 1;
                display: flex;
                flex-direction: column;
                background: rgba(0, 0, 0, 0.1);
            }
            
            .textpro-chat-header {
                background: rgba(0, 0, 0, 0.3);
                padding: 20px 30px;
                border-bottom: 1px solid rgba(59, 130, 246, 0.3);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .textpro-chat-title {
                font-size: 22px;
                font-weight: 700;
                background: linear-gradient(135deg, var(--tp-primary), var(--tp-primary-2));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                margin: 0 0 4px;
            }
            
            .textpro-chat-subtitle {
                font-size: 13px;
                color: rgba(255, 255, 255, 0.6);
                margin: 0;
            }
            
            .textpro-close-btn {
                width: 36px;
                height: 36px;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 8px;
                color: white;
                font-size: 24px;
                line-height: 1;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
                flex-shrink: 0;
            }
            
            .textpro-close-btn:hover {
                background: rgba(239, 68, 68, 0.2);
                border-color: rgba(239, 68, 68, 0.5);
            }
            
            .textpro-clear-history-btn {
                width: 36px;
                height: 36px;
                background: rgba(239, 68, 68, 0.1);
                border: 1px solid rgba(239, 68, 68, 0.3);
                border-radius: 8px;
                color: #ef4444;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
            }
            
            .textpro-clear-history-btn:hover {
                background: rgba(239, 68, 68, 0.2);
                border-color: rgba(239, 68, 68, 0.5);
                transform: scale(1.05);
            }
            
            .textpro-chat-messages {
                flex: 1;
                overflow-y: auto;
                padding: 24px;
                -webkit-overflow-scrolling: touch;
            }

            /* Mobile/tablette: le panneau info devient un drawer, fermé par défaut */
            @media (max-width: 1024px) {
                .textpro-layout {
                    position: relative;
                }

                .textpro-info-panel {
                    position: fixed;
                    top: 0;
                    left: 0;
                    height: 100vh;
                    width: min(350px, 88vw);
                    background: rgba(0, 0, 0, 0.78);
                    backdrop-filter: blur(18px);
                    transform: translateX(-105%);
                    transition: transform 0.25s ease;
                    z-index: 10002;
                    border-right: 1px solid rgba(59, 130, 246, 0.3);
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.55);
                }

                .textpro-info-panel.open {
                    transform: translateX(0);
                }

                .textpro-sidebar-toggle-btn {
                    display: flex;
                }

                .textpro-sidebar-close-btn {
                    display: flex;
                    position: absolute;
                    top: 16px;
                    right: 16px;
                    width: 40px;
                    height: 40px;
                    background: rgba(0, 0, 0, 0.25);
                    border: 1px solid rgba(255, 255, 255, 0.18);
                    border-radius: 10px;
                    color: white;
                    cursor: pointer;
                    align-items: center;
                    justify-content: center;
                }

                .textpro-sidebar-close-btn svg {
                    width: 18px;
                    height: 18px;
                }

                .textpro-chat-header {
                    padding: 16px 16px;
                    gap: 10px;
                    flex-wrap: wrap;
                }

                /* Empêcher les titres longs de pousser les boutons hors écran */
                .textpro-chat-header-left > div {
                    min-width: 0;
                }

                .textpro-chat-title,
                .textpro-chat-subtitle {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 100%;
                }

                .textpro-chat-actions {
                    margin-left: auto;
                }

                .textpro-chat-actions {
                    gap: 8px !important;
                }

                .textpro-chat-title {
                    font-size: 18px;
                }

                .textpro-chat-subtitle {
                    font-size: 12px;
                }

                .textpro-chat-input-area {
                    padding: 14px 16px;
                }

                .textpro-chat-messages {
                    padding: 16px;
                }

                .textpro-message-content {
                    max-width: 85%;
                }

                .textpro-chat-textarea {
                    min-height: 44px;
                    max-height: 120px;
                }

                .textpro-mic-btn,
                .textpro-translate-btn,
                .textpro-send-btn {
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                }
            }

            /* Mobile: empiler l'input pour ne pas cacher les boutons */
            @media (max-width: 768px) {
                .textpro-input-top {
                    flex-direction: column;
                    align-items: stretch;
                    gap: 10px;
                }

                .textpro-chat-textarea {
                    width: 100%;
                    resize: vertical;
                }

                .textpro-counter {
                    position: static;
                    align-self: flex-end;
                    margin-top: 0;
                    margin-right: 2px;
                }

                .textpro-input-buttons {
                    justify-content: flex-end;
                }
            }
            
            .textpro-message {
                margin-bottom: 16px;
                display: flex;
            }
            
            .textpro-message.user {
                justify-content: flex-end;
            }
            
            .textpro-message-content {
                max-width: 70%;
                padding: 14px 18px;
                border-radius: 12px;
                font-size: 14px;
                line-height: 1.6;
                white-space: pre-wrap;
                word-wrap: break-word;
                text-align: left;
            }
            
            .textpro-message.user .textpro-message-content {
                background: linear-gradient(135deg, #3b82f6, #06b6d4);
                color: white;
            }
            
            .textpro-message.assistant .textpro-message-content {
                background: rgba(255, 255, 255, 0.08);
                color: white;
                border: 1px solid rgba(59, 130, 246, 0.3);
            }
            
            .textpro-chat-input-area {
                padding: 20px 30px;
                background: rgba(0, 0, 0, 0.3);
                border-top: 1px solid rgba(59, 130, 246, 0.3);
            }
            
            .textpro-input-wrapper {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .textpro-input-bar {
                width: 100%;
            }

            /* Surcharge du style global .input-wrapper (chat principal) pour rester cohérent avec Text Pro */
            .textpro-input-bar.input-wrapper {
                background: rgba(0, 0, 0, 0.3);
                border-color: var(--tp-border);
                box-shadow: none;
            }

            .textpro-input-bar.input-wrapper:focus-within {
                border-color: rgba(59, 130, 246, 0.6);
                background: rgba(0, 0, 0, 0.4);
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.14);
            }
            
            .textpro-chat-textarea {
                flex: 1;
                min-height: 60px;
                max-height: 150px;
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(59, 130, 246, 0.3);
                border-radius: 12px;
                padding: 12px 16px;
                color: white;
                font-size: 14px;
                font-family: inherit;
                resize: vertical;
            }

            /* Variante inline: même style que le chat principal (boutons intégrés) */
            .textpro-chat-textarea--inline {
                border: none;
                background: transparent;
                outline: none;
                font-size: 15px;
                color: white;
                resize: none;
                min-height: 24px;
                line-height: 1.5;
                padding: 6px 8px;
            }

            /* Boutons icônes (style chat principal: SVG sans carré/cercle visible) */
            .textpro-icon-btn {
                background: none;
                border: none;
                color: var(--tp-muted);
                cursor: pointer;
                width: 32px;
                height: 32px;
                padding: 6px;
                border-radius: 8px;
                transition: all 0.2s;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }

            .textpro-icon-btn svg {
                width: 20px;
                height: 20px;
            }

            .textpro-icon-btn:hover:not(:disabled) {
                background: var(--tp-panel-bg-strong);
                color: white;
            }

            .textpro-icon-btn:disabled {
                opacity: 0.35;
                cursor: not-allowed;
            }

            .textpro-mic-btn,
            .textpro-translate-btn,
            .textpro-send-btn {
                background: transparent;
                border: none;
                border-radius: 0;
            }
            
            .textpro-chat-textarea:focus {
                outline: none;
                border-color: rgba(59, 130, 246, 0.6);
                background: rgba(0, 0, 0, 0.4);
            }

            .textpro-chat-textarea--inline:focus {
                outline: none;
            }
            
            .textpro-chat-textarea::placeholder {
                color: rgba(255, 255, 255, 0.4);
            }
            
            .textpro-input-buttons {
                display: flex;
                gap: 8px;
            }
            
            /* Micro: même visuel que le chat principal (bouton icône discret) */
            .textpro-mic-btn {
                background: none;
                border: none;
                color: var(--tp-muted);
                cursor: pointer;
                width: 32px;
                height: 32px;
                padding: 6px;
                border-radius: 8px;
                transition: all 0.2s;
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }
            
            .textpro-mic-btn svg {
                width: 20px;
                height: 20px;
            }
            
            .textpro-mic-btn:hover {
                background: var(--tp-panel-bg-strong);
                color: white;
            }

            .textpro-mic-btn:focus-visible {
                outline: none;
                box-shadow: 0 0 0 3px var(--tp-border);
            }
            
            .textpro-mic-btn.recording {
                background: rgba(239, 68, 68, 0.3);
                color: white;
                animation: pulse 1.5s ease-in-out infinite;
            }
            
            @keyframes pulse {
                0%, 100% {
                    transform: scale(1);
                    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
                }
                50% {
                    transform: scale(1.05);
                    box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
                }
            }
            
            .textpro-send-btn {
                color: var(--tp-primary);
            }
            
            .textpro-send-btn:hover:not(:disabled) {
                background: var(--tp-panel-bg-strong);
                color: white;
            }
            
            .textpro-counter {
                position: static;
                font-size: 11px;
                color: rgba(255, 255, 255, 0.5);
                background: rgba(0, 0, 0, 0.3);
                padding: 4px 10px;
                border-radius: 12px;
                pointer-events: none;
                align-self: flex-end;
                margin-top: 6px;
            }
            
            .textpro-download-btn {
                display: inline-block;
                margin-top: 8px;
                padding: 3px 6px;
                background: rgba(59, 130, 246, 0.1);
                border: 1px solid var(--tp-border);
                border-radius: 3px;
                color: var(--tp-primary);
                font-weight: 400;
                font-size: 9px;
                cursor: pointer;
                transition: all 0.2s ease;
                display: inline-flex;
                align-items: center;
                gap: 4px;
            }
            
            .textpro-download-btn svg {
                width: 12px;
                height: 12px;
            }
            
            .textpro-download-btn span {
                font-size: 9px;
            }
            
            .textpro-download-btn:hover {
                background: rgba(59, 130, 246, 0.25);
                border-color: rgba(59, 130, 246, 0.6);
            }
            
            .textpro-copy-btn {
                display: inline-block;
                margin-top: 8px;
                margin-left: 6px;
                padding: 3px 6px;
                background: rgba(59, 130, 246, 0.1);
                border: 1px solid rgba(59, 130, 246, 0.3);
                border-radius: 3px;
                color: #3b82f6;
                font-weight: 400;
                font-size: 9px;
                cursor: pointer;
                transition: all 0.2s ease;
                display: inline-flex;
                align-items: center;
                gap: 4px;
            }
            
            .textpro-copy-btn svg {
                width: 12px;
                height: 12px;
            }
            
            .textpro-copy-btn span {
                font-size: 9px;
            }
            
            .textpro-copy-btn:hover {
                background: rgba(59, 130, 246, 0.25);
                border-color: rgba(59, 130, 246, 0.6);
            }
            
            .textpro-copy-btn.copied {
                background: rgba(16, 185, 129, 0.2);
                border-color: rgba(16, 185, 129, 0.4);
                color: #10b981;
            }

            .textpro-message-actions {
                display: flex;
                gap: 8px;
                align-items: center;
                flex-wrap: wrap;
                margin-top: 10px;
            }
            
            .textpro-speaker-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 24px;
                padding: 0;
                background: rgba(59, 130, 246, 0.18);
                border: 1px solid var(--tp-border-strong);
                border-radius: 6px;
                color: var(--tp-primary);
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .textpro-speaker-btn svg {
                width: 16px;
                height: 16px;
                vertical-align: middle;
            }
            
            .textpro-speaker-btn:hover {
                background: rgba(59, 130, 246, 0.28);
                transform: scale(1.1);
            }
            
            .textpro-speaker-btn.speaking {
                animation: speakerPulse 1s ease-in-out infinite;
            }
            
            @keyframes speakerPulse {
                0%, 100% {
                    transform: scale(1);
                }
                50% {
                    transform: scale(1.15);
                }
            }
            
            .textpro-translate-btn {
                color: var(--tp-muted);
            }
            
            .textpro-translate-btn:hover {
                background: var(--tp-panel-bg-strong);
                color: white;
            }
            
            .textpro-translate-btn.translating {
                background: linear-gradient(135deg, var(--tp-primary), var(--tp-primary-2));
                color: white;
                animation: translatePulse 1.5s ease-in-out infinite;
            }
            
            @keyframes translatePulse {
                0%, 100% {
                    opacity: 1;
                    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
                }
                50% {
                    opacity: 0.9;
                    box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
                }
            }
            
            .textpro-lang-selector {
                display: flex;
                flex-direction: column;
                gap: 6px;
                flex: 1;
            }
            
            .textpro-lang-selector label {
                font-size: 11px;
                color: rgba(255, 255, 255, 0.7);
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .textpro-lang-selector select {
                width: 100%;
                padding: 8px 10px;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(59, 130, 246, 0.4);
                border-radius: 8px;
                color: white;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .textpro-lang-selector select:hover {
                background: rgba(255, 255, 255, 0.15);
                border-color: rgba(59, 130, 246, 0.6);
            }
            
            .textpro-lang-selector select:focus {
                outline: none;
                border-color: var(--tp-primary);
                box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
            }
            
            .textpro-lang-arrow {
                color: var(--tp-primary);
                margin-top: 18px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .textpro-lang-arrow svg {
                width: 20px;
                height: 20px;
            }
            
            @keyframes slideInUp {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
    }

    /**
     * Mobile UX: sidebar (panneau info) replié par défaut sur petits écrans
     */
    function setupTextProResponsiveSidebar() {
        const sidebar = document.querySelector('.textpro-info-panel');
        const overlay = document.getElementById('textProModuleOverlay');
        if (!sidebar || !overlay) return;

        const sync = () => {
            const isNarrow = window.matchMedia && window.matchMedia('(max-width: 1024px)').matches;
            if (isNarrow) {
                // Par défaut fermé, sauf si l'utilisateur a explicitement ouvert
                if (!sidebar.dataset.userToggled) {
                    sidebar.classList.remove('open');
                }
            } else {
                // Desktop: toujours visible
                sidebar.classList.remove('open');
                delete sidebar.dataset.userToggled;
            }
        };

        // Exposer un toggle simple
        window.toggleTextProSidebar = function(forceOpen) {
            const isNarrow = window.matchMedia && window.matchMedia('(max-width: 1024px)').matches;
            if (!isNarrow) return;

            sidebar.dataset.userToggled = '1';

            if (typeof forceOpen === 'boolean') {
                sidebar.classList.toggle('open', forceOpen);
            } else {
                sidebar.classList.toggle('open');
            }
        };

        // Sync initial + resize
        sync();
        window.__textProResizeHandler = sync;
        window.addEventListener('resize', sync);
    }
    
    /**
     * Gérer l'upload de fichier
     */
    window.handleTextProFileUpload = function(event) {
        try {
            const file = event.target.files[0];
            if (!file) return;
            
            const statusDiv = document.getElementById('textProFileStatus');

            function setFileStatus(iconSvg, text, color) {
                if (!statusDiv) return;
                statusDiv.style.color = color || '';
                statusDiv.replaceChildren();
                if (iconSvg) {
                    const iconWrap = document.createElement('span');
                    iconWrap.style.display = 'inline-flex';
                    iconWrap.style.alignItems = 'center';
                    iconWrap.style.marginRight = '6px';
                    iconWrap.innerHTML = iconSvg;
                    statusDiv.appendChild(iconWrap);
                }
                statusDiv.appendChild(document.createTextNode(text));
            }

            const reader = new FileReader();
            
            if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
                reader.onload = function(e) {
                    const content = e.target.result;
                    setFileStatus(SVGIcons.check, `${file.name} chargé (${Math.round(content.length/1024)} Ko)`, 'rgba(16, 185, 129, 0.8)');
                    
                    // Ajouter le fichier avec un marqueur clair
                    const fileMessage = `[FICHIER UPLOADÉ: ${file.name}]\n\n${content}\n\n[FIN DU FICHIER]`;
                    addTextProMessage(fileMessage, 'user');
                    
                    // Afficher un message visuel plus simple
                    const messagesDiv = document.getElementById('textProMessages');
                    const lastUserMsg = messagesDiv.querySelector('.textpro-message.user:last-child .textpro-message-content');
                    if (lastUserMsg) {
                        lastUserMsg.textContent = `Fichier uploadé: ${file.name} (${Math.round(content.length/1024)} Ko)`;
                    }
                    
                    setTimeout(() => {
                        addTextProMessage(`J'ai bien reçu votre fichier "${file.name}" (${Math.round(content.length/1024)} Ko de texte). Que souhaitez-vous que je fasse avec ce contenu ? Je peux le traduire, le résumer, le corriger, le réécrire, etc.`, 'assistant');
                    }, 500);
                };
                reader.readAsText(file);
            } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
                // Gérer les PDF via extraction OCR
                setFileStatus(SVGIcons.file, `Extraction du texte de ${file.name}...`, 'rgba(59, 130, 246, 0.8)');
                
                reader.onload = async function(e) {
                    try {
                        const base64 = e.target.result.split(',')[1];
                        
                        // Appeler l'API extractText pour extraire le texte (simple OCR sans OpenAI)
                        const response = await fetch('/api/extractText', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                file: base64,
                                fileName: file.name
                            })
                        });
                        
                        if (!response.ok) {
                            const errorData = await response.json().catch(() => ({}));
                            throw new Error(errorData.error || `HTTP ${response.status}`);
                        }
                        
                        const data = await response.json();
                        const extractedText = data.text || '';
                        
                        if (extractedText) {
                            setFileStatus(SVGIcons.check, `${file.name} analysé (${Math.round(extractedText.length/1024)} Ko de texte extrait)`, 'rgba(16, 185, 129, 0.8)');
                            
                            const fileMessage = `[FICHIER PDF UPLOADÉ: ${file.name}]\n\n${extractedText}\n\n[FIN DU FICHIER]`;
                            addTextProMessage(fileMessage, 'user');
                            
                            const messagesDiv = document.getElementById('textProMessages');
                            const lastUserMsg = messagesDiv.querySelector('.textpro-message.user:last-child .textpro-message-content');
                            if (lastUserMsg) {
                                lastUserMsg.textContent = `PDF uploadé: ${file.name} (${Math.round(extractedText.length/1024)} Ko de texte extrait)`;
                            }
                            
                            setTimeout(() => {
                                addTextProMessage(`J'ai extrait le texte de votre PDF "${file.name}" (${Math.round(extractedText.length/1024)} Ko). Que voulez-vous que je fasse avec ce contenu ?`, 'assistant');
                            }, 500);
                        } else {
                            throw new Error('Aucun texte extrait');
                        }
                    } catch (error) {
                        console.error('Erreur extraction PDF:', error);
                        setFileStatus(SVGIcons.closeCompare, `Erreur: ${error.message}`, 'rgba(239, 68, 68, 0.8)');
                        addTextProMessage(`Désolé, je n'ai pas pu extraire le texte du PDF "${file.name}". Vous pouvez essayer de copier-coller le contenu manuellement.`, 'assistant');
                    }
                };
                reader.readAsDataURL(file);
            } else {
                setFileStatus(SVGIcons.file, `${file.name} détecté - Collez le contenu dans le chat`, 'rgba(59, 130, 246, 0.8)');
            }
        } catch (error) {
            console.error('Erreur upload:', error);
        }
    };
    
    /**
     * Ajouter un message au chat
     */
    function addTextProMessage(content, role, offerDownload = false, translationContent = null) {
        const messagesDiv = document.getElementById('textProMessages');
        if (!messagesDiv) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `textpro-message ${role}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'textpro-message-content';
        contentDiv.textContent = content;

        // Actions (speaker / download / copy) for assistant messages
        let actionsRow = null;
        if (role === 'assistant') {
            actionsRow = document.createElement('div');
            actionsRow.className = 'textpro-message-actions';
            contentDiv.appendChild(actionsRow);
        }
        
        // Ajouter le bouton de lecture vocale pour les messages de l'assistant
        if (role === 'assistant') {
            const speakerBtn = document.createElement('button');
            speakerBtn.className = 'textpro-speaker-btn';
            speakerBtn.innerHTML = SVGIcons.speaker;
            speakerBtn.title = 'Écouter le message';
            speakerBtn.onclick = function() {
                window.speakTextProMessage(content, speakerBtn);
            };
            (actionsRow || contentDiv).appendChild(speakerBtn);
        }
        
        // Ajouter le bouton de téléchargement si proposé (dans le contentDiv)
        if (offerDownload && role === 'assistant') {
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'textpro-download-btn';
            downloadBtn.innerHTML = SVGIcons.download + ' <span>Télécharger</span>';
            downloadBtn.onclick = function() {
                // Utiliser translationContent si disponible (pour avoir seulement le texte traduit sans le préfixe)
                const textToDownload = translationContent || content;
                downloadTextProResult(textToDownload);
            };
            (actionsRow || contentDiv).appendChild(downloadBtn);
            
            // Ajouter le bouton de copie
            const copyBtn = document.createElement('button');
            copyBtn.className = 'textpro-copy-btn';
            copyBtn.innerHTML = SVGIcons.copy + ' <span>Copier</span>';
            copyBtn.onclick = function() {
                const textToCopy = translationContent || content;
                window.copyTextProMessage(textToCopy, copyBtn);
            };
            (actionsRow || contentDiv).appendChild(copyBtn);
        }
        
        messageDiv.appendChild(contentDiv);
        
        messagesDiv.appendChild(messageDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        
        textProChatHistory.push({ role, content });
    }
    
    /**
     * Télécharger le résultat de Text Pro au format PDF, TXT ou DOCX
     */
    function downloadTextProResult(content, format = 'auto') {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            
            // Demander le format si en mode auto
            if (format === 'auto') {
                const userChoice = prompt('Choisissez le format de téléchargement:\n1. PDF (par défaut)\n2. TXT (texte brut)\n3. DOCX (Word)\n\nEntrez 1, 2 ou 3:', '1');
                
                if (userChoice === null) return; // Annulé
                
                switch (userChoice.trim()) {
                    case '2':
                        format = 'txt';
                        break;
                    case '3':
                        format = 'docx';
                        break;
                    default:
                        format = 'pdf';
                }
            }
            
            // Téléchargement selon le format choisi
            switch (format) {
                case 'txt':
                    downloadAsText(content, timestamp);
                    break;
                case 'docx':
                    downloadAsDocx(content, timestamp);
                    break;
                case 'pdf':
                default:
                    downloadAsPDF(content, timestamp);
                    break;
            }
            
        } catch (error) {
            console.error('Erreur téléchargement:', error);
            alert('Erreur lors du téléchargement. Veuillez réessayer.');
        }
    }
    
    /**
     * Télécharger en format TXT
     */
    function downloadAsText(content, timestamp) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `textpro-traduction-${timestamp}.txt`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        console.log('✓ Fichier TXT téléchargé');
    }
    
    /**
     * Télécharger en format PDF
     */
    function downloadAsPDF(content, timestamp) {
        // Vérifier si jsPDF est disponible
        const jsPDFLib = window.jspdf?.jsPDF || window.jsPDF;
        
        if (jsPDFLib) {
            const doc = new jsPDFLib({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });
            
            // Configuration du texte
            doc.setFont('helvetica');
            doc.setFontSize(11);
            
            // Marges et dimensions
            const margin = 15;
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const maxWidth = pageWidth - (2 * margin);
            
            // Diviser le texte en lignes
            const lines = doc.splitTextToSize(content, maxWidth);
            let y = margin;
            
            lines.forEach((line) => {
                if (y > pageHeight - margin) {
                    doc.addPage();
                    y = margin;
                }
                doc.text(line, margin, y);
                y += 6;
            });
            
            // Télécharger le PDF
            const filename = `textpro-traduction-${timestamp}.pdf`;
            doc.save(filename);
            console.log('✓ PDF téléchargé:', filename);
        } else {
            console.warn('jsPDF non disponible, téléchargement en TXT');
            downloadAsText(content, timestamp);
        }
    }
    
    /**
     * Télécharger en format DOCX (simulation basique)
     */
    function downloadAsDocx(content, timestamp) {
        // Pour un vrai DOCX, il faudrait utiliser une bibliothèque comme docx.js
        // Ici on crée un format RTF qui peut être ouvert par Word
        const rtfContent = `{\\rtf1\\ansi\\deff0
{\\fonttbl{\\f0\\fnil\\fcharset0 Arial;}}
{\\colortbl;\\red0\\green0\\blue0;}
\\viewkind4\\uc1\\pard\\cf1\\f0\\fs22 ${content.replace(/\n/g, '\\par\n')}
}`;
        
        const blob = new Blob([rtfContent], { type: 'application/rtf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `textpro-traduction-${timestamp}.rtf`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        console.log('✓ Fichier RTF téléchargé (compatible Word)');
    }
    
    /**
     * Basculer l'enregistrement vocal (Speech-to-Text)
     */
    window.toggleTextProRecording = async function() {
        const micBtn = document.getElementById('textProMicBtn');
        const textarea = document.getElementById('textProChatInput');
        
        if (!isRecording) {
            // Démarrer l'enregistrement
            try {
                // Méthode 1: Utiliser Web Speech API (reconnaissance vocale native du navigateur)
                if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                    recognition = new SpeechRecognition();
                    recognition.lang = 'fr-FR';
                    recognition.continuous = false;
                    recognition.interimResults = false;
                    
                    recognition.onstart = function() {
                        isRecording = true;
                        micBtn.classList.add('recording');
                        micBtn.innerHTML = SVGIcons.microphoneOff;
                        micBtn.title = 'Arrêter l\'enregistrement';
                        console.log('Enregistrement vocal démarré');
                    };
                    
                    recognition.onresult = function(event) {
                        const transcript = event.results[0][0].transcript;
                        textarea.value = (textarea.value ? textarea.value + ' ' : '') + transcript;
                        console.log('✓ Transcription:', transcript);
                    };
                    
                    recognition.onerror = function(event) {
                        console.error('Erreur reconnaissance vocale:', event.error);
                        alert(`Erreur: ${event.error}. Vérifiez les permissions du microphone.`);
                        stopRecording();
                    };
                    
                    recognition.onend = function() {
                        stopRecording();
                    };
                    
                    recognition.start();
                } else {
                    // Méthode 2: Fallback avec MediaRecorder + API externe (Whisper)
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    mediaRecorder = new MediaRecorder(stream);
                    audioChunks = [];
                    
                    mediaRecorder.ondataavailable = (event) => {
                        audioChunks.push(event.data);
                    };
                    
                    mediaRecorder.onstop = async () => {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                        await transcribeAudio(audioBlob);
                        stream.getTracks().forEach(track => track.stop());
                    };
                    
                    mediaRecorder.start();
                    isRecording = true;
                    micBtn.classList.add('recording');
                    micBtn.innerHTML = SVGIcons.microphoneOff;
                    micBtn.title = 'Arrêter l\'enregistrement';
                    console.log('Enregistrement audio démarré (fallback)');
                }
            } catch (error) {
                console.error('Erreur accès microphone:', error);
                alert('Impossible d\'accéder au microphone. Vérifiez les permissions.');
            }
        } else {
            // Arrêter l'enregistrement
            stopRecording();
        }
    };
    
    /**
     * Arrêter l'enregistrement
     */
    function stopRecording() {
        isRecording = false;
        const micBtn = document.getElementById('textProMicBtn');
        if (micBtn) {
            micBtn.classList.remove('recording');
            micBtn.innerHTML = SVGIcons.microphone;
            micBtn.title = 'Enregistrer un message vocal';
        }
        
        if (recognition) {
            recognition.stop();
            recognition = null;
        }
        
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
    }
    
    /**
     * Transcrire l'audio via API (Whisper ou autre)
     */
    async function transcribeAudio(audioBlob) {
        try {
            const textarea = document.getElementById('textProChatInput');
            textarea.value = 'Transcription en cours...';
            
            // Convertir en base64
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async function() {
                const base64Audio = reader.result.split(',')[1];
                
                // Appeler votre API de transcription
                const response = await fetch('/api/transcribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ audio: base64Audio })
                });
                
                if (!response.ok) throw new Error('Erreur transcription');
                
                const data = await response.json();
                textarea.value = data.text || '';
            };
        } catch (error) {
            console.error('Erreur transcription:', error);
            const textarea = document.getElementById('textProChatInput');
            textarea.value = '';
            alert('Erreur lors de la transcription. Veuillez réessayer.');
        }
    }
    
    /**
     * Basculer la vue comparaison
     */
    window.toggleComparisonMode = function() {
        comparisonMode = !comparisonMode;
        const comparisonView = document.getElementById('comparisonView');
        const chatPanel = document.querySelector('.textpro-chat-panel');
        const toggleBtn = document.getElementById('comparisonToggleBtn');
        
        if (comparisonMode) {
            // Activer la vue comparaison
            if (comparisonView) comparisonView.style.display = 'flex';
            if (chatPanel) chatPanel.style.display = 'none';
            if (toggleBtn) {
                toggleBtn.classList.add('active');
                toggleBtn.innerHTML = `${SVGIcons.closeCompare}<span>Fermer Comparaison</span>`;
            }
            
            // Afficher les derniers textes si disponibles
            if (lastSourceText && lastTranslatedText) {
                updateComparisonView(lastSourceText, lastTranslatedText);
            }
        } else {
            // Désactiver la vue comparaison
            if (comparisonView) comparisonView.style.display = 'none';
            if (chatPanel) chatPanel.style.display = 'flex';
            if (toggleBtn) {
                toggleBtn.classList.remove('active');
                toggleBtn.innerHTML = `${SVGIcons.compare}<span>Vue Comparaison</span>`;
            }
        }
    };
    
    /**
     * Mettre à jour la vue comparaison
     */
    function updateComparisonView(sourceText, targetText) {
        const sourceDisplay = document.getElementById('sourceTextDisplay');
        const targetDisplay = document.getElementById('targetTextDisplay');
        const sourceLangLabel = document.getElementById('sourceLangLabel');
        const targetLangLabel = document.getElementById('targetLangLabel');
        
        if (sourceDisplay) {
            sourceDisplay.innerHTML = `<p>${sourceText.replace(/\n/g, '<br>')}</p>`;
        }
        
        if (targetDisplay) {
            targetDisplay.innerHTML = `<p>${targetText.replace(/\n/g, '<br>')}</p>`;
        }
        
        // Mettre à jour les labels de langue
        if (sourceLangLabel) {
            const srcLang = sourceLang.split('-')[0].toUpperCase();
            sourceLangLabel.textContent = srcLang;
        }
        
        if (targetLangLabel) {
            targetLangLabel.textContent = targetLang.toUpperCase();
        }
        
        // Sauvegarder pour référence
        lastSourceText = sourceText;
        lastTranslatedText = targetText;
    }
    
    /**
     * Synchroniser le défilement des panneaux
     */
    window.syncComparisonScroll = function() {
        const sourceText = document.getElementById('sourceTextDisplay');
        const targetText = document.getElementById('targetTextDisplay');
        
        if (sourceText && targetText) {
            // Synchroniser les positions de défilement
            const syncScroll = (e) => {
                const scrollPercentage = e.target.scrollTop / (e.target.scrollHeight - e.target.clientHeight);
                const otherPanel = e.target === sourceText ? targetText : sourceText;
                otherPanel.scrollTop = scrollPercentage * (otherPanel.scrollHeight - otherPanel.clientHeight);
            };
            
            sourceText.addEventListener('scroll', syncScroll);
            targetText.addEventListener('scroll', syncScroll);
            
            addTextProMessage('Synchronisation du défilement activée', 'assistant');
        }
    };
    
    /**
     * Effacer la vue comparaison
     */
    window.clearComparison = function() {
        // Réinitialiser les variables
        lastSourceText = '';
        lastTranslatedText = '';
        
        // Vider les panneaux
        const sourceDisplay = document.getElementById('sourceTextDisplay');
        const targetDisplay = document.getElementById('targetTextDisplay');
        
        if (sourceDisplay) {
            sourceDisplay.innerHTML = `<div class="textpro-comparison-placeholder">
                Le texte original apparaîtra ici après la traduction
            </div>`;
        }
        
        if (targetDisplay) {
            targetDisplay.innerHTML = `<div class="textpro-comparison-placeholder">
                La traduction apparaîtra ici
            </div>`;
        }
        
        // Message de confirmation
        addTextProMessage('Vue comparaison effacée. Prêt pour une nouvelle traduction.', 'assistant');
        console.log('Vue comparaison réinitialisée');
    };
    
    /**
     * Télécharger la comparaison
     */
    window.downloadComparison = function() {
        if (!lastSourceText || !lastTranslatedText) {
            alert('Aucune comparaison disponible à télécharger.');
            return;
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const content = `COMPARAISON DE TRADUCTION\n` +
                       `Date: ${new Date().toLocaleString()}\n` +
                       `Mode: ${translationModes[currentTranslationMode].name}\n` +
                       `\n${'='.repeat(80)}\n\n` +
                       `TEXTE ORIGINAL:\n` +
                       `${'-'.repeat(80)}\n` +
                       `${lastSourceText}\n\n` +
                       `${'='.repeat(80)}\n\n` +
                       `TRADUCTION:\n` +
                       `${'-'.repeat(80)}\n` +
                       `${lastTranslatedText}\n`;
        
        downloadTextProResult(content, 'pdf');
    };
    
    /**
     * Changer le mode de traduction
     */
    window.changeTranslationMode = function(mode) {
        currentTranslationMode = mode;
        const modeInfo = translationModes[mode];
        
        // Mettre à jour la description
        const descriptionDiv = document.getElementById('modeDescription');
        if (descriptionDiv && modeInfo) {
            descriptionDiv.textContent = modeInfo.description;
        }
        
        // Ajouter un message de confirmation dans le chat
        const modeName = modeInfo ? modeInfo.name : mode;
        addTextProMessage(`Mode de traduction changé: ${modeName}`, 'assistant');
        
        console.log('Mode de traduction:', mode);

        // Mobile: refermer le panneau latéral après sélection
        try {
            const isNarrow = window.matchMedia && window.matchMedia('(max-width: 1024px)').matches;
            if (isNarrow && typeof window.toggleTextProSidebar === 'function') {
                window.toggleTextProSidebar(false);
            }
        } catch (e) {}
    };
    
    /**
     * Lire un message à voix haute (Text-to-Speech)
     */
    window.speakTextProMessage = function(text, button) {
        // Arrêter toute lecture en cours
        if (currentUtterance) {
            speechSynthesis.cancel();
            currentUtterance = null;
            
            // Retirer la classe speaking de tous les boutons
            document.querySelectorAll('.textpro-speaker-btn.speaking').forEach(btn => {
                btn.classList.remove('speaking');
            });
            
            // Si on clique sur le même bouton, on arrête là
            if (button && button.classList.contains('speaking')) {
                return;
            }
        }
        
        // Créer une nouvelle lecture
        currentUtterance = new SpeechSynthesisUtterance(text);
        currentUtterance.lang = 'fr-FR';
        currentUtterance.rate = 1.0;
        currentUtterance.pitch = 1.0;
        currentUtterance.volume = 1.0;
        
        // Ajouter la classe speaking au bouton
        if (button) {
            button.classList.add('speaking');
        }
        
        currentUtterance.onend = function() {
            if (button) {
                button.classList.remove('speaking');
            }
            currentUtterance = null;
        };
        
        currentUtterance.onerror = function(event) {
            console.error('Erreur TTS:', event);
            if (button) {
                button.classList.remove('speaking');
            }
            currentUtterance = null;
        };
        
        speechSynthesis.speak(currentUtterance);
        console.log('Lecture vocale démarrée');
    };

    /**
     * Mettre à jour les langues de traduction
     */
    window.updateTranslationLanguages = function() {
        const sourceSelect = document.getElementById('sourceLangSelect');
        const targetSelect = document.getElementById('targetLangSelect');
        
        if (sourceSelect && targetSelect) {
            sourceLang = sourceSelect.value;
            targetLang = targetSelect.value;
            console.log(`Langues mises à jour: ${sourceLang} → ${targetLang}`);
            
            // Mettre à jour les badges de langue dans la vue comparaison
            const sourceLangLabel = document.getElementById('sourceLangLabel');
            const targetLangLabel = document.getElementById('targetLangLabel');
            
            if (sourceLangLabel) {
                const srcLang = sourceLang.split('-')[0].toUpperCase();
                sourceLangLabel.textContent = srcLang;
            }
            
            if (targetLangLabel) {
                targetLangLabel.textContent = targetLang.toUpperCase();
            }
        }

        // Mobile: refermer le panneau latéral après sélection
        try {
            const isNarrow = window.matchMedia && window.matchMedia('(max-width: 1024px)').matches;
            if (isNarrow && typeof window.toggleTextProSidebar === 'function') {
                window.toggleTextProSidebar(false);
            }
        } catch (e) {}
    };
    
    /**
     * Mettre à jour le compteur de caractères/mots
     */
    window.updateTextProCounter = function() {
        const textarea = document.getElementById('textProChatInput');
        const counter = document.getElementById('textProCounter');
        
        if (textarea && counter) {
            const text = textarea.value;
            const chars = text.length;
            const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
            
            counter.textContent = `${chars} caractère${chars > 1 ? 's' : ''} | ${words} mot${words > 1 ? 's' : ''}`;
        }
    };
    
    /**
     * Copier le contenu d'un message
     */
    window.copyTextProMessage = async function(text, button) {
        try {
            await navigator.clipboard.writeText(text);
            
            // Feedback visuel
            const originalHTML = button.innerHTML;
            button.classList.add('copied');
            button.innerHTML = `${SVGIcons.check} <span>Copié !</span>`;
            
            setTimeout(() => {
                button.classList.remove('copied');
                button.innerHTML = originalHTML;
            }, 2000);
            
            console.log('✓ Texte copié dans le presse-papiers');
        } catch (error) {
            console.error('Erreur copie:', error);
            alert('Impossible de copier le texte. Veuillez réessayer.');
        }
    };
    
    /**
     * Effacer l'historique du chat
     */
    window.clearTextProHistory = function() {
        if (confirm('Voulez-vous vraiment effacer tout l\'historique du chat ?')) {
            const messagesDiv = document.getElementById('textProMessages');
            if (messagesDiv) {
                // Vider tout le contenu
                messagesDiv.innerHTML = '';
            }
            
            // Vider l'historique
            textProChatHistory = [];
            
            // Régénérer le message d'accueil
            const welcomeMessage = `Bienvenue dans AI Text Pro
Votre assistant intelligent de traitement et traduction de texte.

CAPACITÉS PRINCIPALES
• Traduction professionnelle dans 7 langues
• 7 modes spécialisés : Général, Académique, Scientifique, Juridique, Médical, Technique, Business
• Correction orthographique et grammaticale
• Résumé et synthèse de documents
• Réécriture et optimisation de style
• Analyse et structuration de contenu

OUTILS DISPONIBLES
• Vue Comparaison source/cible
• Export multi-format (PDF, TXT, DOCX)
• Copie instantanée
• Synthèse vocale et dictation
• Traduction vocale en temps réel
• Import de fichiers
• Compteur de mots et caractères

Pour commencer, sélectionnez vos langues dans le panneau latéral et saisissez votre texte.`;
            addTextProMessage(welcomeMessage, 'assistant');
            
            // Réinitialiser le textarea et le compteur
            const textarea = document.getElementById('textProChatInput');
            if (textarea) textarea.value = '';
            window.updateTextProCounter();
            
            console.log('✓ Historique effacé');
        }
    };

    /**
     * Basculer la traduction vocale instantanée
     */
    window.toggleInstantTranslation = async function() {
        const translateBtn = document.getElementById('textProTranslateBtn');
        
        if (!isTranslating) {
            // Démarrer la traduction instantanée
            try {
                // Vérifier si Web Speech API est disponible
                if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
                    alert('Désolé, la reconnaissance vocale n\'est pas supportée par votre navigateur. Utilisez Chrome, Edge ou Safari.');
                    return;
                }
                
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                translationRecognition = new SpeechRecognition();
                translationRecognition.lang = sourceLang;
                translationRecognition.continuous = true;
                translationRecognition.interimResults = false;
                
                translationRecognition.onstart = function() {
                    isTranslating = true;
                    translateBtn.classList.add('translating');
                    translateBtn.title = 'Arrêter la traduction instantanée';
                    console.log('Traduction vocale instantanée démarrée');
                    
                    // Ajouter un message dans le chat
                    addTextProMessage(`Traduction instantanée activée (${getLanguageName(sourceLang)} → ${getLanguageName(targetLang, true)}). Parlez maintenant...`, 'assistant');
                };
                
                translationRecognition.onresult = async function(event) {
                    const transcript = event.results[event.results.length - 1][0].transcript;
                    console.log('Texte capturé:', transcript);
                    
                    // Afficher le texte original
                    addTextProMessage(transcript, 'user');
                    
                    // Traduire le texte
                    try {
                        const translation = await translateText(transcript, sourceLang, targetLang);
                        
                        // Afficher la traduction avec option de téléchargement
                        addTextProMessage(`Traduction: ${translation}`, 'assistant', true, translation);
                        
                        // Mettre à jour la vue comparaison
                        lastSourceText = transcript;
                        lastTranslatedText = translation;
                        if (comparisonMode) {
                            updateComparisonView(transcript, translation);
                        }
                        
                        // Lire la traduction à voix haute
                        speakTranslation(translation, targetLang);
                    } catch (error) {
                        console.error('Erreur traduction:', error);
                        addTextProMessage('Erreur lors de la traduction. Veuillez réessayer.', 'assistant');
                    }
                };
                
                translationRecognition.onerror = function(event) {
                    console.error('Erreur reconnaissance vocale:', event.error);
                    if (event.error !== 'no-speech') {
                        addTextProMessage(`Erreur: ${event.error}. Vérifiez les permissions du microphone.`, 'assistant');
                        stopInstantTranslation();
                    }
                };
                
                translationRecognition.onend = function() {
                    if (isTranslating) {
                        // Redémarrer automatiquement si on est toujours en mode traduction
                        try {
                            translationRecognition.start();
                        } catch (e) {
                            console.log('Fin de la traduction instantanée');
                            stopInstantTranslation();
                        }
                    }
                };
                
                translationRecognition.start();
            } catch (error) {
                console.error('Erreur accès microphone:', error);
                alert('Impossible d\'accéder au microphone. Vérifiez les permissions.');
            }
        } else {
            // Arrêter la traduction instantanée
            stopInstantTranslation();
        }
    };
    
    /**
     * Arrêter la traduction instantanée
     */
    function stopInstantTranslation() {
        isTranslating = false;
        const translateBtn = document.getElementById('textProTranslateBtn');
        
        if (translateBtn) {
            translateBtn.classList.remove('translating');
            translateBtn.title = 'Traduction vocale instantanée';
        }
        
        if (translationRecognition) {
            translationRecognition.stop();
            translationRecognition = null;
        }
        
        addTextProMessage('Traduction instantanée arrêtée.', 'assistant');
    }
    
    /**
     * Traduire un texte via l'API
     */
    async function translateText(text, fromLang, toLang) {
        try {
            // Extraire le code de langue simplifié (fr-FR -> fr)
            const fromCode = fromLang.split('-')[0];
            
            // Obtenir le prompt selon le mode
            const modeInfo = translationModes[currentTranslationMode];
            const modePrompt = modeInfo 
                ? `${modeInfo.prompt} ` 
                : 'Tu es un traducteur professionnel généraliste. ';
            
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [
                        {
                            role: 'system',
                            content: `${modePrompt}Traduis le texte de ${getLanguageName(fromLang)} vers ${getLanguageName(toLang, true)}. Ne fournis que la traduction, sans explications supplémentaires.`
                        },
                        {
                            role: 'user',
                            content: text
                        }
                    ],
                    userId: currentUser ? currentUser.email : 'anonymous',
                    context: 'text-pro-translation'
                })
            });
            
            if (!response.ok) throw new Error('Erreur API traduction');
            
            const data = await response.json();
            return data.response || text;
        } catch (error) {
            console.error('Erreur traduction:', error);
            throw error;
        }
    }
    
    /**
     * Lire la traduction à voix haute
     */
    function speakTranslation(text, lang) {
        // Arrêter toute lecture en cours
        if (speechSynthesis.speaking) {
            speechSynthesis.cancel();
        }
        
        // Mapper les codes de langue pour la synthèse vocale
        const langMap = {
            'en': 'en-US',
            'fr': 'fr-FR',
            'es': 'es-ES',
            'de': 'de-DE',
            'it': 'it-IT',
            'ar': 'ar-SA',
            'zh': 'zh-CN'
        };
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = langMap[lang] || 'en-US';
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        utterance.onerror = function(event) {
            console.error('Erreur TTS traduction:', event);
        };
        
        speechSynthesis.speak(utterance);
        console.log('Traduction lue à voix haute');
    }
    
    /**
     * Obtenir le nom complet d'une langue
     */
    function getLanguageName(langCode, isTarget = false) {
        const names = {
            'fr-FR': 'Français',
            'fr': 'Français',
            'en-US': 'Anglais',
            'en': 'Anglais',
            'es-ES': 'Espagnol',
            'es': 'Espagnol',
            'de-DE': 'Allemand',
            'de': 'Allemand',
            'it-IT': 'Italien',
            'it': 'Italien',
            'ar-SA': 'Arabe',
            'ar': 'Arabe',
            'zh-CN': 'Chinois',
            'zh': 'Chinois'
        };
        return names[langCode] || langCode;
    }

    /**
     * Envoyer un message
     */
    window.sendTextProMessage = async function() {
        try {
            const input = document.getElementById('textProChatInput');
            const sendBtn = document.querySelector('.textpro-send-btn');
            const message = input.value.trim();
            
            if (!message) return;
            
            addTextProMessage(message, 'user');
            input.value = '';
            
            sendBtn.disabled = true;
            sendBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
            
            // Préparer les messages
            const modeInfo = translationModes[currentTranslationMode];
            const systemPrompt = modeInfo 
                ? `Tu es Agent Tony, assistant spécialisé dans le traitement de texte professionnel. ${modeInfo.prompt}

Fonctionnalités disponibles pour l'utilisateur :
- 7 modes de traduction spécialisés (Général, Académique, Scientifique, Juridique, Médical, Technique, Business)
- Traduction dans 7 langues : Français, Anglais, Espagnol, Allemand, Italien, Arabe, Chinois
- Vue Comparaison côte à côte du texte original et de la traduction
- Téléchargement des traductions en PDF, TXT ou DOCX
- Copie instantanée des traductions dans le presse-papiers
- Speech-to-Text et Text-to-Speech
- Traduction vocale instantanée
- Upload de fichiers (TXT, PDF, DOC, DOCX)
- Compteur de caractères et mots en temps réel

Tu peux traduire, réécrire, corriger, résumer, analyser et améliorer des textes. Quand un utilisateur uploade un fichier, il sera marqué par [FICHIER UPLOADÉ: nom] ... [FIN DU FICHIER]. Prends en compte tout le contenu du fichier dans tes réponses. Quand tu traduis un texte, propose toujours le téléchargement du résultat.`
                : `Tu es Agent Tony, assistant spécialisé dans le traitement de texte professionnel.

Fonctionnalités disponibles pour l'utilisateur :
- 7 modes de traduction spécialisés (Général, Académique, Scientifique, Juridique, Médical, Technique, Business)
- Traduction dans 7 langues : Français, Anglais, Espagnol, Allemand, Italien, Arabe, Chinois
- Vue Comparaison côte à côte du texte original et de la traduction
- Téléchargement des traductions en PDF, TXT ou DOCX
- Copie instantanée des traductions dans le presse-papiers
- Speech-to-Text et Text-to-Speech
- Traduction vocale instantanée
- Upload de fichiers (TXT, PDF, DOC, DOCX)
- Compteur de caractères et mots en temps réel

Tu peux traduire, réécrire, corriger, résumer, analyser et améliorer des textes. Quand un utilisateur uploade un fichier, il sera marqué par [FICHIER UPLOADÉ: nom] ... [FIN DU FICHIER]. Prends en compte tout le contenu du fichier dans tes réponses. Quand tu traduis un texte, propose toujours le téléchargement du résultat.`;
            
            const messages = [
                {
                    role: 'system',
                    content: systemPrompt
                },
                ...textProChatHistory.map(msg => ({
                    role: msg.role === 'assistant' ? 'assistant' : 'user',
                    content: msg.content
                }))
            ];
            
            // Debug: vérifier le contenu
            console.log('Envoi à l\'API:', messages.length, 'messages');
            console.log('Historique complet:', textProChatHistory);
            const fileMessages = messages.filter(m => m.content.includes('[FICHIER UPLOADÉ'));
            if (fileMessages.length > 0) {
                console.log('Fichiers trouvés:', fileMessages.length);
                fileMessages.forEach(fm => {
                    console.log('  - Taille:', fm.content.length, 'caractères');
                });
            }
            
            // Appeler l'API
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages,
                    userId: currentUser ? currentUser.email : 'anonymous',
                    context: 'text-pro'
                })
            });
            
            if (!response.ok) throw new Error('Erreur API');
            
            const data = await response.json();
            const responseText = data.response || 'Désolé, je n\'ai pas pu traiter votre demande.';
            addTextProMessage(responseText, 'assistant', data.offerDownload);
            
            // Détecter si c'est une traduction et mettre à jour la vue comparaison
            if (message.toLowerCase().includes('tradui') && responseText.length > 10) {
                lastSourceText = message;
                lastTranslatedText = responseText;
                
                // Si la vue comparaison est active, mettre à jour
                if (comparisonMode) {
                    updateComparisonView(message, responseText);
                }
            }
            
        } catch (error) {
            console.error('Erreur:', error);
            addTextProMessage('Désolé, une erreur s\'est produite. Veuillez réessayer.', 'assistant');
        } finally {
            const sendBtn = document.querySelector('.textpro-send-btn');
            const input = document.getElementById('textProChatInput');
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.innerHTML = SVGIcons.send;
            }
            if (input) input.focus();
        }
    };
    
    console.log('Module Text Pro initialisé');
})();
