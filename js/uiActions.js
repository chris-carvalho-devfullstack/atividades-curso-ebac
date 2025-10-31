// js/uiActions.js
// Este ficheiro contém as funções que estavam no app.js e que o eventBinder.js precisa.
// Isto quebra a dependência circular.

import { showModal, hideModal } from './modalHandler.js';
import { getTasks, updateSubtasks } from './taskStore.js';
import { findNestedSubtask, generateId } from './utils.js';
import { db } from "./firebase-config.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { initializeAuth, getCurrentUserUID, getUserSettings } from './authManager.js';

// --- Variáveis de estado movidas do app.js ---
export let currentTaskLi = null;
export function setCurrentTaskLi(li) { currentTaskLi = li; }
export let currentSubtaskData = {
    taskId: null, subtaskId: null, isEdit: false, parentId: null,
    priority: 'medium', category: 'geral', dueDate: '', dueTime: ''
};
export function setCurrentSubtaskData(data) { currentSubtaskData = data; }
export function getCurrentSubtaskData() { return { ...currentSubtaskData }; }

// --- Funções de Modal movidas do app.js ---
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

// Função para mostrar/esconder e configurar o menu de opções da subtarefa
export function toggleSubtaskMenu($button, taskId, subtaskId, parentId) {
    const $mainTaskLi = $button.closest('#task-list > li');
    $('#task-list > li').removeClass('menu-active'); 
    $('.subtask-options-menu.active').not($button.siblings('.subtask-options-menu')).removeClass('active');
    
    const $menu = $button.siblings('.subtask-options-menu').first();
    const isActive = $menu.hasClass('active');

    if (!isActive) {
        $menu.addClass('active');
        $mainTaskLi.addClass('menu-active');

        $menu.find('.menu-edit').off('click').on('click', (e) => {
            e.stopPropagation();
            openSubtaskModalForEdit(taskId, subtaskId);
            $menu.removeClass('active');
            $mainTaskLi.removeClass('menu-active');
        });
        $menu.find('.menu-add-below').off('click').on('click', (e) => {
            e.stopPropagation();
            openSubtaskModalForCreate(taskId, parentId);
            $menu.removeClass('active');
            $mainTaskLi.removeClass('menu-active');
        });
        $menu.find('.menu-add-child').off('click').on('click', (e) => {
            e.stopPropagation();
            openSubtaskModalForCreate(taskId, subtaskId);
            $menu.removeClass('active');
            $mainTaskLi.removeClass('menu-active');
        });
        $menu.find('.menu-remove').off('click').on('click', (e) => {
            e.stopPropagation();
            $menu.removeClass('active');
            $mainTaskLi.removeClass('menu-active');
            deleteSubtaskViaModal(taskId, subtaskId);
        });

        setTimeout(() => {
            $(document).one('click.closeSubtaskMenu', (e) => {
                if (!$menu.is(e.target) && $menu.has(e.target).length === 0 && !$button.is(e.target)) {
                    $menu.removeClass('active');
                    $('#task-list > li').removeClass('menu-active');
                }
            });
        }, 0); 
    } else {
        $menu.removeClass('active');
        $mainTaskLi.removeClass('menu-active');
        $(document).off('click.closeSubtaskMenu');
    }
}

export function deleteSubtaskViaModal(taskId, subId) {
    const tasks = getTasks(); const task = tasks.find(t => t.id === taskId); if (!task || !task.subtasks) return;
    const subtask = findNestedSubtask(task.subtasks, subId); if (!subtask) return;
    $('#confirm-title').text('Apagar Subtarefa'); $('#confirm-text').html(`Deseja realmente apagar a subtarefa <strong>"${subtask.text}"</strong> e todos os seus itens aninhados? Esta ação não pode ser desfeita.`); showModal('#confirmModal');
    $('#confirm-ok-btn').off('click').on('click', async function() { $(this).prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Excluindo...'); const recursiveRemove = (subtasksArray) => { if (!subtasksArray) return []; return subtasksArray.filter(sub => sub.id !== subId).map(sub => { if (sub.subtasks?.length > 0) { sub.subtasks = recursiveRemove(sub.subtasks); } return sub; }); }; const updatedSubtasks = recursiveRemove([...task.subtasks]); await updateSubtasks(taskId, updatedSubtasks); hideModal('#confirmModal'); $(this).prop('disabled', false).html('Confirmar'); });
    $('#confirm-cancel-btn').off('click').on('click', function() { hideModal('#confirmModal'); $('#confirm-ok-btn').prop('disabled', false).html('Confirmar'); });
}

// --- Outras Funções Utilitárias movidas do app.js ---
export function exportTaskToGoogleLink(task) {
    if (!task.dueDate) { alert("A tarefa precisa ter uma data para exportar!"); return; } let startDateTime = task.dueDate + (task.dueTime ? `T${task.dueTime}:00Z` : 'T00:00:00Z'); let startDate = new Date(startDateTime); let endDate = new Date(startDate.getTime() + 60 * 60 * 1000); let formatForGoogle = (date) => date.toISOString().replace(/-|:|\.\d+/g, ''); let details = task.subtasks ? task.subtasks.map(st => st.text).join('\n') : ''; let url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(task.text)}&dates=${formatForGoogle(startDate)}/${formatForGoogle(endDate)}&details=${encodeURIComponent(details)}`; window.open(url, '_blank');
}