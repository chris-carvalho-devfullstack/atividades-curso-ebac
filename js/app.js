// js/app.js - Ponto de Entrada Principal e Gerenciador de Eventos

// ===============================================
// 1. IMPORTAÇÕES DE MÓDULOS E FIREBASE
// ===============================================

// Firebase (apenas o necessário para funções que *ainda* residem aqui)
import { db } from "./firebase-config.js"; // Pode ser removido se createTaskDeadlineNotification for movido
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js"; // Para createTaskDeadlineNotification

// Módulos Criados
import { initializeAuth, getCurrentUserUID, getUserSettings } from './authManager.js';
import { showModal, hideModal } from './modalHandler.js';
import {
    addTask, updateTask, deleteTask, updateSubtasks, getTasks, saveTaskOrder,
    restoreTaskFromTrash, permanentlyDeleteTask
} from './taskStore.js';
// Importa APENAS as funções de UI necessárias para serem chamadas DIRETAMENTE pelos event listeners ou funções daqui
import { applyFilter, checkAllDueDates, findNestedSubtask } from './uiRenderer.js';
// Importa showToastNotification se o botão de teste ainda existir
import { showToastNotification } from './toast-notification.js';


// ===============================================
// 2. VARIÁVEIS GLOBAIS (Restantes)
// ===============================================

// Mantidas aqui pois são usadas pelos event listeners para controlar o estado dos modais de edição/subtarefa
let currentTaskLi = null;
let currentSubtaskData = {
    taskId: null, subtaskId: null, isEdit: false, parentId: null,
    priority: 'medium', category: 'geral', dueDate: '', dueTime: ''
};
// Mantidas para a lógica do calendário que ainda reside aqui
let calendar = null;
let calendarInitialized = false;

// ===============================================
// 3. FUNÇÕES QUE AINDA RESIDEM EM APP.JS
//    (Serão movidas futuramente para módulos mais específicos)
// ===============================================

// --- Funções relacionadas aos Modais Específicos ---

// (Estas funções preparam os dados e chamam showModal/hideModal do modalHandler)
export function openSubtaskModalForCreate(taskId, parentId) {
    const tasks = getTasks();
    let parentText = "Tarefa Principal";
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        if (parentId === taskId) {
            parentText = task.text;
        } else if (task.subtasks) {
            // Usa findNestedSubtask importado do uiRenderer (ou mover para utils.js)
            parentText = findNestedSubtask(task.subtasks, parentId)?.text || "Subtarefa";
        }
    }

    currentSubtaskData = { taskId, subtaskId: null, isEdit: false, parentId, priority: 'medium', category: 'geral', dueDate: '', dueTime: '' };

    $('#subtask-modal-title').text(`Adicionar Subtarefa a "${parentText}"`);
    $('#subtask-input').val('');
    $('#subtask-priority').val('medium');
    $('#subtask-category').val('geral');
    $('#subtask-date').val('');
    $('#subtask-time').val('');
    $('#subtask-add-btn').text('Adicionar');
    showModal('#subtask-modal');
}

export function openSubtaskModalForEdit(taskId, subtaskId) {
    const tasks = getTasks();
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return;

    // Usa findNestedSubtask importado do uiRenderer (ou mover para utils.js)
    const subtask = findNestedSubtask(task.subtasks, subtaskId);
    if (!subtask) return;

    currentSubtaskData = { taskId, subtaskId, isEdit: true, parentId: null, priority: subtask.priority || 'medium', category: subtask.category || 'geral', dueDate: subtask.dueDate || '', dueTime: subtask.dueTime || '' };

    $('#subtask-modal-title').text(`Editar Subtarefa: "${subtask.text}"`);
    $('#subtask-input').val(subtask.text);
    $('#subtask-priority').val(currentSubtaskData.priority);
    $('#subtask-category').val(currentSubtaskData.category);
    $('#subtask-date').val(currentSubtaskData.dueDate);
    $('#subtask-time').val(currentSubtaskData.dueTime);
    $('#subtask-add-btn').text('Salvar Edição');
    showModal('#subtask-modal');
}

// (toggleSubtaskMenu e deleteSubtaskViaModal interagem com a UI do menu e o modal de confirmação)
export function toggleSubtaskMenu($button, taskId, subtaskId, parentId) {
    $('.subtask-options-menu').removeClass('active'); // Fecha outros menus
    const $menu = $button.siblings('.subtask-options-menu').first();
    $menu.toggleClass('active');

    // Remove listeners antigos e adiciona novos (essencial ao re-renderizar)
    $menu.find('.menu-edit').off('click').on('click', (e) => { e.stopPropagation(); openSubtaskModalForEdit(taskId, subtaskId); $menu.removeClass('active'); });
    $menu.find('.menu-add-below').off('click').on('click', (e) => { e.stopPropagation(); openSubtaskModalForCreate(taskId, parentId); $menu.removeClass('active'); });
    $menu.find('.menu-add-child').off('click').on('click', (e) => { e.stopPropagation(); openSubtaskModalForCreate(taskId, subtaskId); $menu.removeClass('active'); });
    $menu.find('.menu-remove').off('click').on('click', (e) => { e.stopPropagation(); $menu.removeClass('active'); deleteSubtaskViaModal(taskId, subtaskId); }); // Chama a função daqui

    // Fecha o menu se clicar fora
    setTimeout(() => { $(document).one('click', (e) => { if (!$menu.is(e.target) && $menu.has(e.target).length === 0 && !$button.is(e.target)) $menu.removeClass('active'); }); }, 0);
}


export function deleteSubtaskViaModal(taskId, subId) {
    const tasks = getTasks();
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return;

    // Usa findNestedSubtask importado do uiRenderer (ou mover para utils.js)
    const subtask = findNestedSubtask(task.subtasks, subId);
    if (!subtask) return;

    $('#confirm-title').text('Apagar Subtarefa');
    $('#confirm-text').html(`Deseja realmente apagar a subtarefa <strong>"${subtask.text}"</strong> e todos os seus itens aninhados? Esta ação não pode ser desfeita.`);
    showModal('#confirmModal');

    // Configura botões do modal de confirmação
    $('#confirm-ok-btn').off('click').on('click', async function() {
        $(this).prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Excluindo...');

        // Lógica de remoção recursiva (poderia ir para taskStore ou utils)
        const recursiveRemove = (subtasksArray) => {
            if (!subtasksArray) return [];
            return subtasksArray.filter(sub => sub.id !== subId).map(sub => {
                if (sub.subtasks?.length > 0) { // Optional chaining
                    sub.subtasks = recursiveRemove(sub.subtasks);
                }
                return sub;
            });
        };
        const updatedSubtasks = recursiveRemove([...task.subtasks]); // Passa cópia

        await updateSubtasks(taskId, updatedSubtasks); // Chama a função do taskStore

        hideModal('#confirmModal');
        $(this).prop('disabled', false).html('Confirmar'); // Reseta o botão OK
    });

    $('#confirm-cancel-btn').off('click').on('click', function() {
        hideModal('#confirmModal');
        $('#confirm-ok-btn').prop('disabled', false).html('Confirmar'); // Reseta o botão OK ao cancelar
    });
}


// --- Funções Relacionadas ao Calendário ---

// <<< EXPORT ADICIONADO >>> (Necessário para authManager)
export function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (calendarEl && typeof FullCalendar !== 'undefined' && FullCalendar.Calendar && !calendarInitialized) {
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'timeGridWeek', locale: 'pt-br',
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' },
            events: [], // Eventos serão adicionados por syncAllToCalendar
            eventClick: function (info) { // Manipulador de clique
                const { taskId, subtaskId } = info.event.extendedProps;
                hideModal('.modal.show'); // Fecha qualquer modal aberto
                if (subtaskId) { openSubtaskModalForEdit(taskId, subtaskId); } // Abre modal de edição de subtarefa
                else { // Abre modal de edição de tarefa principal
                    const li = $(`#task-list > li[data-id="${taskId}"]`);
                    if (li.length) li.find('.edit-btn').first().trigger('click'); // Simula clique no botão editar
                }
            }
        });
        calendar.render();
        calendarInitialized = true;
        syncAllToCalendar(); // Sincroniza tarefas existentes ao inicializar
        console.log("Calendário inicializado.");
    } else if (calendarInitialized) {
        console.log("Calendário já inicializado.");
        // Garante que o calendário seja re-renderizado se já existia (útil em HMR ou re-inicializações)
        setTimeout(() => { if (calendar) calendar.render(); }, 10);
    }
}

// Sincroniza tarefas do taskStore com o FullCalendar
function syncAllToCalendar() {
    if (!calendarInitialized || !calendar) return;

    calendar.getEvents().forEach(event => event.remove()); // Limpa eventos antigos
    const tasks = getTasks(); // Pega tarefas do taskStore

    const addEventToCalendar = (item, parentTaskId = null) => {
        if (item.dueDate) {
            calendar.addEvent({
                id: parentTaskId ? `${parentTaskId}_${item.id}` : item.id,
                title: item.text,
                start: item.dueDate + (item.dueTime ? `T${item.dueTime}` : ''), // Assume fuso local se não especificado
                allDay: !item.dueTime,
                color: item.completed ? '#6c757d' : (item.priority === 'high' ? '#dc3545' : item.priority === 'medium' ? '#ffc107' : '#28a745'), // Cores baseadas em prioridade/status
                extendedProps: { taskId: parentTaskId || item.id, subtaskId: parentTaskId ? item.id : null }
            });
        }
    };

    tasks.forEach(task => {
        addEventToCalendar(task);
        if (task.subtasks?.length > 0) { // Optional chaining
            const traverseSubtasks = (subtasks, parentId) => {
                subtasks.forEach(sub => {
                    addEventToCalendar(sub, parentId);
                    if (sub.subtasks?.length > 0) { // Optional chaining
                        traverseSubtasks(sub.subtasks, parentId);
                    }
                });
            };
            traverseSubtasks(task.subtasks, task.id);
        }
    });
     console.log("Calendário sincronizado com", tasks.length, "tarefas.");
}

// --- Outras Funções Utilitárias que Restaram ---

// Exporta tarefa para link do Google Calendar
export function exportTaskToGoogleLink(task) {
    if (!task.dueDate) { alert("A tarefa precisa ter uma data para exportar!"); return; }
    // Usa UTC para evitar problemas de fuso no link
    let startDateTime = task.dueDate + (task.dueTime ? `T${task.dueTime}:00Z` : 'T00:00:00Z');
    let startDate = new Date(startDateTime);
    // Adiciona 1 hora de duração por padrão
    let endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    // Formato YYYYMMDDTHHMMSSZ exigido pelo Google Calendar
    let formatForGoogle = (date) => date.toISOString().replace(/-|:|\.\d+/g, '');

    let details = task.subtasks ? task.subtasks.map(st => st.text).join('\n') : '';
    let url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(task.text)}&dates=${formatForGoogle(startDate)}/${formatForGoogle(endDate)}&details=${encodeURIComponent(details)}`;
    window.open(url, '_blank');
}

// Função para criar notificação de prazo (ainda aqui pois depende de `serverTimestamp` e `getUserSettings`)
async function createTaskDeadlineNotification(taskId, taskText, dueDateTime) {
    const uid = getCurrentUserUID();
    if (!uid) return;

    try {
        const settings = getUserSettings();
        const notificationsRef = collection(db, 'users', uid, 'notifications');
        const leadingTime = settings.taskSettings.alertLeadTimeMinutes || 60;

        await addDoc(notificationsRef, {
            type: 'task_deadline',
            message: `Atenção: A tarefa "${taskText}" vence em menos de ${leadingTime} minutos (${dueDateTime}).`,
            url: `/index.html#task-${taskId}`, // Link direto para a tarefa (requer ajuste no HTML se não existir)
            read: false,
            timestamp: serverTimestamp() // Importado do Firebase
        });
        console.log(`Notificação de prazo criada para a tarefa: ${taskId}`);
    } catch (error) {
        console.error("Erro ao criar notificação de prazo:", error);
    }
}


// ===============================================
// 4. EVENT HANDLERS (Função principal exportada)
// ===============================================

// <<< EXPORT ADICIONADO >>> (Necessário para authManager)
export function setupCommonEventListeners() {
    console.log("Configurando Event Listeners comuns...");

    // Verifica a data de vencimento a cada 60 segundos
    // A função checkAllDueDates foi movida para uiRenderer, mas precisa ser chamada daqui.
    // Importa checkAllDueDates do uiRenderer
    setInterval(checkAllDueDates, 60 * 1000);

    // --- Abertura de Modais ---
    // (Listeners para #toggle-form-btn, #toggle-filter-btn, #toggle-trash-btn, #toggle-calendar-btn INALTERADOS)
    $('#toggle-form-btn').off('click').on('click', () => { showModal('#addTaskModal'); setTimeout(() => $('#task-text').focus(), 150); });
    $('#toggle-filter-btn').off('click').on('click', () => { showModal('#filterModal'); setTimeout(() => $('#search-input').focus(), 150); });
    $('#toggle-trash-btn').off('click').on('click', () => showModal('#trashModal'));
    $('#toggle-calendar-btn').off('click').on('click', () => {
        const $container = $('#calendar-container');
        if ($container.is(':visible')) $container.slideUp(180);
        else $container.slideDown(180, () => {
            if (!calendarInitialized) initCalendar();
            setTimeout(() => { if (calendar) calendar.render(); }, 10);
             // Sincroniza novamente ao abrir, caso tarefas tenham mudado
             syncAllToCalendar();
        });
    });

    // --- Fechamento de Modais ---
    // (Listeners INALTERADOS)
    $('#add-task-cancel-btn').off('click').on('click', () => hideModal('#addTaskModal'));
    $('#filter-apply-btn').off('click').on('click', () => { applyFilter(); hideModal('#filterModal'); }); // applyFilter importado de uiRenderer
    $('#filter-cancel-btn').off('click').on('click', () => hideModal('#filterModal'));
    $('.modal .close, .modal .close-top-right').off('click').on('click', function() { hideModal($(this).closest('.modal')); });
    $('#edit-cancel-btn').off('click').on('click', () => hideModal('#editTaskModal'));
    $('#subtask-cancel-btn').off('click').on('click', () => hideModal('#subtask-modal'));
    $('#view-close-btn').off('click').on('click', () => hideModal('#viewTaskModal'));
    $(document).off('keydown').on('keydown', (e) => { if (e.key === 'Escape') $('.modal.show').each(function () { hideModal($(this)); }); });

    // --- Formulário Principal (Adicionar Tarefa) ---
    $('#task-form').off('submit').on('submit', async function (e) { // <<< USA addTask >>>
        e.preventDefault();
        let text = $('#task-text').val()?.trim(); // Optional chaining
        if (!text) return;
        let task = {
            text, completed: false,
            priority: $('#task-priority').val() || 'medium',
            dueDate: $('#task-date').val() || null, // Usa null se vazio
            dueTime: $('#task-time').val() || null, // Usa null se vazio
            category: $('#task-category').val() || 'geral',
            privacy: $('#task-privacy').val() || 'private',
            subtasks: []
        };
        // Limpa campos vazios para não salvar no Firestore/LS desnecessariamente
        if (!task.dueDate) delete task.dueDate;
        if (!task.dueTime) delete task.dueTime;

        await addTask(task); // Chama a função abstrata do taskStore

        // Limpa o formulário
        $('#task-text').val(''); $('#task-priority').val('medium'); $('#task-date').val('');
        $('#task-time').val(''); $('#task-category').val('geral'); $('#task-privacy').val('private');
        hideModal('#addTaskModal');
    });

    // --- Checkboxes ---
    // Removemos os listeners .task-checkbox e .subtask-checkbox daqui,
    // pois a lógica de atualização foi movida para updateTask/updateSubtasks no taskStore,
    // e a atualização da UI (classe 'completed') será feita pelo uiRenderer.
    // Os event listeners para os checkboxes serão recriados em eventBinder.js

    // --- Botões de Tarefa ---
    // Removemos os listeners .remove-btn e .edit-btn daqui.
    // Eles serão recriados em eventBinder.js

    $('#edit-save-btn').off('click').on('click', async function() { // <<< USA updateTask >>>
        if (!currentTaskLi) return;
        let taskId = currentTaskLi.attr('data-id');
        const updatedData = {
            text: $('#edit-task-name').val()?.trim() || 'Tarefa', // Optional chaining
            priority: $('#edit-task-priority').val(),
            category: $('#edit-task-category').val(),
            dueDate: $('#edit-task-date').val() || null, // Usa null
            dueTime: $('#edit-task-time').val() || null, // Usa null
            privacy: $('#edit-task-privacy').val(),
        };
         // Limpa campos vazios
        if (!updatedData.dueDate) delete updatedData.dueDate;
        if (!updatedData.dueTime) delete updatedData.dueTime;

        await updateTask(taskId, updatedData); // Chama a função abstrata do taskStore
        hideModal('#editTaskModal');
        currentTaskLi = null;
    });

    // --- Botões de Subtarefa ---
    // Removemos o listener .add-subtask-btn daqui.
    // Será recriado em eventBinder.js

    $('#subtask-add-btn').off('click').on('click', async function () { // <<< USA updateSubtasks, getTasks, findNestedSubtask >>>
        const { taskId, subtaskId, isEdit, parentId } = currentSubtaskData;
        const subtaskText = $('#subtask-input').val()?.trim(); // Optional chaining
        if (!subtaskText || !taskId) return;

        const tasks = getTasks();
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        const newSubtaskData = {
            text: subtaskText,
            priority: $('#subtask-priority').val() || 'medium',
            category: $('#subtask-category').val() || 'geral',
            dueDate: $('#subtask-date').val() || null, // Usa null
            dueTime: $('#subtask-time').val() || null, // Usa null
        };
         // Limpa campos vazios
        if (!newSubtaskData.dueDate) delete newSubtaskData.dueDate;
        if (!newSubtaskData.dueTime) delete newSubtaskData.dueTime;

        let updatedSubtasks;
        let originalSubtasks = task.subtasks ? [...task.subtasks] : [];

        // Lógica de adicionar/editar (pode ir para taskStore?)
         const findAndUpdate = (subs, id, data) => {
             if (!subs) return [];
            return subs.map(sub => {
                if (sub.id === id) return { ...sub, ...data }; // Atualiza
                 if (sub.subtasks?.length > 0) sub.subtasks = findAndUpdate(sub.subtasks, id, data); // Recursivo
                 return sub;
            });
        };
         const findAndAdd = (subs, pId, newSub) => {
             if (!subs) return pId === taskId ? [newSub] : []; // Adiciona no nível raiz se subs for null e parentId for taskId
             if (pId === taskId) return [...subs, newSub]; // Adiciona no nível raiz
             return subs.map(sub => {
                 if (sub.id === pId) {
                     sub.subtasks = sub.subtasks ? [...sub.subtasks, newSub] : [newSub]; // Adiciona filho
                 } else if (sub.subtasks?.length > 0) {
                     sub.subtasks = findAndAdd(sub.subtasks, pId, newSub); // Recursivo
                 }
                 return sub;
             });
         };


        if (isEdit) {
            updatedSubtasks = findAndUpdate(originalSubtasks, subtaskId, newSubtaskData);
        } else {
             // generateId está importado de utils.js
            const newSubtask = { id: generateId(), completed: false, subtasks: [], ...newSubtaskData };
            updatedSubtasks = findAndAdd(originalSubtasks, parentId, newSubtask);
        }

        await updateSubtasks(taskId, updatedSubtasks); // Chama a função abstrata do taskStore

        hideModal('#subtask-modal');
        // Reset manual dos dados do modal (mantido)
        currentSubtaskData = { taskId: null, subtaskId: null, isEdit: false, parentId: null, priority: 'medium', category: 'geral', dueDate: '', dueTime: '' };
        $('#subtask-modal-title').text('Adicionar Subtarefa');$('#subtask-input').val('');$('#subtask-priority').val('medium');$('#subtask-category').val('geral');$('#subtask-date').val('');$('#subtask-time').val('');$('#subtask-add-btn').text('Adicionar');
    });

    // --- Filtros ---
    // (Listeners INALTERADOS, chamam applyFilter importado de uiRenderer)
    $('#search-input').off('input').on('input', applyFilter);
    $('#filter-priority').off('change').on('change', applyFilter);
    $('#filter-category').off('change').on('change', applyFilter);

    // --- Sortable ---
    // A inicialização do sortable foi movida para uiRenderer (chamada após renderAllTasks)
    // O listener de 'update' para salvar a ordem permanece aqui.
    $('#task-list').sortable({
        update: async function (event, ui) { // <<< USA saveTaskOrder >>>
             // Evita salvar se o item voltou à posição original
             if (ui.sender) return; // Não salva se veio de outra lista (caso de subtarefas no futuro)
            const orderedIds = $(this).children('li').map(function() { return $(this).attr('data-id'); }).get();
            await saveTaskOrder(orderedIds); // Chama a função abstrata do taskStore
        },
        placeholder: "ui-state-highlight", forcePlaceholderSize: true, axis: "y", cursor: "grabbing", opacity: 0.8,
        items: "> li" // Garante que apenas LIs diretas sejam ordenáveis
    });


    // --- Botão de Expandir/Colapsar Subtarefas ---
    // Listener removido daqui, será recriado em eventBinder.js

    // --- Abrir Modal de Visualização (Clicando no Label) ---
    // Listener removido daqui, será recriado em eventBinder.js

    // --- Lixeira ---
    // Listeners para .btn-restore e .btn-delete-permanently, e #empty-trash-btn INALTERADOS
    // Eles chamam as funções importadas do taskStore.
     $(document).off('click', '.btn-restore').on('click', '.btn-restore', function() {
        const taskId = $(this).data('id');
        restoreTaskFromTrash(taskId);
    });
     $(document).off('click', '.btn-delete-permanently').on('click', '.btn-delete-permanently', function() {
        const taskId = $(this).data('id');
         const trash = getTrash(); // Pega do taskStore
         const task = trash.find(t => t.id === taskId);
        $('#confirm-title').text('Excluir Permanentemente');
        $('#confirm-text').text(`Tem certeza que deseja excluir a tarefa "${task?.text || 'Tarefa'}" permanentemente? Esta ação NÃO pode ser desfeita.`);
        showModal('#confirmModal');
        $('#confirm-ok-btn').off('click').on('click', async () => { await permanentlyDeleteTask(taskId); hideModal('#confirmModal'); });
        $('#confirm-cancel-btn').off('click').on('click', () => hideModal('#confirmModal'));
    });
     $('#empty-trash-btn').off('click').on('click', function() {
        const trash = getTrash(); // Pega do taskStore
        if (trash.length === 0) { alert("A lixeira já está vazia."); return; }
        $('#confirm-title').text('Esvaziar Lixeira');
        $('#confirm-text').text(`Tem certeza que deseja excluir permanentemente TODOS os ${trash.length} itens da lixeira? Esta ação NÃO pode ser desfeita.`);
        showModal('#confirmModal');
        $('#confirm-ok-btn').off('click').on('click', async () => {
             $('#confirm-ok-btn').prop('disabled', true).text('Esvaziando...');
             const deletePromises = trash.map(item => permanentlyDeleteTask(item.id));
             try { await Promise.all(deletePromises); }
             catch (error) { console.error("Erro ao esvaziar a lixeira:", error); alert("Ocorreu um erro ao esvaziar a lixeira."); }
             finally { hideModal('#confirmModal'); $('#confirm-ok-btn').prop('disabled', false).text('Confirmar'); }
         });
        $('#confirm-cancel-btn').off('click').on('click', () => hideModal('#confirmModal'));
     });

    // --- Scroll da Navbar ---
    // (Lógica INALTERADA)
    let lastScrollTop = 0;
    const nav = document.querySelector("nav");
    if(nav) { window.addEventListener("scroll", () => { let currentScroll = window.pageYOffset || document.documentElement.scrollTop; if (currentScroll > lastScrollTop && currentScroll > 100) nav.classList.add("hidden"); else if (currentScroll < lastScrollTop) nav.classList.remove("hidden"); lastScrollTop = currentScroll <= 0 ? 0 : currentScroll; }); }

     // --- Botão de Teste Toast ---
     // (Lógica INALTERADA, usa showToastNotification importado)
     const testButton = document.getElementById('test-toast-btn');
     if (testButton) {
         // Remove listener antigo para evitar duplicação
         const newTestButton = testButton.cloneNode(true);
         testButton.parentNode.replaceChild(newTestButton, testButton);
         newTestButton.addEventListener('click', () => {
             console.log("Botão de teste do toast clicado!");
             showToastNotification('Notificação de Teste', 'Esta é uma mensagem de teste manual.', 'default', 5000);
         });
     } else { console.warn("Botão de teste do toast (#test-toast-btn) não encontrado."); }

     console.log("Event Listeners comuns configurados.");
}

// ===============================================
// INICIALIZAÇÃO
// ===============================================
initializeAuth(); // Chama a função do authManager para iniciar o processo

// setupCommonEventListeners será chamado DENTRO do initializeAuth após a sessão ser definida.