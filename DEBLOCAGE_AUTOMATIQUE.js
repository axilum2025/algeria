// 🚨 SCRIPT DE DÉBLOCAGE AUTOMATIQUE D'INTERFACE
// Copiez-collez ce code dans la Console F12 et appuyez sur Entrée

(function() {
    console.log('🔍 DIAGNOSTIC DE BLOCAGE EN COURS...\n');
    
    const issues = [];
    const fixes = [];
    
    // 1. Vérifier les overlays visibles
    const overlays = document.querySelectorAll('[id*="overlay"], [id*="Overlay"], [class*="overlay"]');
    overlays.forEach(overlay => {
        const style = window.getComputedStyle(overlay);
        const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        const zIndex = parseInt(style.zIndex) || 0;
        
        if (isVisible && zIndex > 100) {
            issues.push(`❌ Overlay bloquant détecté: ${overlay.id || overlay.className}`);
            overlay.style.display = 'none';
            overlay.classList.remove('show');
            fixes.push(`✅ Masqué: ${overlay.id || overlay.className}`);
        }
    });
    
    // 2. Vérifier si les inputs sont désactivés
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    
    if (userInput) {
        if (userInput.disabled) {
            issues.push('❌ Input principal désactivé');
            userInput.disabled = false;
            fixes.push('✅ Input réactivé');
        }
        if (userInput.style.pointerEvents === 'none') {
            issues.push('❌ Input avec pointer-events: none');
            userInput.style.pointerEvents = 'auto';
            fixes.push('✅ pointer-events restauré sur input');
        }
    }
    
    if (sendBtn) {
        if (sendBtn.disabled) {
            issues.push('❌ Bouton Envoyer désactivé');
            sendBtn.disabled = false;
            fixes.push('✅ Bouton Envoyer réactivé');
        }
        if (sendBtn.style.pointerEvents === 'none') {
            issues.push('❌ Bouton avec pointer-events: none');
            sendBtn.style.pointerEvents = 'auto';
            fixes.push('✅ pointer-events restauré sur bouton');
        }
    }
    
    // 3. Vérifier le body
    const bodyStyle = window.getComputedStyle(document.body);
    if (bodyStyle.pointerEvents === 'none') {
        issues.push('❌ Body avec pointer-events: none - CRITIQUE');
        document.body.style.pointerEvents = 'auto';
        fixes.push('✅ pointer-events restauré sur body');
    }
    
    if (bodyStyle.overflow === 'hidden') {
        issues.push('⚠️ Body overflow: hidden (peut bloquer scroll)');
        document.body.style.overflow = 'auto';
        fixes.push('✅ Overflow restauré sur body');
    }
    
    // 4. Chercher éléments avec z-index très élevé
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
        const style = window.getComputedStyle(el);
        const zIndex = parseInt(style.zIndex) || 0;
        
        if (zIndex > 9999) {
            const isVisible = style.display !== 'none' && style.visibility !== 'hidden';
            if (isVisible) {
                issues.push(`⚠️ Élément avec z-index élevé (${zIndex}): ${el.tagName}#${el.id || el.className}`);
                // Ne pas corriger automatiquement, juste signaler
            }
        }
    });
    
    // 5. Vérifier si des panneaux sont ouverts
    const panels = ['functionsPanel', 'toolsPanel', 'settingsPanel', 'excelAiOverlay'];
    panels.forEach(panelId => {
        const panel = document.getElementById(panelId);
        if (panel) {
            const style = window.getComputedStyle(panel);
            if (style.display !== 'none' && style.right !== '-100%') {
                issues.push(`⚠️ Panneau ouvert: ${panelId}`);
                if (panelId === 'excelAiOverlay') {
                    panel.remove();
                    fixes.push(`✅ Panneau ${panelId} fermé`);
                } else {
                    panel.style.right = '-100%';
                    panel.style.display = 'none';
                    fixes.push(`✅ Panneau ${panelId} fermé`);
                }
            }
        }
    });
    
    // 6. Vérifier les event listeners problématiques
    const clickableElements = document.querySelectorAll('button, a, input, [onclick]');
    let blockedElements = 0;
    clickableElements.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.pointerEvents === 'none' && !el.disabled) {
            el.style.pointerEvents = 'auto';
            blockedElements++;
        }
    });
    if (blockedElements > 0) {
        issues.push(`⚠️ ${blockedElements} éléments cliquables bloqués`);
        fixes.push(`✅ ${blockedElements} éléments débloqués`);
    }
    
    // 7. Forcer le focus sur l'input
    if (userInput) {
        setTimeout(() => {
            userInput.focus();
            fixes.push('✅ Focus remis sur input principal');
        }, 100);
    }
    
    // RAPPORT
    console.log('═══════════════════════════════════════');
    console.log('📊 RAPPORT DE DIAGNOSTIC');
    console.log('═══════════════════════════════════════\n');
    
    if (issues.length === 0) {
        console.log('✅ AUCUN PROBLÈME DÉTECTÉ !');
        console.log('L\'interface devrait fonctionner normalement.\n');
    } else {
        console.log('🔴 PROBLÈMES DÉTECTÉS:\n');
        issues.forEach(issue => console.log(issue));
        console.log('\n');
    }
    
    if (fixes.length > 0) {
        console.log('🔧 CORRECTIONS APPLIQUÉES:\n');
        fixes.forEach(fix => console.log(fix));
        console.log('\n');
    }
    
    console.log('═══════════════════════════════════════');
    
    // Informations complémentaires
    console.log('\n📋 ÉTAT ACTUEL:');
    console.log('Input désactivé:', userInput?.disabled || false);
    console.log('Bouton désactivé:', sendBtn?.disabled || false);
    console.log('Body pointer-events:', bodyStyle.pointerEvents);
    console.log('Overlays visibles:', Array.from(overlays).filter(o => 
        window.getComputedStyle(o).display !== 'none'
    ).length);
    
    console.log('\n💡 Si le blocage persiste:');
    console.log('1. Appuyez sur Ctrl+Shift+R pour hard refresh');
    console.log('2. Testez en navigation privée (Ctrl+Shift+N)');
    console.log('3. Vérifiez les erreurs rouges dans cette console');
    console.log('4. Partagez les erreurs avec le développeur\n');
    
    // Notification visuelle
    if (fixes.length > 0) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #10B981, #059669);
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.3);
            z-index: 999999;
            font-family: system-ui, -apple-system, sans-serif;
            font-weight: 600;
            font-size: 14px;
            animation: slideInRight 0.3s ease;
        `;
        notification.innerHTML = `
            ✅ Interface débloquée !<br>
            <span style="font-size: 12px; font-weight: 400; opacity: 0.9;">
                ${fixes.length} correction(s) appliquée(s)
            </span>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }
    
    return {
        issues: issues,
        fixes: fixes,
        resolved: fixes.length > 0
    };
})();
