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
                    
                    <div class="textpro-features">
                        <h3 class="textpro-section-title">Fonctionnalités</h3>
                        <div class="textpro-feature-list">
                            <div class="textpro-feature-item">🎤 Speech-to-Text</div>
                            <div class="textpro-feature-item">🔊 Text-to-Speech</div>
                            <div class="textpro-feature-item">📄 Upload de fichiers</div>
                            <div class="textpro-feature-item">💾 Téléchargement PDF</div>
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
                                Bonjour ! Je suis votre Agent Text Pro. 
                                
                                🎤 Utilisez le microphone pour dicter votre texte
                                🔊 Cliquez sur le haut-parleur pour écouter mes réponses
                                📄 Uploadez un fichier ou collez votre texte directement
                                
                                Je peux traduire, corriger, résumer, réécrire et bien plus !
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
                            <div class="textpro-input-buttons">
                                <button class="textpro-mic-btn" id="textProMicBtn" onclick="window.toggleTextProRecording()" title="Enregistrer un message vocal">
                                    🎤
                                </button>
                                <button class="textpro-send-btn" onclick="window.sendTextProMessage()" title="Envoyer le message">
                                    📤
                                </button>
                            </div>
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
            
            .textpro-input-buttons {
                display: flex;
                gap: 8px;
            }
            
            .textpro-mic-btn {
                width: 48px;
                height: 48px;
                padding: 0;
                background: rgba(139, 92, 246, 0.2);
                border: 1px solid rgba(139, 92, 246, 0.4);
                border-radius: 12px;
                color: white;
                font-size: 20px;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .textpro-mic-btn:hover {
                background: rgba(139, 92, 246, 0.3);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
            }
            
            .textpro-mic-btn.recording {
                background: rgba(239, 68, 68, 0.3);
                border-color: rgba(239, 68, 68, 0.6);
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
                width: 48px;
                height: 48px;
                padding: 0;
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
            
            .textpro-download-btn {
                display: inline-block;
                margin-top: 8px;
                padding: 3px 6px;
                background: rgba(16, 185, 129, 0.1);
                border: 1px solid rgba(16, 185, 129, 0.3);
                border-radius: 3px;
                color: #10b981;
                font-weight: 400;
                font-size: 9px;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .textpro-download-btn:hover {
                background: rgba(16, 185, 129, 0.25);
                border-color: rgba(16, 185, 129, 0.6);
            }
            
            .textpro-speaker-btn {
                display: inline-block;
                margin-left: 8px;
                padding: 4px 8px;
                background: rgba(139, 92, 246, 0.2);
                border: 1px solid rgba(139, 92, 246, 0.4);
                border-radius: 6px;
                color: #a78bfa;
                font-size: 16px;
                cursor: pointer;
                transition: all 0.2s ease;
                vertical-align: middle;
            }
            
            .textpro-speaker-btn:hover {
                background: rgba(139, 92, 246, 0.3);
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
                    statusDiv.textContent = `✓ ${file.name} chargé (${Math.round(content.length/1024)} Ko)`;
                    statusDiv.style.color = 'rgba(16, 185, 129, 0.8)';
                    
                    // Ajouter le fichier avec un marqueur clair
                    const fileMessage = `[FICHIER UPLOADÉ: ${file.name}]\n\n${content}\n\n[FIN DU FICHIER]`;
                    addTextProMessage(fileMessage, 'user');
                    
                    // Afficher un message visuel plus simple
                    const messagesDiv = document.getElementById('textProMessages');
                    const lastUserMsg = messagesDiv.querySelector('.textpro-message.user:last-child .textpro-message-content');
                    if (lastUserMsg) {
                        lastUserMsg.textContent = `📄 Fichier uploadé: ${file.name} (${Math.round(content.length/1024)} Ko)`;
                    }
                    
                    setTimeout(() => {
                        addTextProMessage(`J'ai bien reçu votre fichier "${file.name}" (${Math.round(content.length/1024)} Ko de texte). Que souhaitez-vous que je fasse avec ce contenu ? Je peux le traduire, le résumer, le corriger, le réécrire, etc.`, 'assistant');
                    }, 500);
                };
                reader.readAsText(file);
            } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
                // Gérer les PDF via extraction OCR
                statusDiv.textContent = `⏳ Extraction du texte de ${file.name}...`;
                statusDiv.style.color = 'rgba(59, 130, 246, 0.8)';
                
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
                            statusDiv.textContent = `✓ ${file.name} analysé (${Math.round(extractedText.length/1024)} Ko de texte extrait)`;
                            statusDiv.style.color = 'rgba(16, 185, 129, 0.8)';
                            
                            const fileMessage = `[FICHIER PDF UPLOADÉ: ${file.name}]\n\n${extractedText}\n\n[FIN DU FICHIER]`;
                            addTextProMessage(fileMessage, 'user');
                            
                            const messagesDiv = document.getElementById('textProMessages');
                            const lastUserMsg = messagesDiv.querySelector('.textpro-message.user:last-child .textpro-message-content');
                            if (lastUserMsg) {
                                lastUserMsg.textContent = `📄 PDF uploadé: ${file.name} (${Math.round(extractedText.length/1024)} Ko de texte extrait)`;
                            }
                            
                            setTimeout(() => {
                                addTextProMessage(`J'ai extrait le texte de votre PDF "${file.name}" (${Math.round(extractedText.length/1024)} Ko). Que voulez-vous que je fasse avec ce contenu ?`, 'assistant');
                            }, 500);
                        } else {
                            throw new Error('Aucun texte extrait');
                        }
                    } catch (error) {
                        console.error('Erreur extraction PDF:', error);
                        statusDiv.textContent = `❌ Erreur: ${error.message}`;
                        statusDiv.style.color = 'rgba(239, 68, 68, 0.8)';
                        addTextProMessage(`Désolé, je n'ai pas pu extraire le texte du PDF "${file.name}". Vous pouvez essayer de copier-coller le contenu manuellement.`, 'assistant');
                    }
                };
                reader.readAsDataURL(file);
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
    function addTextProMessage(content, role, offerDownload = false) {
        const messagesDiv = document.getElementById('textProMessages');
        if (!messagesDiv) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `textpro-message ${role}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'textpro-message-content';
        contentDiv.textContent = content;
        
        // Ajouter le bouton de lecture vocale pour les messages de l'assistant
        if (role === 'assistant') {
            const speakerBtn = document.createElement('button');
            speakerBtn.className = 'textpro-speaker-btn';
            speakerBtn.textContent = '🔊';
            speakerBtn.title = 'Écouter le message';
            speakerBtn.onclick = function() {
                window.speakTextProMessage(content, speakerBtn);
            };
            contentDiv.appendChild(document.createElement('br'));
            contentDiv.appendChild(speakerBtn);
        }
        
        // Ajouter le bouton de téléchargement si proposé (dans le contentDiv)
        if (offerDownload && role === 'assistant') {
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'textpro-download-btn';
            downloadBtn.textContent = 'Télécharger';
            downloadBtn.onclick = function() {
                downloadTextProResult(content);
            };
            contentDiv.appendChild(downloadBtn);
        }
        
        messageDiv.appendChild(contentDiv);
        
        messagesDiv.appendChild(messageDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        
        textProChatHistory.push({ role, content });
    }
    
    /**
     * Télécharger le résultat de Text Pro au format PDF
     */
    function downloadTextProResult(content) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const filename = `textpro-resultat-${timestamp}.pdf`;
            
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
                
                lines.forEach((line, index) => {
                    if (y > pageHeight - margin) {
                        doc.addPage();
                        y = margin;
                    }
                    doc.text(line, margin, y);
                    y += 6;
                });
                
                // Télécharger le PDF
                doc.save(filename);
                console.log('✓ PDF téléchargé:', filename);
            } else {
                // Fallback TXT si jsPDF n'est vraiment pas disponible
                console.warn('jsPDF non disponible, téléchargement en TXT');
                const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `textpro-resultat-${timestamp}.txt`;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
            }
        } catch (error) {
            console.error('Erreur téléchargement PDF:', error);
            // Fallback TXT en cas d'erreur
            try {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `textpro-resultat-${timestamp}.txt`;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
            } catch (e) {
                alert('Erreur lors du téléchargement. Veuillez réessayer.');
            }
        }
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
                        micBtn.textContent = '⏹️';
                        micBtn.title = 'Arrêter l\'enregistrement';
                        console.log('🎤 Enregistrement vocal démarré');
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
                    micBtn.textContent = '⏹️';
                    micBtn.title = 'Arrêter l\'enregistrement';
                    console.log('🎤 Enregistrement audio démarré (fallback)');
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
            micBtn.textContent = '🎤';
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
        console.log('🔊 Lecture vocale démarrée');
    };

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
            sendBtn.textContent = '⏳';
            
            // Préparer les messages
            const messages = [
                {
                    role: 'system',
                    content: 'Tu es Agent Text Pro, un assistant spécialisé dans le traitement de texte professionnel. Tu peux traduire, réécrire, corriger, résumer, analyser et améliorer des textes. Quand un utilisateur uploade un fichier, il sera marqué par [FICHIER UPLOADÉ: nom] ... [FIN DU FICHIER]. Prends en compte tout le contenu du fichier dans tes réponses.'
                },
                ...textProChatHistory.map(msg => ({
                    role: msg.role === 'assistant' ? 'assistant' : 'user',
                    content: msg.content
                }))
            ];
            
            // Debug: vérifier le contenu
            console.log('📤 Envoi à l\'API:', messages.length, 'messages');
            console.log('📝 Historique complet:', textProChatHistory);
            const fileMessages = messages.filter(m => m.content.includes('[FICHIER UPLOADÉ'));
            if (fileMessages.length > 0) {
                console.log('📄 Fichiers trouvés:', fileMessages.length);
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
            addTextProMessage(data.response || 'Désolé, je n\'ai pas pu traiter votre demande.', 'assistant', data.offerDownload);
            
        } catch (error) {
            console.error('Erreur:', error);
            addTextProMessage('Désolé, une erreur s\'est produite. Veuillez réessayer.', 'assistant');
        } finally {
            const sendBtn = document.querySelector('.textpro-send-btn');
            const input = document.getElementById('textProChatInput');
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.textContent = '📤';
            }
            if (input) input.focus();
        }
    };
    
    console.log('Module Text Pro initialisé');
})();
