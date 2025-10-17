// notifications.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    doc,
    updateDoc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

let currentUser;

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loadNotifications();
        setupEventListeners();
    } else {
        window.location.href = "login.html";
    }
});

function loadNotifications() {
    const notificationsList = document.getElementById('notifications-list');
    const q = query(collection(db, 'users', currentUser.uid, 'notifications'), orderBy('timestamp', 'desc'));

    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            notificationsList.innerHTML = `<li class="notification-item empty">Nenhuma notificação encontrada.</li>`;
            return;
        }

        notificationsList.innerHTML = '';
        snapshot.forEach(doc => {
            renderNotification(notificationsList, doc.id, doc.data());
        });
    });
}

function renderNotification(container, id, data) {
    const li = document.createElement('li');
    li.className = `notification-item ${data.read ? 'read' : 'unread'}`;
    li.dataset.id = id;
    li.dataset.url = data.url || '#';

    const timestamp = data.timestamp ? data.timestamp.toDate().toLocaleString('pt-BR') : '';

    li.innerHTML = `
        <div class="notification-icon">
            <i class="fa ${getNotificationIcon(data.type)}"></i>
        </div>
        <div class="notification-content">
            <p>${data.message}</p>
            <span class="timestamp">${timestamp}</span>
        </div>
        ${!data.read ? '<div class="unread-dot"></div>' : ''}
    `;

    li.addEventListener('click', async () => {
        if (!data.read) {
            const notifRef = doc(db, 'users', currentUser.uid, 'notifications', id);
            await updateDoc(notifRef, { read: true });
        }
        if (data.url) {
            window.location.href = data.url;
        }
    });

    container.appendChild(li);
}

function getNotificationIcon(type) {
    switch (type) {
        case 'friend_request':
            return 'fa-user-plus';
        case 'like':
            return 'fa-heart';
        case 'comment':
            return 'fa-comment';
        default:
            return 'fa-bell';
    }
}

function setupEventListeners() {
    const markAllAsReadBtn = document.getElementById('mark-all-as-read-btn');
    markAllAsReadBtn.addEventListener('click', async () => {
        const batch = writeBatch(db);
        const q = query(collection(db, 'users', currentUser.uid, 'notifications'), where('read', '==', false));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            batch.update(doc.ref, { read: true });
        });
        await batch.commit();
    });
}