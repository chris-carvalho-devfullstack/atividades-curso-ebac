// js/app.js - Ponto de Entrada Principal e Funções Residuais

// ===============================================
// 1. IMPORTAÇÕES DE MÓDULOS E FIREBASE
// ===============================================

import { db } from "./firebase-config.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { initializeAuth, getCurrentUserUID, getUserSettings } from './authManager.js';
import { showModal, hideModal } from './modalHandler.js';
import { getTasks, updateSubtasks } from './taskStore.js';
// *** CORRIGIDO: Importa findNestedSubtask de utils.js ***
import { findNestedSubtask } from './utils.js';
import { showToastNotification } from './toast-notification.js'; // Mantido para createTaskDeadlineNotification (se mover, remover)

// ===============================================
// 2. VARIÁVEIS GLOBAIS (Restantes e Exportadas)
// ===============================================

// Exportadas para serem usadas/modificadas por eventBinder.js
export let currentTaskLi = null;
export function setCurrentTaskLi(li) { currentTaskLi = li; }
export let currentSubtaskData = {
    taskId: null, subtaskId: null, isEdit: false, parentId: null,
    priority: 'medium', category: 'geral', dueDate: '', dueTime: ''
};
export function setCurrentSubtaskData(data) { currentSubtaskData = data; }
export function getCurrentSubtaskData() { return { ...currentSubtaskData }; } // Retorna cópia

// Mantidas internas para o calendário
let calendar = null;
let calendarInitialized = false;

// ===============================================
// 3. FUNÇÕES QUE AINDA RESIDEM EM APP.JS
// ===============================================

// --- Funções relacionadas aos Modais Específicos ---
// (Estas permanecem exportadas para eventBinder.js)
export function openSubtaskModalForCreate(taskId, parentId) {
    const tasks = getTasks(); let parentText = "Tarefa Principal"; const task = tasks.find(t => t.id === taskId);
    if (task) { if (parentId === taskId) { parentText = task.text; } else if (task.subtasks) { parentText = findNestedSubtask(task.subtasks, parentId)?.text || "Subtarefa"; } }
    setCurrentSubtaskData({ taskId, subtaskId: null, isEdit: false, parentId, priority: 'medium', category: 'geral', dueDate: '', dueTime: '' });
    $('#subtask-modal-title').text(`Adicionar Subtarefa a "${parentText}"`); $('#subtask-input').val(''); $('#subtask-priority').val('medium'); $('#subtask-category').val('geral'); $('#subtask-date').val(''); $('#subtask-time').val(''); $('#subtask-add-btn').text('Adicionar');
    showModal('#subtask-modal');
}
export function openSubtaskModalForEdit(taskId, subtaskId) {
    const tasks = getTasks(); const task = tasks.find(t => t.id === taskId); if (!task || !task.subtasks) return;
    const subtask = findNestedSubtask(task.subtasks, subtaskId); if (!subtask) return;
    setCurrentSubtaskData({ taskId, subtaskId, isEdit: true, parentId: null, priority: subtask.priority || 'medium', category: subtask.category || 'geral', dueDate: subtask.dueDate || '', dueTime: subtask.dueTime || '' });
    $('#subtask-modal-title').text(`Editar Subtarefa: "${subtask.text}"`); $('#subtask-input').val(subtask.text); $('#subtask-priority').val(currentSubtaskData.priority); $('#subtask-category').val(currentSubtaskData.category); $('#subtask-date').val(currentSubtaskData.dueDate); $('#subtask-time').val(currentSubtaskData.dueTime); $('#subtask-add-btn').text('Salvar Edição');
    showModal('#subtask-modal');
}
export function toggleSubtaskMenu($button, taskId, subtaskId, parentId) {
    $('.subtask-options-menu').removeClass('active'); const $menu = $button.siblings('.subtask-options-menu').first(); $menu.toggleClass('active');
    $menu.find('.menu-edit').off('click').on('click', (e) => { e.stopPropagation(); openSubtaskModalForEdit(taskId, subtaskId); $menu.removeClass('active'); });
    $menu.find('.menu-add-below').off('click').on('click', (e) => { e.stopPropagation(); openSubtaskModalForCreate(taskId, parentId); $menu.removeClass('active'); });
    $menu.find('.menu-add-child').off('click').on('click', (e) => { e.stopPropagation(); openSubtaskModalForCreate(taskId, subtaskId); $menu.removeClass('active'); });
    $menu.find('.menu-remove').off('click').on('click', (e) => { e.stopPropagation(); $menu.removeClass('active'); deleteSubtaskViaModal(taskId, subtaskId); });
    setTimeout(() => { $(document).one('click', (e) => { if (!$menu.is(e.target) && $menu.has(e.target).length === 0 && !$button.is(e.target)) $menu.removeClass('active'); }); }, 0);
}
export function deleteSubtaskViaModal(taskId, subId) {
    const tasks = getTasks(); const task = tasks.find(t => t.id === taskId); if (!task || !task.subtasks) return;
    const subtask = findNestedSubtask(task.subtasks, subId); if (!subtask) return;
    $('#confirm-title').text('Apagar Subtarefa'); $('#confirm-text').html(`Deseja realmente apagar a subtarefa <strong>"${subtask.text}"</strong> e todos os seus itens aninhados? Esta ação não pode ser desfeita.`); showModal('#confirmModal');
    $('#confirm-ok-btn').off('click').on('click', async function() { $(this).prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Excluindo...'); const recursiveRemove = (subtasksArray) => { if (!subtasksArray) return []; return subtasksArray.filter(sub => sub.id !== subId).map(sub => { if (sub.subtasks?.length > 0) { sub.subtasks = recursiveRemove(sub.subtasks); } return sub; }); }; const updatedSubtasks = recursiveRemove([...task.subtasks]); await updateSubtasks(taskId, updatedSubtasks); hideModal('#confirmModal'); $(this).prop('disabled', false).html('Confirmar'); });
    $('#confirm-cancel-btn').off('click').on('click', function() { hideModal('#confirmModal'); $('#confirm-ok-btn').prop('disabled', false).html('Confirmar'); });
}

// --- Funções Relacionadas ao Calendário ---
// (initCalendar é exportada para authManager, syncAllToCalendar é interna)
export function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (calendarEl && typeof FullCalendar !== 'undefined' && FullCalendar.Calendar && !calendarInitialized) {
        calendar = new FullCalendar.Calendar(calendarEl, { initialView: 'timeGridWeek', locale: 'pt-br', headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' }, events: [],
            eventClick: function (info) { const { taskId, subtaskId } = info.event.extendedProps; hideModal('.modal.show'); if (subtaskId) { openSubtaskModalForEdit(taskId, subtaskId); } else { const li = $(`#task-list > li[data-id="${taskId}"]`); if (li.length) li.find('.edit-btn').first().trigger('click'); } }
        });
        try { calendar.render(); calendarInitialized = true; syncAllToCalendar(); console.log("Calendário inicializado."); } catch (e) { console.error("Erro ao renderizar calendário:", e); calendarInitialized = false; }
    } else if (calendarInitialized && calendar) { console.log("Tentando re-renderizar calendário existente."); setTimeout(() => { if (calendar) calendar.render(); }, 10); syncAllToCalendar(); }
}
function syncAllToCalendar() {
    if (!calendarInitialized || !calendar) return; calendar.getEvents().forEach(event => event.remove()); const tasks = getTasks();
    const addEventToCalendar = (item, parentTaskId = null) => { if (item.dueDate) { let startDateTime = item.dueDate + (item.dueTime ? `T${item.dueTime}` : ''); try { new Date(startDateTime); calendar.addEvent({ id: parentTaskId ? `${parentTaskId}_${item.id}` : item.id, title: item.text || 'Tarefa sem nome', start: startDateTime, allDay: !item.dueTime, color: item.completed ? '#6c757d' : (item.priority === 'high' ? '#dc3545' : item.priority === 'medium' ? '#ffc107' : '#28a745'), extendedProps: { taskId: parentTaskId || item.id, subtaskId: parentTaskId ? item.id : null } }); } catch(e) { console.warn(`Data inválida ignorada para evento do calendário: ${startDateTime}`); } } };
    tasks.forEach(task => { addEventToCalendar(task); if (task.subtasks?.length > 0) { const traverseSubtasks = (subtasks, parentId) => { subtasks.forEach(sub => { addEventToCalendar(sub, parentId); if (sub.subtasks?.length > 0) { traverseSubtasks(sub.subtasks, parentId); } }); }; traverseSubtasks(task.subtasks, task.id); } });
    console.log("Calendário sincronizado com", tasks.length, "tarefas.");
}

// --- Outras Funções Utilitárias que Restaram ---
// (exportTaskToGoogleLink exportada para eventBinder, createTaskDeadlineNotification interna)
export function exportTaskToGoogleLink(task) {
    if (!task.dueDate) { alert("A tarefa precisa ter uma data para exportar!"); return; } let startDateTime = task.dueDate + (task.dueTime ? `T${task.dueTime}:00Z` : 'T00:00:00Z'); let startDate = new Date(startDateTime); let endDate = new Date(startDate.getTime() + 60 * 60 * 1000); let formatForGoogle = (date) => date.toISOString().replace(/-|:|\.\d+/g, ''); let details = task.subtasks ? task.subtasks.map(st => st.text).join('\n') : ''; let url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(task.text)}&dates=${formatForGoogle(startDate)}/${formatForGoogle(endDate)}&details=${encodeURIComponent(details)}`; window.open(url, '_blank');
}
async function createTaskDeadlineNotification(taskId, taskText, dueDateTime) {
     const uid = getCurrentUserUID(); if (!uid) return; try { const settings = getUserSettings(); const notificationsRef = collection(db, 'users', uid, 'notifications'); const leadingTime = settings.taskSettings.alertLeadTimeMinutes || 60; await addDoc(notificationsRef, { type: 'task_deadline', message: `Atenção: A tarefa "${taskText}" vence em menos de ${leadingTime} minutos (${dueDateTime}).`, url: `/index.html#task-${taskId}`, read: false, timestamp: serverTimestamp() }); console.log(`Notificação de prazo criada para a tarefa: ${taskId}`); } catch (error) { console.error("Erro ao criar notificação de prazo:", error); }
}

// ===============================================
// INICIALIZAÇÃO
// ===============================================
initializeAuth(); // Chama a função do authManager para iniciar o processo
// setupCommonEventListeners foi movido para eventBinder.js e será chamado pelo authManager.