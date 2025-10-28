// nav.js (Versão Atualizada com Listener Firestore para Toasts)

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
// Funções do Firestore necessárias para ambos os listeners (badge/dropdown e toast)
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
    writeBatch,
    Timestamp // Importa Timestamp para a query do listener de toast
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
// Importa a função do toast
import { showToastNotification } from './toast-notification.js';

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
        root.style.setProperty('--secondary-color', secondaryColor); // Fallback
        root.style.setProperty('--background-image', `url(${backgroundImage})`);
        root.style.setProperty('--background-size', 'cover');
        root.style.setProperty('--background-repeat', 'no-repeat');
        root.style.setProperty('--background-position', 'center center');
        root.style.setProperty('--background-attachment', 'fixed');
    } else {
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
            applyTheme('#4CAF50', '#f0f2f5', 'none'); // Padrão
        }
    } catch (error) {
        console.error("Erro ao carregar o tema do usuário:", error);
        applyTheme('#4CAF50', '#f0f2f5', 'none'); // Padrão em caso de erro
    }
}

// --- Variáveis globais no escopo do nav.js para controlar os listeners ---
let unsubscribeBadgeListener = null;
let unsubscribeDropdownListener = null;
let unsubscribeToastListener = null;
let lastToastTimestamp = null; // Para evitar toasts antigos ao carregar a página
// -------------------------------------------------------------------------

/**
 * Função principal que cria o menu de navegação e inicializa suas funcionalidades.
 */
function loadNavAndProfile() {
    const navPlaceholder = document.getElementById('nav-placeholder');
    if (!navPlaceholder) {
        console.error('Elemento com id="nav-placeholder" não encontrado.');
        return;
    }

    // O HTML da navegação permanece o mesmo que você já tem
    const navHTML = `
    <nav>
        <div class="nav-mobile-header-bar">
            <button id="mobile-menu-toggle" class="mobile-toggle-btn"><i class="fa-solid fa-bars"></i></button>
            <li id="mobile-nav-login-btn" class="nav-auth-item" style="display: none;"><a href="login.html" class="btn-login-nav"><i class="fa-solid fa-right-to-bracket"></i> Entrar</a></li>
            <li class="profile-menu-container nav-auth-item" id="mobile-profile-container" style="display: none;">
                <div class="profile-menu-toggle" id="mobile-profile-toggle"><img id="mobile-nav-profile-pic" src="https://via.placeholder.com/150" alt="Foto do Perfil" class="nav-avatar"></div>
                <ul class="profile-submenu" id="mobile-profile-submenu">
                    <li class="submenu-profile-item"><div class="submenu-profile-header"><img id="mobile-submenu-profile-pic" src="https://via.placeholder.com/150" alt="Foto" class="submenu-profile-pic"><div class="submenu-profile-info"><h4 id="mobile-submenu-fullname">Carregando...</h4><p id="mobile-submenu-email"></p><p id="mobile-submenu-username" class="submenu-username-display"></p></div></div></li>
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
            <li id="nav-login-btn" class="nav-auth-item" style="display: none;"><a href="login.html" class="btn-login-nav"><i class="fa-solid fa-right-to-bracket"></i> Entrar</a></li>
            <li class="notification-bell-container nav-auth-item" id="desktop-notification-container" style="display: none;">
                <button id="notification-bell-btn"><i class="fa-solid fa-bell"></i><span id="notification-badge"></span></button>
                <div class="notifications-submenu" id="desktop-notifications-submenu"><div class="notifications-submenu-header"><h3>Notificações</h3></div><ul class="notifications-submenu-list" id="desktop-notifications-list"></ul><div class="notifications-submenu-footer"><a href="notifications.html">Ver todas</a></div></div>
            </li>
            <li class="profile-menu-container nav-auth-item" id="desktop-profile-container" style="display: none;">
                <div class="profile-menu-toggle" id="desktop-profile-toggle"><img id="nav-profile-pic" src="https://via.placeholder.com/150" alt="Foto" class="nav-avatar"></div>
                <ul class="profile-submenu" id="desktop-profile-submenu">
                     <li class="submenu-profile-item"><div class="submenu-profile-header"><img id="submenu-profile-pic" src="https://via.placeholder.com/150" alt="Foto" class="submenu-profile-pic"><div class="submenu-profile-info"><h4 id="submenu-fullname">Carregando...</h4><p id="submenu-email"></p><p id="submenu-username" class="submenu-username-display"></p></div></div></li>
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

    // --- LÓGICA DE AUTENTICAÇÃO ---
    onAuthStateChanged(auth, async (user) => {
        // Limpa TODOS os listeners anteriores ao mudar o estado de autenticação
        if (unsubscribeBadgeListener) unsubscribeBadgeListener();
        if (unsubscribeDropdownListener) unsubscribeDropdownListener();
        if (unsubscribeToastListener) unsubscribeToastListener();
        unsubscribeBadgeListener = null;
        unsubscribeDropdownListener = null;
        unsubscribeToastListener = null;
        lastToastTimestamp = null; // Reseta o timestamp do toast

        if (user) {
            // --- Usuário está LOGADO ---
            const currentUserUid = user.uid;
            console.log("Usuário logado, configurando UI e listeners...");

            loadUserTheme(currentUserUid);

            // Mostra/Esconde elementos de UI
            document.getElementById('desktop-profile-container').style.display = 'list-item';
            document.getElementById('desktop-notification-container').style.display = 'list-item';
            document.getElementById('nav-login-btn').style.display = 'none';
            document.getElementById('mobile-profile-container').style.display = 'list-item';
            document.getElementById('mobile-nav-login-btn').style.display = 'none';

            // Carrega dados do perfil
            const docRef = doc(db, "users", currentUserUid);
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

            // Atualiza a UI com os dados do perfil
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

            // Configura os listeners de notificação (Badge, Dropdown e Toast)
            setupNotificationListeners(currentUserUid,
                document.getElementById('notification-badge'),
                document.getElementById('desktop-notifications-list')
            );
            setupToastListener(currentUserUid); // Chama a nova função para o listener do toast

        } else {
            // --- Usuário está DESLOGADO ---
            console.log("Usuário deslogado, limpando UI.");
            applyTheme('#4CAF50', '#f0f2f5', 'none'); // Aplica tema padrão
            // Mostra/Esconde elementos de UI
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
            window.location.href = 'index.html'; // Redireciona para o início após sair
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
 * Configura os listeners para os menus de perfil e notificações (dropdown).
 */
function setupMenuControls() {
    const desktopProfileToggle = document.getElementById("desktop-profile-toggle");
    const desktopProfileSubmenu = document.getElementById("desktop-profile-submenu");
    const mobileProfileToggle = document.getElementById("mobile-profile-toggle");
    const mobileProfileSubmenu = document.getElementById("mobile-profile-submenu");
    const notificationBellBtn = document.getElementById('notification-bell-btn');
    const notificationsSubmenu = document.getElementById('desktop-notifications-submenu');
    const mobileMenuToggle = document.getElementById("mobile-menu-toggle"); // Botão de menu mobile
    const mainNavList = document.getElementById("main-nav-list"); // Lista de links principal

    // Menu Mobile
    if (mobileMenuToggle && mainNavList) {
        mobileMenuToggle.addEventListener("click", () => {
            mainNavList.classList.toggle("active");
        });
    }

    // Perfil Desktop
    if (desktopProfileToggle) {
        desktopProfileToggle.addEventListener("click", (e) => {
            e.stopPropagation();
            desktopProfileSubmenu.classList.toggle("active");
            if (notificationsSubmenu) notificationsSubmenu.classList.remove("active");
        });
    }

    // Perfil Mobile (dentro do menu hamburguer)
    if (mobileProfileToggle) {
        mobileProfileToggle.addEventListener("click", (e) => {
            e.stopPropagation();
            mobileProfileSubmenu.classList.toggle("active");
        });
    }

    // Notificações Desktop (Sino)
    if (notificationBellBtn) {
        notificationBellBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notificationsSubmenu.classList.toggle('active');
            if (desktopProfileSubmenu) desktopProfileSubmenu.classList.remove("active");
             // Marca como lidas ao abrir (lógica movida para setupNotificationListeners)
        });
    }

    // Fechar menus ao clicar fora
    document.addEventListener("click", (e) => {
        if (desktopProfileSubmenu && !desktopProfileToggle.contains(e.target) && !desktopProfileSubmenu.contains(e.target)) {
            desktopProfileSubmenu.classList.remove("active");
        }
        if (mobileProfileSubmenu && !mobileProfileToggle.contains(e.target) && !mobileProfileSubmenu.contains(e.target)) {
            mobileProfileSubmenu.classList.remove("active");
        }
        if (notificationsSubmenu && !notificationBellBtn.contains(e.target) && !notificationsSubmenu.contains(e.target)) {
            notificationsSubmenu.classList.remove("active");
        }
         // Fecha menu mobile se clicar fora dele
         if (mainNavList.classList.contains("active") && !mainNavList.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
            mainNavList.classList.remove("active");
        }
    });
}

/**
 * Configura os listeners do Firestore para o BADGE e o DROPDOWN de notificações.
 */
function setupNotificationListeners(uid, badge, list) {
    if (!badge || !list) return;

    // Listener para contar não lidas (Badge)
    const unreadQuery = query(collection(db, "users", uid, "notifications"), where("read", "==", false));
    unsubscribeBadgeListener = onSnapshot(unreadQuery, (snapshot) => {
        badge.textContent = snapshot.size;
        badge.style.display = snapshot.size > 0 ? 'block' : 'none';
    }, error => console.error("Erro no listener do badge:", error));

    // Listener para as 5 recentes (Dropdown)
    const recentQuery = query(collection(db, "users", uid, "notifications"), orderBy('timestamp', 'desc'), limit(5));
    unsubscribeDropdownListener = onSnapshot(recentQuery, (snapshot) => {
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
                    if (!data.read) {
                        try {
                            await updateDoc(doc.ref, { read: true });
                        } catch (error) {
                            console.error("Erro ao marcar notificação como lida:", error);
                        }
                    }
                    if (data.url) window.location.href = data.url;
                    // Fecha o submenu após clicar
                    document.getElementById('desktop-notifications-submenu')?.classList.remove('active');
                });
                list.appendChild(li);
            });
        }
    }, error => console.error("Erro no listener do dropdown:", error));

    // Lógica para marcar como lidas ao abrir o dropdown
    const notificationBellBtn = document.getElementById('notification-bell-btn');
    const notificationsSubmenu = document.getElementById('desktop-notifications-submenu');
    if (notificationBellBtn && notificationsSubmenu) {
         notificationBellBtn.addEventListener('click', async () => {
            // Marca como lidas APENAS se o menu estiver sendo aberto
            if (notificationsSubmenu.classList.contains('active')) { // Checa se JÁ está ativo ANTES do toggle
                 try {
                     const batch = writeBatch(db);
                     const unreadQuerySnapshot = await getDocs(unreadQuery); // Reusa a query das não lidas
                     unreadQuerySnapshot.forEach(doc => {
                         batch.update(doc.ref, { read: true });
                     });
                     await batch.commit();
                     console.log("Notificações do dropdown marcadas como lidas.");
                 } catch (error) {
                     console.error("Erro ao marcar notificações do dropdown como lidas:", error);
                 }
            }
         });
    }
}

/**
 * Configura o listener do Firestore para exibir TOASTS para novas notificações.
 */
function setupToastListener(uid) {
    console.log("Configurando listener Firestore para toasts...");
    const notificationsRef = collection(db, 'users', uid, 'notifications');
    const queryStartTime = Timestamp.now(); // Pega o timestamp atual para filtrar

    // Query para pegar notificações criadas A PARTIR de agora
    const q = query(notificationsRef, where("timestamp", ">=", queryStartTime), orderBy('timestamp', 'desc'));

    unsubscribeToastListener = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            // Processa apenas notificações ADICIONADAS
            if (change.type === "added") {
                const notificationData = change.doc.data();
                const notificationTimestamp = notificationData.timestamp;

                // Verifica se a notificação é realmente nova (após o listener iniciar)
                if (notificationTimestamp && notificationTimestamp.toMillis() >= queryStartTime.toMillis()) {

                    // Verifica se já mostramos um toast para esta notificação (comparando timestamps)
                    if (!lastToastTimestamp || notificationTimestamp.toMillis() > lastToastTimestamp.toMillis()) {

                        // Verifica se a aba está visível ANTES de mostrar o toast
                        if (!document.hidden) {
                            console.log("Nova notificação detectada para Toast:", notificationData.type, notificationData.message);
                            showToastNotification(
                                getTitleForType(notificationData.type), // Usa a função auxiliar para título
                                notificationData.message,
                                notificationData.type
                            );
                        } else {
                            console.log("Nova notificação detectada, mas aba não está visível. Toast suprimido.");
                        }
                        // Atualiza o último timestamp processado, mostrando o toast ou não
                        lastToastTimestamp = notificationTimestamp;
                    }
                }
            }
        });
    }, (error) => {
        console.error("Erro no listener de notificações para toasts:", error);
    });
}

/**
 * Retorna a classe do ícone com base no tipo de notificação (para dropdown).
 */
function getNotificationIcon(type) {
    // Mapeamento de ícones para o dropdown (pode ser diferente do toast se quiser)
    switch (type) {
        case 'like': return 'fa-heart text-red-500';
        case 'comment': return 'fa-comment text-green-500';
        case 'friend_request': return 'fa-user-plus text-blue-500';
        case 'task_import_request': return 'fa-download text-purple-500';
        case 'task_deadline': return 'fa-clock text-orange-500';
        default: return 'fa-bell text-gray-500';
    }
}

/**
 * Retorna um título padrão para o Toast baseado no tipo.
 */
function getTitleForType(type) {
    switch (type) {
        case 'like': return 'Nova Curtida';
        case 'comment': return 'Novo Comentário';
        case 'friend_request': return 'Pedido de Amizade';
        case 'task_import_request': return 'Pedido de Importação';
        case 'task_deadline': return '🚨 Prazo de Tarefa Próximo';
        default: return 'Nova Notificação';
    }
}

/**
 * Adiciona a classe 'active' ao link da página atual no menu.
 */
function setActiveLink() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('#main-nav-list a').forEach(link => {
        const linkPage = link.getAttribute('href').split('/').pop() || 'index.html';
        if (linkPage === currentPage) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// Inicia o processo quando o DOM estiver pronto.
document.addEventListener('DOMContentLoaded', loadNavAndProfile);