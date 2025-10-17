// nav-profile.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// --- Elementos Comuns ---
const navProfilePic = document.getElementById('nav-profile-pic');
const navProfileName = document.getElementById('nav-profile-name');
const mobileNavProfilePic = document.getElementById('mobile-nav-profile-pic');

// --- Elementos de Autenticação (Visibilidade) ---
const desktopProfileContainer = document.getElementById('desktop-profile-container');
const desktopLoginBtn = document.getElementById('nav-login-btn');
const mobileProfileContainer = document.getElementById('mobile-profile-container');
const mobileLoginBtn = document.getElementById('mobile-nav-login-btn');

// --- Elementos de Logout ---
const logoutBtnSubmenu = document.getElementById('logout-btn-submenu');
const mobileLogoutBtn = document.getElementById('mobile-logout-btn');


onAuthStateChanged(auth, async (user) => {
    if (user) {
        // --- Usuário está LOGADO ---
        
        // VISIBILIDADE AUTH: Mostra perfil, esconde login
        if(desktopProfileContainer) desktopProfileContainer.style.display = 'list-item'; 
        if(desktopLoginBtn) desktopLoginBtn.style.display = 'none';
        if(mobileProfileContainer) mobileProfileContainer.style.display = 'list-item'; 
        if(mobileLoginBtn) mobileLoginBtn.style.display = 'none'; 
        
        // CARREGAMENTO DE DADOS:
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        const placeholder = "https://via.placeholder.com/150";

        if (docSnap.exists()) {
            const data = docSnap.data();
            const photoURL = data.fotoURL || placeholder;
            const username = data.username || user.displayName || "Usuário";
            
            if (navProfileName) navProfileName.textContent = username;
            if (navProfilePic) navProfilePic.src = photoURL;
            if (mobileNavProfilePic) mobileNavProfilePic.src = photoURL;

        } else {
            const photoURL = user.photoURL || placeholder;
            const username = user.displayName || "Usuário";

            if (navProfileName) navProfileName.textContent = username;
            if (navProfilePic) navProfilePic.src = photoURL;
            if (mobileNavProfilePic) mobileNavProfilePic.src = photoURL;
        }

    } else {
        // --- Usuário está DESLOGADO ---
        
        // VISIBILIDADE AUTH: Esconde perfil, mostra login
        if(desktopProfileContainer) desktopProfileContainer.style.display = 'none';
        if(desktopLoginBtn) desktopLoginBtn.style.display = 'list-item';
        if(mobileProfileContainer) mobileProfileContainer.style.display = 'none';
        if(mobileLoginBtn) mobileLoginBtn.style.display = 'list-item';
    }
});


// --- LÓGICA DE LOGOUT ---
async function handleLogout(e) {
    e.preventDefault();
    try {
        await signOut(auth);
        // CORREÇÃO: Redireciona para a página inicial após o logout
        window.location.href = 'index.html';
    } catch (err) {
        console.error('Erro ao fazer signOut:', err);
    }
}

if (logoutBtnSubmenu) {
    logoutBtnSubmenu.addEventListener('click', handleLogout);
}
if (mobileLogoutBtn) {
    mobileLogoutBtn.addEventListener('click', handleLogout);
}


// --- LÓGICA DE CONTROLE DOS MENUS ---

// PERFIL DESKTOP
const desktopProfileToggle = document.getElementById("desktop-profile-toggle");
const desktopProfileSubmenu = document.getElementById("desktop-profile-submenu");

if (desktopProfileToggle && desktopProfileSubmenu) {
    desktopProfileToggle.addEventListener("click", (e) => {
        e.stopPropagation(); // Impede que o clique feche o menu imediatamente
        desktopProfileSubmenu.classList.toggle("active");
    });
}

// PERFIL MOBILE
const mobileProfileToggle = document.getElementById("mobile-profile-toggle");
const mobileProfileSubmenu = document.getElementById("mobile-profile-submenu");

if (mobileProfileToggle && mobileProfileSubmenu) {
    mobileProfileToggle.addEventListener("click", (e) => {
        e.stopPropagation(); // Impede que o clique feche o menu imediatamente
        mobileProfileSubmenu.classList.toggle("active");
    });
}

// FECHAR MENUS AO CLICAR FORA
document.addEventListener("click", (e) => {
    // Fecha submenu desktop se o clique for fora dele
    if (desktopProfileSubmenu && desktopProfileSubmenu.classList.contains("active")) {
        if (!desktopProfileToggle.contains(e.target)) {
            desktopProfileSubmenu.classList.remove("active");
        }
    }
    
    // Fecha submenu mobile se o clique for fora dele
    if (mobileProfileSubmenu && mobileProfileSubmenu.classList.contains("active")) {
        if (!mobileProfileToggle.contains(e.target)) {
            mobileProfileSubmenu.classList.remove("active");
        }
    }
});