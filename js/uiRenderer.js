// js/uiRenderer.js
import { getTasks, getTrash } from './taskStore.js';
import { getUserSettings } from './authManager.js';
import { generateId, findNestedSubtask } from './utils.js'; // <<< Importa findNestedSubtask de utils.js
// Temporário: Funções de modal/menu ainda em app.js (ou serão movidas para eventBinder/app)
// Estas importações podem ser removidas se os listeners forem movidos para eventBinder.js
import { openSubtaskModalForEdit } from './app.js';
import { exportTaskToGoogleLink } from './app.js';


// ===============================================
// Funções de Renderização Principal (Exportadas)
// ===============================================

export function renderAllTasks(tasksArray) {
    const taskList = $('#task-list');
    taskList.empty();
    if (tasksArray && tasksArray.length > 0) {
        tasksArray.forEach(task => addTaskHTML(task));
        // Inicializa sortable APÓS todos os itens serem adicionados
        initSortableSubtasks(taskList); // Chama a função auxiliar
    } else {
        taskList.append('<li class="empty-list-message">Nenhuma tarefa encontrada.</li>');
    }
    updateProgress();
    checkAllDueDates(); // Verifica prazos após renderizar
}

export function renderTrash(trashArray) {
    const trashList = $('#trash-list');
    trashList.empty();
    if (!trashArray || trashArray.length === 0) {
        trashList.append('<li class="empty-list-message" style="justify-content:center;">Lixeira vazia.</li>');
    } else {
        trashArray.forEach(task => {
            const deletedAtDate = task.deletedAt?.toDate ? task.deletedAt.toDate() : null;
            const deletedAtString = deletedAtDate ? deletedAtDate.toLocaleDateString() : 'Data inválida';
            const li = $(`
                <li>
                    <span class="trash-item-text">${task.text || 'Tarefa sem nome'} (Excluído em: ${deletedAtString})</span>
                    <div class="trash-item-actions">
                        <button class="btn-restore" data-id="${task.id}" title="Restaurar Tarefa"><i class="fas fa-undo"></i></button>
                        <button class="btn-delete-permanently" data-id="${task.id}" title="Excluir Permanentemente"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </li>
            `);
            trashList.append(li);
        });
    }
}

// ===============================================
// Funções de Renderização Detalhada (Internas/Auxiliares)
// ===============================================

function addTaskHTML(task) {
    const taskPriority = task.priority || 'medium';
    const taskCategory = task.category || 'geral';
    const taskId = task.id; // Garante que temos o ID

    if (!taskId) {
        console.error("Tentativa de renderizar tarefa sem ID:", task);
        return; // Não renderiza tarefa sem ID
    }

    let li = $('<li></li>').attr('data-id', taskId).attr('data-category', taskCategory).addClass('priority-' + taskPriority);
    let taskDiv = $('<div class="task-main"></div>');
    let textDiv = $('<div class="task-text"></div>');
    let checkbox = $('<input type="checkbox" class="task-checkbox">').prop('checked', task.completed || false);
    let label = $('<label></label>').text(task.text || 'Tarefa sem nome');
    if (task.completed) label.addClass('completed');

    let privacyIcon = $('<i class="privacy-icon"></i>');
    if (task.privacy === 'public') privacyIcon.addClass('fa fa-globe').attr('title', 'Pública');
    else if (task.privacy === 'shared') privacyIcon.addClass('fa fa-users').attr('title', 'Compartilhada');
    else privacyIcon.addClass('fa fa-lock').attr('title', 'Privada');
    textDiv.append(privacyIcon, checkbox, label);

    let prioCatDiv = $('<div class="task-priority-category"></div>');
    let priorityLabel = $('<span class="priority-label"></span>').addClass('priority-' + taskPriority).text(taskPriority.charAt(0).toUpperCase() + taskPriority.slice(1));
    let categorySpan = $('<span class="task-category"></span>').text(taskCategory.charAt(0).toUpperCase() + taskCategory.slice(1)).attr('data-tooltip', 'Categoria: ' + taskCategory.charAt(0).toUpperCase() + taskCategory.slice(1));
    prioCatDiv.append(priorityLabel, categorySpan);
    textDiv.append(prioCatDiv);

    if (task.dueDate) {
        let dateText = 'Data inválida';
        try { dateText = new Date(task.dueDate + 'T00:00:00Z').toLocaleDateString(undefined, { timeZone: 'UTC' }); } catch(e) { /* Ignora data inválida */ }
        let timeText = task.dueTime ? ` ${task.dueTime}` : '';
        let dateLabel = $('<span class="task-datetime"></span>').text(`📅 ${dateText}${timeText}`);
        textDiv.append(dateLabel);
    }

    let btnGroup = $('<div class="button-group"></div>');
    if (task.subtasks && task.subtasks.length > 0) {
        btnGroup.append($('<button type="button" class="toggle-subtasks-btn" title="Mostrar/Ocultar Subtarefas">▼</button>'));
    }

    if (task.dueDate) {
        let googleBtn = $('<button class="google-calendar-btn" type="button" title="Agendar no Google Agenda"><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Google_Calendar_icon_%282020%29.svg/512px-Google_Calendar_icon_%282020%29.svg.png" alt="Google Agenda"></button>');
        // O listener será adicionado em eventBinder.js usando delegação
        btnGroup.append(googleBtn);
    }

    let editBtn = $('<button class="edit-btn" type="button" title="Editar Tarefa">✎</button>');
    let removeBtn = $('<button class="remove-btn" type="button" title="Mover para Lixeira">🗑️</button>');
    let addSubBtn = $('<button class="add-subtask-btn" type="button" title="Adicionar Subtarefa">➕ Sub</button>').attr('data-task-id', taskId);

    btnGroup.append(editBtn, removeBtn, addSubBtn);
    taskDiv.append(textDiv, btnGroup);
    li.append(taskDiv);

    let subtaskList = $('<ul class="subtask-list"></ul>');
    if (task.subtasks && task.subtasks.length > 0) {
        task.subtasks.forEach(st => addSubtaskHTML(subtaskList, st, taskId));
    } else {
        subtaskList.hide();
    }
    li.append(subtaskList);

    $('#task-list').append(li);
    updateTaskDueVisual(li, task);
}

function addSubtaskHTML(list, subtask, taskId, parentId = null) {
    const subtaskId = subtask.id || generateId(); // Garante um ID
    const subtaskPriority = subtask.priority || 'medium';

    let li = $('<li></li>').attr('data-id', subtaskId).attr('data-parent-id', parentId || taskId).addClass('priority-' + subtaskPriority);
    li.css('position', 'relative');

    let textDiv = $('<div class="task-text"></div>');
    let checkbox = $('<input type="checkbox" class="subtask-checkbox">').prop('checked', subtask.completed || false);
    let label = $('<label class="subtask-label"></label>').text(subtask.text || 'Subtarefa sem nome').attr('data-task-id', taskId).attr('data-subtask-id', subtaskId);
    if (subtask.completed) label.addClass('completed');
    textDiv.append(checkbox, label);

    if (subtask.dueDate) {
        let dateText = 'Data inválida';
        try { dateText = new Date(subtask.dueDate + 'T00:00:00Z').toLocaleDateString(undefined, { timeZone: 'UTC' }); } catch(e) { /* Ignora */ }
        let timeText = subtask.dueTime ? ` ${subtask.dueTime}` : '';
        let dateLabel = $('<span class="task-datetime"></span>').text(`📅 ${dateText}${timeText}`);
        textDiv.append(dateLabel);
    }

    let btnGroup = $('<div class="button-group subtask-btn-group"></div>');
    let optionsBtn = $('<button class="subtask-options-btn" type="button" title="Opções">⋮</button>').attr('data-task-id', taskId).attr('data-subtask-id', subtaskId).attr('data-parent-id', parentId || taskId);
    let contextMenu = $(`
        <div class="subtask-options-menu">
            <ul>
                <li><button class="menu-add-below"><i class="fa fa-plus"></i> Adicionar Abaixo</button></li>
                <li><button class="menu-add-child"><i class="fa fa-level-down-alt"></i> Adicionar Filho</button></li>
                <li><button class="menu-edit"><i class="fa fa-pencil"></i> Editar</button></li>
                <li><button class="menu-remove" style="color: #dc3545;"><i class="fa fa-trash"></i> Excluir</button></li>
            </ul>
        </div>
    `);
    btnGroup.append(optionsBtn, contextMenu);
    li.append(textDiv, btnGroup);

    if (subtask.subtasks && subtask.subtasks.length > 0) {
        let nestedSubtaskList = $('<ul class="subtask-list nested-subtask-list"></ul>');
        subtask.subtasks.forEach(st => addSubtaskHTML(nestedSubtaskList, st, taskId, subtaskId)); // Passa subtaskId como parentId
        li.append(nestedSubtaskList);
    }

    list.append(li);
    updateTaskDueVisual(li, subtask);
}

// ===============================================
// Funções de Atualização de UI Específicas (Exportadas)
// ===============================================

export function updateProgress() {
    const tasks = getTasks();
    let total = tasks.length;
    let completed = tasks.filter(t => t.completed).length;
    let percent = total ? Math.round((completed / total) * 100) : 0;
    const progressBar = $('.progress-bar');
    if (progressBar.length === 0) return;
    progressBar.text(percent ? percent + '%' : (total > 0 ? '0%' : ''));
    let color;
    if (percent === 0 && total > 0) color = '#f44336';
    else if (percent === 0 && total === 0) color = '#e0e0e0';
    else if (percent < 50) color = '#ff9800';
    else if (percent < 100) color = '#4CAF50';
    else color = 'linear-gradient(270deg, #4CAF50, #8BC34A, #4CAF50)';
    if (percent === 100 && total > 0) { progressBar.css({ 'background': color, 'background-size': '600% 100%', 'animation': 'gradientAnimation 3s ease infinite' }); progressBar.addClass('completed high-progress'); }
    else { progressBar.css({ 'background': color, 'animation': 'none' }); progressBar.removeClass('completed high-progress'); }
    progressBar.css('width', percent + '%');
}

export function updateTaskDueVisual(li, task) {
    if (!li || !task) return;
    li = $(li);
    li.removeClass('due-soon overdue');
    li.removeClass('priority-low priority-medium priority-high').addClass('priority-' + (task.priority || 'medium'));
    if (!task.dueDate || task.completed) return;
    const dateTimeString = task.dueDate + (task.dueTime ? `T${task.dueTime}:00` : 'T00:00:00'); // Assume fuso local para cálculo
    let due;
    try { due = new Date(dateTimeString); if (isNaN(due.getTime())) throw new Error(); }
    catch (e) { return; } // Não aplica estilo se data inválida
    const now = new Date();
    const settings = getUserSettings();
    const leadTimeMinutes = settings.taskSettings.alertLeadTimeMinutes || 60;
    const diffMinutes = (due.getTime() - now.getTime()) / (1000 * 60);
    const isDueSoon = diffMinutes > 0 && diffMinutes <= leadTimeMinutes + 1;
    const isOverdue = diffMinutes <= 0;
    if (isOverdue) { li.addClass('overdue'); }
    else if (isDueSoon) { li.addClass('due-soon'); }
    // A LÓGICA DE DISPARAR A NOTIFICAÇÃO FOI MOVIDA PARA taskStore (na função updateTask)
}

export function checkAllDueDates() {
    const tasksMap = new Map(getTasks().map(t => [t.id, t]));
    $('#task-list>li[data-id]').each(function () { // Adiciona seletor data-id
        const task = tasksMap.get($(this).attr('data-id'));
        if (task) updateTaskDueVisual($(this), task);
    });
    $('.subtask-list li[data-id]').each(function () {
        const $li = $(this);
        const taskId = $li.closest('li[data-id][data-category]').attr('data-id');
        const subId = $li.attr('data-id');
        const task = tasksMap.get(taskId);
        // Usa findNestedSubtask importado de utils.js
        if (task?.subtasks) { // Optional chaining
            const subtask = findNestedSubtask(task.subtasks, subId);
            if (subtask) updateTaskDueVisual($li, subtask);
        }
    });
}

export function applyFilter() {
    let searchVal = $('#search-input').val().toLowerCase();
    let priorityVal = $('#filter-priority').val();
    let categoryVal = $('#filter-category').val();
    $('#task-list>li[data-id]').each(function () { // Adiciona seletor data-id
        let taskElement = $(this);
        let text = taskElement.find('label').first().text()?.toLowerCase() || '';
        let priorityClass = taskElement.attr('class')?.match(/priority-(low|medium|high)/)?.[0] || 'priority-medium';
        let taskCategory = taskElement.data('category') || 'geral';
        const matchesSearch = text.includes(searchVal);
        const matchesPriority = (priorityVal === 'all' || priorityClass.includes(priorityVal));
        const matchesCategory = (categoryVal === 'all' || taskCategory === categoryVal);
        taskElement.toggle(matchesSearch && matchesPriority && matchesCategory);
    });
     // Mostra/oculta mensagem de lista vazia após filtro
     const noVisibleTasks = $('#task-list>li[data-id]:visible').length === 0;
     $('.empty-list-message').toggle(noVisibleTasks);
}

// ===============================================
// Funções Auxiliares de UI (Inicialização de Plugins, etc.)
// ===============================================

// Inicializa o jQuery UI Sortable para listas de subtarefas
function initSortableSubtasks(container) {
     // A inicialização do sortable da lista principal (#task-list) fica em eventBinder.js
    container.find('.subtask-list').each(function() {
        if ($(this).data('ui-sortable')) {
           // $(this).sortable('destroy'); // Opcional: destruir antes de recriar
        }
        $(this).sortable({
            connectWith: '.subtask-list', // Permite mover entre listas de mesmo nível
            placeholder: "ui-state-highlight-subtask",
            forcePlaceholderSize: true,
            axis: "y",
            cursor: "grabbing",
            opacity: 0.8,
            // O listener 'update' para salvar a ordem das subtarefas precisaria ser adicionado em eventBinder.js
            // update: async function(event, ui) { /* ... lógica para salvar ordem das subtarefas ... */ }
        }).disableSelection(); // Previne seleção de texto ao arrastar
    });
}


// <<< REMOVIDO: findNestedSubtask foi movido para utils.js >>>