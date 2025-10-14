// nav-profile.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

const navProfilePic = document.getElementById('nav-profile-pic');
const navProfileName = document.getElementById('nav-profile-name');
const logoutBtnSubmenu = document.getElementById('logout-btn-submenu');

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Usuário está logado, busca dados do perfil
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            navProfileName.textContent = data.username || user.displayName || "Usuário";
            navProfilePic.src = data.fotoURL || "https://via.placeholder.com/150";
        } else {
            // Fallback se não houver perfil no Firestore
            navProfileName.textContent = user.displayName || "Usuário";
            navProfilePic.src = user.photoURL || "https://via.placeholder.com/150";
        }

    } else {
        // Usuário não está logado, esconde o menu de perfil se necessário
        const profileMenu = document.querySelector('.profile-menu-container');
        if(profileMenu) profileMenu.style.display = 'none';
    }
});

// Lógica de Logout
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