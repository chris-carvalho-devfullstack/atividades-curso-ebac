// ===============================================
// 1. IMPORTAÇÕES DO FIREBASE 
// ===============================================
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { 
    collection, 
    query, 
    orderBy, 
    onSnapshot, 
    doc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    serverTimestamp,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// ===============================================
// 2. VARIÁVEIS GLOBAIS
// ===============================================
let CURRENT_USER_UID = null;
let tasks = []; 
let currentTaskLi = null;
let currentSubtaskData = { 
    taskId: null, subtaskId: null, isEdit: false, parentId: null,
    priority: 'medium', category: 'geral', dueDate: '', dueTime: '' 
}; 
let calendar = null;
let calendarInitialized = false;

// Função utilitária básica
function generateId() { return '_' + Math.random().toString(36).substr(2, 9); }


// ===============================================
// 3. FUNÇÕES RECURSIVAS DE MANIPULAÇÃO DE DADOS 
// ===============================================

/**
 * Funções auxiliares para encontrar e atualizar sub-tarefas em qualquer nível.
 */
function updateNestedSubtasks(subtasks, targetId, callbackFn) {
    if (!subtasks) return [];
    
    return subtasks.map(subtask => {
        if (subtask.id === targetId) {
            return callbackFn(subtask);
        }
        
        if (subtask.subtasks && subtask.subtasks.length > 0) {
            subtask.subtasks = updateNestedSubtasks(subtask.subtasks, targetId, callbackFn);
        }
        return subtask;
    });
}

/**
 * Função auxiliar para encontrar a sub-tarefa aninhada pelo ID.
 */
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

/**
 * Checa o status de conclusão de forma recursiva para a tarefa principal.
 */
const checkCompletionStatusRecursively = (subtasks) => {
    if (!subtasks || subtasks.length === 0) return true;
    return subtasks.every(st => st.completed && checkCompletionStatusRecursively(st.subtasks));
};


// ===============================================
// 4. FUNÇÕES DE OPERAÇÃO DO FIRESTORE
// ===============================================

function getNewTaskOrderIndex() {
    if (tasks.length === 0) return 1.0; 
    return tasks[0].orderIndex - 1.0; 
}

async function addTaskToFirestore(task) {
    if (!CURRENT_USER_UID) return;
    try {
        const tasksRef = collection(db, "users", CURRENT_USER_UID, "tasks");
        const newOrderIndex = getNewTaskOrderIndex();
        
        await addDoc(tasksRef, { 
            ...task, 
            createdAt: serverTimestamp(),
            orderIndex: newOrderIndex,
            subtasks: task.subtasks || [] 
        });
        console.log("✅ Tarefa adicionada com sucesso ao Firestore!");
    } catch (error) {
        console.error("🚨 Erro ao adicionar tarefa:", error);
        alert(`🚨 ERRO CRÍTICO AO SALVAR TAREFA. Motivo: ${error.message}.`);
    }
}

async function updateTaskInFirestore(taskId, data) {
    if (!CURRENT_USER_UID) return;
    try {
        const taskRef = doc(db, "users", CURRENT_USER_UID, "tasks", taskId);
        await updateDoc(taskRef, data);
    } catch (error) {
        console.error("Erro ao atualizar tarefa:", error);
    }
}

async function deleteTaskFromFirestore(taskId) {
    if (!CURRENT_USER_UID) return;
    try {
        const taskRef = doc(db, "users", CURRENT_USER_UID, "tasks", taskId);
        await deleteDoc(taskRef);
    } catch (error) {
        console.error("Erro ao deletar tarefa:", error);
    }
}

async function saveSubtasksToFirestore(taskId, subtasks) {
    await updateTaskInFirestore(taskId, { subtasks: subtasks });
}


// ===============================================
// 5. ESCUTA EM TEMPO REAL
// ===============================================
function loadTasksRealTime() {
    if (!CURRENT_USER_UID) return;
    
    const tasksRef = collection(db, "users", CURRENT_USER_UID, "tasks");
    const q = query(tasksRef, orderBy("orderIndex", "asc")); 

    onSnapshot(q, (snapshot) => {
        $('#task-list').empty(); 
        tasks = []; 
        
        snapshot.forEach((doc) => {
            const task = doc.data();
            task.id = doc.id; 
            if (!task.category) task.category = 'geral'; 
            
            if (!task.subtasks) task.subtasks = []; 
            
            tasks.push(task); 
            addTaskHTML(task); 
        });

        updateProgress(); 
        checkAllDueDates(); 
        applyFilter();
        syncAllToCalendar(); 
        
    }, (error) => {
        console.error("Erro ao escutar tarefas em tempo real:", error);
    });
}


// ===============================================
// 6. FUNÇÃO DE MIGRAÇÃO
// ===============================================

function migrateLocalTasksToFirestore() {
    const data = localStorage.getItem('tasks');
    if (!data) return; 

    try {
        const localTasks = JSON.parse(data);
        if (localTasks.length === 0) return;

        console.log(`Encontradas ${localTasks.length} tarefas antigas no LocalStorage. Iniciando migração...`);

        const tasksRef = collection(db, "users", CURRENT_USER_UID, "tasks");
        
        let orderIndex = 0; 

        localTasks.forEach(async (task) => {
             const { id, ...taskData } = task; 

             await addDoc(tasksRef, {
                ...taskData,
                createdAt: serverTimestamp(),
                orderIndex: orderIndex++
            });
        });

        localStorage.removeItem('tasks');
        console.log("Migração concluída e LocalStorage limpo.");
        alert("🎉 Tarefas antigas do LocalStorage foram migradas para o Firebase! Recarregue a página se elas ainda não aparecerão.");

    } catch (e) { 
        console.error('Erro durante a migração do LocalStorage:', e);
    }
}

// ===============================================
// 7. FUNÇÕES DE RENDERIZAÇÃO E UTILIDADE 
// ===============================================

/* ---------- ADD TAREFA HTML ---------- */
function addTaskHTML(task) {
    let li = $('<li></li>')
        .attr('data-id', task.id)
        .attr('data-category', task.category)
        .addClass('priority-' + task.priority);

    let taskDiv = $('<div class="task-main"></div>');
    let textDiv = $('<div class="task-text"></div>');

    let checkbox = $('<input type="checkbox" class="task-checkbox">').prop('checked', task.completed);
    let label = $('<label></label>').text(task.text);
    if (task.completed) label.addClass('completed');
    textDiv.append(checkbox, label);

    let prioCatDiv = $('<div class="task-priority-category"></div>');
    let priorityLabel = $('<span class="priority-label"></span>')
        .addClass('priority-' + task.priority)
        .text(task.priority.charAt(0).toUpperCase() + task.priority.slice(1));
    prioCatDiv.append(priorityLabel);

    let categorySpan = $('<span class="task-category"></span>')
        .text(task.category.charAt(0).toUpperCase() + task.category.slice(1))
        .attr('data-tooltip', 'Categoria: ' + task.category.charAt(0).toUpperCase() + task.category.slice(1));
    prioCatDiv.append(categorySpan);
    textDiv.append(prioCatDiv);

    if (task.dueDate) {
        let dateText = new Date(task.dueDate + 'T00:00:00').toLocaleDateString();
        let timeText = task.dueTime ? ` ${task.dueTime}` : '';
        let dateTimeText = `📅 ${dateText}${timeText}`;
        let dateLabel = $('<span class="task-datetime"></span>').text(dateTimeText);
        textDiv.append(dateLabel);
    }

    let btnGroup = $('<div class="button-group"></div>');
    if (task.subtasks.length > 0) btnGroup.append($('<button type="button" class="toggle-subtasks-btn">▼</button>'));

    if (task.dueDate) {
        let googleBtn = $('<button class="google-calendar-btn" type="button" data-tooltip="Agendar no Google Agenda"></button>');
        let img = $('<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Google_Calendar_icon_%282020%29.svg/512px-Google_Calendar_icon_%282020%29.svg.png" alt="Google Agenda">');
        googleBtn.append(img);
        btnGroup.append(googleBtn);
        googleBtn.on('click', function () { exportTaskToGoogleLink(task); });
    }

    let editBtn = $('<button class="edit-btn" type="button">✎</button>');
    let removeBtn = $('<button class="remove-btn" type="button">🗑️</button>');
    
    // Botão Adicionar Sub (referencia a tarefa principal)
    let addSubBtn = $('<button class="add-subtask-btn" type="button">➕ Sub</button>')
        .attr('data-task-id', task.id); 
    
    btnGroup.append(editBtn, removeBtn, addSubBtn);

    taskDiv.append(textDiv, btnGroup);
    li.append(taskDiv);

    // Renderiza a lista de sub-tarefas (chamada recursiva)
    let subtaskList = $('<ul class="subtask-list"></ul>');
    // Chama a função recursiva para a lista principal
    task.subtasks.forEach(st => addSubtaskHTML(subtaskList, st, task.id)); 
    li.append(subtaskList);
    initSubtaskSortable(subtaskList);

    $('#task-list').append(li);
    updateTaskDueVisual(li, task);
}

// NOVO: Função de renderização RECURSIVA para Sub-tarefas
function addSubtaskHTML(list, subtask, taskId, parentId = null) {
    
    let li = $('<li></li>')
        .attr('data-id', subtask.id)
        .attr('data-parent-id', parentId || taskId)
        // Adiciona classe de prioridade para subtasks terem cor
        .addClass('priority-' + (subtask.priority || 'medium'));
    
    // O item LI deve ser relativo para posicionar o menu de contexto ABSOLUTAMENTE
    li.css('position', 'relative'); 

    let textDiv = $('<div class="task-text"></div>');
    let checkbox = $('<input type="checkbox" class="subtask-checkbox">').prop('checked', subtask.completed);
    
    // O clique no label AGORA abre o modal de edição
    let label = $('<label class="subtask-label"></label>').text(subtask.text)
        .attr('data-task-id', taskId)
        .attr('data-subtask-id', subtask.id)
        .on('click', function(e) {
            e.stopPropagation();
            openSubtaskModalForEdit(taskId, subtask.id);
        });

    if (subtask.completed) label.addClass('completed');
    
    textDiv.append(checkbox, label);
    
    // Mostra data e hora se existirem
    if (subtask.dueDate) {
        let dateText = new Date(subtask.dueDate + 'T00:00:00').toLocaleDateString();
        let timeText = subtask.dueTime ? ` ${subtask.dueTime}` : '';
        let dateTimeText = `📅 ${dateText}${timeText}`;
        let dateLabel = $('<span class="task-datetime"></span>').text(dateTimeText);
        textDiv.append(dateLabel);
    }
    
    // GRUPO DE BOTÕES (AGORA APENAS O ÍCONE DE OPÇÕES)
    let btnGroup = $('<div class="button-group subtask-btn-group"></div>'); 

    // ÍCONE DE OPÇÕES (os três pontinhos)
    let optionsBtn = $('<button class="subtask-options-btn" type="button">⋮</button>')
        .attr('data-task-id', taskId)
        .attr('data-subtask-id', subtask.id)
        .attr('data-parent-id', parentId || taskId)
        // O handler para o menu de contexto
        .on('click', function(e) { 
            e.stopPropagation();
            toggleSubtaskMenu($(this), taskId, subtask.id, parentId || taskId);
        });

    // Adiciona o botão e o menu de contexto DENTRO do button-group para posicionamento
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
    
    // Adiciona o conteúdo (texto/checkbox/data) e o grupo de botões ao LI
    li.append(textDiv, btnGroup);

    // RENDERIZAÇÃO RECURSIVA para a hierarquia visual
    if (subtask.subtasks && subtask.subtasks.length > 0) {
        let nestedSubtaskList = $('<ul class="subtask-list nested-subtask-list"></ul>');
        subtask.subtasks.forEach(st => addSubtaskHTML(nestedSubtaskList, st, taskId, subtask.id));
        li.append(nestedSubtaskList);
    }
    
    list.append(li);
    updateTaskDueVisual(li, subtask);
}

// NOVO: Função que lida com o menu de contexto da sub-tarefa (CORRIGIDO)
function toggleSubtaskMenu($button, taskId, subtaskId, parentId) {
    // Esconde todos os outros menus abertos
    $('.subtask-options-menu').removeClass('active');
    
    // O menu é irmão do botão
    const $menu = $button.siblings('.subtask-options-menu').first();
    $menu.toggleClass('active');

    // Mapear os botões do menu para as ações:
    
    // 1. Editar
    $menu.find('.menu-edit').off('click').on('click', (e) => {
        e.stopPropagation();
        openSubtaskModalForEdit(taskId, subtaskId);
        $menu.removeClass('active');
    });

    // 2. Adicionar Abaixo (Cria no mesmo nível)
    $menu.find('.menu-add-below').off('click').on('click', (e) => {
        e.stopPropagation();
        openSubtaskModalForCreate(taskId, parentId); 
        $menu.removeClass('active');
    });

    // 3. Adicionar Filho (Cria um nível abaixo)
    $menu.find('.menu-add-child').off('click').on('click', (e) => {
        e.stopPropagation();
        openSubtaskModalForCreate(taskId, subtaskId); 
        $menu.removeClass('active');
    });

    // 4. Excluir (NOVO: Chama o modal)
    $menu.find('.menu-remove').off('click').on('click', async (e) => {
        e.stopPropagation();
        $menu.removeClass('active');
        deleteSubtaskViaModal(taskId, subtaskId); 
    });
    
    // Fecha o menu ao clicar fora
    // Usa um timeout para garantir que o evento de clique termine antes de fechar
    setTimeout(() => {
        $(document).one('click', (e) => {
            // Se o clique não foi no próprio menu ou botão
            if (!$(e.target).closest('.subtask-options-menu').length && !$(e.target).is('.subtask-options-btn')) {
                $('.subtask-options-menu').removeClass('active');
            }
        });
    }, 100);
}


// NOVO: Implementação da função deleteSubtaskViaModal (Substitui o prompt)
function deleteSubtaskViaModal(taskId, subId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const subtask = findNestedSubtask(task.subtasks, subId);
    if (!subtask) return;

    // 1. Configura o modal de confirmação
    $('#confirm-title').text('Apagar Subtarefa');
    $('#confirm-text').html(`Deseja realmente apagar a subtarefa <strong>"${subtask.text}"</strong> e todos os seus itens aninhados? Esta ação não pode ser desfeita.`);
    
    // 2. Exibe o modal
    showModal('#confirmModal');

    // 3. Configura o handler de confirmação (com exclusão)
    $('#confirm-ok-btn').off('click').on('click', async function() {
        $('#confirm-ok-btn').prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Excluindo...');
        
        const recursiveRemove = (subtasks) => {
            return subtasks.filter(sub => sub.id !== subId).map(sub => {
                if (sub.subtasks && sub.subtasks.length > 0) {
                    sub.subtasks = recursiveRemove(sub.subtasks);
                }
                return sub;
            });
        };

        const updatedSubtasks = recursiveRemove(task.subtasks);
        await saveSubtasksToFirestore(taskId, updatedSubtasks);
        
        // Limpeza e fechamento
        hideModal('#confirmModal');
        $('#confirm-ok-btn').prop('disabled', false).html('Confirmar');
    });

    // 4. Configura o handler de cancelamento
    $('#confirm-cancel-btn').off('click').on('click', function() {
        hideModal('#confirmModal');
        $('#confirm-ok-btn').prop('disabled', false).html('Confirmar');
    });
}


/* ---------- EDICAO / CRIACAO DE SUBTAREFA VIA MODAL (MODIFICADO) ---------- */

function openSubtaskModalForCreate(taskId, parentId) {
    // Reseta/Define o estado do modal
    currentSubtaskData = { 
        taskId, subtaskId: null, isEdit: false, parentId,
        priority: 'medium', category: 'geral', dueDate: '', dueTime: '' 
    }; 
    
    let parentText = parentId === taskId 
        ? tasks.find(t => t.id === taskId)?.text 
        : findNestedSubtask(tasks.find(t => t.id === taskId)?.subtasks, parentId)?.text || "Subtarefa";
    
    $('#subtask-modal-title').text(`Adicionar Subtarefa a "${parentText}"`);
    $('#subtask-input').val('');
    $('#subtask-priority').val('medium');
    $('#subtask-category').val('geral');
    $('#subtask-date').val('');
    $('#subtask-time').val('');
    $('#subtask-add-btn').text('Adicionar');
    showModal('#subtask-modal');
}

function openSubtaskModalForEdit(taskId, subtaskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const subtask = findNestedSubtask(task.subtasks, subtaskId);
    if (!subtask) return;
    
    // Define o estado com os dados da subtask
    currentSubtaskData = { 
        taskId, subtaskId, isEdit: true, parentId: null,
        priority: subtask.priority || 'medium', 
        category: subtask.category || 'geral', 
        dueDate: subtask.dueDate || '', 
        dueTime: subtask.dueTime || '' 
    };
    
    $('#subtask-modal-title').text(`Editar Subtarefa: "${subtask.text}"`);
    $('#subtask-input').val(subtask.text);
    $('#subtask-priority').val(currentSubtaskData.priority);
    $('#subtask-category').val(currentSubtaskData.category);
    $('#subtask-date').val(currentSubtaskData.dueDate);
    $('#subtask-time').val(currentSubtaskData.dueTime);
    $('#subtask-add-btn').text('Salvar Edição');
    showModal('#subtask-modal');
}

/* ---------- DRAG & DROP UTILS ---------- */
function initSubtaskSortable(sublist) {
    sublist.sortable({
        connectWith: '.subtask-list',
        update: function () {
             // Lógica de persistência para ordenação de subtasks aninhadas é complexa e omitida aqui.
        }
    });
}

/* ---------- FILTRO / PESQUISA ---------- */
function applyFilter() {
    let searchVal = $('#search-input').val().toLowerCase();
    let priorityVal = $('#filter-priority').val();
    let categoryVal = $('#filter-category').val();

    $('#task-list>li').each(function () {
        let task = $(this);
        let text = task.find('label').first().text().toLowerCase();
        let priorityClass = (task.attr('class') || '').toLowerCase();
        let taskCategory = task.data('category') || 'geral';
        task.toggle(
            text.includes(searchVal) &&
            (priorityVal === 'all' || priorityClass.includes(priorityVal)) &&
            (categoryVal === 'all' || taskCategory === categoryVal)
        );
    });
}

/* ---------- BARRA DE PROGRESSO ---------- */
function updateProgress() {
    let total = tasks.length;
    let completed = tasks.filter(t => t.completed).length; 
    let percent = total ? Math.round((completed / total) * 100) : 0;
    $('.progress-bar').text(percent ? percent + '%' : '');

    let color;
    if (percent === 0) color = '#f44336';
    else if (percent < 50) color = '#ff9800';
    else if (percent < 80) color = '#4CAF50';
    else color = 'linear-gradient(270deg, #4CAF50, #8BC34A, #4CAF50)';

    if (percent >= 80) $('.progress-bar').css({ 'background': color, 'background-size': '600% 100%', 'animation': 'gradientAnimation 3s ease infinite' });
    else $('.progress-bar').css({ 'background': color, 'animation': 'none' });

    $('.progress-bar').css('width', percent + '%');
    $('.progress-bar').toggleClass('completed', percent === 100);
}

/* ---------- DATAS ---------- */
function updateTaskDueVisual(li, task) {
    li.removeClass('due-soon overdue');
    // Verifica se a subtask tem classe priority-low/medium/high
    li.removeClass('priority-low priority-medium priority-high').addClass('priority-' + (task.priority || 'medium'));

    if (!task || !task.dueDate || task.completed) return;
    
    const dueDateTimeString = task.dueDate + (task.dueTime ? 'T' + task.dueTime : 'T00:00:00');
    const due = new Date(dueDateTimeString);
    const now = new Date();
    const diffHours = (due - now) / (1000 * 60 * 60);

    if (diffHours < 0) li.addClass('overdue');
    else if (diffHours <= 24) li.addClass('due-soon');
}

function checkAllDueDates() {
    $('#task-list>li').each(function () {
        updateTaskDueVisual($(this), tasks.find(t => t.id === $(this).attr('data-id')));
    });
    // Adiciona verificação para subtasks, já que elas agora chamam updateTaskDueVisual
    $('.subtask-list li').each(function () {
        const taskId = $(this).closest('li[data-id][data-category]').attr('data-id');
        const subId = $(this).attr('data-id');
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            const subtask = findNestedSubtask(task.subtasks, subId);
            if (subtask) updateTaskDueVisual($(this), subtask);
        }
    });
}

/* ---------- GOOGLE AGENDA ---------- */
function exportTaskToGoogleLink(task) {
    if (!task.dueDate) { alert("A tarefa precisa ter uma data para exportar!"); return; }
    
    let startDateTime = task.dueDate + (task.dueTime ? `T${task.dueTime}:00` : 'T09:00:00');
    let startDate = new Date(startDateTime);
    let endDate = new Date(startDate.getTime() + 60 * 60 * 1000); 

    let formatForGoogle = (date) => date.toISOString().replace(/-|:|\.\d+/g, '');
    
    let url = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
                `&text=${encodeURIComponent(task.text)}` +
                `&dates=${formatForGoogle(startDate)}/${formatForGoogle(endDate)}` +
                `&details=${encodeURIComponent(task.subtasks.map(st=>st.text).join('\n'))}`;
    window.open(url,'_blank');
}

/* ---------- FULLCALENDAR ---------- */
function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    if(calendarEl && typeof FullCalendar!=='undefined' && FullCalendar.Calendar){
        calendar = new FullCalendar.Calendar(calendarEl,{
            initialView:'timeGridWeek', 
            locale: 'pt-br',
            headerToolbar:{left:'prev,next today',center:'title',right:'dayGridMonth,timeGridWeek,listWeek'},
            events: [], 
            eventClick:function(info){
                try{
                    const id=info.event.id;
                    const li=$(`#task-list li[data-id="${id}"]`);
                    if(li.length) {
                        hideModal('.modal.show');
                        li.find('label').first().click();
                        try { li[0].scrollIntoView({behavior:'smooth', block:'center'}); } catch(e){}
                        setTimeout(() => {
                            try { li.addClass('highlight'); setTimeout(()=>li.removeClass('highlight'), 1200); } catch(e){}
                        }, 300);
                    }
                } catch(e){}
            }
        });
        calendar.render(); calendarInitialized=true;
    }
}

function syncTaskToCalendar(task) {
    if (!calendar) return;
    let existing = calendar.getEventById(task.id);
    if (task.dueDate) {
        let startDateTime = task.dueDate + (task.dueTime ? `T${task.dueTime}` : '');
        let eventData = {
            id: task.id,
            title: task.text,
            start: startDateTime,
            allDay: !task.dueTime, 
            color: task.completed ? '#4CAF50' : undefined
        };
        if (existing) { existing.remove(); }
        calendar.addEvent(eventData);
    } else if (existing) {
        existing.remove();
    }
}

function removeEventFromCalendar(taskId){ if(calendar){ let ev=calendar.getEventById(taskId); if(ev) ev.remove(); } }
function syncAllToCalendar(){
    if(calendar) {
        calendar.getEvents().forEach(e=>e.remove());
        tasks.forEach(syncTaskToCalendar); 
    }
}

function showModal(selector, options = {}) {
    const $modal = (typeof selector === 'string') ? $(selector) : selector;
    if (!$modal || $modal.length === 0) return;

    $('body').css('overflow', 'hidden'); 
    $modal.addClass('show').attr('aria-hidden', 'false').show();

    const $focusableElements = $modal.find('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const $firstFocusable = $focusableElements.first();
    const $lastFocusable = $focusableElements.last();

    setTimeout(() => {
        if ($firstFocusable.length) $firstFocusable.focus();
    }, 100);

    $modal.off('keydown.focusTrap').on('keydown.focusTrap', function (e) {
        if (e.key === 'Tab' || e.keyCode === 9) {
            if (e.shiftKey) { // Shift + Tab
                if (document.activeElement === $firstFocusable[0]) {
                    $lastFocusable.focus();
                    e.preventDefault();
                }
            } else { // Tab
                if (document.activeElement === $lastFocusable[0]) {
                    $firstFocusable.focus();
                    e.preventDefault();
                }
            }
        }
    });

    if (calendar && $modal.find('#calendar').length) {
        setTimeout(() => { try { calendar.render(); } catch (e) {} }, 60);
    }

    $modal.off('click.modalOverlay').on('click.modalOverlay', function (evt) {
        if (evt.target === this && !(options && options.disableOverlayClose)) hideModal($modal);
    });
}

function hideModal(selector) {
    const $modal = (typeof selector === 'string') ? $(selector) : selector;
    if (!$modal || $modal.length === 0) return;

    $('body').css('overflow', ''); 
    $modal.removeClass('show').attr('aria-hidden', 'true').hide();
    $modal.off('click.modalOverlay');
    $modal.off('keydown.focusTrap'); 
}


// ===============================================
// 8. LÓGICA DE AUTENTICAÇÃO E EVENT HANDLERS
// ===============================================

onAuthStateChanged(auth, (user) => {
    if (user) {
        CURRENT_USER_UID = user.uid;
        
        $(document).ready(function () {
            
            migrateLocalTasksToFirestore(); 
            loadTasksRealTime(); 

            initCalendar(); 
            setInterval(checkAllDueDates, 60 * 1000); 

            /* ------------------ EVENT HANDLERS (DOM INTERACTION) ------------------ */

            /* ---------- Mostrar/Esconder Formulário e Filtros ---------- */
            $('#toggle-form-btn').on('click', function() {
                $('#filter-container').slideUp(200);
                $('#form-container').slideToggle(300, function() {
                    if ($(this).is(':visible')) $('#task-text').focus();
                });
                const formVisible = $('#form-container').is(':visible');
                if (!formVisible) $(this).html('<i class="fa-solid fa-times"></i> Fechar Formulário');
                else $(this).html('<i class="fa-solid fa-plus"></i> Adicionar Nova Tarefa');
            });

            $('#toggle-filter-btn').on('click', function() {
                $('#form-container').slideUp(200, function() {
                    $('#toggle-form-btn').html('<i class="fa-solid fa-plus"></i> Adicionar Nova Tarefa');
                });
                $('#filter-container').slideToggle(300, function() {
                    if ($(this).is(':visible')) $('#search-input').focus();
                });
            });

            $(document).on('keydown', function (e) {
                if (e.key === 'Escape' || e.keyCode === 27) {
                    if ($('#form-container').is(':visible')) {
                        $('#form-container').slideUp(300);
                        $('#toggle-form-btn').html('<i class="fa-solid fa-plus"></i> Adicionar Nova Tarefa');
                    }
                    if ($('#filter-container').is(':visible')) {
                        $('#filter-container').slideUp(300);
                    }
                }
            });
            
            $('.modal .close, .modal .close-top-right').on('click', function() { hideModal($(this).closest('.modal')); });
            $('#edit-cancel-btn').on('click', () => hideModal('#editTaskModal'));
            $('#subtask-cancel-btn').on('click', () => hideModal('#subtask-modal'));
            $('#view-close-btn').on('click', () => hideModal('#viewTaskModal'));
            $(document).on('keydown', function (e) {
                if (e.key === 'Escape' || e.keyCode === 27) $('.modal.show').each(function () { hideModal($(this)); });
            });


            /* ---------- ADD TAREFA (MODIFICADO) ---------- */
            $('#task-form').off('submit').on('submit', function (e) {
                e.preventDefault();
                let text = $('#task-text').val().trim();
                let priority = $('#task-priority').val();
                let dueDate = $('#task-date').val();
                let dueTime = $('#task-time').val();
                let category = $('#task-category').val() || 'geral';
                if (!text) return;

                let task = { text, completed: false, priority, dueDate, dueTime, category, subtasks: [] };
                
                addTaskToFirestore(task);

                $('#task-text').val('');
                $('#task-priority').val('medium');
                $('#task-date').val('');
                $('#task-time').val('');
                $('#task-category').val('geral');
            });


            /* ---------- MARCAR / DESMARCAR TAREFA PRINCIPAL (MODIFICADO) ---------- */
            $(document).off('change', '.task-checkbox').on('change', '.task-checkbox', async function () {
                let li = $(this).closest('li');
                let taskId = li.attr('data-id');
                let isCompleted = $(this).prop('checked');
                
                let task = tasks.find(t => t.id === taskId);
                if (!task) return;
                
                // Marca/desmarca o status da tarefa principal e propaga para todos os filhos
                const recursiveCheck = (subtasks) => {
                    return subtasks.map(st => ({
                        ...st,
                        completed: isCompleted,
                        subtasks: st.subtasks ? recursiveCheck(st.subtasks) : []
                    }));
                };

                const subtasks = recursiveCheck(task.subtasks);
                
                await updateTaskInFirestore(taskId, { 
                    completed: isCompleted,
                    subtasks: subtasks 
                });
            });

            /* ---------- MARCAR / DESMARCAR SUBTAREFA (MODIFICADO - QUALQUER NÍVEL) ---------- */
            $(document).off('change', '.subtask-checkbox').on('change', '.subtask-checkbox', async function () {
                let li = $(this).closest('li');
                let subId = li.attr('data-id');
                let taskId = $(this).closest('li[data-id][data-category]').attr('data-id');

                let task = tasks.find(t => t.id === taskId);
                if (!task) return;

                const isCompleted = $(this).prop('checked');
                
                // 1. Atualiza o status da sub-tarefa alvo e seus filhos (recursivamente)
                const updateTargetAndChildren = (subtasks) => {
                    return subtasks.map(st => {
                        if (st.id === subId) {
                            st.completed = isCompleted;
                            // Propaga para filhos
                            if (st.subtasks) st.subtasks = st.subtasks.map(child => ({...child, completed: isCompleted}));
                        } else if (st.subtasks && st.subtasks.length > 0) {
                            st.subtasks = updateTargetAndChildren(st.subtasks);
                        }
                        return st;
                    });
                };
                
                let updatedSubtasks = updateTargetAndChildren(task.subtasks);

                // 2. Verifica o status da Tarefa Principal com o novo array
                const isMainTaskCompleted = checkCompletionStatusRecursively(updatedSubtasks);

                // 3. Salva no Firestore
                await updateTaskInFirestore(taskId, { 
                    subtasks: updatedSubtasks,
                    completed: isMainTaskCompleted 
                });
            });

            /* ---------- REMOVER TAREFA (MODIFICADO) ---------- */
            $(document).off('click', '.remove-btn').on('click', '.remove-btn', function () {
                let li = $(this).closest('li');
                let taskId = li.attr('data-id');
                let task = tasks.find(t => t.id === taskId);
                if (!task) return;
                
                $('#confirm-title').text('Apagar Tarefa');
                $('#confirm-text').text(`Deseja realmente apagar a tarefa "${task.text}"? Esta ação não pode ser desfeita.`);
                showModal('#confirmModal');

                $('#confirm-ok-btn').off('click').on('click', function() {
                    deleteTaskFromFirestore(taskId); 
                    hideModal('#confirmModal');
                });

                $('#confirm-cancel-btn').off('click').on('click', function() {
                    hideModal('#confirmModal');
                });
            });

            /* ---------- REMOVER SUBTAREFA (MODIFICADO - QUALQUER NÍVEL) ---------- */
            // Esta lógica foi movida para dentro do menu de contexto e é tratada pela função deleteSubtaskViaModal
            
            // NOVO EVENTO: Adicionar Subtarefa Aninhada
            $(document).on('click', '.add-nested-subtask-btn', function() {
                const taskId = $(this).data('task-id');
                const parentId = $(this).data('parent-id');
                openSubtaskModalForCreate(taskId, parentId);
            });

            // MODIFICADO: Adicionar Subtarefa (Principal)
            $(document).on('click', '.add-subtask-btn', function () {
                const taskId = $(this).data('task-id') || $(this).closest('li').data('id');
                if (!taskId) return;
                openSubtaskModalForCreate(taskId, taskId); 
            });


            // MODIFICADO: Lógica de Salvar/Adicionar Subtarefa (Unifica Edição e Criação Aninhada)
            $('#subtask-add-btn').off('click').on('click', async function () { 
                const { taskId, subtaskId, isEdit, parentId } = currentSubtaskData;
                const subtaskText = $('#subtask-input').val().trim();
                
                // Pega os novos campos do modal
                const newSubtaskData = {
                    text: subtaskText,
                    priority: $('#subtask-priority').val(),
                    category: $('#subtask-category').val(),
                    dueDate: $('#subtask-date').val(),
                    dueTime: $('#subtask-time').val(),
                };

                if (!newSubtaskData.text || !taskId) return;
                
                const task = tasks.find(t => t.id === taskId);
                if (!task) return;

                let updatedSubtasks;

                if (isEdit) {
                    updatedSubtasks = updateNestedSubtasks(task.subtasks, subtaskId, (sub) => {
                        // Atualiza todos os campos
                        return { ...sub, ...newSubtaskData };
                    });
                    
                } else {
                    const newSubtask = { id: generateId(), completed: false, subtasks: [], ...newSubtaskData };

                    if (parentId === taskId) {
                        updatedSubtasks = [...task.subtasks, newSubtask];
                    } else {
                        updatedSubtasks = updateNestedSubtasks(task.subtasks, parentId, (sub) => {
                            sub.subtasks = sub.subtasks || [];
                            sub.subtasks.push(newSubtask);
                            return sub;
                        });
                    }
                }
                
                await saveSubtasksToFirestore(taskId, updatedSubtasks);

                hideModal('#subtask-modal');
                currentSubtaskData = { taskId: null, subtaskId: null, isEdit: false, parentId: null };
            });


            /* ---------- EDITAR TAREFA VIA MODAL (MODIFICADO) ---------- */
            $(document).on('click','.edit-btn',function(){
                let li = $(this).closest('li'); currentTaskLi=li;
                let task = tasks.find(t => t.id === li.attr('data-id')); if(!task) return;
                $('#edit-task-name').val(task.text);
                $('#edit-task-priority').val(task.priority);
                $('#edit-task-category').val(task.category);
                $('#edit-task-date').val(task.dueDate);
                $('#edit-task-time').val(task.dueTime);
                showModal('#editTaskModal');
            });

            $('#edit-save-btn').off('click').on('click', async function(){ 
                if(!currentTaskLi) return;
                let taskId = currentTaskLi.attr('data-id');
                
                let task = tasks.find(t => t.id === taskId); 
                if(!task) return;
                
                const updatedData = {
                    text: $('#edit-task-name').val().trim() || 'Tarefa',
                    priority: $('#edit-task-priority').val(),
                    category: $('#edit-task-category').val(),
                    dueDate: $('#edit-task-date').val(),
                    dueTime: $('#edit-task-time').val(),
                };
                
                await updateTaskInFirestore(taskId, updatedData);

                hideModal('#editTaskModal'); 
                currentTaskLi=null;
            });
            
            /* ---------- FILTRO / PESQUISA ---------- */
            $('#search-input').on('input', applyFilter);
            $('#filter-priority').on('change', applyFilter);
            $('#filter-category').on('change', applyFilter);


            /* ---------- DRAG & DROP (RE-HABILITADO) ---------- */
            $('#task-list').sortable({
                update: async function (event, ui) {
                    if (!CURRENT_USER_UID) return;
                    
                    const orderedIds = $('#task-list>li').map(function() {
                        return $(this).attr('data-id');
                    }).get();

                    const batch = writeBatch(db);
                    const tasksRef = collection(db, "users", CURRENT_USER_UID, "tasks");
                    
                    orderedIds.forEach((taskId, newIndex) => {
                        const taskRef = doc(tasksRef, taskId);
                        batch.update(taskRef, { orderIndex: newIndex });
                    });

                    try {
                        await batch.commit();
                        console.log("✅ Nova ordem salva no Firestore com sucesso!");
                    } catch (error) {
                        console.error("🚨 Erro ao salvar a nova ordem:", error);
                        $(this).sortable('cancel');
                        alert("Erro ao salvar a nova ordem. Verifique sua conexão ou regras de segurança.");
                    }
                }
            });

            /* ---------- TOGGLE SUBTASKS (INALTERADO) ---------- */
            $(document).on('click', '.toggle-subtasks-btn', function () {
                let li = $(this).closest('li');
                li.find('.subtask-list').slideToggle(200);
                $(this).toggleClass('collapsed');
            });

            /* ---------- MODAL DE VISUALIZAÇÃO (MODIFICADO PARA RECURSÃO) ---------- */
            $(document).on('click', '#task-list li > .task-main > .task-text > label', function(){
                let li = $(this).closest('li');
                let task = tasks.find(t => t.id === li.attr('data-id'));
                if(!task) return;
                
                const renderNestedSubtasks = (subtasks, $list) => {
                    if (!subtasks || subtasks.length === 0) return;
                    subtasks.forEach(st => {
                        const $li = $('<li></li>').text(st.text + (st.completed ? ' ✅' : '')).appendTo($list);
                        if (st.subtasks && st.subtasks.length > 0) {
                            const $ul = $('<ul class="subtasks-list" style="margin-left: 20px; border-left: 2px solid #ddd; padding-left: 10px;"></ul>').appendTo($li);
                            renderNestedSubtasks(st.subtasks, $ul);
                        }
                    });
                };

                $('#view-task-name').text(task.text);
                $('#view-task-priority').text(task.priority.charAt(0).toUpperCase()+task.priority.slice(1));
                $('#view-task-category').text(task.category.charAt(0).toUpperCase()+task.category.slice(1));
                
                let dateText = task.dueDate ? new Date(task.dueDate + 'T00:00:00').toLocaleDateString() : 'Sem data';
                let timeText = task.dueTime ? ` às ${task.dueTime}` : '';
                $('#view-task-date').text(dateText + timeText);

                let $subtasks = $('#view-task-subtasks').empty();
                if(task.subtasks.length){
                    renderNestedSubtasks(task.subtasks, $subtasks);
                } else $subtasks.append('<li>Nenhuma subtarefa</li>');

                showModal('#viewTaskModal');

                $('#view-edit-btn').off('click').on('click',function(){
                    hideModal('#viewTaskModal');
                    li.find('.edit-btn').first().click();
                });

                $('#view-delete-btn').off('click').on('click',function(){
                    hideModal('#viewTaskModal');
                    li.find('.remove-btn').first().click();
                });
            });

            /* ---------- SCROLL NAV (INALTERADO) ---------- */
            let lastScrollTop = 0;
            const nav = document.querySelector("nav");
            window.addEventListener("scroll",()=>{ let currentScroll=window.pageYOffset||document.documentElement.scrollTop; if(currentScroll>lastScrollTop&&currentScroll>100) nav.classList.add("hidden"); else if(currentScroll<lastScrollTop) nav.classList.remove("hidden"); lastScrollTop=currentScroll<=0?0:currentScroll; });

            $('#toggle-calendar-btn').on('click',function(){
                const $container=$('#calendar-container');
                if($container.is(':visible')) $container.slideUp(180);
                else $container.slideDown(180,function(){
                    if(!calendarInitialized) initCalendar();
                    else if(calendar) {
                        try { calendar.render(); } catch(e){}
                        setTimeout(()=>{ try{ calendar.render(); } catch(e){} }, 60);
                    }
                });
            });

        });
        
    } else {
        const currentPage = window.location.pathname.split('/').pop();
        if (currentPage !== 'login.html' && currentPage !== 'signup.html') {
            window.location.href = "login.html";
        }
    }
});