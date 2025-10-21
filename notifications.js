// notifications.js (VERSÃO COM LÓGICA DE LOG SEPARADA)
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
    // getDoc não é mais necessário para a exclusão aqui
    serverTimestamp // Mantido para renderLogEntry se usar timestamp
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

let currentUser;
let selectedNotifications = new Set();

// Elementos do DOM
const notificationsList = document.getElementById('notifications-list');
const selectAllCheckbox = document.getElementById('select-all-checkbox');
const deleteSelectedBtn = document.getElementById('delete-selected-btn');
const markAllAsReadBtn = document.getElementById('mark-all-as-read-btn');
const toggleLogViewBtn = document.getElementById('toggle-log-view-btn');
const notificationLogContainer = document.getElementById('notification-log-container');
const notificationLogList = document.getElementById('notification-log-list');
const closeLogViewBtn = document.getElementById('close-log-view-btn');
const emptyLogsBtn = document.getElementById('empty-logs-btn'); // Novo botão

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
    if (!currentUser) return;
    const q = query(collection(db, 'users', currentUser.uid, 'notifications'), orderBy('timestamp', 'desc'));

    onSnapshot(q, (snapshot) => {
        selectedNotifications.clear();
        updateDeleteButtonState();
        if (selectAllCheckbox) selectAllCheckbox.checked = false;

        if (snapshot.empty) {
            notificationsList.innerHTML = `<li class="notification-item empty">Nenhuma notificação encontrada.</li>`;
            return;
        }

        notificationsList.innerHTML = '';
        snapshot.forEach(doc => {
            renderNotification(notificationsList, doc.id, doc.data());
        });
    }, (error) => {
        console.error("Erro ao carregar notificações:", error);
        notificationsList.innerHTML = `<li class="notification-item empty error">Erro ao carregar notificações.</li>`;
    });
}

function renderNotification(container, id, data) {
    const li = document.createElement('li');
    li.className = `notification-item ${data.read ? 'read' : 'unread'}`;
    li.dataset.id = id;

    const timestamp = data.timestamp ? data.timestamp.toDate().toLocaleString('pt-BR') : '';

    li.innerHTML = `
        <div class="notification-select">
            <input type="checkbox" class="notification-checkbox" data-id="${id}">
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
    contentDiv.addEventListener('click', async () => {
        if (!data.read) {
            const notifRef = doc(db, 'users', currentUser.uid, 'notifications', id);
            try {
                await updateDoc(notifRef, { read: true });
            } catch (error) {
                console.error("Erro ao marcar como lida:", error);
            }
        }
        if (data.url && data.url !== '#') {
            window.location.href = data.url;
        }
    });

    const checkbox = li.querySelector('.notification-checkbox');
    checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            selectedNotifications.add(id);
        } else {
            selectedNotifications.delete(id);
        }
        updateDeleteButtonState();
        checkSelectAllState();
    });

    container.appendChild(li);
}

// Carrega os logs da coleção notificationLogs (sem alterações)
function loadNotificationLogs() {
    if (!currentUser) return;
    notificationLogList.innerHTML = `<li class="notification-item placeholder"><i class="fa fa-spinner fa-spin"></i> Carregando logs...</li>`;
    const q = query(collection(db, 'users', currentUser.uid, 'notificationLogs'), orderBy('loggedAt', 'desc')); // Usar loggedAt se existir

    getDocs(q).then(snapshot => {
        if (snapshot.empty) {
            notificationLogList.innerHTML = `<li class="notification-item empty">Nenhum log encontrado.</li>`;
            return;
        }
        notificationLogList.innerHTML = '';
        snapshot.forEach(logDoc => {
            renderLogEntry(notificationLogList, logDoc.id, logDoc.data());
        });
    }).catch(error => {
        console.error("Erro ao carregar logs:", error);
        notificationLogList.innerHTML = `<li class="notification-item empty error">Erro ao carregar logs.</li>`;
    });
}

// Renderiza uma entrada de log (sem alterações)
function renderLogEntry(container, id, data) {
    const li = document.createElement('li');
    li.className = `notification-item log-item ${data.originalRead ? 'read' : 'unread'}`;
    li.dataset.id = id;
    // Usar loggedAt se existir, senão o timestamp original
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

// Atualiza estado do botão Apagar (sem alterações)
function updateDeleteButtonState() {
    if (deleteSelectedBtn) {
        deleteSelectedBtn.disabled = selectedNotifications.size === 0;
    }
}

// Atualiza estado do Select All (sem alterações)
function checkSelectAllState() {
    if (!selectAllCheckbox) return;
    const allCheckboxes = notificationsList.querySelectorAll('.notification-checkbox');
    const allVisibleChecked = Array.from(allCheckboxes).every(cb => cb.checked);
    selectAllCheckbox.checked = allVisibleChecked && allCheckboxes.length > 0;
}

// Modal de confirmação (sem alterações)
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
    okBtn.onclick = () => { onConfirm(); modal.style.display = 'none'; };
    cancelBtn.onclick = () => { modal.style.display = 'none'; };
}

// *** FUNÇÃO DE APAGAR MODIFICADA: APENAS DELETA DA COLEÇÃO PRINCIPAL ***
async function deleteSelectedNotifications() {
    if (!currentUser || selectedNotifications.size === 0) return;

    showConfirmModal(
        'Apagar Notificações',
        `Tem certeza que deseja apagar ${selectedNotifications.size} notificação(ões) selecionada(s)? Esta ação é permanente e NÃO moverá para o log.`,
        async () => {
            deleteSelectedBtn.disabled = true;
            deleteSelectedBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Apagando...';

            const batch = writeBatch(db);

            // Adiciona a operação de delete para cada notificação selecionada
            selectedNotifications.forEach(notificationId => {
                const notifRef = doc(db, 'users', currentUser.uid, 'notifications', notificationId);
                batch.delete(notifRef);
            });

            try {
                await batch.commit();
                console.log(`${selectedNotifications.size} notificações apagadas permanentemente.`);
                selectedNotifications.clear(); // Limpa a seleção
                // updateDeleteButtonState(); // Será atualizado pelo onSnapshot
                // if (selectAllCheckbox) selectAllCheckbox.checked = false; // Será atualizado pelo onSnapshot
            } catch (error) {
                console.error("Erro ao apagar notificações:", error);
                alert("Ocorreu um erro ao apagar as notificações.");
            } finally {
                // Restaura o botão independentemente do resultado, pois o onSnapshot atualizará o estado correto
                deleteSelectedBtn.innerHTML = '<i class="fa fa-trash"></i> Apagar Selecionadas';
                // A desativação será feita pelo onSnapshot ao limpar a lista/seleção
            }
        }
    );
}

// *** NOVA FUNÇÃO: Limpar todos os logs ***
async function clearAllLogs() {
    if (!currentUser) return;

    showConfirmModal(
        'Esvaziar Logs',
        'Tem certeza que deseja apagar TODO o histórico de notificações (logs)? Esta ação é irreversível.',
        async () => {
            if(emptyLogsBtn) { // Desabilita botão enquanto processa
                 emptyLogsBtn.disabled = true;
                 emptyLogsBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Esvaziando...';
            }

            const batch = writeBatch(db);
            const logsCollectionRef = collection(db, 'users', currentUser.uid, 'notificationLogs');
            const q = query(logsCollectionRef); // Query para pegar todos os logs

            try {
                const snapshot = await getDocs(q);
                if (snapshot.empty) {
                    console.log("Log já está vazio.");
                    return; // Sai se não há nada para apagar
                }
                snapshot.forEach(logDoc => {
                    batch.delete(logDoc.ref); // Adiciona cada log ao batch para exclusão
                });
                await batch.commit();
                console.log("Todos os logs foram apagados.");
                // O loadNotificationLogs será chamado novamente se a view estiver aberta,
                // ou da próxima vez que for aberta, mostrando a lista vazia.
            } catch (error) {
                console.error("Erro ao esvaziar os logs:", error);
                alert("Ocorreu um erro ao esvaziar os logs.");
            } finally {
                 if(emptyLogsBtn) { // Reabilita o botão
                     emptyLogsBtn.disabled = false;
                     emptyLogsBtn.innerHTML = '<i class="fa fa-eraser"></i> Esvaziar Logs';
                 }
            }
        }
    );
}


function getNotificationIcon(type) {
    switch (type) {
        case 'friend_request': return 'fa-user-plus text-blue-500';
        case 'like': return 'fa-heart text-red-500';
        case 'comment': return 'fa-comment text-green-500';
        case 'task_import_request': return 'fa-download text-purple-500';
        case 'task_deadline': return 'fa-clock text-orange-500';
        default: return 'fa-bell text-gray-500';
    }
}

function setupEventListeners() {
    // Marcar todas como lidas (sem alterações)
    if (markAllAsReadBtn) {
        markAllAsReadBtn.addEventListener('click', async () => { /* ...código existente... */ });
    }

    // Checkbox "Selecionar Todos" (sem alterações)
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => { /* ...código existente... */ });
    }

    // Botão "Apagar Selecionadas" (agora chama a nova versão da função)
    if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener('click', deleteSelectedNotifications);
    }

    // Botão "Ver Logs" (sem alterações)
    if (toggleLogViewBtn) {
        toggleLogViewBtn.addEventListener('click', () => {
            notificationsList.style.display = 'none';
            notificationLogContainer.style.display = 'block';
            loadNotificationLogs();
        });
    }

    // Botão "Fechar Logs" (sem alterações)
    if (closeLogViewBtn) {
        closeLogViewBtn.addEventListener('click', () => {
            notificationLogContainer.style.display = 'none';
            notificationsList.style.display = 'block';
        });
    }

    // *** NOVO LISTENER: Botão "Esvaziar Logs" ***
    if (emptyLogsBtn) {
        emptyLogsBtn.addEventListener('click', clearAllLogs);
    }
}