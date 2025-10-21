// notifications.js (VERSÃO COM ABAS E SELEÇÃO RESTAURADA)

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
let selectedNotifications = new Set(); // Conjunto para IDs selecionados (RESTAURADO)
let unsubscribeNotifications = null;
let unsubscribeLogs = null;
let areAllSelected = false; // Estado do botão Selecionar Todas

// =============================================
// ELEMENTOS DO DOM
// =============================================
const notificationsList = document.getElementById('notifications-list');
const notificationLogList = document.getElementById('notification-log-list');

// Abas e Conteúdos
const tabNotifications = document.getElementById('tab-notifications');
const tabLogs = document.getElementById('tab-logs');
const viewNotifications = document.getElementById('notifications-view');
const viewLogs = document.getElementById('logs-view');

// Botões de Ação
const markAllAsReadBtn = document.getElementById('mark-all-as-read-btn');
const emptyLogsBtn = document.getElementById('empty-logs-btn');
const selectAllBtn = document.getElementById('select-all-btn'); // NOVO BOTÃO (RESTAURADO)
const deleteSelectedBtn = document.getElementById('delete-selected-btn'); // RESTAURADO

// =============================================
// INICIALIZAÇÃO E AUTENTICAÇÃO
// =============================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        setupEventListeners();
        switchTab(tabNotifications, viewNotifications); // Carrega aba padrão
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
        selectedNotifications.clear(); // Limpa seleção ao recarregar
        updateSelectionControls(); // Atualiza botões de seleção

        if (snapshot.empty) {
            notificationsList.innerHTML = `<li class="notification-item empty">Sua caixa de entrada está vazia.</li>`;
            markAllAsReadBtn.disabled = true;
            selectAllBtn.disabled = true; // Desabilita se não há nada
            return;
        }

        notificationsList.innerHTML = '';
        let hasUnread = false;
        snapshot.forEach(doc => {
            if (!doc.data().read) hasUnread = true;
            renderNotification(notificationsList, doc.id, doc.data());
        });

        markAllAsReadBtn.disabled = !hasUnread;
        selectAllBtn.disabled = false; // Habilita se há itens

    }, (error) => {
        console.error("Erro ao carregar notificações:", error);
        notificationsList.innerHTML = `<li class="notification-item empty error">Erro ao carregar notificações.</li>`;
        markAllAsReadBtn.disabled = true;
        selectAllBtn.disabled = true;
    });
}

function loadNotificationLogs() {
    if (!currentUser) return;
    if (unsubscribeLogs) unsubscribeLogs();

    notificationLogList.innerHTML = `<li class="notification-item placeholder"><i class="fa fa-spinner fa-spin"></i> Carregando logs...</li>`;
    const q = query(collection(db, 'users', currentUser.uid, 'notificationLogs'), orderBy('loggedAt', 'desc'));

    unsubscribeLogs = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            notificationLogList.innerHTML = `<li class="notification-item empty">Nenhum log encontrado.</li>`;
            emptyLogsBtn.disabled = true;
            return;
        }
        notificationLogList.innerHTML = '';
        snapshot.forEach(logDoc => {
            renderLogEntry(notificationLogList, logDoc.id, logDoc.data());
        });
        emptyLogsBtn.disabled = false;
    }, (error) => {
        console.error("Erro ao carregar logs:", error);
        notificationLogList.innerHTML = `<li class="notification-item empty error">Erro ao carregar logs.</li>`;
    });
}

// =============================================
// RENDERIZAÇÃO (com Checkbox restaurado)
// =============================================

function renderNotification(container, id, data) {
    const li = document.createElement('li');
    li.className = `notification-item ${data.read ? 'read' : 'unread'}`;
    li.dataset.id = id;

    const timestamp = data.timestamp ? data.timestamp.toDate().toLocaleString('pt-BR') : '';

    // HTML com checkbox
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

    // Evento de clique no conteúdo (marcar como lida e redirecionar)
    li.querySelector('.notification-content').addEventListener('click', async () => {
        if (!data.read) {
            const notifRef = doc(db, 'users', currentUser.uid, 'notifications', id);
            try { await updateDoc(notifRef, { read: true }); } catch (error) { console.error("Erro ao marcar como lida:", error); }
        }
        if (data.url && data.url !== '#') { window.location.href = data.url; }
    });

    // Evento de clique no checkbox (RESTAURADO)
    const checkbox = li.querySelector('.notification-checkbox');
    checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            selectedNotifications.add(id);
        } else {
            selectedNotifications.delete(id);
        }
        updateSelectionControls(); // Atualiza estado dos botões
    });

    // Marca o checkbox se já estiver selecionado (útil após Selecionar Todos)
    checkbox.checked = selectedNotifications.has(id);

    container.appendChild(li);
}

function renderLogEntry(container, id, data) { // Sem alterações
    const li = document.createElement('li');
    li.className = `notification-item log-item ${data.originalRead ? 'read' : 'unread'}`;
    li.dataset.id = id;
    const loggedAtTimestamp = data.loggedAt ? data.loggedAt.toDate().toLocaleString('pt-BR') : (data.timestamp ? data.timestamp.toDate().toLocaleString('pt-BR') : 'Data indisponível');

    li.innerHTML = `
        <div class="notification-icon">
            <i class="fa ${getNotificationIcon(data.type)}"></i>
        </div>
        <div class="notification-content">
            <p>${data.message}</p>
            <span class="timestamp">Log: ${loggedAtTimestamp}</span>
        </div>
    `;
    container.appendChild(li);
}

function getNotificationIcon(type) { // Sem alterações
    switch (type) {
        case 'friend_request': return 'fa-user-plus text-blue-500';
        case 'like': return 'fa-heart text-red-500';
        case 'comment': return 'fa-comment text-green-500';
        case 'task_import_request': return 'fa-download text-purple-500';
        case 'task_deadline': return 'fa-clock text-orange-500';
        default: return 'fa-bell text-gray-500';
    }
}

// =============================================
// LÓGICA DE EVENTOS E AÇÕES
// =============================================

function setupEventListeners() {
    // --- Controle das Abas ---
    tabNotifications.addEventListener('click', () => switchTab(tabNotifications, viewNotifications));
    tabLogs.addEventListener('click', () => switchTab(tabLogs, viewLogs));

    // --- Botões de Ação ---
    markAllAsReadBtn.addEventListener('click', markAllAsRead);
    emptyLogsBtn.addEventListener('click', confirmClearAllLogs);
    selectAllBtn.addEventListener('click', toggleSelectAll); // RESTAURADO
    deleteSelectedBtn.addEventListener('click', confirmDeleteSelected); // RESTAURADO
}

function switchTab(activeTab, activeView) { // Sem alterações
    [tabNotifications, tabLogs].forEach(tab => tab.classList.remove('active'));
    [viewNotifications, viewLogs].forEach(view => view.classList.remove('active'));
    activeTab.classList.add('active');
    activeView.classList.add('active');
    if (activeView === viewNotifications) loadNotifications();
    else if (activeView === viewLogs) loadNotificationLogs();
}

// --- Ação: Marcar todas como lidas (sem alterações) ---
async function markAllAsRead() { /* ...código existente... */ }

// --- Ação: Selecionar/Deselecionar Todas (RESTAURADO E MELHORADO) ---
function toggleSelectAll() {
    areAllSelected = !areAllSelected; // Inverte o estado
    const allCheckboxes = notificationsList.querySelectorAll('.notification-checkbox');

    allCheckboxes.forEach(checkbox => {
        checkbox.checked = areAllSelected;
        const id = checkbox.dataset.id;
        if (areAllSelected) {
            selectedNotifications.add(id);
        } else {
            selectedNotifications.delete(id);
        }
    });
    updateSelectionControls();
}

// --- Atualizar Controles de Seleção (RESTAURADO E MELHORADO) ---
function updateSelectionControls() {
    const numSelected = selectedNotifications.size;
    const numTotal = notificationsList.querySelectorAll('.notification-checkbox').length;

    // Atualiza botão Apagar Selecionadas
    deleteSelectedBtn.disabled = numSelected === 0;

    // Atualiza botão Selecionar Todas
    if (numSelected === 0 || numTotal === 0) {
        selectAllBtn.querySelector('span').textContent = 'Selecionar Todas';
        selectAllBtn.querySelector('i').className = 'fa-regular fa-square-check';
        areAllSelected = false;
    } else if (numSelected === numTotal) {
        selectAllBtn.querySelector('span').textContent = 'Desselecionar Todas';
        selectAllBtn.querySelector('i').className = 'fa-solid fa-square-check'; // Ícone preenchido
        areAllSelected = true;
    } else {
        selectAllBtn.querySelector('span').textContent = 'Selecionar Todas';
        selectAllBtn.querySelector('i').className = 'fa-regular fa-square-minus'; // Ícone de seleção parcial
        areAllSelected = false; // Estado intermediário, próximo clique seleciona tudo
    }

    // Desabilita Selecionar Todas se não houver notificações
    selectAllBtn.disabled = numTotal === 0;
}


// --- Ação: Apagar Selecionadas (RESTAURADO) ---
function confirmDeleteSelected() {
    if (selectedNotifications.size === 0) return;
    showConfirmModal(
        'Apagar Notificações',
        `Tem certeza que deseja apagar ${selectedNotifications.size} notificação(ões) selecionada(s)? Esta ação é permanente.`,
        () => deleteSelectedNotifications()
    );
}

async function deleteSelectedNotifications() {
    deleteSelectedBtn.disabled = true;
    deleteSelectedBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Apagando...';

    const batch = writeBatch(db);
    selectedNotifications.forEach(id => {
        batch.delete(doc(db, 'users', currentUser.uid, 'notifications', id));
    });

    try {
        await batch.commit();
        console.log(`${selectedNotifications.size} notificações apagadas.`);
        selectedNotifications.clear(); // Limpa a seleção
        // O onSnapshot cuidará de atualizar a UI e os botões
    } catch (error) {
        console.error("Erro ao apagar notificações selecionadas:", error);
        alert("Erro ao apagar as notificações.");
        // Reabilita o botão em caso de erro, pois o onSnapshot não recarregará
        deleteSelectedBtn.disabled = false;
        deleteSelectedBtn.innerHTML = '<i class="fa fa-trash"></i> Apagar Selecionadas';
        updateSelectionControls(); // Atualiza o estado dos botões de seleção
    }
    // Não precisa restaurar o texto do botão aqui, o onSnapshot faz isso.
}


// --- Ação: Esvaziar Logs (sem alterações) ---
function confirmClearAllLogs() { /* ...código existente... */ }
async function clearAllLogs() { /* ...código existente... */ }

// =============================================
// MODAL DE CONFIRMAÇÃO (sem alterações)
// =============================================
function showConfirmModal(title, message, onConfirm) { /* ...código existente... */ }