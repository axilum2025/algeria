/**
 * Module Text Pro - Traitement de texte professionnel
 * Ce module est chargé séparément pour éviter de bloquer l'application principale
 */

(function() {
    'use strict';
    
    // Variables du module
    let textProChatHistory = [];
    let textProOverlay = null;
    
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
            
            // Focus sur le textarea
            setTimeout(() => {
                const textarea = document.getElementById('textProChatInput');
                if (textarea) textarea.focus();
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
            background: linear-gradient(135deg, #1e3a8a, #0a4d3c, #064e3b);
            z-index: 10001;
            animation: fadeIn 0.3s ease;
            display: flex;
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
                        <h1 class="textpro-info-title">AI Text Pro</h1>
                        <p class="textpro-info-subtitle">Traitement de texte intelligent</p>
                    </div>
                    
                    <div class="textpro-upload-section">
                        <h3 class="textpro-section-title">Upload de fichier</h3>
                        <button class="textpro-upload-btn" onclick="document.getElementById('textProFileInput').click()">
                            Choisir un fichier
                        </button>
                        <input type="file" id="textProFileInput" accept=".txt,.pdf,.doc,.docx" style="display: none;" onchange="window.handleTextProFileUpload(event)">
                        <div id="textProFileStatus" class="textpro-file-status"></div>
                    </div>
                    
                    <div class="textpro-examples">
                        <h3 class="textpro-section-title">Exemples de commandes</h3>
                        
                        <div class="textpro-example-card">
                            <h4>Traduction</h4>
                            <p>Traduis en anglais professionnel</p>
                        </div>
                        
                        <div class="textpro-example-card">
                            <h4>Correction</h4>
                            <p>Corrige l'orthographe et la grammaire</p>
                        </div>
                        
                        <div class="textpro-example-card">
                            <h4>Résumé</h4>
                            <p>Résume ce texte en 3 points</p>
                        </div>
                        
                        <div class="textpro-example-card">
                            <h4>Réécriture</h4>
                            <p>Réécris de façon plus formelle</p>
                        </div>
                    </div>
                </div>
                
                <!-- Panneau de chat -->
                <div class="textpro-chat-panel">
                    <div class="textpro-chat-header">
                        <div>
                            <h2 class="textpro-chat-title">Agent Text Pro</h2>
                            <p class="textpro-chat-subtitle">Assistant de traitement de texte</p>
                        </div>
                        <button class="textpro-close-btn" onclick="window.closeTextProModule()">×</button>
                    </div>
                    
                    <div class="textpro-chat-messages" id="textProMessages">
                        <div class="textpro-message assistant">
                            <div class="textpro-message-content">
                                Bonjour ! Je suis votre Agent Text Pro. Uploadez un fichier ou collez votre texte directement dans le chat. Je peux traduire, corriger, résumer, réécrire et bien plus !
                            </div>
                        </div>
                    </div>
                    
                    <div class="textpro-chat-input-area">
                        <div class="textpro-input-wrapper">
                            <textarea 
                                id="textProChatInput" 
                                class="textpro-chat-textarea" 
                                placeholder="Collez votre texte ou posez votre question..."
                                onkeydown="if(event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); window.sendTextProMessage(); }"
                            ></textarea>
                            <button class="textpro-send-btn" onclick="window.sendTextProMessage()">
                                Envoyer
                            </button>
                        </div>
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
            }
            
            .textpro-info-panel {
                width: 350px;
                background: rgba(0, 0, 0, 0.2);
                border-right: 1px solid rgba(59, 130, 246, 0.3);
                overflow-y: auto;
                padding: 24px;
            }
            
            .textpro-info-header {
                margin-bottom: 24px;
            }
            
            .textpro-info-title {
                font-size: 24px;
                font-weight: 700;
                background: linear-gradient(135deg, #3b82f6, #06b6d4);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                margin: 0 0 8px;
            }
            
            .textpro-info-subtitle {
                font-size: 13px;
                color: rgba(255, 255, 255, 0.6);
                margin: 0;
            }
            
            .textpro-section-title {
                font-size: 15px;
                font-weight: 700;
                color: white;
                margin: 0 0 12px;
            }
            
            .textpro-upload-section {
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(59, 130, 246, 0.3);
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
                background: linear-gradient(135deg, #3b82f6, #06b6d4);
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
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
            }
            
            .textpro-close-btn:hover {
                background: rgba(239, 68, 68, 0.2);
                border-color: rgba(239, 68, 68, 0.5);
            }
            
            .textpro-chat-messages {
                flex: 1;
                overflow-y: auto;
                padding: 24px;
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
                gap: 12px;
                align-items: flex-end;
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
            
            .textpro-chat-textarea:focus {
                outline: none;
                border-color: rgba(59, 130, 246, 0.6);
                background: rgba(0, 0, 0, 0.4);
            }
            
            .textpro-chat-textarea::placeholder {
                color: rgba(255, 255, 255, 0.4);
            }
            
            .textpro-send-btn {
                padding: 12px 28px;
                background: linear-gradient(135deg, #3b82f6, #06b6d4);
                border: none;
                border-radius: 10px;
                color: white;
                font-weight: 600;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .textpro-send-btn:hover:not(:disabled) {
                transform: translateY(-2px);
                box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
            }
            
            .textpro-send-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
        `;
    }
    
    /**
     * Gérer l'upload de fichier
     */
    window.handleTextProFileUpload = function(event) {
        try {
            const file = event.target.files[0];
            if (!file) return;
            
            const statusDiv = document.getElementById('textProFileStatus');
            const reader = new FileReader();
            
            if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
                reader.onload = function(e) {
                    const content = e.target.result;
                    statusDiv.textContent = `✓ ${file.name} chargé`;
                    statusDiv.style.color = 'rgba(16, 185, 129, 0.8)';
                    
                    addTextProMessage(`Fichier: ${file.name}\n\n${content}`, 'user');
                    setTimeout(() => {
                        addTextProMessage(`J'ai bien reçu votre fichier "${file.name}". Que souhaitez-vous que je fasse avec ce texte ?`, 'assistant');
                    }, 500);
                };
                reader.readAsText(file);
            } else {
                statusDiv.textContent = `✓ ${file.name} détecté - Collez le contenu dans le chat`;
                statusDiv.style.color = 'rgba(59, 130, 246, 0.8)';
            }
        } catch (error) {
            console.error('Erreur upload:', error);
        }
    };
    
    /**
     * Ajouter un message au chat
     */
    function addTextProMessage(content, role) {
        const messagesDiv = document.getElementById('textProMessages');
        if (!messagesDiv) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `textpro-message ${role}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'textpro-message-content';
        contentDiv.textContent = content;
        
        messageDiv.appendChild(contentDiv);
        messagesDiv.appendChild(messageDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        
        textProChatHistory.push({ role, content });
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
            sendBtn.textContent = 'Traitement...';
            
            // Préparer les messages
            const messages = [
                {
                    role: 'system',
                    content: 'Tu es Agent Text Pro, un assistant spécialisé dans le traitement de texte professionnel. Tu peux traduire, réécrire, corriger, résumer, analyser et améliorer des textes.'
                },
                ...textProChatHistory.map(msg => ({
                    role: msg.role === 'assistant' ? 'assistant' : 'user',
                    content: msg.content
                }))
            ];
            
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
            addTextProMessage(data.response || 'Désolé, je n\'ai pas pu traiter votre demande.', 'assistant');
            
        } catch (error) {
            console.error('Erreur:', error);
            addTextProMessage('Désolé, une erreur s\'est produite. Veuillez réessayer.', 'assistant');
        } finally {
            const sendBtn = document.querySelector('.textpro-send-btn');
            const input = document.getElementById('textProChatInput');
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.textContent = 'Envoyer';
            }
            if (input) input.focus();
        }
    };
    
    console.log('Module Text Pro initialisé');
})();
