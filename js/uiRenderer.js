// js/uiRenderer.js
import { getCurrentUserUID, getUserSettings } from './authManager.js';
import { db } from "./firebase-config.js"; 
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js"; 
import { findNestedSubtask, generateId } from './utils.js'; // Adicionado findNestedSubtask
import { showModal, hideModal } from './modalHandler.js'; // Adicionado para uso em modais
import { updateTask } from './taskStore.js'; // Adicionado para uso em updateTaskDueVisual

// *** CORREÇÃO: Importa de taskStore.js ***
import { 
    getTasks, 
    getTrash, 
    updateTaskInFirestore // *** NECESSÁRIO para a função de notificação ***
} from './taskStore.js'; 

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
// FUNÇÃO DE NOTIFICAÇÃO (MOVIDA PARA AQUI)
// ===============================================
/**
 * Cria uma notificação de prazo no Firestore E
 * marca a tarefa como 'deadlineNotified: true' para evitar duplicatas.
 * (Movida do app.js para quebrar o ciclo de dependência)
 */
async function createTaskDeadlineNotification(taskId, taskText, dueDateTime) {
     const uid = getCurrentUserUID(); if (!uid) return;
     try {
         const settings = getUserSettings();
         const notificationsRef = collection(db, 'users', uid, 'notifications');
         const leadingTime = settings.taskSettings.alertLeadTimeMinutes || 60;
         
         // 1. Cria a notificação
         await addDoc(notificationsRef, {
             type: 'task_deadline',
             message: `Atenção: A tarefa "${taskText}" vence em menos de ${leadingTime} minutos (${dueDateTime}).`,
             url: `/index.html#task-${taskId}`, 
             read: false,
             timestamp: serverTimestamp()
         });
         
         // 2. Marca a tarefa como notificada para evitar spam
         await updateTaskInFirestore(taskId, { deadlineNotified: true }); 
         
         console.log(`Notificação de prazo CRIADA e task marcada como notificada: ${taskId}`);
         
     } catch (error) {
         console.error("Erro ao criar notificação de prazo:", error);
     }
}


// ===============================================
// Funções de Renderização Principal (Exportadas)
// ===============================================

export function renderAllTasks(tasksArray) {
    const taskList = $('#task-list');
    taskList.empty();
    if (tasksArray && tasksArray.length > 0) {
        tasksArray.forEach(task => addTaskHTML(task));
        initSortableSubtasks(taskList); 
    } else {
        taskList.append('<li class="empty-list-message">Nenhuma tarefa encontrada.</li>');
    }
    // As chamadas updateProgress e checkAllDueDates são movidas para o listener
    // para garantir a ordem correta após a renderização do HTML.
}

/**
 * Renderiza todas as tarefas no quadro Kanban, separadas por status.
 */
export function renderKanbanBoard(tasksArray) {
    // 1. Limpa todas as colunas
    $('.kanban-list').empty();

    // 2. Agrupa as tarefas por status
    const tasksByStatus = { todo: [], in_progress: [], done: [] };
    tasksArray.forEach(task => {
        // CORREÇÃO: Garante que 'completed: true' force o status para 'done'
        const status = task.completed ? 'done' : (task.status || 'todo');
        if (tasksByStatus[status]) {
            tasksByStatus[status].push(task);
        } else {
            // Garante que a tarefa vá para 'todo' se o status for inválido
            tasksByStatus.todo.push(task);
        }
    });

    // 3. Renderiza os cartões em cada coluna
    for (const status in tasksByStatus) {
        const $list = $(`.kanban-column[data-status="${status}"] .kanban-list`);
        tasksByStatus[status].forEach(task => {
            const $card = createKanbanCard(task);
            $list.append($card);
        });
    }
    
    // 4. A inicialização do Sortable foi movida para o app.js
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
 * Cria o HTML para um cartão Kanban.
 */
function createKanbanCard(task) {
    const taskPriority = task.priority || 'medium';
    const taskId = task.id;
    const isCompleted = task.completed;
    
    let cardColor;
    if (isCompleted) {
        cardColor = '#4CAF50'; // Verde para concluída
    } else if (task.status === 'in_progress') {
         cardColor = '#ff9800'; // Laranja para em progresso
    } else if (taskPriority === 'high') {
        cardColor = '#f44336'; // Vermelho para alta prioridade (e todo)
    } else {
        cardColor = '#2196F3'; // Azul para baixa/media (e todo)
    }

    // Lógica de Data
    let dateText = '';
    let timeText = '';
    if (task.dueDate) {
        try { 
            const due = new Date(task.dueDate + (task.dueTime ? `T${task.dueTime}:00` : 'T00:00:00'));
            const now = new Date();
            const isOverdue = due.getTime() < now.getTime() && !isCompleted;

            dateText = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            timeText = task.dueTime ? due.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
            
            if (isOverdue) {
                dateText = `<i class="fa fa-exclamation-circle" style="color:#f44336;"></i> ${dateText}`;
            }
        } catch(e) { /* Ignora */ }
    }

    // Corrigido para incluir o botão de opções no card kanban para edição/remoção
    const $card = $(`
        <li class="kanban-card" data-id="${taskId}" data-priority="${taskPriority}" style="--card-color: ${cardColor};">
            <span class="kanban-card-text js-view-label" title="${task.text || 'Tarefa sem nome'}">${task.text || 'Tarefa sem nome'}</span>
            <div class="kanban-card-meta">
                <div>
                    <span class="priority-label priority-${taskPriority}">${priorityTooltipMap[taskPriority]}</span>
                </div>
                ${task.dueDate ? 
                    `<span class="task-datetime">${dateText} ${timeText}</span>` : 
                    ''
                }
            </div>
            
            <button class="task-options-btn" type="button" data-tooltip="Opções"><i class="fa-solid fa-ellipsis-h"></i></button>
            <div class="task-actions-menu" style="right: 5px; top: 35px; width: 170px;">
                <button class="edit-btn" type="button" data-id="${taskId}"><i class="fa fa-pencil"></i> Editar</button>
                <button class="remove-btn" type="button" data-id="${taskId}"><i class="fa fa-trash"></i> Apagar</button>
            </div>
        </li>
    `);
    
    // Adiciona listener para o menu de opções do cartão
    $card.find('.task-options-btn').on('click', function(e) {
        e.stopPropagation();
        const $menu = $(this).siblings('.task-actions-menu');
        $('.task-actions-menu.active').not($menu).removeClass('active');
        $menu.toggleClass('active');
    });

    // Adiciona listener para o botão de edição no Kanban (usa o listener delegado do eventBinder)
    $card.find('.edit-btn').on('click', function() {
        const id = $(this).data('id');
        $(`#task-list > li[data-id="${id}"]`).find('.edit-btn').trigger('click');
    });
    
    // Adiciona listener para o botão de apagar no Kanban (usa o listener delegado do eventBinder)
    $card.find('.remove-btn').on('click', function() {
        const id = $(this).data('id');
        $(`#task-list > li[data-id="${id}"]`).find('.remove-btn').trigger('click');
    });
    
    return $card;
}


function addTaskHTML(task) {
    const taskPriority = task.priority || 'medium';
    const taskCategory = task.category || 'geral';
    const taskId = task.id; 

    if (!taskId) {
        console.error("Tentativa de renderizar tarefa sem ID:", task);
        return; 
    }

    let li = $('<li></li>').attr('data-id', taskId).attr('data-category', taskCategory).addClass('priority-' + taskPriority);
    
    let taskDiv = $('<div class="task-main"></div>');
    
    if (task.subtasks && task.subtasks.length > 0) {
        taskDiv.append($('<button type="button" class="toggle-subtasks-btn collapsed" title="Mostrar Subtarefas">►</button>'));
    } else {
        taskDiv.append('<span class="toggle-subtasks-placeholder"></span>');
    }

    let privacyIcon = $('<i class="privacy-icon"></i>');
    if (task.privacy === 'public') privacyIcon.addClass('fa fa-globe').attr('title', 'Pública');
    else if (task.privacy === 'shared') privacyIcon.addClass('fa fa-users').attr('title', 'Compartilhada');
    else privacyIcon.addClass('fa fa-lock').attr('title', 'Privada');
    taskDiv.append(privacyIcon);

    let checkbox = $('<input type="checkbox" class="task-checkbox">').prop('checked', task.completed || false);
    taskDiv.append(checkbox);

    const taskText = task.text || 'Tarefa sem nome';
    let label = $('<label class="js-view-label"></label>')
        .text(taskText)
        .attr('title', taskText); 
    if (task.completed) label.addClass('completed');
    taskDiv.append(label);

    let metaIconsDiv = $('<div class="task-meta-icons"></div>');
    
    if (task.dueDate) {
        let dateText = 'Data inválida';
        try { dateText = new Date(task.dueDate + 'T00:00:00Z').toLocaleDateString(undefined, { timeZone: 'UTC' }); } catch(e) { /* Ignora data inválida */ }
        
        let timeText = task.dueTime ? ` ${task.dueTime}` : ''; 
        
        let dateLabel = $('<span class="task-datetime"></span>')
            .html(`📅 ${dateText}${timeText}`) 
            .attr('data-tooltip', `Prazo: ${dateText}${timeText}`);
        metaIconsDiv.append(dateLabel);
    }

    let priorityLabel = $('<span class="priority-label priority-circle"></span>')
        .addClass('priority-' + taskPriority)
        .text(priorityMap[taskPriority] || 'M')
        .attr('data-tooltip', priorityTooltipMap[taskPriority] || 'Prioridade Média');
    metaIconsDiv.append(priorityLabel);

    let categorySpan = $('<span class="task-category category-icon"></span>')
        .html(`<i class="${categoryIconMap[taskCategory] || 'fa-solid fa-tag'}"></i>`)
        .attr('data-tooltip', categoryTooltipMap[taskCategory] || 'Categoria: Outros');
    metaIconsDiv.append(categorySpan);
    
    taskDiv.append(metaIconsDiv); 

    let btnGroup = $('<div class="button-group"></div>');
    
    let optionsBtn = $('<button class="task-options-btn" type="button" title="Opções"><i class="fa-solid fa-ellipsis-h"></i></button>');
    
    let actionsMenu = $('<div class="task-actions-menu"></div>');

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
    
    taskDiv.append(btnGroup); 
    
    li.append(taskDiv); 

    let subtaskList = $('<ul class="subtask-list"></ul>').hide();
    if (task.subtasks && task.subtasks.length > 0) {
        task.subtasks.forEach(st => addSubtaskHTML(subtaskList, st, taskId));
    }
    li.append(subtaskList);

    $('#task-list').append(li);
}

function addSubtaskHTML(list, subtask, taskId, parentId = null) {
    const subtaskId = subtask.id || generateId(); 

    let li = $('<li></li>').attr('data-id', subtaskId).attr('data-parent-id', parentId || taskId);
    
    let taskDiv = $('<div class="task-main"></div>');
    
    let checkbox = $('<input type="checkbox" class="subtask-checkbox">').prop('checked', subtask.completed || false);
    taskDiv.append(checkbox);

    const subtaskText = subtask.text || 'Subtarefa sem nome';
    let label = $('<label class="js-view-label"></label>')
        .text(subtaskText)
        .attr('title', subtaskText); 
    if (subtask.completed) label.addClass('completed');
    taskDiv.append(label);

    let btnGroup = $('<div class="button-group"></div>');
    
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
    
    taskDiv.append(btnGroup); 
    
    li.append(taskDiv); 

    if (subtask.subtasks && subtask.subtasks.length > 0) {
        let nestedSubtaskList = $('<ul class="subtask-list nested-subtask-list"></ul>');
        subtask.subtasks.forEach(st => addSubtaskHTML(nestedSubtaskList, st, taskId, subtaskId));
        li.append(nestedSubtaskList);
    }

    list.append(li);
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
    else color = 'linear-gradient(270deg, #4CAF50, #81C784, #4CAF50)';

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
 * Atualiza o visual (cores) e dispara a notificação de prazo.
 */
export function updateTaskDueVisual(li, task) {
    if (!li || !task) return;
    li = $(li);
    li.removeClass('due-soon overdue');
    li.removeClass('priority-low priority-medium priority-high').addClass('priority-' + (task.priority || 'medium'));
    
    if (!task.dueDate || task.completed) return; 
    
    const dateTimeString = task.dueDate + (task.dueTime ? `T${task.dueTime}:00` : 'T00:00:00'); 
    let due;
    try { due = new Date(dateTimeString); if (isNaN(due.getTime())) throw new Error(); }
    catch (e) { return; } 
    
    const now = new Date();
    const settings = getUserSettings();
    const leadTimeMinutes = settings.taskSettings.alertLeadTimeMinutes || 60;
    const diffMinutes = (due.getTime() - now.getTime()) / (1000 * 60);
    
    const isDueSoon = diffMinutes > 0 && diffMinutes <= leadTimeMinutes + 1; 
    const isOverdue = diffMinutes <= 0;

    if (isOverdue) {
        li.addClass('overdue');
    } else if (isDueSoon) {
        li.addClass('due-soon');
        
        if (!task.deadlineNotified) {
            console.log(`Disparando notificação de prazo para: ${task.text}`);
            const simpleDateTime = due.toLocaleString('pt-BR', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'short' });
            createTaskDeadlineNotification(task.id, task.text, simpleDateTime);
        }
    }
}


export function checkAllDueDates() {
    const tasksMap = new Map(getTasks().map(t => [t.id, t]));
    $('#task-list>li[data-id]').each(function () { 
        const task = tasksMap.get($(this).attr('data-id'));
        if (task) updateTaskDueVisual($(this), task);
    });
}

export function applyFilter() {
    let searchVal = $('#search-input').val().toLowerCase();
    let priorityVal = $('#filter-priority').val();
    let categoryVal = $('#filter-category').val();
    const tasks = getTasks();
    
    // Mostra/Esconde a mensagem de lista vazia
    if (tasks.length === 0 && searchVal === '' && priorityVal === 'all' && categoryVal === 'all') {
         $('.empty-list-message').text("Nenhuma tarefa encontrada.").show();
         return;
    } else if (tasks.length > 0) {
        $('.empty-list-message').hide();
    }
    
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
    // Se não houver tarefas visíveis (mas a lista não está vazia originalmente)
    if (noVisibleTasks && tasks.length > 0) {
        // Encontra o container principal de tarefas, se houver
        const $taskList = $('#task-list');
        // Adiciona uma mensagem temporária de que os filtros não encontraram nada
        if ($taskList.find('.no-results-message').length === 0) {
             $taskList.append('<li class="no-results-message">Nenhum resultado encontrado com os filtros atuais.</li>');
        }
    } else {
         $('.no-results-message').remove(); // Remove a mensagem se houver resultados
    }
}


// ===============================================
// Funções Auxiliares de UI (Inicialização de Plugins, etc.)
// ===============================================

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


// ===============================================
// *** NOVO: EVENT LISTENERS DO RENDERER ***
// ===============================================
// O uiRenderer agora ouve os eventos do taskStore e atualiza a UI.

document.addEventListener('tasksUpdated', () => {
    console.log("uiRenderer ouviu 'tasksUpdated'. A renderizar...");
    
    const tasks = getTasks();
    
    // 1. Renderiza a Lista (sempre)
    // 1a. Salva o estado de expansão antes de renderizar
    const expandedTasks = new Set();
    $('#task-list > li').each(function() {
        if (!$(this).find('.toggle-subtasks-btn').hasClass('collapsed')) {
            expandedTasks.add($(this).data('id'));
        }
    });

    // 1b. Renderiza
    renderAllTasks(tasks); 
    
    // 1c. Restaura o estado de expansão
    expandedTasks.forEach(id => {
        const $li = $(`#task-list > li[data-id="${id}"]`);
        if ($li.length) {
            $li.find('.toggle-subtasks-btn').removeClass('collapsed').html('▼');
            $li.children('.subtask-list').show();
        }
    });

    // 2. Renderiza o Kanban (se estiver na view correta)
    if (sessionStorage.getItem('activeView') === 'board') {
        renderKanbanBoard(tasks);
        // O Sortable é inicializado no app.js após a renderização do board
    }
    
    // 3. Aplica atualizações e filtros
    updateProgress();
    applyFilter();
    checkAllDueDates(); // Verifica prazos APÓS a UI estar no DOM
});

document.addEventListener('trashUpdated', () => {
    console.log("uiRenderer ouviu 'trashUpdated'. A renderizar lixeira...");
    const trash = getTrash();
    renderTrash(trash);
});