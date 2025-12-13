// Fonctions pour la réinitialisation du mot de passe (100% local, sans email)

function showForgotPasswordModal() {
    closeSigninModal();
    const modal = document.getElementById('forgotPasswordModal');
    modal.classList.add('show');
    
    setTimeout(() => {
        document.getElementById('forgotPasswordEmail').focus();
    }, 100);
}

function closeForgotPasswordModal() {
    const modal = document.getElementById('forgotPasswordModal');
    modal.classList.remove('show');
    document.getElementById('forgotPasswordForm').reset();
}

function handleForgotPassword(event) {
    event.preventDefault();
    
    const email = document.getElementById('forgotPasswordEmail').value.trim().toLowerCase();
    const newPassword = document.getElementById('forgotPasswordNew').value;
    
    // Validation du mot de passe
    if (newPassword.length < 6) {
        showToast('❌ Le mot de passe doit contenir au moins 6 caractères', 'error');
        return;
    }
    
    // Vérifier si l'utilisateur existe
    const user = users.find(u => u.email === email);
    
    if (!user) {
        showToast('❌ Aucun compte avec cet email. Veuillez vous enregistrer.', 'error');
        return;
    }
    
    // Mettre à jour le mot de passe
    user.password = newPassword;
    localStorage.setItem('users', JSON.stringify(users));
    
    // Succès
    closeForgotPasswordModal();
    showToast('✅ Mot de passe modifié avec succès ! Vous pouvez vous connecter.', 'success');
    showSignin();
}
