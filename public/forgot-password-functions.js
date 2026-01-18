// Fonctions pour la réinitialisation du mot de passe (via API + email)

let __forgotPasswordCodeRequested = false;

function showForgotPasswordModal() {
    closeSigninModal();
    const modal = document.getElementById('forgotPasswordModal');
    modal.classList.add('show');

    __forgotPasswordCodeRequested = false;
    const codeGroup = document.getElementById('forgotPasswordCodeGroup');
    if (codeGroup) codeGroup.style.display = 'none';
    const emailInput = document.getElementById('forgotPasswordEmail');
    if (emailInput) emailInput.disabled = false;
    const submitBtn = document.getElementById('forgotPasswordSubmitBtn');
    if (submitBtn) submitBtn.textContent = 'Envoyer le code';
    
    setTimeout(() => {
        document.getElementById('forgotPasswordEmail').focus();
    }, 100);
}

function closeForgotPasswordModal() {
    const modal = document.getElementById('forgotPasswordModal');
    modal.classList.remove('show');
    document.getElementById('forgotPasswordForm').reset();

    __forgotPasswordCodeRequested = false;
    const codeGroup = document.getElementById('forgotPasswordCodeGroup');
    if (codeGroup) codeGroup.style.display = 'none';
    const emailInput = document.getElementById('forgotPasswordEmail');
    if (emailInput) emailInput.disabled = false;
    const submitBtn = document.getElementById('forgotPasswordSubmitBtn');
    if (submitBtn) submitBtn.textContent = 'Envoyer le code';
}

async function handleForgotPassword(event) {
    event.preventDefault();
    
    const email = document.getElementById('forgotPasswordEmail').value.trim().toLowerCase();
    const code = (document.getElementById('forgotPasswordCode')?.value || '').trim();
    const newPassword = document.getElementById('forgotPasswordNew').value;
    
    // Validation du mot de passe
    if (newPassword.length < 6) {
        showToast('❌ Le mot de passe doit contenir au moins 6 caractères', 'error');
        return;
    }
    
    try {
        const submitBtn = document.getElementById('forgotPasswordSubmitBtn');
        if (submitBtn) submitBtn.textContent = 'Traitement...';

        if (!__forgotPasswordCodeRequested) {
            // Étape 1: demander un code par email
            const resp = await fetch('/api/auth-request-password-reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await resp.json().catch(() => ({}));
            if (!resp.ok) {
                throw new Error(data?.error || `HTTP ${resp.status}`);
            }

            __forgotPasswordCodeRequested = true;

            const codeGroup = document.getElementById('forgotPasswordCodeGroup');
            if (codeGroup) codeGroup.style.display = 'block';
            const emailInput = document.getElementById('forgotPasswordEmail');
            if (emailInput) emailInput.disabled = true;
            const codeInput = document.getElementById('forgotPasswordCode');
            if (codeInput) {
                codeInput.value = '';
                codeInput.focus();
            }

            showToast('📩 Code envoyé (si le compte existe). Entrez-le pour finaliser.', 'success');
            if (submitBtn) submitBtn.textContent = 'Réinitialiser le mot de passe';
            return;
        }

        // Étape 2: valider le code + changer le mot de passe
        if (!code || !/^[0-9]{6}$/.test(code)) {
            showToast('❌ Code invalide (6 chiffres)', 'error');
            if (submitBtn) submitBtn.textContent = 'Réinitialiser le mot de passe';
            return;
        }

        const resp = await fetch('/api/auth-reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code, newPassword })
        });

        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            throw new Error(data?.error || `HTTP ${resp.status}`);
        }

        closeForgotPasswordModal();
        showToast('✅ Mot de passe modifié. Vous pouvez vous connecter.', 'success');
        showSignin();
    } catch (err) {
        showToast(`❌ ${err?.message || 'Erreur lors de la réinitialisation'}`, 'error');
        const submitBtn = document.getElementById('forgotPasswordSubmitBtn');
        if (submitBtn) submitBtn.textContent = __forgotPasswordCodeRequested ? 'Réinitialiser le mot de passe' : 'Envoyer le code';
    }
}
