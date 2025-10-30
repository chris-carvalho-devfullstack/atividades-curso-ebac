// js/uiRenderer.js
import { getTasks, getTrash } from './taskStore.js';
import { getUserSettings } from './authManager.js';
import { generateId, findNestedSubtask } from './utils.js'; // <<< Importa findNestedSubtask de utils.js
// Temporário: Funções de modal/menu ainda em app.js (ou serão movidas para eventBinder/app)
// Estas importações podem ser removidas se os listeners forem movidos para eventBinder/app
import { openSubtaskModalForEdit } from './app.js';
import { exportTaskToGoogleLink } from './app.js';
// *** MUDANÇA: Importa a função de criar notificação de prazo ***
import { createTaskDeadlineNotification } from './app.js';


// --- Mapeamentos para os novos ícones e tooltips ---
const priorityMap = {
    high: 'A',
    medium: 'M',
    low: 'B'
};
const priorityTooltipMap = {
    high: 'Prioridade Alta',
    medium: 'Prioridade Média',
    low: 'Prioridade Baixa'
};
const categoryIconMap = {
    geral: 'fa-solid fa-tag',
    trabalho: 'fa-solid fa-briefcase',
    pessoal: 'fa-solid fa-user',
    estudo: 'fa-solid fa-book',
    outros: 'fa-solid fa-list-check'
};
const categoryTooltipMap = {
    geral: 'Categoria: Geral',
    trabalho: 'Categoria: Trabalho',
    pessoal: 'Categoria: Pessoal',
    estudo: 'Categoria: Estudo',
    outros: 'Categoria: Outros'
};
// --------------------------------------------------


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
    checkAllDueDates(); // Verifica prazos após renderizar (ESTA É A CHAMADA CORRETA E ÚNICA)
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

/**
 * ATUALIZADO (Refinamento Final v2)
 */
function addTaskHTML(task) {
    const taskPriority = task.priority || 'medium';
    const taskCategory = task.category || 'geral';
    const taskId = task.id; 

    if (!taskId) {
        console.error("Tentativa de renderizar tarefa sem ID:", task);
        return; 
    }

    let li = $('<li></li>').attr('data-id', taskId).attr('data-category', taskCategory).addClass('priority-' + taskPriority);
    
    // task-main é a linha flex principal
    let taskDiv = $('<div class="task-main"></div>');
    
    // 1. Botão Expandir/Colapsar
    if (task.subtasks && task.subtasks.length > 0) {
        taskDiv.append($('<button type="button" class="toggle-subtasks-btn collapsed" title="Mostrar Subtarefas">►</button>'));
    } else {
        taskDiv.append('<span class="toggle-subtasks-placeholder"></span>');
    }

    // 2. Ícone de Privacidade
    let privacyIcon = $('<i class="privacy-icon"></i>');
    if (task.privacy === 'public') privacyIcon.addClass('fa fa-globe').attr('title', 'Pública');
    else if (task.privacy === 'shared') privacyIcon.addClass('fa fa-users').attr('title', 'Compartilhada');
    else privacyIcon.addClass('fa fa-lock').attr('title', 'Privada');
    taskDiv.append(privacyIcon);

    // 3. Checkbox
    let checkbox = $('<input type="checkbox" class="task-checkbox">').prop('checked', task.completed || false);
    taskDiv.append(checkbox);

    // 4. Label (Título da Tarefa)
    const taskText = task.text || 'Tarefa sem nome';
    // *** CORREÇÃO: Adicionada classe 'js-view-label' ***
    let label = $('<label class="js-view-label"></label>')
        .text(taskText)
        .attr('title', taskText); // **NOVO: Adiciona tooltip para texto cortado**
    if (task.completed) label.addClass('completed');
    taskDiv.append(label);

    // 5. Div de Metadados (alinhado à direita)
    let metaIconsDiv = $('<div class="task-meta-icons"></div>');
    
    // **MUDANÇA DE ORDEM (1): Data/Hora primeiro**
    if (task.dueDate) {
        let dateText = 'Data inválida';
        try { dateText = new Date(task.dueDate + 'T00:00:00Z').toLocaleDateString(undefined, { timeZone: 'UTC' }); } catch(e) { /* Ignora data inválida */ }
        
        let timeText = task.dueTime ? ` ${task.dueTime}` : ''; 
        
        let dateLabel = $('<span class="task-datetime"></span>')
            .html(`📅 ${dateText}${timeText}`) // Mostra data e hora
            .attr('data-tooltip', `Prazo: ${dateText}${timeText}`);
        metaIconsDiv.append(dateLabel);
    }

    // **MUDANÇA DE ORDEM (2): Prioridade**
    let priorityLabel = $('<span class="priority-label priority-circle"></span>')
        .addClass('priority-' + taskPriority)
        .text(priorityMap[taskPriority] || 'M')
        .attr('data-tooltip', priorityTooltipMap[taskPriority] || 'Prioridade Média');
    metaIconsDiv.append(priorityLabel);

    // **MUDANÇA DE ORDEM (3): Categoria**
    let categorySpan = $('<span class="task-category category-icon"></span>')
        .html(`<i class="${categoryIconMap[taskCategory] || 'fa-solid fa-tag'}"></i>`)
        .attr('data-tooltip', categoryTooltipMap[taskCategory] || 'Categoria: Geral');
    metaIconsDiv.append(categorySpan);
    
    taskDiv.append(metaIconsDiv); // Adiciona o grupo de ícones ao task-main

    // 6. Botões de Ação (Grupo de menu)
    let btnGroup = $('<div class="button-group"></div>');
    
    // **MUDANÇA DE ÍCONE: 'fa-ellipsis-h' (horizontal)**
    let optionsBtn = $('<button class="task-options-btn" type="button" title="Opções"><i class="fa-solid fa-ellipsis-h"></i></button>');
    
    let actionsMenu = $('<div class="task-actions-menu"></div>');

    // **MUDANÇA ÍCONE GOOGLE:**
    if (task.dueDate) {
        let googleBtn = $(`
            <button class="google-calendar-btn" type="button" data-tooltip="Agendar no Google Agenda">
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Google_Calendar_icon_%282020%29.svg/512px-Google_Calendar_icon_%282020%29.svg.png" alt="G">
                Agendar
            </button>
        `);
        actionsMenu.append(googleBtn);
    }
    
    let editBtn = $('<button class="edit-btn" type="button"><i class="fa fa-pencil"></i> Editar</button>');
    let addSubBtn = $('<button class="add-subtask-btn" type="button" data-task-id="' + taskId + '"><i class="fa fa-plus"></i> Add Subtarefa</button>');
    let removeBtn = $('<button class="remove-btn" type="button"><i class="fa fa-trash"></i> Apagar</button>');

    actionsMenu.append(editBtn, addSubBtn, removeBtn);
    btnGroup.append(optionsBtn, actionsMenu);
    
    taskDiv.append(btnGroup); // Adiciona o grupo de menu ao task-main
    
    li.append(taskDiv); // Adiciona a linha principal (task-main) ao li

    // Lista de Subtarefas (escondida por padrão)
    let subtaskList = $('<ul class="subtask-list"></ul>').hide();
    if (task.subtasks && task.subtasks.length > 0) {
        task.subtasks.forEach(st => addSubtaskHTML(subtaskList, st, taskId));
    }
    li.append(subtaskList);

    $('#task-list').append(li);
    
    // *** CORREÇÃO: Esta chamada foi removida daqui para evitar a primeira chamada duplicada ***
    // updateTaskDueVisual(li, task); 
}

/**
 * ATUALIZADO (Refinamento Final v2)
 */
function addSubtaskHTML(list, subtask, taskId, parentId = null) {
    const subtaskId = subtask.id || generateId(); 

    let li = $('<li></li>').attr('data-id', subtaskId).attr('data-parent-id', parentId || taskId);
    
    // task-main é a linha flex principal da subtarefa
    let taskDiv = $('<div class="task-main"></div>');
    
    // *** CORREÇÃO: Placeholders removidos para permitir que o CSS controle o alinhamento ***
    // 1. Placeholder (para alinhar com o botão de expandir do pai) - REMOVIDO
    // taskDiv.append('<span class="toggle-subtasks-placeholder"></span>');
    
    // 2. Placeholder (para alinhar com o ícone de privacidade do pai) - REMOVIDO
    // taskDiv.append('<span class="privacy-placeholder"></span>');

    // 3. Checkbox
    let checkbox = $('<input type="checkbox" class="subtask-checkbox">').prop('checked', subtask.completed || false);
    taskDiv.append(checkbox);

    // 4. Label (Título da Subtarefa)
    const subtaskText = subtask.text || 'Subtarefa sem nome';
    // *** CORREÇÃO: Adicionada classe 'js-view-label' ***
    let label = $('<label class="js-view-label"></label>')
        .text(subtaskText)
        .attr('title', subtaskText); // **NOVO: Tooltip para texto cortado**
    if (subtask.completed) label.addClass('completed');
    taskDiv.append(label);

    // 5. Metadados (NÃO SÃO RENDERIZADOS, conforme solicitado)
    // O 'margin-left: auto' no 'label' (via CSS) vai empurrá-lo

    // 6. Botão de Opções da Subtarefa
    let btnGroup = $('<div class="button-group"></div>');
    
    // **MUDANÇA DE ÍCONE: 'fa-ellipsis-h' (horizontal)**
    let optionsBtn = $('<button class="subtask-options-btn" type="button" title="Opções"><i class="fa-solid fa-ellipsis-h"></i></button>').attr('data-task-id', taskId).attr('data-subtask-id', subtaskId).attr('data-parent-id', parentId || taskId);
    
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
    
    taskDiv.append(btnGroup); // Adiciona o grupo de menu ao task-main
    
    li.append(taskDiv); // Adiciona a linha principal (task-main) ao li

    if (subtask.subtasks && subtask.subtasks.length > 0) {
        let nestedSubtaskList = $('<ul class="subtask-list nested-subtask-list"></ul>');
        subtask.subtasks.forEach(st => addSubtaskHTML(nestedSubtaskList, st, taskId, subtaskId));
        li.append(nestedSubtaskList);
    }

    list.append(li);
    // Não chama updateTaskDueVisual, pois subtarefas não têm metadados visuais
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

    progressBar.text(percent > 0 ? percent + '%' : '');

    let color;
    if (percent === 0 && total > 0) color = '#f44336'; 
    else if (percent === 0 && total === 0) color = '#e0e0e0';
    else if (percent < 50) color = '#ff9800';
    else if (percent < 100) color = '#4CAF50';
    else color = 'linear-gradient(270deg, #4CAF50, #8BC34A, #4CAF50)';

    if (percent === 100 && total > 0) {
        progressBar.css({ 'background': color, 'background-size': '600% 100%', 'animation': 'gradientAnimation 3s ease infinite' });
        progressBar.addClass('completed high-progress');
    } else {
        progressBar.css({ 'background': color, 'animation': 'none' });
        progressBar.removeClass('completed high-progress');
    }
    progressBar.css('width', percent + '%');
}

/**
 * *** FUNÇÃO CORRIGIDA ***
 * Atualiza o visual (cores) e agora também dispara a notificação de prazo.
 */
export function updateTaskDueVisual(li, task) {
    if (!li || !task) return;
    li = $(li);
    li.removeClass('due-soon overdue');
    li.removeClass('priority-low priority-medium priority-high').addClass('priority-' + (task.priority || 'medium'));
    
    // Se não tiver data ou já estiver completa, remove classes e sai
    if (!task.dueDate || task.completed) return; 
    
    const dateTimeString = task.dueDate + (task.dueTime ? `T${task.dueTime}:00` : 'T00:00:00'); 
    let due;
    try { due = new Date(dateTimeString); if (isNaN(due.getTime())) throw new Error(); }
    catch (e) { return; } // Data inválida, sai
    
    const now = new Date();
    const settings = getUserSettings();
    const leadTimeMinutes = settings.taskSettings.alertLeadTimeMinutes || 60;
    const diffMinutes = (due.getTime() - now.getTime()) / (1000 * 60);
    
    // +1 minuto de buffer para garantir que a verificação capture
    const isDueSoon = diffMinutes > 0 && diffMinutes <= leadTimeMinutes + 1; 
    const isOverdue = diffMinutes <= 0;

    if (isOverdue) {
        li.addClass('overdue');
    } else if (isDueSoon) {
        li.addClass('due-soon');
        
        // *** MUDANÇA: Dispara a notificação ***
        // Se está vencendo em breve E AINDA NÃO FOI NOTIFICADA
        if (!task.deadlineNotified) {
            console.log(`Disparando notificação de prazo para: ${task.text}`);
            // Passa a data formatada para a notificação
            const simpleDateTime = due.toLocaleString('pt-BR', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'short' });
            createTaskDeadlineNotification(task.id, task.text, simpleDateTime);
            // A função 'createTaskDeadlineNotification' agora é responsável por
            // criar a notificação E marcar 'deadlineNotified: true' no Firestore.
        }
    }
    // Se não for 'overdue' nem 'due-soon', nenhuma classe de prazo é adicionada.
}


export function checkAllDueDates() {
    const tasksMap = new Map(getTasks().map(t => [t.id, t]));
    $('#task-list>li[data-id]').each(function () { 
        const task = tasksMap.get($(this).attr('data-id'));
        if (task) updateTaskDueVisual($(this), task);
    });
    // Não é mais necessário iterar sobre subtarefas, pois elas não têm data visual
}

export function applyFilter() {
    let searchVal = $('#search-input').val().toLowerCase();
    let priorityVal = $('#filter-priority').val();
    let categoryVal = $('#filter-category').val();
    $('#task-list>li[data-id]').each(function () { 
        let taskElement = $(this);
        let text = taskElement.find('label').first().text()?.toLowerCase() || '';
        let priorityClass = taskElement.attr('class')?.match(/priority-(low|medium|high)/)?.[0] || 'priority-medium';
        let taskCategory = taskElement.data('category') || 'geral';
        const matchesSearch = text.includes(searchVal);
        const matchesPriority = (priorityVal === 'all' || priorityClass.includes(priorityVal));
        const matchesCategory = (categoryVal === 'all' || taskCategory === categoryVal);
        taskElement.toggle(matchesSearch && matchesPriority && matchesCategory);
    });
     const noVisibleTasks = $('#task-list>li[data-id]:visible').length === 0;
     $('.empty-list-message').toggle(noVisibleTasks);
}

// ===============================================
// Funções Auxiliares de UI (Inicialização de Plugins, etc.)
// ===============================================

// Inicializa o jQuery UI Sortable para listas de subtarefas
function initSortableSubtasks(container) {
    container.find('.subtask-list').each(function() {
        if ($(this).data('ui-sortable')) {
           // $(this).sortable('destroy'); 
        }
        $(this).sortable({
            connectWith: '.subtask-list', 
            placeholder: "ui-state-highlight-subtask",
            forcePlaceholderSize: true,
            axis: "y",
            cursor: "grabbing",
            opacity: 0.8,
        }).disableSelection();
    });
}