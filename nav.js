// nav.js (Versão Atualizada e Unificada com Carregamento de Tema e Imagem de Fundo)

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import {
    doc,
    getDoc,
    collection,
    query,
    where,
    onSnapshot,
    orderBy,
    limit,
    updateDoc,
    getDocs,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

/**
 * Aplica as cores e imagem de fundo do tema ao site.
 * @param {string} primaryColor - A cor principal.
 * @param {string} secondaryColor - A cor de fundo.
 * @param {string} backgroundImage - A URL da imagem de fundo ou 'none'.
 */
function applyTheme(primaryColor, secondaryColor, backgroundImage = 'none') {
    const root = document.documentElement;

    root.style.setProperty('--primary-color', primaryColor);

    if (backgroundImage && backgroundImage !== 'none') {
        // Se houver uma imagem de fundo
        root.style.setProperty('--secondary-color', secondaryColor); // Mantém a cor de fundo como fallback
        root.style.setProperty('--background-image', `url(${backgroundImage})`);
        root.style.setProperty('--background-size', 'cover');
        root.style.setProperty('--background-repeat', 'no-repeat');
        root.style.setProperty('--background-position', 'center center');
        root.style.setProperty('--background-attachment', 'fixed');
    } else {
        // Se NÃO houver imagem de fundo
        root.style.setProperty('--secondary-color', secondaryColor);
        root.style.setProperty('--background-image', 'none');
        root.style.setProperty('--background-size', 'auto');
        root.style.setProperty('--background-repeat', 'repeat');
        root.style.setProperty('--background-position', 'center center');
        root.style.setProperty('--background-attachment', 'scroll');
    }
}


/**
 * Carrega o tema salvo do Firestore para o usuário.
 * @param {string} uid - O UID do usuário.
 */
async function loadUserTheme(uid) {
    const userRef = doc(db, "users", uid);
    try {
        const docSnap = await getDoc(userRef);
        if (docSnap.exists() && docSnap.data().theme) {
            const { primary, secondary, backgroundImage } = docSnap.data().theme;
            applyTheme(primary, secondary, backgroundImage || 'none');
        } else {
            applyTheme('#4CAF50', '#f0f2f5', 'none');
        }
    } catch (error) {
        console.error("Erro ao carregar o tema do usuário:", error);
        applyTheme('#4CAF50', '#f0f2f5', 'none');
    }
}

/**
 * Função principal que cria o menu de navegação e inicializa suas funcionalidades.
 */
function loadNavAndProfile() {
    const navPlaceholder = document.getElementById('nav-placeholder');
    if (!navPlaceholder) {
        console.error('Elemento com id="nav-placeholder" não encontrado.');
        return;
    }

    const navHTML = `
    <nav>
        <div class="nav-mobile-header-bar">
            <button id="mobile-menu-toggle" class="mobile-toggle-btn">
                <i class="fa-solid fa-bars"></i>
            </button>
            <li id="mobile-nav-login-btn" class="nav-auth-item" style="display: none;">
                <a href="login.html" class="btn-login-nav"><i class="fa-solid fa-right-to-bracket"></i> Entrar</a>
            </li>
            <li class="profile-menu-container nav-auth-item" id="mobile-profile-container" style="display: none;">
                <div class="profile-menu-toggle" id="mobile-profile-toggle">
                    <img id="mobile-nav-profile-pic" src="https://via.placeholder.com/150" alt="Foto do Perfil" class="nav-avatar">
                </div>
                <ul class="profile-submenu" id="mobile-profile-submenu">
                    <li class="submenu-profile-item">
                        <div class="submenu-profile-header">
                            <img id="mobile-submenu-profile-pic" src="https://via.placeholder.com/150" alt="Foto do Perfil" class="submenu-profile-pic">
                            <div class="submenu-profile-info">
                                <h4 id="mobile-submenu-fullname">Carregando...</h4>
                                <p id="mobile-submenu-email">email@example.com</p>
                                <p id="mobile-submenu-username" class="submenu-username-display">@username</p>
                            </div>
                        </div>
                    </li>
                    <li><a href="public-profile.html"><i class="fa-solid fa-eye"></i> Ver Perfil Público</a></li>
                    <li><a href="profile.html"><i class="fa-solid fa-user-pen"></i> Editar Perfil</a></li>
                    <li><a href="settings.html"><i class="fa-solid fa-cog"></i> Configurações</a></li>
                    <li><a href="#" id="mobile-logout-btn"><i class="fa-solid fa-right-from-bracket"></i> Sair</a></li>
                </ul>
            </li>
        </div>
        <ul id="main-nav-list" class="nav-links">
            <li><a href="./index.html"><i class="fa-solid fa-house"></i> Início</a></li>
            <li><a href="pomodoro.html"><i class="fa-solid fa-clock"></i> Pomodoro</a></li>
            <li><a href="feed.html"><i class="fa-solid fa-stream"></i> Feed</a></li>
            <li><a href="notifications.html"><i class="fa-solid fa-bell"></i> Notificações</a></li>
            <li><a href="friends.html"><i class="fa-solid fa-users"></i> Amigos</a></li>
            <li><a href="#"><i class="fa-solid fa-circle-info"></i> Sobre</a></li>
            <li id="nav-login-btn" class="nav-auth-item" style="display: none;">
                <a href="login.html" class="btn-login-nav"><i class="fa-solid fa-right-to-bracket"></i> Entrar</a>
            </li>
            <li class="notification-bell-container nav-auth-item" id="desktop-notification-container" style="display: none;">
                <button id="notification-bell-btn">
                    <i class="fa-solid fa-bell"></i>
                    <span id="notification-badge"></span>
                </button>
                <div class="notifications-submenu" id="desktop-notifications-submenu">
                    <div class="notifications-submenu-header"><h3>Notificações</h3></div>
                    <ul class="notifications-submenu-list" id="desktop-notifications-list"></ul>
                    <div class="notifications-submenu-footer"><a href="notifications.html">Ver todas as notificações</a></div>
                </div>
            </li>
            <li class="profile-menu-container nav-auth-item" id="desktop-profile-container" style="display: none;">
                <div class="profile-menu-toggle" id="desktop-profile-toggle">
                    <img id="nav-profile-pic" src="https://via.placeholder.com/150" alt="Foto do Perfil" class="nav-avatar">
                </div>
                <ul class="profile-submenu" id="desktop-profile-submenu">
                    <li class="submenu-profile-item">
                        <div class="submenu-profile-header">
                            <img id="submenu-profile-pic" src="https://via.placeholder.com/150" alt="Foto do Perfil" class="submenu-profile-pic">
                            <div class="submenu-profile-info">
                                <h4 id="submenu-fullname">Carregando...</h4>
                                <p id="submenu-email">email@example.com</p>
                                <p id="submenu-username" class="submenu-username-display">@username</p>
                            </div>
                        </div>
                    </li>
                    <li><a href="public-profile.html"><i class="fa-solid fa-eye"></i> Ver Perfil Público</a></li>
                    <li><a href="profile.html"><i class="fa-solid fa-user-pen"></i> Editar Perfil</a></li>
                    <li><a href="settings.html"><i class="fa-solid fa-cog"></i> Configurações</a></li>
                    <li><a href="#" id="logout-btn-submenu"><i class="fa-solid fa-right-from-bracket"></i> Sair</a></li>
                </ul>
            </li>
        </ul>
    </nav>
    `;

    navPlaceholder.innerHTML = navHTML;

    // Lógica de Autenticação e Perfil
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Usuário está LOGADO
            loadUserTheme(user.uid);

            document.getElementById('desktop-profile-container').style.display = 'list-item';
            document.getElementById('desktop-notification-container').style.display = 'list-item';
            document.getElementById('nav-login-btn').style.display = 'none';
            document.getElementById('mobile-profile-container').style.display = 'list-item';
            document.getElementById('mobile-nav-login-btn').style.display = 'none';

            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            const placeholder = "https://via.placeholder.com/150";
            let photoURL = user.photoURL || placeholder;
            let fullname = user.displayName || "Usuário";
            let email = user.email || "";
            let username = "";

            if (docSnap.exists()) {
                const data = docSnap.data();
                photoURL = data.fotoURL || photoURL;
                fullname = data.fullname || fullname;
                username = data.username ? `@${data.username}` : "";
            }
            
            document.getElementById('nav-profile-pic').src = photoURL;
            document.getElementById('mobile-nav-profile-pic').src = photoURL;
            
            document.getElementById('submenu-profile-pic').src = photoURL;
            document.getElementById('submenu-fullname').textContent = fullname;
            document.getElementById('submenu-email').textContent = email;
            document.getElementById('submenu-username').textContent = username;

            document.getElementById('mobile-submenu-profile-pic').src = photoURL;
            document.getElementById('mobile-submenu-fullname').textContent = fullname;
            document.getElementById('mobile-submenu-email').textContent = email;
            document.getElementById('mobile-submenu-username').textContent = username;

            setupNotificationListeners(user.uid, document.getElementById('notification-badge'), document.getElementById('desktop-notifications-list'));

        } else {
            // Usuário está DESLOGADO
            applyTheme('#4CAF50', '#f0f2f5', 'none');
            document.getElementById('desktop-profile-container').style.display = 'none';
            document.getElementById('desktop-notification-container').style.display = 'none';
            document.getElementById('nav-login-btn').style.display = 'list-item';
            document.getElementById('mobile-profile-container').style.display = 'none';
            document.getElementById('mobile-nav-login-btn').style.display = 'list-item';
        }
    });

    // Lógica de Logout
    async function handleLogout(e) {
        e.preventDefault();
        try {
            await signOut(auth);
            window.location.href = 'index.html';
        } catch (err) {
            console.error('Erro ao fazer signOut:', err);
        }
    }
    document.getElementById('logout-btn-submenu').addEventListener('click', handleLogout);
    document.getElementById('mobile-logout-btn').addEventListener('click', handleLogout);

    setupMenuControls();
    setActiveLink();
}

/**
 * Configura os listeners para os menus de perfil e notificações.
 */
function setupMenuControls() {
    const desktopProfileToggle = document.getElementById("desktop-profile-toggle");
    const desktopProfileSubmenu = document.getElementById("desktop-profile-submenu");
    const mobileProfileToggle = document.getElementById("mobile-profile-toggle");
    const mobileProfileSubmenu = document.getElementById("mobile-profile-submenu");
    const notificationBellBtn = document.getElementById('notification-bell-btn');
    const notificationsSubmenu = document.getElementById('desktop-notifications-submenu');

    if (desktopProfileToggle) {
        desktopProfileToggle.addEventListener("click", (e) => {
            e.stopPropagation();
            desktopProfileSubmenu.classList.toggle("active");
            if (notificationsSubmenu) notificationsSubmenu.classList.remove("active");
        });
    }

    if (mobileProfileToggle) {
        mobileProfileToggle.addEventListener("click", (e) => {
            e.stopPropagation();
            mobileProfileSubmenu.classList.toggle("active");
        });
    }

    if (notificationBellBtn) {
        notificationBellBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notificationsSubmenu.classList.toggle('active');
            if (desktopProfileSubmenu) desktopProfileSubmenu.classList.remove("active");
        });
    }
    
    document.addEventListener("click", (e) => {
        if (desktopProfileSubmenu && !desktopProfileToggle.contains(e.target)) {
            desktopProfileSubmenu.classList.remove("active");
        }
        if (mobileProfileSubmenu && !mobileProfileToggle.contains(e.target)) {
            mobileProfileSubmenu.classList.remove("active");
        }
        if (notificationsSubmenu && !notificationBellBtn.contains(e.target) && !notificationsSubmenu.contains(e.target)) {
            notificationsSubmenu.classList.remove("active");
        }
    });
}

/**
 * Configura os listeners do Firestore para notificações.
 */
function setupNotificationListeners(uid, badge, list) {
    if (!badge || !list) return;

    const unreadQuery = query(collection(db, "users", uid, "notifications"), where("read", "==", false));
    onSnapshot(unreadQuery, (snapshot) => {
        badge.textContent = snapshot.size;
        badge.style.display = snapshot.size > 0 ? 'block' : 'none';
    });

    const recentQuery = query(collection(db, "users", uid, "notifications"), orderBy('timestamp', 'desc'), limit(5));
    onSnapshot(recentQuery, (snapshot) => {
        list.innerHTML = '';
        if (snapshot.empty) {
            list.innerHTML = `<li class="notification-item empty">Nenhuma notificação recente.</li>`;
        } else {
            snapshot.forEach(doc => {
                const data = doc.data();
                const li = document.createElement('li');
                li.className = `notification-item ${data.read ? 'read' : 'unread'}`;
                li.innerHTML = `
                    <div class="notification-icon"><i class="fa ${getNotificationIcon(data.type)}"></i></div>
                    <div class="notification-content"><p>${data.message}</p></div>
                `;
                li.addEventListener('click', async () => {
                    if (!data.read) await updateDoc(doc.ref, { read: true });
                    if (data.url) window.location.href = data.url;
                });
                list.appendChild(li);
            });
        }
    });
}

/**
 * Retorna a classe do ícone com base no tipo de notificação.
 */
function getNotificationIcon(type) {
    switch (type) {
        case 'friend_request': return 'fa-user-plus';
        case 'like': return 'fa-heart';
        case 'comment': return 'fa-comment';
        case 'task_import_request': return 'fa-download';
        default: return 'fa-bell';
    }
}

/**
 * Adiciona a classe 'active' ao link da página atual no menu.
 */
function setActiveLink() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('#main-nav-list a').forEach(link => {
        const linkPage = link.getAttribute('href').split('/').pop() || 'index.html';
        link.classList.toggle('active', linkPage === currentPage);
    });
}

// Inicia o processo quando o DOM estiver pronto.
document.addEventListener('DOMContentLoaded', loadNavAndProfile);