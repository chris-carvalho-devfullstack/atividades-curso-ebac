// nav-profile.js
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

// --- Elementos Comuns de Perfil ---
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

// --- Elementos de Notificação ---
const desktopNotificationContainer = document.getElementById('desktop-notification-container');
const notificationBellBtn = document.getElementById('notification-bell-btn');
const notificationBadge = document.getElementById('notification-badge');
const notificationsSubmenu = document.getElementById('desktop-notifications-submenu');
const notificationsList = document.getElementById('desktop-notifications-list');

// --- Função para ícone de notificação ---
function getNotificationIcon(type) {
    switch (type) {
        case 'friend_request': return 'fa-user-plus text-blue-500';
        case 'like': return 'fa-heart text-red-500';
        case 'comment': return 'fa-comment text-green-500';
        case 'task_import_request': return 'fa-download text-purple-500';
        default: return 'fa-bell text-gray-500';
    }
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // --- Usuário está LOGADO ---

        // VISIBILIDADE AUTH: Mostra perfil e notificações, esconde login
        if(desktopProfileContainer) desktopProfileContainer.style.display = 'list-item';
        if(desktopNotificationContainer) desktopNotificationContainer.style.display = 'list-item';
        if(desktopLoginBtn) desktopLoginBtn.style.display = 'none';
        if(mobileProfileContainer) mobileProfileContainer.style.display = 'list-item';
        if(mobileLoginBtn) mobileLoginBtn.style.display = 'none';

        // CARREGAMENTO DE DADOS DO PERFIL:
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

        // LÓGICA DE NOTIFICAÇÕES:
        // Listener para notificações não lidas (atualiza o contador)
        const unreadQuery = query(collection(db, "users", user.uid, "notifications"), where("read", "==", false));
        onSnapshot(unreadQuery, (snapshot) => {
            const unreadCount = snapshot.size;
            if (notificationBadge) {
                notificationBadge.textContent = unreadCount;
                notificationBadge.style.display = unreadCount > 0 ? 'block' : 'none';
            }
        });

        // Listener para as 5 notificações mais recentes (para o dropdown)
        const recentQuery = query(collection(db, "users", user.uid, "notifications"), orderBy('timestamp', 'desc'), limit(5));
        onSnapshot(recentQuery, (snapshot) => {
            if (notificationsList) {
                notificationsList.innerHTML = ''; // Limpa a lista
                if (snapshot.empty) {
                    notificationsList.innerHTML = `<li class="notification-item empty">Nenhuma notificação recente.</li>`;
                } else {
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        const li = document.createElement('li');
                        li.className = `notification-item ${data.read ? 'read' : 'unread'}`;
                        li.innerHTML = `
                            <div class="notification-icon"><i class="fa ${getNotificationIcon(data.type)}"></i></div>
                            <div class="notification-content"><p>${data.message}</p></div>
                        `;
                        // Adiciona evento de clique para marcar como lida e redirecionar
                        li.addEventListener('click', async () => {
                            if (!data.read) {
                                await updateDoc(doc.ref, { read: true });
                            }
                            if (data.url) window.location.href = data.url;
                        });
                        notificationsList.appendChild(li);
                    });
                }
            }
        });

    } else {
        // --- Usuário está DESLOGADO ---

        // VISIBILIDADE AUTH: Esconde perfil e notificações, mostra login
        if(desktopProfileContainer) desktopProfileContainer.style.display = 'none';
        if(desktopNotificationContainer) desktopNotificationContainer.style.display = 'none';
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
        window.location.href = 'index.html';
    } catch (err) {
        console.error('Erro ao fazer signOut:', err);
    }
}

if (logoutBtnSubmenu) logoutBtnSubmenu.addEventListener('click', handleLogout);
if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', handleLogout);


// --- LÓGICA DE CONTROLE DOS MENUS ---

// PERFIL DESKTOP
const desktopProfileToggle = document.getElementById("desktop-profile-toggle");
const desktopProfileSubmenu = document.getElementById("desktop-profile-submenu");

if (desktopProfileToggle && desktopProfileSubmenu) {
    desktopProfileToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        desktopProfileSubmenu.classList.toggle("active");
        if (notificationsSubmenu) notificationsSubmenu.classList.remove("active"); // Fecha o outro menu
    });
}

// PERFIL MOBILE
const mobileProfileToggle = document.getElementById("mobile-profile-toggle");
const mobileProfileSubmenu = document.getElementById("mobile-profile-submenu");

if (mobileProfileToggle && mobileProfileSubmenu) {
    mobileProfileToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        mobileProfileSubmenu.classList.toggle("active");
    });
}

// CONTROLE DO MENU DE NOTIFICAÇÕES
if (notificationBellBtn && notificationsSubmenu) {
    notificationBellBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        notificationsSubmenu.classList.toggle('active');
        if (desktopProfileSubmenu) desktopProfileSubmenu.classList.remove("active"); // Fecha o outro menu

        // Marca as 5 notificações visíveis como lidas ao abrir o menu
        if (notificationsSubmenu.classList.contains('active')) {
            const batch = writeBatch(db);
            const unreadQuery = query(
                collection(db, "users", auth.currentUser.uid, "notifications"),
                where("read", "==", false),
                orderBy('timestamp', 'desc'),
                limit(5)
            );
            const snapshot = await getDocs(unreadQuery);
            snapshot.forEach(doc => {
                batch.update(doc.ref, { read: true });
            });
            await batch.commit();
        }
    });
}

// FECHAR MENUS AO CLICAR FORA
document.addEventListener("click", (e) => {
    // Fecha submenu de perfil (desktop)
    if (desktopProfileSubmenu && desktopProfileSubmenu.classList.contains("active")) {
        if (!desktopProfileToggle.contains(e.target)) {
            desktopProfileSubmenu.classList.remove("active");
        }
    }
    // Fecha submenu de perfil (mobile)
    if (mobileProfileSubmenu && mobileProfileSubmenu.classList.contains("active")) {
        if (!mobileProfileToggle.contains(e.target)) {
            mobileProfileSubmenu.classList.remove("active");
        }
    }
    // Fecha submenu de notificações
    if (notificationsSubmenu && notificationsSubmenu.classList.contains("active")) {
        if (!notificationBellBtn.contains(e.target) && !notificationsSubmenu.contains(e.target)) {
            notificationsSubmenu.classList.remove("active");
        }
    }
});