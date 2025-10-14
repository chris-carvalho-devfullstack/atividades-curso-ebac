// nav-profile.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// Elementos do Menu
const navProfilePic = document.getElementById('nav-profile-pic');
const navProfileName = document.getElementById('nav-profile-name');
const logoutBtnSubmenu = document.getElementById('logout-btn-submenu');
const profileMenu = document.querySelector('.profile-menu-container');
const loginBtn = document.getElementById('nav-login-btn');
const profileMenuToggle = document.querySelector('.profile-menu-toggle'); // <-- NOVO

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // --- Usuário está LOGADO ---
        if(profileMenu) profileMenu.style.display = 'list-item';
        if(loginBtn) loginBtn.style.display = 'none';

        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            navProfileName.textContent = data.username || user.displayName || "Usuário";
            navProfilePic.src = data.fotoURL || "https://via.placeholder.com/150";
        } else {
            navProfileName.textContent = user.displayName || "Usuário";
            navProfilePic.src = user.photoURL || "https://via.placeholder.com/150";
        }

    } else {
        // --- Usuário está DESLOGADO ---
        if(profileMenu) profileMenu.style.display = 'none';
        if(loginBtn) loginBtn.style.display = 'list-item';
    }
});

// Lógica de Logout no botão do submenu
if(logoutBtnSubmenu) {
    logoutBtnSubmenu.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await signOut(auth);
            window.location.href = 'login.html';
        } catch (err) {
            console.error('Erro ao fazer signOut:', err);
        }
    });
}

// ===========================
// LÓGICA DE CLIQUE PARA O SUBMENU (NOVO)
// ===========================
if (profileMenuToggle) {
    profileMenuToggle.addEventListener('click', (e) => {
        // Impede que o clique no documento (abaixo) seja acionado
        e.stopPropagation(); 
        // Adiciona ou remove a classe que mostra/esconde o menu
        profileMenu.classList.toggle('is-open');
    });
}

// Fecha o menu se o usuário clicar fora dele
document.addEventListener('click', () => {
    if (profileMenu && profileMenu.classList.contains('is-open')) {
        profileMenu.classList.remove('is-open');
    }
});