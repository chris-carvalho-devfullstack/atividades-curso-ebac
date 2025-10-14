// nav-profile.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// Elementos do Menu DESKTOP/MENU MOBILE EXPANDIDO (contêm o submenu)
const navProfilePic = document.getElementById('nav-profile-pic'); // Desktop Pic
const navProfileName = document.getElementById('nav-profile-name'); // Desktop Name
const logoutBtnSubmenu = document.getElementById('logout-btn-submenu');
const desktopProfileMenu = document.getElementById('desktop-profile-container'); // Container do perfil com submenu (dentro da UL principal)
const desktopLoginBtn = document.getElementById('nav-login-btn'); // Botão Login (dentro da UL principal)
const desktopProfileToggle = document.querySelector('#desktop-profile-container .profile-menu-toggle'); // Botão de clique para abrir o submenu (Desktop)

// Elementos MOBILE FLOATING BAR (Ícones flutuantes na barra verde)
const mobileProfileMenu = document.getElementById('mobile-profile-container'); // Container do ícone flutuante do perfil
const mobileLoginBtn = document.getElementById('mobile-nav-login-btn'); // Botão Login flutuante
const mobileNavProfilePic = document.getElementById('mobile-nav-profile-pic'); // Imagem de perfil flutuante

// Elementos do Menu Hamburger
const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
const mainNavList = document.getElementById('main-nav-list'); // UL principal


onAuthStateChanged(auth, async (user) => {
    if (user) {
        // --- Usuário está LOGADO ---
        
        // VISIBILIDADE AUTH DESKTOP/MENU:
        if(desktopProfileMenu) desktopProfileMenu.style.display = 'list-item'; 
        if(desktopLoginBtn) desktopLoginBtn.style.display = 'none';

        // VISIBILIDADE AUTH MOBILE FLUTUANTE:
        if(mobileProfileMenu) mobileProfileMenu.style.display = 'block'; 
        if(mobileLoginBtn) mobileLoginBtn.style.display = 'none'; 
        
        // CARREGAMENTO DE DADOS:
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        const placeholder = "https://via.placeholder.com/150";

        if (docSnap.exists()) {
            const data = docSnap.data();
            const photoURL = data.fotoURL || placeholder;
            const username = data.username || user.displayName || "Usuário";
            
            // Desktop/Menu
            if (navProfileName) navProfileName.textContent = username;
            if (navProfilePic) navProfilePic.src = photoURL;
            
            // Mobile Floating
            if (mobileNavProfilePic) mobileNavProfilePic.src = photoURL;
        } else {
            const photoURL = user.photoURL || placeholder;
            const username = user.displayName || "Usuário";

            // Desktop/Menu
            if (navProfileName) navProfileName.textContent = username;
            if (navProfilePic) navProfilePic.src = photoURL;
            
            // Mobile Floating
            if (mobileNavProfilePic) mobileNavProfilePic.src = photoURL;
        }

    } else {
        // --- Usuário está DESLOGADO ---
        
        // VISIBILIDADE AUTH DESKTOP/MENU:
        if(desktopProfileMenu) desktopProfileMenu.style.display = 'none';
        if(desktopLoginBtn) desktopLoginBtn.style.display = 'list-item';

        // VISIBILIDADE AUTH MOBILE FLUTUANTE:
        if(mobileProfileMenu) mobileProfileMenu.style.display = 'none';
        if(mobileLoginBtn) mobileLoginBtn.style.display = 'block';
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

// ===========================================
// LÓGICA DE CLIQUE PARA O SUBMENU (Desktop/Menu Mobile Expandido)
// ===========================================
if (desktopProfileToggle && desktopProfileMenu) {
    desktopProfileToggle.addEventListener('click', (e) => {
        e.stopPropagation(); 
        
        // ABRIR SUBMENU DE PERFIL
        desktopProfileMenu.classList.toggle('is-open');
    });
}

// =============================================================
// LÓGICA DE CLIQUE PARA O SUBMENU (Mobile FLUTUANTE) - CORRIGIDA
// =============================================================
if (mobileProfileMenu && desktopProfileMenu && mainNavList) {
    mobileProfileMenu.addEventListener('click', (e) => {
        // CORRIGIDO: Esta lógica só deve ser executada se for uma tela pequena (mobile)
        if (window.innerWidth <= 700) {
            e.stopPropagation(); 
            
            // 1. Toggles o menu principal (abre o hamburger)
            mainNavList.classList.toggle('mobile-open');

            // 2. Toggles o submenu de perfil *dentro* do menu principal (garante que o submenu abra)
            // Usa o mesmo estado do menu principal para garantir a sincronia
            desktopProfileMenu.classList.toggle('is-open', mainNavList.classList.contains('mobile-open'));
        }
    });
}


// Fecha o menu se o usuário clicar fora dele (CORRIGIDO PARA O DESKTOP)
document.addEventListener('click', (e) => {
    
    // 1. Lógica para fechar o Submenu de Perfil (Desktop)
    if (desktopProfileMenu && desktopProfileMenu.classList.contains('is-open')) {
        
        // Verifica se o clique ocorreu fora do elemento do menu (e de seu toggle)
        // Isso evita que ele feche imediatamente após o clique de abertura.
        if (!desktopProfileMenu.contains(e.target)) {
            desktopProfileMenu.classList.remove('is-open');
        }
    }
    
    // 2. Lógica para fechar o Menu Hamburger principal
    if (mainNavList && mainNavList.classList.contains('mobile-open') && window.innerWidth <= 700) {
        
        // CUIDADO: O clique no ícone de perfil flutuante (mobileProfileMenu) abre o menu.
        // Se o clique for fora da UL, fora do hamburger E fora do ícone flutuante:
        const isClickOutsideMobileMenu = !mainNavList.contains(e.target) 
                                        && !mobileMenuToggle.contains(e.target) 
                                        && !mobileProfileMenu.contains(e.target);
        
        if (isClickOutsideMobileMenu) {
             mainNavList.classList.remove('mobile-open');
             
             // Fecha o submenu de perfil
             if (desktopProfileMenu) {
                 desktopProfileMenu.classList.remove('is-open');
             }
        }
    }
});

// ===========================================
// LÓGICA DE CLIQUE PARA O HAMBURGER (Mobile)
// ===========================================
if (mobileMenuToggle && mainNavList) {
    mobileMenuToggle.addEventListener('click', () => {
        mainNavList.classList.toggle('mobile-open');
        
        // Quando o hamburger fecha, garante que o submenu também feche
        if (!mainNavList.classList.contains('mobile-open') && desktopProfileMenu) {
             desktopProfileMenu.classList.remove('is-open');
        }
    });
}