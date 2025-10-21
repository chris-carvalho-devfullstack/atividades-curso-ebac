// notifications.js (VERSÃO CORRIGIDA COM ABAS E SELEÇÃO FUNCIONAL)

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
    writeBatch,
    getDocs,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

let currentUser;
let selectedNotifications = new Set();
let unsubscribeNotifications = null;
let unsubscribeLogs = null;
let areAllSelectedState = false;

// =============================================
// ELEMENTOS DO DOM
// =============================================
const notificationsList = document.getElementById('notifications-list');
const notificationLogList = document.getElementById('notification-log-list');
const tabNotifications = document.getElementById('tab-notifications');
const tabLogs = document.getElementById('tab-logs');
const viewNotifications = document.getElementById('notifications-view');
const viewLogs = document.getElementById('logs-view');
const markAllAsReadBtn = document.getElementById('mark-all-as-read-btn');
const emptyLogsBtn = document.getElementById('empty-logs-btn');
const selectAllBtn = document.getElementById('select-all-btn');
const deleteSelectedBtn = document.getElementById('delete-selected-btn');

// =============================================
// INICIALIZAÇÃO E AUTENTICAÇÃO
// =============================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        setupEventListeners();
        switchTab('notifications-view'); // Carrega a aba padrão
    } else {
        window.location.href = "login.html";
        if (unsubscribeNotifications) unsubscribeNotifications();
        if (unsubscribeLogs) unsubscribeLogs();
    }
});

// =============================================
// LÓGICA DE CARREGAMENTO DE DADOS
// =============================================
function loadNotifications() {
    if (!currentUser) return;
    if (unsubscribeNotifications) unsubscribeNotifications();

    const q = query(collection(db, 'users', currentUser.uid, 'notifications'), orderBy('timestamp', 'desc'));

    unsubscribeNotifications = onSnapshot(q, (snapshot) => {
        selectedNotifications.clear();

        if (snapshot.empty) {
            notificationsList.innerHTML = `<li class="notification-item empty">Sua caixa de entrada está vazia.</li>`;
            updateSelectionControls();
            return;
        }

        notificationsList.innerHTML = '';
        snapshot.forEach(doc => {
            renderNotification(notificationsList, doc.id, doc.data());
        });
        
        updateSelectionControls();

    }, (error) => {
        console.error("Erro ao carregar notificações:", error);
        notificationsList.innerHTML = `<li class="notification-item empty error">Erro ao carregar notificações.</li>`;
        updateSelectionControls();
    });
}

function loadNotificationLogs() {
    if (!currentUser) return;
    if (unsubscribeLogs) unsubscribeLogs();

    notificationLogList.innerHTML = `<li class="notification-item placeholder"><i class="fa fa-spinner fa-spin"></i> Carregando logs...</li>`;
    const q = query(collection(db, 'users', currentUser.uid, 'notificationLogs'), orderBy('loggedAt', 'desc'));

    unsubscribeLogs = onSnapshot(q, (snapshot) => {
        emptyLogsBtn.disabled = snapshot.empty;
        if (snapshot.empty) {
            notificationLogList.innerHTML = `<li class="notification-item empty">Nenhum log encontrado.</li>`;
            return;
        }
        notificationLogList.innerHTML = '';
        snapshot.forEach(logDoc => {
            renderLogEntry(notificationLogList, logDoc.id, logDoc.data());
        });
    }, (error) => {
        console.error("Erro ao carregar logs:", error);
        notificationLogList.innerHTML = `<li class="notification-item empty error">Erro ao carregar logs.</li>`;
        emptyLogsBtn.disabled = true;
    });
}

// =============================================
// RENDERIZAÇÃO
// =============================================
function renderNotification(container, id, data) {
    const li = document.createElement('li');
    li.className = `notification-item ${data.read ? 'read' : 'unread'}`;
    li.dataset.id = id;

    const timestamp = data.timestamp ? data.timestamp.toDate().toLocaleString('pt-BR') : '';

    li.innerHTML = `
        <div class="notification-select">
            <input type="checkbox" class="notification-checkbox" data-id="${id}" title="Selecionar esta notificação">
        </div>
        <div class="notification-icon">
            <i class="fa ${getNotificationIcon(data.type)}"></i>
        </div>
        <div class="notification-content" data-url="${data.url || '#'}">
            <p>${data.message}</p>
            <span class="timestamp">${timestamp}</span>
        </div>
        ${!data.read ? '<div class="unread-dot"></div>' : ''}
    `;

    const contentDiv = li.querySelector('.notification-content');
    contentDiv.addEventListener('click', async (e) => {
        if (e.target.type === 'checkbox') return;
        if (!data.read) {
            const notifRef = doc(db, 'users', currentUser.uid, 'notifications', id);
            try { await updateDoc(notifRef, { read: true }); } catch (error) { console.error("Erro ao marcar como lida:", error); }
        }
        if (data.url && data.url !== '#') { window.location.href = data.url; }
    });

    const checkbox = li.querySelector('.notification-checkbox');
    checkbox.addEventListener('change', (e) => {
        e.target.checked ? selectedNotifications.add(id) : selectedNotifications.delete(id);
        updateSelectionControls();
    });

    checkbox.checked = selectedNotifications.has(id);
    container.appendChild(li);
}

function renderLogEntry(container, id, data) {
    const li = document.createElement('li');
    li.className = `notification-item log-item ${data.originalRead ? 'read' : 'unread'}`;
    const loggedAtTimestamp = data.loggedAt?.toDate().toLocaleString('pt-BR') || 'Data indisponível';

    li.innerHTML = `
        <div class="notification-icon"><i class="fa ${getNotificationIcon(data.type)}"></i></div>
        <div class="notification-content">
            <p>${data.message}</p>
            <span class="timestamp">Log: ${loggedAtTimestamp}</span>
        </div>`;
    container.appendChild(li);
}

function getNotificationIcon(type) {
    // ... (código existente)
}

// =============================================
// LÓGICA DE EVENTOS E AÇÕES
// =============================================
function setupEventListeners() {
    tabNotifications.addEventListener('click', () => switchTab('notifications-view'));
    tabLogs.addEventListener('click', () => switchTab('logs-view'));
    markAllAsReadBtn.addEventListener('click', markAllAsRead);
    emptyLogsBtn.addEventListener('click', confirmClearAllLogs);
    selectAllBtn.addEventListener('click', toggleSelectAll);
    deleteSelectedBtn.addEventListener('click', confirmDeleteSelected);
}

function switchTab(tabId) {
    const isActive = (id) => id === tabId;
    tabNotifications.classList.toggle('active', isActive('notifications-view'));
    viewNotifications.classList.toggle('active', isActive('notifications-view'));
    tabLogs.classList.toggle('active', isActive('logs-view'));
    viewLogs.classList.toggle('active', isActive('logs-view'));

    if (isActive('notifications-view')) loadNotifications();
    else if (isActive('logs-view')) loadNotificationLogs();
}

async function markAllAsRead() {
    // ... (código existente)
}

function toggleSelectAll() {
    areAllSelectedState = !areAllSelectedState;
    const allCheckboxes = notificationsList.querySelectorAll('.notification-checkbox');
    allCheckboxes.forEach(checkbox => {
        const id = checkbox.dataset.id;
        if (checkbox.checked !== areAllSelectedState) {
            checkbox.checked = areAllSelectedState;
            areAllSelectedState ? selectedNotifications.add(id) : selectedNotifications.delete(id);
        }
    });
    updateSelectionControls();
}

function updateSelectionControls() {
    const numSelected = selectedNotifications.size;
    const numTotal = notificationsList.querySelectorAll('.notification-checkbox').length;
    let hasUnread = false;
    if (numTotal > 0) {
        hasUnread = !!notificationsList.querySelector('.notification-item.unread');
    }
    
    // Botão Apagar
    deleteSelectedBtn.disabled = numSelected === 0;
    
    // Botão Selecionar Todas
    selectAllBtn.disabled = numTotal === 0;
    areAllSelectedState = (numSelected === numTotal && numTotal > 0);
    updateSelectAllButtonVisualState();
    
    // Botão Marcar Todas como Lidas
    markAllAsReadBtn.disabled = !hasUnread;
}

function updateSelectAllButtonVisualState() {
    const numSelected = selectedNotifications.size;
    const numTotal = notificationsList.querySelectorAll('.notification-checkbox').length;
    const icon = selectAllBtn.querySelector('i');
    const text = selectAllBtn.querySelector('span');
    
    if (numSelected === 0 || numTotal === 0) {
        text.textContent = 'Selecionar Todas';
        icon.className = 'fa-regular fa-square';
    } else if (numSelected === numTotal) {
        text.textContent = 'Desselecionar';
        icon.className = 'fa-solid fa-square-check';
    } else {
        text.textContent = 'Selecionar Todas';
        icon.className = 'fa-solid fa-minus-square';
    }
}

function confirmDeleteSelected() {
    if (selectedNotifications.size === 0) return;
    showConfirmModal(
        'Apagar Notificações',
        `Tem certeza que deseja apagar ${selectedNotifications.size} notificação(ões)?`,
        () => deleteSelectedNotifications()
    );
}

async function deleteSelectedNotifications() {
    if (!currentUser || selectedNotifications.size === 0) return;
    
    deleteSelectedBtn.disabled = true;
    deleteSelectedBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Apagando...';

    const batch = writeBatch(db);
    selectedNotifications.forEach(id => {
        batch.delete(doc(db, 'users', currentUser.uid, 'notifications', id));
    });

    try {
        await batch.commit();
        // A UI será atualizada pelo onSnapshot
    } catch (error) {
        console.error("Erro ao apagar notificações:", error);
        alert("Erro ao apagar as notificações.");
        deleteSelectedBtn.innerHTML = '<i class="fa fa-trash"></i> Apagar Selecionadas';
        updateSelectionControls();
    }
}

function confirmClearAllLogs() {
    // ... (código existente)
}

async function clearAllLogs() {
    // ... (código existente)
}

function showConfirmModal(title, message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    if (!modal) { if (confirm(`${title}\n\n${message}`)) onConfirm(); return; }
    
    const modalTitle = modal.querySelector('#confirm-modal-title');
    const modalText = modal.querySelector('#confirm-modal-text');
    const okBtn = modal.querySelector('#confirm-modal-ok-btn');
    const cancelBtn = modal.querySelector('#confirm-modal-cancel-btn');
    
    modalTitle.textContent = title;
    modalText.textContent = message;
    modal.style.display = 'flex';

    // Limpa listeners antigos para evitar chamadas múltiplas
    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    
    newOkBtn.addEventListener('click', () => { 
        onConfirm(); 
        modal.style.display = 'none'; 
    });

    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    newCancelBtn.addEventListener('click', () => { 
        modal.style.display = 'none'; 
    });
}
