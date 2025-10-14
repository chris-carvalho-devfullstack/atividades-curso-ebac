// ===============================================
// 1. IMPORTAÇÕES DO FIREBASE (ADICIONADO writeBatch)
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
    writeBatch // <--- NOVO
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// ===============================================
// 2. VARIÁVEIS GLOBAIS
// ===============================================
let CURRENT_USER_UID = null;
let tasks = []; 
let currentTaskLi = null;
let calendar = null;
let calendarInitialized = false;

// Função utilitária básica
function generateId() { return '_' + Math.random().toString(36).substr(2, 9); }


// ===============================================
// 3. FUNÇÕES DE OPERAÇÃO DO FIRESTORE (MODIFICADO)
// ===============================================

// NOVO HELPER: Calcula o novo índice para colocar a tarefa no topo
function getNewTaskOrderIndex() {
    if (tasks.length === 0) return 1.0; 
    // Subtrai 1.0 do menor índice atual (tasks[0], já que a lista é ordenada por orderIndex ASC)
    return tasks[0].orderIndex - 1.0; 
}

async function addTaskToFirestore(task) {
    if (!CURRENT_USER_UID) return;
    try {
        const tasksRef = collection(db, "users", CURRENT_USER_UID, "tasks");
        
        // ADICIONA O orderIndex para que a nova tarefa vá para o topo
        const newOrderIndex = getNewTaskOrderIndex();
        
        await addDoc(tasksRef, { 
            ...task, 
            createdAt: serverTimestamp(),
            orderIndex: newOrderIndex // <--- NOVO CAMPO
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
// 4. ESCUTA EM TEMPO REAL (MODIFICADO)
// ===============================================
function loadTasksRealTime() {
    if (!CURRENT_USER_UID) return;
    
    const tasksRef = collection(db, "users", CURRENT_USER_UID, "tasks");
    
    // ORDENA AGORA POR orderIndex (ascendente)
    const q = query(tasksRef, orderBy("orderIndex", "asc")); 

    onSnapshot(q, (snapshot) => {
        $('#task-list').empty(); 
        tasks = []; 
        
        snapshot.forEach((doc) => {
            const task = doc.data();
            task.id = doc.id; 
            if (!task.category) task.category = 'geral'; 
            
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
// 6. FUNÇÃO DE MIGRAÇÃO (MODIFICADO)
// ===============================================

function migrateLocalTasksToFirestore() {
    const data = localStorage.getItem('tasks');
    if (!data) return; 

    try {
        const localTasks = JSON.parse(data);
        if (localTasks.length === 0) return;

        console.log(`Encontradas ${localTasks.length} tarefas antigas no LocalStorage. Iniciando migração...`);

        const tasksRef = collection(db, "users", CURRENT_USER_UID, "tasks");
        
        // Define o índice inicial para sequenciar as tarefas do local storage
        let orderIndex = 0; 

        localTasks.forEach(async (task) => {
             const { id, ...taskData } = task; 

             await addDoc(tasksRef, {
                ...taskData,
                createdAt: serverTimestamp(),
                orderIndex: orderIndex++ // <--- ADICIONA orderIndex sequencial
            });
        });

        localStorage.removeItem('tasks');
        console.log("Migração concluída e LocalStorage limpo.");
        alert("🎉 Tarefas antigas do LocalStorage foram migradas para o Firebase! Recarregue a página se elas ainda não aparecerem.");

    } catch (e) { 
        console.error('Erro durante a migração do LocalStorage:', e);
    }
}


// ===============================================
// 7. FUNÇÕES DE RENDERIZAÇÃO E UTILIDADE (ELEVADAS)
// ===============================================

/* ---------- ADD TAREFA HTML (ELEVADA) ---------- */
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
    let addSubBtn = $('<button class="add-subtask-btn" type="button">➕ Sub</button>');
    btnGroup.append(editBtn, removeBtn, addSubBtn);

    taskDiv.append(textDiv, btnGroup);
    li.append(taskDiv);

    let subtaskList = $('<ul class="subtask-list"></ul>');
    task.subtasks.forEach(st => addSubtaskHTML(subtaskList, st));
    li.append(subtaskList);
    initSubtaskSortable(subtaskList);

    $('#task-list').append(li);
    updateTaskDueVisual(li, task);
}

function addSubtaskHTML(list, subtask) {
    let li = $('<li></li>').attr('data-id', subtask.id);
    let div = $('<div class="task-text"></div>');
    let checkbox = $('<input type="checkbox" class="subtask-checkbox">').prop('checked', subtask.completed);
    let label = $('<label></label>').text(subtask.text);
    if (subtask.completed) label.addClass('completed');
    div.append(checkbox, label);
    let removeBtn = $('<button class="remove-subtask-btn" type="button">🗑️</button>');
    li.append(div, removeBtn);
    list.append(li);
}

/* ---------- DRAG & DROP UTILS (ELEVADAS) ---------- */
function initSubtaskSortable(sublist) {
    sublist.sortable({
        connectWith: '.subtask-list',
        update: function () {
             // Opcional: Implementar persistência de ordenação de subtasks aqui, se necessário.
        }
    });
}

/* ---------- FILTRO / PESQUISA (ELEVADA) ---------- */
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

/* ---------- BARRA DE PROGRESSO (ELEVADA) ---------- */
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

/* ---------- DATAS (ELEVADAS) ---------- */
function updateTaskDueVisual(li, task) {
    li.removeClass('due-soon overdue');
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
}

/* ---------- GOOGLE AGENDA (ELEVADA) ---------- */
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

/* ---------- FULLCALENDAR (ELEVADAS) ---------- */
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
// 5. LÓGICA DE AUTENTICAÇÃO E INICIALIZAÇÃO
// ===============================================

onAuthStateChanged(auth, (user) => {
    if (user) {
        CURRENT_USER_UID = user.uid;
        
        $(document).ready(function () {
            
            // === PASSO 1: MIGRAÇÃO (Chamada Única) ===
            migrateLocalTasksToFirestore(); 
            
            // === PASSO 2: INICIALIZAÇÃO DO LISTENER ===
            loadTasksRealTime(); 

            // Inicialização de calendários e checks de datas
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

            // Fecha painéis no Escape
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
            
            // Eventos de Fechamento de Modais
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

                // Limpa UI
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
                
                const subtasks = task.subtasks.map(st => ({ ...st, completed: isCompleted }));
                
                await updateTaskInFirestore(taskId, { 
                    completed: isCompleted,
                    subtasks: subtasks 
                });
            });

            /* ---------- MARCAR / DESMARCAR SUBTAREFA (MODIFICADO) ---------- */
            $(document).off('change', '.subtask-checkbox').on('change', '.subtask-checkbox', async function () {
                let li = $(this).closest('li');
                let subId = li.attr('data-id');
                let taskLi = li.closest('ul').closest('li');
                let taskId = taskLi.attr('data-id');

                let task = tasks.find(t => t.id === taskId);
                if (!task) return;

                const updatedSubtasks = task.subtasks.map(st => 
                    st.id === subId ? { ...st, completed: $(this).prop('checked') } : st
                );

                const mainTaskCompleted = updatedSubtasks.every(st => st.completed);

                await updateTaskInFirestore(taskId, { 
                    subtasks: updatedSubtasks,
                    completed: mainTaskCompleted 
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

            /* ---------- REMOVER SUBTAREFA (MODIFICADO) ---------- */
            $(document).off('click', '.remove-subtask-btn').on('click', '.remove-subtask-btn', async function () {
                let li = $(this).closest('li');
                let subId = li.attr('data-id');
                let taskLi = li.closest('ul').closest('li');
                let taskId = taskLi.attr('data-id');
                
                let task = tasks.find(t => t.id === taskId);
                if (!task) return;
                
                const updatedSubtasks = task.subtasks.filter(st => st.id !== subId);
                
                await saveSubtasksToFirestore(taskId, updatedSubtasks); 
            });

            /* ---------- ADD SUBTAREFA VIA MODAL (MODIFICADO) ---------- */
            $(document).on('click', '.add-subtask-btn', function () {
                currentTaskLi = $(this).closest('li');
                let taskText = currentTaskLi.find('label').first().text();
                $('#subtask-input').val('');
                $('#subtask-input').attr('placeholder', `Digite a subtarefa para "${taskText}"`);
                $('#subtask-modal-title').text(`Adicionar subtarefa para "${taskText}"`);
                showModal('#subtask-modal');
            });

            $('#subtask-add-btn').off('click').on('click', async function () { 
                let subtaskText = $('#subtask-input').val().trim();
                if (!subtaskText || !currentTaskLi) return;
                let taskId = currentTaskLi.attr('data-id');
                
                let task = tasks.find(t => t.id === taskId);
                if (!task) return;
                
                let subtask = { id: generateId(), text: subtaskText, completed: false };
                const updatedSubtasks = [...task.subtasks, subtask];
                
                await saveSubtasksToFirestore(taskId, updatedSubtasks);

                hideModal('#subtask-modal');
                currentTaskLi = null;
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
                    
                    // Recalcula e salva o orderIndex de 0 até N
                    orderedIds.forEach((taskId, newIndex) => {
                        const taskRef = doc(tasksRef, taskId);
                        // Usa o índice da posição DOM como o novo orderIndex
                        batch.update(taskRef, { orderIndex: newIndex });
                    });

                    try {
                        await batch.commit();
                        console.log("✅ Nova ordem salva no Firestore com sucesso!");
                        // O onSnapshot do loadTasksRealTime irá reagir ao batch.commit() e redesenhar a lista, garantindo a persistência.
                    } catch (error) {
                        console.error("🚨 Erro ao salvar a nova ordem:", error);
                        // Se falhar, reverte a mudança visual para evitar dessincronização.
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

            /* ---------- MODAL DE VISUALIZAÇÃO (INALTERADO) ---------- */
            $(document).on('click', '#task-list li > .task-main > .task-text > label', function(){
                let li = $(this).closest('li');
                let task = tasks.find(t => t.id === li.attr('data-id'));
                if(!task) return;

                $('#view-task-name').text(task.text);
                $('#view-task-priority').text(task.priority.charAt(0).toUpperCase()+task.priority.slice(1));
                $('#view-task-category').text(task.category.charAt(0).toUpperCase()+task.category.slice(1));
                
                let dateText = task.dueDate ? new Date(task.dueDate + 'T00:00:00').toLocaleDateString() : 'Sem data';
                let timeText = task.dueTime ? ` às ${task.dueTime}` : '';
                $('#view-task-date').text(dateText + timeText);

                let $subtasks = $('#view-task-subtasks').empty();
                if(task.subtasks.length){
                    task.subtasks.forEach(st => $('<li></li>').text(st.text + (st.completed ? ' ✅' : '')).appendTo($subtasks));
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
        // Redireciona para o login se não estiver logado
        const currentPage = window.location.pathname.split('/').pop();
        if (currentPage !== 'login.html' && currentPage !== 'signup.html') {
            window.location.href = "login.html";
        }
    }
});