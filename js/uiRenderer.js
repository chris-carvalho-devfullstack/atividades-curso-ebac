// js/uiRenderer.js
import { getTasks, getTrash } from './taskStore.js'; // Para obter dados a serem renderizados
import { getUserSettings } from './authManager.js'; // Para obter configurações (ex: prazo)
import { generateId } from './utils.js'; // Para IDs de subtarefas locais
import { openSubtaskModalForCreate, openSubtaskModalForEdit, deleteSubtaskViaModal, toggleSubtaskMenu } from './app.js'; // Temporário: Funções de modal/menu ainda em app.js
import { exportTaskToGoogleLink } from './app.js'; // Temporário: Função de exportação ainda em app.js

// ===============================================
// Funções de Renderização Principal (Exportadas)
// ===============================================

export function renderAllTasks(tasksArray) {
    const taskList = $('#task-list');
    taskList.empty(); // Limpa a lista
    if (tasksArray && tasksArray.length > 0) {
        tasksArray.forEach(task => addTaskHTML(task)); // Chama a função interna para cada tarefa
        // Inicializa sortable para subtarefas após renderizar tudo
        taskList.find('.subtask-list').each(function() {
             initSubtaskSortable($(this));
        });
    } else {
        // Opcional: Mostrar mensagem se não houver tarefas
        taskList.append('<li style="text-align: center; color: #888; padding: 20px;">Nenhuma tarefa encontrada.</li>');
    }
     // Garante que a barra de progresso seja atualizada após renderizar
     updateProgress();
     // Garante que os status de prazo sejam verificados
     checkAllDueDates();
}

export function renderTrash(trashArray) {
    const trashList = $('#trash-list');
    trashList.empty(); // Limpa a lista
    if (!trashArray || trashArray.length === 0) {
        trashList.append('<li style="justify-content:center; color: #888;">Lixeira vazia.</li>');
    } else {
        trashArray.forEach(task => {
            // Verifica se deletedAt é um objeto Timestamp do Firestore
            const deletedAtDate = task.deletedAt?.toDate ? task.deletedAt.toDate() : null;
            const deletedAtString = deletedAtDate ? deletedAtDate.toLocaleDateString() : 'Data inválida';

            const li = $(`
                <li>
                    <span>${task.text || 'Tarefa sem nome'} (Excluído em: ${deletedAtString})</span>
                    <div>
                        <button class="btn-restore" data-id="${task.id}">Restaurar</button>
                        <button class="btn-delete-permanently" data-id="${task.id}">Excluir Permanentemente</button>
                    </div>
                </li>
            `);
            trashList.append(li);
        });
    }
}

// ===============================================
// Funções de Renderização Detalhada (Internas ou Exportadas se necessário)
// ===============================================

// Adiciona o HTML de uma tarefa principal à lista
export function addTaskHTML(task) { // Exportada para ser usada em outros lugares se necessário
    const taskPriority = task.priority || 'medium';
    const taskCategory = task.category || 'geral';

    let li = $('<li></li>')
        .attr('data-id', task.id)
        .attr('data-category', taskCategory)
        .addClass('priority-' + taskPriority);

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
    let priorityLabel = $('<span class="priority-label"></span>')
        .addClass('priority-' + taskPriority)
        .text(taskPriority.charAt(0).toUpperCase() + taskPriority.slice(1));
    prioCatDiv.append(priorityLabel);

    let categorySpan = $('<span class="task-category"></span>')
        .text(taskCategory.charAt(0).toUpperCase() + taskCategory.slice(1))
        .attr('data-tooltip', 'Categoria: ' + taskCategory.charAt(0).toUpperCase() + taskCategory.slice(1));
    prioCatDiv.append(categorySpan);
    textDiv.append(prioCatDiv);

    if (task.dueDate) {
        // Tenta criar data, tratando possível formato inválido
        let dateText = 'Data inválida';
        try {
            dateText = new Date(task.dueDate + 'T00:00:00Z').toLocaleDateString(undefined, { timeZone: 'UTC' }); // Usa UTC para evitar problemas de fuso
        } catch(e) { console.warn("Data inválida para tarefa:", task.id, task.dueDate); }

        let timeText = task.dueTime ? ` ${task.dueTime}` : '';
        let dateTimeText = `📅 ${dateText}${timeText}`;
        let dateLabel = $('<span class="task-datetime"></span>').text(dateTimeText);
        textDiv.append(dateLabel);
    }

    let btnGroup = $('<div class="button-group"></div>');
    if (task.subtasks && task.subtasks.length > 0) {
        btnGroup.append($('<button type="button" class="toggle-subtasks-btn">▼</button>'));
    }

    if (task.dueDate) {
        let googleBtn = $('<button class="google-calendar-btn" type="button" data-tooltip="Agendar no Google Agenda"><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Google_Calendar_icon_%282020%29.svg/512px-Google_Calendar_icon_%282020%29.svg.png" alt="Google Agenda"></button>');
        // Chama a função exportada de app.js (temporariamente)
        googleBtn.on('click', function () { exportTaskToGoogleLink(task); });
        btnGroup.append(googleBtn);
    }

    let editBtn = $('<button class="edit-btn" type="button">✎</button>'); // Event listener será adicionado em eventBinder.js
    let removeBtn = $('<button class="remove-btn" type="button">🗑️</button>'); // Event listener será adicionado em eventBinder.js
    let addSubBtn = $('<button class="add-subtask-btn" type="button">➕ Sub</button>') // Event listener será adicionado em eventBinder.js
        .attr('data-task-id', task.id);

    btnGroup.append(editBtn, removeBtn, addSubBtn);
    taskDiv.append(textDiv, btnGroup);
    li.append(taskDiv);

    let subtaskList = $('<ul class="subtask-list"></ul>');
     // Renderiza subtarefas apenas se existirem
    if (task.subtasks && task.subtasks.length > 0) {
        task.subtasks.forEach(st => addSubtaskHTML(subtaskList, st, task.id)); // Chama addSubtaskHTML interna
    } else {
        subtaskList.hide(); // Garante que a lista esteja escondida se vazia
    }
    li.append(subtaskList);
    // A inicialização do sortable será feita após renderizar tudo

    $('#task-list').append(li);
    updateTaskDueVisual(li, task); // Chama updateTaskDueVisual interna
}


// Adiciona o HTML de uma subtarefa (pode ser chamada recursivamente)
function addSubtaskHTML(list, subtask, taskId, parentId = null) {
    const subtaskId = subtask.id || generateId(); // Garante um ID

    let li = $('<li></li>')
        .attr('data-id', subtaskId)
        .attr('data-parent-id', parentId || taskId)
        .addClass('priority-' + (subtask.priority || 'medium'));

    li.css('position', 'relative'); // Para o menu de opções

    let textDiv = $('<div class="task-text"></div>');
    let checkbox = $('<input type="checkbox" class="subtask-checkbox">').prop('checked', subtask.completed || false);

    let label = $('<label class="subtask-label"></label>').text(subtask.text || 'Subtarefa sem nome')
        .attr('data-task-id', taskId)
        .attr('data-subtask-id', subtaskId)
        // O event listener para abrir o modal de edição será adicionado em eventBinder.js
        // .on('click', function(e) { ... });

    if (subtask.completed) label.addClass('completed');
    textDiv.append(checkbox, label);

    if (subtask.dueDate) {
        let dateText = 'Data inválida';
         try {
             dateText = new Date(subtask.dueDate + 'T00:00:00Z').toLocaleDateString(undefined, { timeZone: 'UTC' });
        } catch(e) { console.warn("Data inválida para subtarefa:", subtaskId, subtask.dueDate); }

        let timeText = subtask.dueTime ? ` ${subtask.dueTime}` : '';
        let dateTimeText = `📅 ${dateText}${timeText}`;
        let dateLabel = $('<span class="task-datetime"></span>').text(dateTimeText);
        textDiv.append(dateLabel);
    }

    let btnGroup = $('<div class="button-group subtask-btn-group"></div>');
    let optionsBtn = $('<button class="subtask-options-btn" type="button">⋮</button>')
        .attr('data-task-id', taskId)
        .attr('data-subtask-id', subtaskId)
        .attr('data-parent-id', parentId || taskId);
        // O event listener para o menu será adicionado em eventBinder.js
        // .on('click', function(e) { ... });

    // O menu em si ainda é criado aqui, mas os listeners dos botões do menu serão movidos
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
        subtask.subtasks.forEach(st => addSubtaskHTML(nestedSubtaskList, st, taskId, subtask.id)); // Chamada recursiva
        li.append(nestedSubtaskList);
    }

    list.append(li);
    updateTaskDueVisual(li, subtask); // Chama updateTaskDueVisual interna
}

// ===============================================
// Funções de Atualização de UI Específicas (Exportadas)
// ===============================================

export function updateProgress() {
    const tasks = getTasks(); // Pega tarefas do taskStore
    let total = tasks.length;
    let completed = tasks.filter(t => t.completed).length;
    let percent = total ? Math.round((completed / total) * 100) : 0;

    const progressBar = $('.progress-bar');
    if (progressBar.length === 0) return; // Sai se a barra não existir

    progressBar.text(percent ? percent + '%' : (total > 0 ? '0%' : '')); // Mostra 0% se houver tarefas

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

// Atualiza a aparência (cores, classes) de um item de tarefa/subtarefa com base no prazo
export function updateTaskDueVisual(li, task) { // Exportada para ser chamada por checkAllDueDates
    if (!li || !task) return; // Verificação
    li = $(li); // Garante que é um objeto jQuery

    li.removeClass('due-soon overdue'); // Limpa estados antigos
    // Reaplica a classe de prioridade
    li.removeClass('priority-low priority-medium priority-high').addClass('priority-' + (task.priority || 'medium'));

    if (!task.dueDate || task.completed) return; // Sai se não tem prazo ou está completa

    // Constrói a string de data/hora, priorizando UTC para consistência
    const dateTimeString = task.dueDate + (task.dueTime ? `T${task.dueTime}:00Z` : 'T00:00:00Z');
    let due;
    try {
        due = new Date(dateTimeString);
        // Verifica se a data é válida
        if (isNaN(due.getTime())) throw new Error("Data inválida");
    } catch (e) {
        console.warn(`Data/hora inválida encontrada para ${task.id}: ${dateTimeString}`);
        return; // Não aplica estilo se a data for inválida
    }

    const now = new Date();
    const settings = getUserSettings(); // Pega as configurações atuais
    const leadTimeMinutes = settings.taskSettings.alertLeadTimeMinutes || 60;

    const diffMinutes = (due.getTime() - now.getTime()) / (1000 * 60);

    const isDueSoon = diffMinutes > 0 && diffMinutes <= leadTimeMinutes + 1; // +1 min buffer
    const isOverdue = diffMinutes <= 0; // Considera 0 minutos como atrasado

    if (isOverdue) {
        li.addClass('overdue');
    } else if (isDueSoon) {
        li.addClass('due-soon');
    }
    // A lógica de disparar a *notificação* (createTaskDeadlineNotification)
    // permanecerá no app.js/eventBinder.js por enquanto,
    // pois está ligada à *transição* para o estado due-soon, não apenas à renderização.
}

// Itera sobre todas as tarefas e subtarefas visíveis e atualiza seu estado visual de prazo
export function checkAllDueDates() {
    const tasksMap = new Map(getTasks().map(t => [t.id, t])); // Cria um mapa para busca rápida

    $('#task-list>li').each(function () {
        const task = tasksMap.get($(this).attr('data-id'));
        if (task) updateTaskDueVisual($(this), task);
    });

    $('.subtask-list li[data-id]').each(function () { // Seleciona apenas LIs com data-id
        const $li = $(this);
        const taskId = $li.closest('li[data-id][data-category]').attr('data-id');
        const subId = $li.attr('data-id');
        const task = tasksMap.get(taskId);
        if (task && task.subtasks) {
            const subtask = findNestedSubtask(task.subtasks, subId); // findNestedSubtask ainda precisa ser importado ou movido
            if (subtask) updateTaskDueVisual($li, subtask);
        }
    });
}

// Filtra as tarefas visíveis na lista principal
export function applyFilter() {
    let searchVal = $('#search-input').val().toLowerCase();
    let priorityVal = $('#filter-priority').val();
    let categoryVal = $('#filter-category').val();

    $('#task-list>li').each(function () {
        let taskElement = $(this);
        // Tenta obter o texto do label; se não encontrar, usa vazio
        let text = taskElement.find('label').first().text()?.toLowerCase() || '';
        // Prioridade padrão 'medium' se não houver classe
        let priorityClass = taskElement.attr('class')?.match(/priority-(low|medium|high)/)?.[0] || 'priority-medium';
        // Categoria padrão 'geral' se não houver data attribute
        let taskCategory = taskElement.data('category') || 'geral';

        // Lógica de visibilidade
        const matchesSearch = text.includes(searchVal);
        const matchesPriority = (priorityVal === 'all' || priorityClass.includes(priorityVal));
        const matchesCategory = (categoryVal === 'all' || taskCategory === categoryVal);

        taskElement.toggle(matchesSearch && matchesPriority && matchesCategory);
    });
}

// ===============================================
// Funções Auxiliares de UI (Ainda aqui, podem ser movidas para app.js/eventBinder)
// ===============================================

// Inicializa o jQuery UI Sortable (chamada após renderizar a lista)
function initSubtaskSortable(sublist) {
    if (sublist && typeof sublist.sortable === 'function') { // Verifica se é um objeto jQuery com sortable
        sublist.sortable({
            connectWith: '.subtask-list',
            // O update handler que salva a ordem está em app.js/eventBinder.js
        });
    }
}

// A função findNestedSubtask precisa estar disponível aqui também,
// pois é usada por checkAllDueDates e outras funções de renderização/UI.
// Idealmente, ela iria para utils.js ou taskStore.js e seria importada aqui.
// Por enquanto, vamos duplicá-la aqui para manter a funcionalidade:
function findNestedSubtask(subtasks, targetId) {
    if (!subtasks) return null;
    for (const subtask of subtasks) {
        if (subtask.id === targetId) {
            return subtask;
        }
        if (subtask.subtasks && subtask.subtasks.length > 0) {
            const found = findNestedSubtask(subtask.subtasks, targetId);
            if (found) return found;
        }
    }
    return null;
}