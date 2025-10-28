// notifications.js (VERSÃO COMPLETA E ATUALIZADA)

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
    serverTimestamp // Import serverTimestamp se precisar usar no cliente
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

let currentUser;
let selectedNotifications = new Set();
let unsubscribeNotifications = null; // Listener para a caixa de entrada
let unsubscribeLogs = null; // Listener para os logs
let areAllSelectedState = false; // Estado do botão "Selecionar Todas"

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
const confirmModal = document.getElementById('confirmModal'); // Referência ao modal de confirmação

// =============================================
// INICIALIZAÇÃO E AUTENTICAÇÃO
// =============================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        setupEventListeners();
        switchTab('notifications-view'); // Começa na aba de caixa de entrada
    } else {
        // Se deslogar, redireciona e limpa os listeners
        window.location.href = "login.html";
        if (unsubscribeNotifications) unsubscribeNotifications();
        if (unsubscribeLogs) unsubscribeLogs();
    }
});

// =============================================
// LÓGICA DE CARREGAMENTO DE DADOS (LISTENERS)
// =============================================

/**
 * Carrega e escuta as notificações da caixa de entrada em tempo real.
 */
function loadNotifications() {
    if (!currentUser) return;
    // Cancela o listener anterior, se existir
    if (unsubscribeNotifications) unsubscribeNotifications();

    // Mostra indicador de carregamento
    notificationsList.innerHTML = `<li class="notification-item placeholder"><i class="fa fa-spinner fa-spin"></i> Carregando notificações...</li>`;

    // Cria a query para buscar notificações, ordenadas pela mais recente
    const q = query(collection(db, 'users', currentUser.uid, 'notifications'), orderBy('timestamp', 'desc'));

    // Inicia o listener em tempo real
    unsubscribeNotifications = onSnapshot(q, (snapshot) => {
        selectedNotifications.clear(); // Limpa a seleção ao recarregar

        if (snapshot.empty) {
            notificationsList.innerHTML = `<li class="notification-item empty">Sua caixa de entrada está vazia.</li>`;
        } else {
            notificationsList.innerHTML = ''; // Limpa a lista antes de renderizar
            snapshot.forEach(doc => {
                // Renderiza cada notificação na lista
                renderNotification(notificationsList, doc.id, doc.data());
            });
        }
        // Atualiza o estado dos botões de seleção/ação
        updateSelectionControls();

    }, (error) => {
        // Trata erros na leitura
        console.error("Erro ao carregar notificações:", error);
        notificationsList.innerHTML = `<li class="notification-item empty error">Erro ao carregar notificações. Tente recarregar a página.</li>`;
        updateSelectionControls(); // Atualiza controles mesmo em erro
    });
}

/**
 * Carrega e escuta os logs de notificação em tempo real.
 */
function loadNotificationLogs() {
    if (!currentUser) return;
    // Cancela o listener anterior, se existir
    if (unsubscribeLogs) unsubscribeLogs();

    // Mostra indicador de carregamento
    notificationLogList.innerHTML = `<li class="notification-item placeholder"><i class="fa fa-spinner fa-spin"></i> Carregando logs...</li>`;

    // Cria a query para buscar os logs, ordenados pelo mais recente
    const q = query(collection(db, 'users', currentUser.uid, 'notificationLogs'), orderBy('loggedAt', 'desc'));

    // Inicia o listener em tempo real
    unsubscribeLogs = onSnapshot(q, (snapshot) => {
        // Habilita ou desabilita o botão de esvaziar logs
        emptyLogsBtn.disabled = snapshot.empty;

        if (snapshot.empty) {
            notificationLogList.innerHTML = `<li class="notification-item empty">Nenhum log encontrado.</li>`;
        } else {
            notificationLogList.innerHTML = ''; // Limpa a lista antes de renderizar
            snapshot.forEach(logDoc => {
                // Renderiza cada entrada de log
                renderLogEntry(notificationLogList, logDoc.id, logDoc.data());
            });
        }
    }, (error) => {
        // Trata erros na leitura
        console.error("Erro ao carregar logs:", error);
        notificationLogList.innerHTML = `<li class="notification-item empty error">Erro ao carregar logs. Tente recarregar a página.</li>`;
        emptyLogsBtn.disabled = true; // Desabilita o botão em caso de erro
    });
}

// =============================================
// RENDERIZAÇÃO DOS ITENS NA UI
// =============================================

/**
 * Renderiza um item de notificação na lista da caixa de entrada.
 * @param {HTMLElement} container - O elemento UL onde a notificação será adicionada.
 * @param {string} id - O ID do documento da notificação.
 * @param {object} data - Os dados da notificação.
 */
function renderNotification(container, id, data) {
    const li = document.createElement('li');
    li.className = `notification-item ${data.read ? 'read' : 'unread'}`;
    li.dataset.id = id; // Armazena o ID no elemento para referência

    // Formata o timestamp para exibição
    const timestamp = data.timestamp ? data.timestamp.toDate().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Data indisponível';

    // Cria o HTML interno do item da lista
    li.innerHTML = `
        <div class="notification-select">
            <input type="checkbox" class="notification-checkbox" data-id="${id}" title="Selecionar esta notificação">
        </div>
        <div class="notification-icon">
            <i class="fa ${getNotificationIcon(data.type)}"></i>
        </div>
        <div class="notification-content" data-url="${data.url || '#'}">
            <p>${data.message || 'Mensagem indisponível.'}</p>
            <span class="timestamp">${timestamp}</span>
        </div>
        ${!data.read ? '<div class="unread-dot" title="Não lida"></div>' : ''}
    `;

    // Adiciona evento de clique no conteúdo para marcar como lida e navegar
    const contentDiv = li.querySelector('.notification-content');
    contentDiv.addEventListener('click', async (e) => {
        // Ignora cliques no checkbox dentro do conteúdo (se houver)
        if (e.target.type === 'checkbox') return;

        // Marca como lida se ainda não estiver
        if (!data.read && currentUser) {
            const notifRef = doc(db, 'users', currentUser.uid, 'notifications', id);
            try {
                await updateDoc(notifRef, { read: true });
                // A UI será atualizada pelo listener onSnapshot
            } catch (error) {
                console.error("Erro ao marcar notificação como lida:", error);
            }
        }
        // Navega para a URL se existir e não for '#'
        if (data.url && data.url !== '#') {
            window.location.href = data.url;
        }
    });

    // Adiciona evento de mudança no checkbox para gerenciar a seleção
    const checkbox = li.querySelector('.notification-checkbox');
    checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            selectedNotifications.add(id);
        } else {
            selectedNotifications.delete(id);
        }
        // Atualiza o estado dos botões de controle
        updateSelectionControls();
    });

    // Marca o checkbox se a notificação já estiver selecionada (útil ao recarregar)
    checkbox.checked = selectedNotifications.has(id);

    // Adiciona o item renderizado ao container
    container.appendChild(li);
}

/**
 * Renderiza uma entrada de log na lista de histórico.
 * @param {HTMLElement} container - O elemento UL onde o log será adicionado.
 * @param {string} id - O ID do documento do log.
 * @param {object} data - Os dados do log.
 */
function renderLogEntry(container, id, data) {
    const li = document.createElement('li');
    // Adiciona classe 'log-item' para possível estilização diferente
    li.className = `notification-item log-item ${data.originalReadStatus ? 'read' : 'unread'}`; // Usa status original
    li.dataset.logId = id;

    // Formata os timestamps para exibição
    const loggedAtTimestamp = data.loggedAt ? data.loggedAt.toDate().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Data log indisponível';
    const originalTimestamp = data.originalTimestamp ? data.originalTimestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''; // Hora original

    // Cria o HTML interno do item de log
    li.innerHTML = `
        <div class="notification-icon">
            <i class="fa ${getNotificationIcon(data.type)}"></i>
        </div>
        <div class="notification-content">
            <p>${data.message || 'Mensagem indisponível.'}</p>
            <span class="timestamp">Original: ${originalTimestamp} / Log: ${loggedAtTimestamp}</span>
        </div>`;
    // Adiciona o item renderizado ao container
    container.appendChild(li);
}

/**
 * Retorna a classe CSS do ícone Font Awesome com base no tipo de notificação/log.
 * @param {string} type - O tipo da notificação (ex: 'like', 'comment').
 * @returns {string} - A classe CSS do ícone.
 */
function getNotificationIcon(type) {
    switch (type) {
        case 'like': return 'fa-heart text-red-500';
        case 'comment': return 'fa-comment text-green-500';
        case 'friend_request': return 'fa-user-plus text-blue-500';
        case 'task_import_request': return 'fa-download text-purple-500';
        case 'task_deadline': return 'fa-clock text-orange-500'; // Ícone para prazo de tarefa
        default: return 'fa-bell text-gray-500'; // Ícone padrão
    }
}

// =============================================
// LÓGICA DE EVENTOS E AÇÕES DO USUÁRIO
// =============================================

/**
 * Configura os event listeners para os botões e abas da página.
 */
function setupEventListeners() {
    // Listeners para troca de abas
    tabNotifications.addEventListener('click', () => switchTab('notifications-view'));
    tabLogs.addEventListener('click', () => switchTab('logs-view'));

    // Listeners para botões de ação
    markAllAsReadBtn.addEventListener('click', markAllAsRead);
    emptyLogsBtn.addEventListener('click', confirmClearAllLogs);
    selectAllBtn.addEventListener('click', toggleSelectAll);
    deleteSelectedBtn.addEventListener('click', confirmDeleteSelected);
}

/**
 * Alterna a visualização entre as abas de Caixa de Entrada e Histórico.
 * @param {string} tabId - O ID do conteúdo da aba a ser ativada ('notifications-view' ou 'logs-view').
 */
function switchTab(tabId) {
    const isActive = (id) => id === tabId;

    // Alterna a classe 'active' nos botões das abas
    tabNotifications.classList.toggle('active', isActive('notifications-view'));
    tabLogs.classList.toggle('active', isActive('logs-view'));

    // Alterna a classe 'active' nos containers de conteúdo
    viewNotifications.classList.toggle('active', isActive('notifications-view'));
    viewLogs.classList.toggle('active', isActive('logs-view'));

    // Carrega os dados correspondentes à aba ativada
    if (isActive('notifications-view')) {
        loadNotifications(); // Carrega/Escuta notificações
        if (unsubscribeLogs) unsubscribeLogs(); // Para de escutar logs
    } else if (isActive('logs-view')) {
        loadNotificationLogs(); // Carrega/Escuta logs
        if (unsubscribeNotifications) unsubscribeNotifications(); // Para de escutar notificações
    }
}

/**
 * Marca todas as notificações não lidas como lidas no Firestore.
 */
async function markAllAsRead() {
    if (!currentUser || markAllAsReadBtn.disabled) return;

    markAllAsReadBtn.disabled = true; // Desabilita enquanto processa
    markAllAsReadBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Marcando...';

    try {
        const batch = writeBatch(db);
        const notificationsRef = collection(db, 'users', currentUser.uid, 'notifications');
        // Busca apenas as não lidas
        const q = query(notificationsRef, where('read', '==', false));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            markAllAsReadBtn.innerHTML = '<i class="fa-solid fa-check-double"></i> Marcar como Lidas';
            return; // Nada a fazer
        }

        // Adiciona a atualização de cada notificação não lida ao batch
        snapshot.forEach(doc => {
            batch.update(doc.ref, { read: true });
        });

        // Executa o batch
        await batch.commit();
        // A UI será atualizada pelo onSnapshot

    } catch (error) {
        console.error("Erro ao marcar todas como lidas:", error);
        alert("Ocorreu um erro ao marcar as notificações como lidas.");
        markAllAsReadBtn.disabled = false; // Reabilita em caso de erro
    } finally {
        // Garante que o texto do botão volte ao normal, mesmo se onSnapshot demorar
         setTimeout(() => {
             if (!markAllAsReadBtn.disabled) { // Só reabilita se não estiver já desabilitado pelo onSnapshot
                 markAllAsReadBtn.innerHTML = '<i class="fa-solid fa-check-double"></i> Marcar como Lidas';
             }
         }, 500);
    }
}

/**
 * Alterna a seleção de todos os checkboxes na lista de notificações.
 */
function toggleSelectAll() {
    if (selectAllBtn.disabled) return;

    // Inverte o estado de seleção geral
    areAllSelectedState = !areAllSelectedState;

    // Seleciona ou deseleciona todos os checkboxes visíveis
    const allCheckboxes = notificationsList.querySelectorAll('.notification-checkbox');
    allCheckboxes.forEach(checkbox => {
        const id = checkbox.dataset.id;
        // Só altera se o estado atual for diferente do desejado
        if (checkbox.checked !== areAllSelectedState) {
            checkbox.checked = areAllSelectedState;
            // Atualiza o Set de selecionados
            if (areAllSelectedState) {
                selectedNotifications.add(id);
            } else {
                selectedNotifications.delete(id);
            }
        }
    });
    // Atualiza o estado visual dos botões de controle
    updateSelectionControls();
}

/**
 * Atualiza o estado (habilitado/desabilitado) e a aparência dos botões
 * de controle da caixa de entrada com base na seleção atual.
 */
function updateSelectionControls() {
    const numSelected = selectedNotifications.size;
    // Conta apenas os itens que *podem* ser selecionados (exclui placeholders)
    const numTotalSelectable = notificationsList.querySelectorAll('.notification-checkbox').length;
    let hasUnread = false;
    // Verifica se há alguma notificação não lida na lista
    if (numTotalSelectable > 0) {
        hasUnread = !!notificationsList.querySelector('.notification-item.unread:not(.placeholder)');
    }

    // Botão Apagar Selecionadas: Habilitado se houver alguma selecionada
    deleteSelectedBtn.disabled = numSelected === 0;

    // Botão Selecionar Todas: Habilitado se houver itens selecionáveis
    selectAllBtn.disabled = numTotalSelectable === 0;
    // Define o estado intermediário se nem todos estiverem selecionados
    areAllSelectedState = (numSelected === numTotalSelectable && numTotalSelectable > 0);
    updateSelectAllButtonVisualState(); // Atualiza ícone e texto do botão

    // Botão Marcar Todas como Lidas: Habilitado se houver alguma não lida
    markAllAsReadBtn.disabled = !hasUnread;
}

/**
 * Atualiza o ícone e o texto do botão "Selecionar Todas" com base
 * no estado atual da seleção (nenhum, alguns, todos).
 */
function updateSelectAllButtonVisualState() {
    const numSelected = selectedNotifications.size;
    const numTotal = notificationsList.querySelectorAll('.notification-checkbox').length;
    const icon = selectAllBtn.querySelector('i');
    const text = selectAllBtn.querySelector('span');

    if (!icon || !text) return; // Segurança caso os elementos não existam

    if (numSelected === 0 || numTotal === 0) {
        // Nenhum selecionado ou lista vazia
        text.textContent = 'Selecionar Todas';
        icon.className = 'fa-regular fa-square'; // Ícone de quadrado vazio
    } else if (numSelected === numTotal) {
        // Todos selecionados
        text.textContent = 'Desselecionar';
        icon.className = 'fa-solid fa-square-check'; // Ícone de check
    } else {
        // Seleção parcial
        text.textContent = 'Selecionar Todas';
        icon.className = 'fa-solid fa-minus-square'; // Ícone de quadrado com traço (indeterminado)
    }
}

/**
 * Exibe o modal de confirmação antes de apagar as notificações selecionadas.
 */
function confirmDeleteSelected() {
    if (selectedNotifications.size === 0) return; // Não faz nada se nada estiver selecionado
    // Mostra o modal com a mensagem apropriada
    showConfirmModal(
        'Apagar Notificações',
        `Tem certeza que deseja apagar ${selectedNotifications.size} notificação(ões) selecionada(s)? Esta ação não pode ser desfeita.`,
        () => deleteSelectedNotifications() // Passa a função de apagar como callback
    );
}

/**
 * Apaga as notificações selecionadas do Firestore.
 */
async function deleteSelectedNotifications() {
    if (!currentUser || selectedNotifications.size === 0) return;

    // Desabilita o botão e mostra feedback de carregamento
    deleteSelectedBtn.disabled = true;
    deleteSelectedBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Apagando...';

    const batch = writeBatch(db);
    // Adiciona a exclusão de cada notificação selecionada ao batch
    selectedNotifications.forEach(id => {
        batch.delete(doc(db, 'users', currentUser.uid, 'notifications', id));
    });

    try {
        await batch.commit(); // Executa o batch
        // A UI será atualizada automaticamente pelo listener onSnapshot
        // Limpar selectedNotifications é feito dentro do onSnapshot ao recarregar
    } catch (error) {
        console.error("Erro ao apagar notificações selecionadas:", error);
        alert("Ocorreu um erro ao apagar as notificações selecionadas.");
        // Reabilita o botão em caso de erro
        deleteSelectedBtn.innerHTML = '<i class="fa fa-trash"></i> Apagar Selecionadas';
        updateSelectionControls(); // Garante que o estado dos botões seja consistente
    }
    // O finally para resetar o botão é desnecessário aqui, pois o onSnapshot cuidará da UI.
}

/**
 * Exibe o modal de confirmação antes de apagar todos os logs.
 */
function confirmClearAllLogs() {
    if (emptyLogsBtn.disabled) return;
    showConfirmModal(
        'Esvaziar Logs',
        'Tem certeza que deseja apagar permanentemente todo o histórico de notificações (logs)? Esta ação não pode ser desfeita.',
        () => clearAllLogs() // Passa a função de limpar logs como callback
    );
}

/**
 * Apaga todos os documentos da subcoleção notificationLogs do usuário.
 */
async function clearAllLogs() {
    if (!currentUser) return;

    // Desabilita o botão e mostra feedback de carregamento
    emptyLogsBtn.disabled = true;
    emptyLogsBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Esvaziando...';

    try {
        const logsRef = collection(db, 'users', currentUser.uid, 'notificationLogs');
        const snapshot = await getDocs(logsRef); // Busca todos os logs

        if (snapshot.empty) {
            emptyLogsBtn.innerHTML = '<i class="fa-solid fa-eraser"></i> Esvaziar Logs';
            return; // Nada a fazer se já estiver vazio
        }

        const batch = writeBatch(db);
        // Adiciona a exclusão de cada log ao batch
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit(); // Executa o batch
        // A UI será atualizada automaticamente pelo listener onSnapshot ao detectar a coleção vazia

    } catch (error) {
        console.error("Erro ao esvaziar logs:", error);
        alert("Ocorreu um erro ao tentar esvaziar os logs.");
        emptyLogsBtn.disabled = false; // Reabilita em caso de erro
    } finally {
        // Garante que o texto do botão volte ao normal, mesmo se onSnapshot demorar
         setTimeout(() => {
             // Só reabilita se não estiver já desabilitado pelo onSnapshot (que roda se a coleção ficar vazia)
             const logListIsEmpty = notificationLogList.querySelector('.notification-item.empty');
             if (!logListIsEmpty) {
                emptyLogsBtn.disabled = false;
                emptyLogsBtn.innerHTML = '<i class="fa-solid fa-eraser"></i> Esvaziar Logs';
             }
         }, 500); // Pequeno delay para dar tempo do onSnapshot atualizar
    }
}

/**
 * Exibe um modal de confirmação genérico.
 * @param {string} title - O título do modal.
 * @param {string} message - A mensagem de confirmação.
 * @param {function} onConfirm - A função a ser executada se o usuário confirmar.
 */
function showConfirmModal(title, message, onConfirm) {
    // Busca os elementos do modal
    const modalTitle = confirmModal.querySelector('#confirm-modal-title');
    const modalText = confirmModal.querySelector('#confirm-modal-text');
    const okBtn = confirmModal.querySelector('#confirm-modal-ok-btn');
    const cancelBtn = confirmModal.querySelector('#confirm-modal-cancel-btn');

    // Verifica se todos os elementos existem
    if (!confirmModal || !modalTitle || !modalText || !okBtn || !cancelBtn) {
        console.error("Elementos do modal de confirmação não encontrados!");
        // Fallback para o confirm nativo do navegador
        if (confirm(`${title}\n\n${message}`)) {
            onConfirm();
        }
        return;
    }

    // Define o conteúdo do modal
    modalTitle.textContent = title;
    modalText.textContent = message;

    // Exibe o modal
    confirmModal.style.display = 'flex';

    // *** IMPORTANTE: Clona e substitui os botões para remover listeners antigos ***
    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    newOkBtn.addEventListener('click', () => {
        onConfirm(); // Executa a ação de confirmação
        confirmModal.style.display = 'none'; // Esconde o modal
    });

    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    newCancelBtn.addEventListener('click', () => {
        confirmModal.style.display = 'none'; // Apenas esconde o modal
    });

    // Opcional: Fechar ao clicar fora do modal
    confirmModal.onclick = (event) => {
        if (event.target === confirmModal) {
            confirmModal.style.display = 'none';
        }
    };
}