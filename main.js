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
    writeBatch,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// ===============================================
// 2. VARIÁVEIS GLOBAIS
// ===============================================
let CURRENT_USER_UID = null;
let tasks = [];
let trash = [];
let currentTaskLi = null;
let currentSubtaskData = {
    taskId: null, subtaskId: null, isEdit: false, parentId: null,
    priority: 'medium', category: 'geral', dueDate: '', dueTime: ''
};
let calendar = null;
let calendarInitialized = false;

// --- VARIÁVEL GLOBAL PARA AS CONFIGURAÇÕES DO USUÁRIO ---
let USER_SETTINGS = {
    taskSettings: {
        alertLeadTimeMinutes: 60 // Padrão: 1 hora
    }
    // Adicionar outros defaults conforme necessário
};
// -----------------------------------------------------------

// Função utilitária básica
function generateId() { return '_' + Math.random().toString(36).substr(2, 9); }

// ===============================================
// LÓGICA DE AUTENTICAÇÃO E INICIALIZAÇÃO
// ===============================================
onAuthStateChanged(auth, (user) => {
    const loginPrompt = document.getElementById('login-prompt');
    const goToLoginBtn = document.getElementById('go-to-login-btn');

    if (user) {
        // Usuário está LOGADO
        CURRENT_USER_UID = user.uid;
        if(loginPrompt) loginPrompt.style.display = 'none';

        $(document).ready(function() {
            initializeAuthenticatedSession();
        });

    } else {
        // Usuário está DESLOGADO
        CURRENT_USER_UID = null;
        if(loginPrompt) loginPrompt.style.display = 'block';
        if(goToLoginBtn) {
            goToLoginBtn.addEventListener('click', () => {
                window.location.href = 'login.html';
            });
        }
        
        $(document).ready(function() {
            initializeGuestSession();
        });
    }
});

function initializeAuthenticatedSession() {
    console.log("Sessão autenticada iniciada.");
    loadUserSettings(); // NOVO: Carrega as configurações do usuário
    initCalendar();
    migrateLocalTasksToFirestore(); 
    loadTasksRealTime();
    loadTrash();
    setupCommonEventListeners();
}

function initializeGuestSession() {
    console.log("Sessão de convidado iniciada.");
    loadTasksFromLocalStorage();
    setupCommonEventListeners();
}

// --- FUNÇÃO PARA CARREGAR AS CONFIGURAÇÕES ---
async function loadUserSettings() {
    if (!CURRENT_USER_UID) return;
    try {
        const docRef = doc(db, "users", CURRENT_USER_UID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().taskSettings) {
            const settings = docSnap.data().taskSettings;
            // Atualiza a variável global com o valor do Firestore (ou usa o default 60)
            USER_SETTINGS.taskSettings.alertLeadTimeMinutes = settings.alertLeadTimeMinutes || 60;
        }
    } catch (error) {
        console.error("Erro ao carregar configurações do usuário:", error);
    }
}
// -----------------------------------------------------

// ===============================================
// 3. FUNÇÕES DE MANIPULAÇÃO DE DADOS (LOCAL & FIRESTORE)
// ===============================================

function getLocalTasks() {
    try {
        const localData = localStorage.getItem('tasks');
        return localData ? JSON.parse(localData) : [];
    } catch (e) {
        console.error("Erro ao ler tarefas locais:", e);
        return [];
    }
}


function saveLocalTasks(tasksArray) {
    localStorage.setItem('tasks', JSON.stringify(tasksArray));
    renderAllTasks(tasksArray);
    updateProgress();
}

function loadTasksFromLocalStorage() {
    tasks = getLocalTasks();
    renderAllTasks(tasks);
    updateProgress();
    checkAllDueDates();
}

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
    // Pega a ordem da primeira tarefa na lista (que é a mais alta) e adiciona 1
    const highestOrder = tasks.reduce((max, t) => t.orderIndex > max ? t.orderIndex : max, 0);
    return highestOrder + 1.0;
}


async function addTaskToFirestore(task) {
    if (!CURRENT_USER_UID) return;
    try {
        const tasksRef = collection(db, "users", CURRENT_USER_UID, "tasks");
        // CORREÇÃO: Usando a nova lógica para garantir que a ordem seja sempre crescente
        const newOrderIndex = tasks.length > 0 ? Math.max(...tasks.map(t => t.orderIndex || 0)) + 1 : 1;

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

async function moveTaskToTrash(taskId) {
    if (!CURRENT_USER_UID) return;
    try {
        const taskRef = doc(db, "users", CURRENT_USER_UID, "tasks", taskId);
        const taskDoc = await getDoc(taskRef);
        if (taskDoc.exists()) {
            const taskData = taskDoc.data();
            const trashRef = doc(db, "users", CURRENT_USER_UID, "trash", taskId);
            await setDoc(trashRef, { ...taskData, deletedAt: serverTimestamp() });
            await deleteDoc(taskRef);
        }
    } catch (error) {
        console.error("Erro ao mover tarefa para a lixeira:", error);
    }
}

async function restoreTaskFromTrash(taskId) {
    if (!CURRENT_USER_UID) return;
    try {
        const trashRef = doc(db, "users", CURRENT_USER_UID, "trash", taskId);
        const taskDoc = await getDoc(trashRef);
        if (taskDoc.exists()) {
            const taskData = taskDoc.data();
            delete taskData.deletedAt;
            const taskRef = doc(db, "users", CURRENT_USER_UID, "tasks", taskId);
            await setDoc(taskRef, taskData);
            await deleteDoc(trashRef);
        }
    } catch (error) {
        console.error("Erro ao restaurar tarefa:", error);
    }
}

async function permanentlyDeleteTask(taskId) {
    if (!CURRENT_USER_UID) return;
    try {
        const trashRef = doc(db, "users", CURRENT_USER_UID, "trash", taskId);
        await deleteDoc(trashRef);
    } catch (error) {
        console.error("Erro ao deletar tarefa permanentemente:", error);
    }
}

async function saveSubtasksToFirestore(taskId, subtasks) {
    await updateTaskInFirestore(taskId, { subtasks: subtasks });
}


// ===============================================
// 5. ESCUTA EM TEMPO REAL (FIRESTORE)
// ===============================================
function loadTasksRealTime() {
    if (!CURRENT_USER_UID) return;

    const tasksRef = collection(db, "users", CURRENT_USER_UID, "tasks");
    const q = query(tasksRef, orderBy("orderIndex", "asc"));

    onSnapshot(q, (snapshot) => {
        tasks = [];

        snapshot.forEach((doc) => {
            const task = doc.data();
            task.id = doc.id;
            if (!task.category) task.category = 'geral';
            if (!task.subtasks) task.subtasks = [];
            tasks.push(task);
        });
        
        renderAllTasks(tasks);
        updateProgress();
        checkAllDueDates();
        applyFilter();
        syncAllToCalendar();

    }, (error) => {
        console.error("Erro ao escutar tarefas em tempo real:", error);
    });
}

function loadTrash() {
    if (!CURRENT_USER_UID) return;

    const trashRef = collection(db, "users", CURRENT_USER_UID, "trash");
    const q = query(trashRef, orderBy("deletedAt", "desc"));

    onSnapshot(q, (snapshot) => {
        trash = [];
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        snapshot.forEach((doc) => {
            const task = doc.data();
            task.id = doc.id;

            if (task.deletedAt.toDate() < thirtyDaysAgo) {
                permanentlyDeleteTask(task.id);
            } else {
                trash.push(task);
            }
        });
        renderTrash(trash);
    });
}


// ===============================================
// 6. FUNÇÃO DE MIGRAÇÃO (CORRIGIDA)
// ===============================================

async function migrateLocalTasksToFirestore() {
    const localTasks = getLocalTasks();
    if (localTasks.length === 0) {
        return; // Nada para migrar
    }

    console.log(`Encontradas ${localTasks.length} tarefas locais. Iniciando migração...`);

    const tasksRef = collection(db, "users", CURRENT_USER_UID, "tasks");
    let currentOrderIndex = tasks.length > 0 ? Math.max(...tasks.map(t => t.orderIndex || 0)) + 1 : 1;

    // Mapeia cada tarefa local para uma promessa de adição no Firestore
    const migrationPromises = localTasks.map(task => {
        const { id, ...taskData } = task; // Remove o ID local antigo
        return addDoc(tasksRef, {
            ...taskData,
            createdAt: serverTimestamp(),
            orderIndex: currentOrderIndex++
        });
    });

    try {
        // Espera todas as promessas de escrita serem concluídas
        await Promise.all(migrationPromises);

        console.log("Migração concluída com sucesso!");
        localStorage.removeItem('tasks'); // Limpa o localStorage APÓS o sucesso
        alert("🎉 Suas tarefas locais foram salvas na nuvem!");
        // O onSnapshot vai recarregar a lista automaticamente, não precisa de reload.

    } catch (e) {
        console.error('Erro durante a migração do LocalStorage:', e);
        alert("Ocorreu um erro ao salvar suas tarefas na nuvem. Por favor, tente novamente.");
    }
}


// ===============================================
// 7. FUNÇÕES DE RENDERIZAÇÃO E UTILIDADE
// ===============================================

function renderAllTasks(tasksArray) {
    $('#task-list').empty();
    tasksArray.forEach(task => addTaskHTML(task));
}

function renderTrash(trashArray) {
    const trashList = $('#trash-list');
    trashList.empty();
    if (trashArray.length === 0) {
        trashList.append('<li>Lixeira vazia.</li>');
    } else {
        trashArray.forEach(task => {
            const deletedAt = task.deletedAt ? task.deletedAt.toDate().toLocaleDateString() : 'N/A';
            const li = $(`
                <li>
                    <span>${task.text} (Excluído em: ${deletedAt})</span>
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


function addTaskHTML(task) {
    const taskPriority = task.priority || 'medium';
    const taskCategory = task.category || 'geral';

    let li = $('<li></li>')
        .attr('data-id', task.id)
        .attr('data-category', taskCategory)
        .addClass('priority-' + taskPriority);

    let taskDiv = $('<div class="task-main"></div>');
    let textDiv = $('<div class="task-text"></div>');

    let checkbox = $('<input type="checkbox" class="task-checkbox">').prop('checked', task.completed);
    let label = $('<label></label>').text(task.text);
    if (task.completed) label.addClass('completed');
    
    // Ícone de privacidade
    let privacyIcon = $('<i class="privacy-icon"></i>');
    if (task.privacy === 'public') {
        privacyIcon.addClass('fa fa-globe').attr('title', 'Pública');
    } else if (task.privacy === 'shared') {
        privacyIcon.addClass('fa fa-users').attr('title', 'Compartilhada');
    } else {
        privacyIcon.addClass('fa fa-lock').attr('title', 'Privada');
    }
    
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
        let dateText = new Date(task.dueDate + 'T00:00:00').toLocaleDateString();
        let timeText = task.dueTime ? ` ${task.dueTime}` : '';
        let dateTimeText = `📅 ${dateText}${timeText}`;
        let dateLabel = $('<span class="task-datetime"></span>').text(dateTimeText);
        textDiv.append(dateLabel);
    }

    let btnGroup = $('<div class="button-group"></div>');
    if (task.subtasks && task.subtasks.length > 0) btnGroup.append($('<button type="button" class="toggle-subtasks-btn">▼</button>'));

    if (task.dueDate) {
        let googleBtn = $('<button class="google-calendar-btn" type="button" data-tooltip="Agendar no Google Agenda"></button>');
        let img = $('<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Google_Calendar_icon_%282020%29.svg/512px-Google_Calendar_icon_%282020%29.svg.png" alt="Google Agenda">');
        googleBtn.append(img);
        btnGroup.append(googleBtn);
        googleBtn.on('click', function () { exportTaskToGoogleLink(task); });
    }

    let editBtn = $('<button class="edit-btn" type="button">✎</button>');
    let removeBtn = $('<button class="remove-btn" type="button">🗑️</button>');

    let addSubBtn = $('<button class="add-subtask-btn" type="button">➕ Sub</button>')
        .attr('data-task-id', task.id);

    btnGroup.append(editBtn, removeBtn, addSubBtn);

    taskDiv.append(textDiv, btnGroup);
    li.append(taskDiv);

    let subtaskList = $('<ul class="subtask-list"></ul>');
    if (task.subtasks) {
        task.subtasks.forEach(st => addSubtaskHTML(subtaskList, st, task.id));
    }
    li.append(subtaskList);
    initSubtaskSortable(subtaskList);

    $('#task-list').append(li);
    updateTaskDueVisual(li, task);
}

function addSubtaskHTML(list, subtask, taskId, parentId = null) {
    let li = $('<li></li>')
        .attr('data-id', subtask.id)
        .attr('data-parent-id', parentId || taskId)
        .addClass('priority-' + (subtask.priority || 'medium'));

    li.css('position', 'relative');

    let textDiv = $('<div class="task-text"></div>');
    let checkbox = $('<input type="checkbox" class="subtask-checkbox">').prop('checked', subtask.completed);

    let label = $('<label class="subtask-label"></label>').text(subtask.text)
        .attr('data-task-id', taskId)
        .attr('data-subtask-id', subtask.id)
        .on('click', function(e) {
            e.stopPropagation();
            openSubtaskModalForEdit(taskId, subtask.id);
        });

    if (subtask.completed) label.addClass('completed');

    textDiv.append(checkbox, label);

    if (subtask.dueDate) {
        let dateText = new Date(subtask.dueDate + 'T00:00:00').toLocaleDateString();
        let timeText = subtask.dueTime ? ` ${subtask.dueTime}` : '';
        let dateTimeText = `📅 ${dateText}${timeText}`;
        let dateLabel = $('<span class="task-datetime"></span>').text(dateTimeText);
        textDiv.append(dateLabel);
    }

    let btnGroup = $('<div class="button-group subtask-btn-group"></div>');

    let optionsBtn = $('<button class="subtask-options-btn" type="button">⋮</button>')
        .attr('data-task-id', taskId)
        .attr('data-subtask-id', subtask.id)
        .attr('data-parent-id', parentId || taskId)
        .on('click', function(e) {
            e.stopPropagation();
            toggleSubtaskMenu($(this), taskId, subtask.id, parentId || taskId);
        });

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
        subtask.subtasks.forEach(st => addSubtaskHTML(nestedSubtaskList, st, taskId, subtask.id));
        li.append(nestedSubtaskList);
    }

    list.append(li);
    updateTaskDueVisual(li, subtask);
}

function toggleSubtaskMenu($button, taskId, subtaskId, parentId) {
    $('.subtask-options-menu').removeClass('active');

    const $menu = $button.siblings('.subtask-options-menu').first();
    $menu.toggleClass('active');

    $menu.find('.menu-edit').off('click').on('click', (e) => {
        e.stopPropagation();
        openSubtaskModalForEdit(taskId, subtaskId);
        $menu.removeClass('active');
    });

    $menu.find('.menu-add-below').off('click').on('click', (e) => {
        e.stopPropagation();
        openSubtaskModalForCreate(taskId, parentId);
        $menu.removeClass('active');
    });

    $menu.find('.menu-add-child').off('click').on('click', (e) => {
        e.stopPropagation();
        openSubtaskModalForCreate(taskId, subtaskId);
        $menu.removeClass('active');
    });

    $menu.find('.menu-remove').off('click').on('click', async (e) => {
        e.stopPropagation();
        $menu.removeClass('active');
        deleteSubtaskViaModal(taskId, subtaskId);
    });

    setTimeout(() => {
        $(document).one('click', (e) => {
            if (!$(e.target).closest('.subtask-options-menu').length && !$(e.target).is('.subtask-options-btn')) {
                $('.subtask-options-menu').removeClass('active');
            }
        });
    }, 100);
}

function deleteSubtaskViaModal(taskId, subId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const subtask = findNestedSubtask(task.subtasks, subId);
    if (!subtask) return;

    $('#confirm-title').text('Apagar Subtarefa');
    $('#confirm-text').html(`Deseja realmente apagar a subtarefa <strong>"${subtask.text}"</strong> e todos os seus itens aninhados? Esta ação não pode ser desfeita.`);

    showModal('#confirmModal');

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
        
        if (CURRENT_USER_UID) {
            await saveSubtasksToFirestore(taskId, updatedSubtasks);
        } else {
            task.subtasks = updatedSubtasks;
            saveLocalTasks(tasks);
        }

        hideModal('#confirmModal');
        $('#confirm-ok-btn').prop('disabled', false).html('Confirmar');
    });

    $('#confirm-cancel-btn').off('click').on('click', function() {
        hideModal('#confirmModal');
        $('#confirm-ok-btn').prop('disabled', false).html('Confirmar');
    });
}

function openSubtaskModalForCreate(taskId, parentId) {
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

function initSubtaskSortable(sublist) {
    sublist.sortable({
        connectWith: '.subtask-list',
        update: function () {
             // Lógica de persistência futura
        }
    });
}

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

// ===============================================
// NOVO: FUNÇÃO PARA CRIAR NOTIFICAÇÃO DE PRAZO
// ===============================================

/**
 * Cria uma notificação no Firestore para o usuário sobre uma tarefa urgente.
 * @param {string} taskId - O ID da tarefa.
 * @param {string} taskText - O texto da tarefa.
 * @param {string} dueDateTime - A data e hora de vencimento formatada.
 */
async function createTaskDeadlineNotification(taskId, taskText, dueDateTime) {
    if (!CURRENT_USER_UID) return;

    try {
        const notificationsRef = collection(db, 'users', CURRENT_USER_UID, 'notifications');
        const LEADING_TIME = USER_SETTINGS.taskSettings.alertLeadTimeMinutes;
        
        await addDoc(notificationsRef, {
            type: 'task_deadline',
            // Mensagem mais informativa
            message: `Atenção: A tarefa "${taskText}" vence em menos de ${LEADING_TIME} minutos (${dueDateTime}).`,
            url: `/index.html#task-${taskId}`, // URL para destacar a tarefa
            read: false,
            timestamp: serverTimestamp()
        });

        console.log(`Notificação de prazo criada para a tarefa: ${taskId}`);

    } catch (error) {
        console.error("Erro ao criar notificação de prazo:", error);
    }
}

// --- FUNÇÃO MODIFICADA PARA USAR AS CONFIGURAÇÕES DO USUÁRIO E DISPARAR NOTIFICAÇÃO ---
function updateTaskDueVisual(li, task) {
    li.removeClass('due-soon overdue');
    li.removeClass('priority-low priority-medium priority-high').addClass('priority-' + (task.priority || 'medium'));

    // Verifica se é uma tarefa válida, não concluída e com data de vencimento
    if (!task || !task.dueDate || task.completed) return;

    const dueDateTimeString = task.dueDate + (task.dueTime ? 'T' + task.dueTime : 'T00:00:00');
    const due = new Date(dueDateTimeString);
    const now = new Date();
    
    // Obtém o tempo limite em minutos da variável global USER_SETTINGS
    const LEAD_TIME_MINUTES = USER_SETTINGS.taskSettings.alertLeadTimeMinutes || 60; 
    
    const diffMinutes = (due - now) / (1000 * 60);
    
    // Variáveis auxiliares para controle de estado
    // Inclui o buffer de +1 minuto para a notificação visual (o que resolveu o seu problema de margem)
    const isDueSoon = diffMinutes > 0 && diffMinutes <= LEAD_TIME_MINUTES + 1;
    const isOverdue = diffMinutes < 0;

    if (isOverdue) {
        li.addClass('overdue');
        // Se a tarefa está atrasada, reseta o flag de notificação, pois ela não é mais 'due-soon' e pode ser adiada
        if (task.deadlineNotified === true) {
             updateTaskInFirestore(task.id, { deadlineNotified: false });
        }
    } 
    
    if (isDueSoon) {
        li.addClass('due-soon');
        
        // **LÓGICA DE NOTIFICAÇÃO: DISPARA APENAS SE NUNCA FOI NOTIFICADA**
        // A notificação de prazo só será criada se for a primeira vez que a tarefa entra no estado 'due-soon'
        if (CURRENT_USER_UID && !task.deadlineNotified) {
            
            // ======= INÍCIO DA CORREÇÃO =======
            // 1. ATUALIZA O ESTADO LOCAL IMEDIATAMENTE PARA EVITAR DUPLICAÇÃO
            task.deadlineNotified = true; 
            // ======= FIM DA CORREÇÃO =======

            const formattedDue = new Date(dueDateTimeString).toLocaleTimeString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

            // 2. Cria a notificação no Firestore
            createTaskDeadlineNotification(task.id, task.text, formattedDue);
            
            // 3. Atualiza o Firestore em segundo plano
            updateTaskInFirestore(task.id, { deadlineNotified: true });
        }
    } 
    
    // Reseta o flag se a tarefa saiu do estado de urgência (usuário adiou para um prazo longe)
    if (!isDueSoon && !isOverdue && task.deadlineNotified === true) {
         updateTaskInFirestore(task.id, { deadlineNotified: false });
    }
}
// ----------------------------------------

function checkAllDueDates() {
    $('#task-list>li').each(function () {
        updateTaskDueVisual($(this), tasks.find(t => t.id === $(this).attr('data-id')));
    });
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

/* ---------- FULLCALENDAR (REVISADO) ---------- */
function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (calendarEl && typeof FullCalendar !== 'undefined' && FullCalendar.Calendar && !calendarInitialized) {
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'timeGridWeek',
            locale: 'pt-br',
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' },
            events: [],
            eventClick: function (info) {
                const { taskId, subtaskId } = info.event.extendedProps;

                hideModal('.modal.show');

                if (subtaskId) {
                    openSubtaskModalForEdit(taskId, subtaskId);
                } else {
                    const li = $(`#task-list > li[data-id="${taskId}"]`);
                    if (li.length) {
                        li.find('.edit-btn').first().click();
                    }
                }
            }
        });
        calendar.render();
        calendarInitialized = true;
    }
}

function syncAllToCalendar() {
    if (!calendarInitialized) return;

    calendar.getEvents().forEach(event => event.remove());

    const addEventToCalendar = (item, parentTaskId = null) => {
        if (item.dueDate) {
            calendar.addEvent({
                id: parentTaskId ? `${parentTaskId}_${item.id}` : item.id,
                title: item.text,
                start: item.dueDate + (item.dueTime ? `T${item.dueTime}` : ''),
                allDay: !item.dueTime,
                color: item.completed ? '#6c757d' : (item.priority === 'high' ? '#dc3545' : item.priority === 'medium' ? '#ffc107' : '#28a745'),
                extendedProps: {
                    taskId: parentTaskId || item.id,
                    subtaskId: parentTaskId ? item.id : null
                }
            });
        }
    };

    tasks.forEach(task => {
        addEventToCalendar(task);
        if (task.subtasks && task.subtasks.length > 0) {
            const traverseSubtasks = (subtasks, parentId) => {
                subtasks.forEach(sub => {
                    addEventToCalendar(sub, parentId);
                    if (sub.subtasks && sub.subtasks.length > 0) {
                        traverseSubtasks(sub.subtasks, parentId);
                    }
                });
            };
            traverseSubtasks(task.subtasks, task.id);
        }
    });
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
// 8. EVENT HANDLERS
// ===============================================

function setupCommonEventListeners() {
    // Verifica a data de vencimento a cada 60 segundos
    setInterval(checkAllDueDates, 60 * 1000);

    const mobileMenuToggle = document.getElementById("mobile-menu-toggle");
    const mainNavList = document.getElementById("main-nav-list");

    if (mobileMenuToggle && mainNavList) {
        mobileMenuToggle.addEventListener("click", () => {
            mainNavList.classList.toggle("active");
        });
    }

    $('#toggle-form-btn').off('click').on('click', function() {
        showModal('#addTaskModal');
        setTimeout(() => { $('#task-text').focus(); }, 150);
    });

    $('#toggle-filter-btn').off('click').on('click', function() {
        showModal('#filterModal');
        setTimeout(() => { $('#search-input').focus(); }, 150);
    });

    $('#toggle-trash-btn').on('click', function() {
        showModal('#trashModal');
    });

    $('#add-task-cancel-btn').on('click', function() {
        hideModal('#addTaskModal');
    });

    $('#filter-apply-btn').on('click', function() {
        applyFilter();
        hideModal('#filterModal');
    });

    $('#filter-cancel-btn').on('click', function() {
        hideModal('#filterModal');
    });

    $('.modal .close, .modal .close-top-right').on('click', function() {
        hideModal($(this).closest('.modal'));
    });
    $('#edit-cancel-btn').on('click', () => hideModal('#editTaskModal'));
    $('#subtask-cancel-btn').on('click', () => hideModal('#subtask-modal'));
    $('#view-close-btn').on('click', () => hideModal('#viewTaskModal'));
    $(document).on('keydown', function (e) {
        if (e.key === 'Escape' || e.keyCode === 27) $('.modal.show').each(function () { hideModal($(this)); });
    });

    $('#task-form').off('submit').on('submit', function (e) {
        e.preventDefault();
        let text = $('#task-text').val().trim();
        let priority = $('#task-priority').val();
        let dueDate = $('#task-date').val();
        let dueTime = $('#task-time').val();
        let category = $('#task-category').val() || 'geral';
        let privacy = $('#task-privacy').val() || 'private';
        if (!text) return;

        let task = { text, completed: false, priority, dueDate, dueTime, category, privacy, subtasks: [] };
        
        if (CURRENT_USER_UID) {
            addTaskToFirestore(task);
        } else {
            task.id = generateId(); // Adiciona um ID local
            tasks.push(task);
            saveLocalTasks(tasks);
        }

        $('#task-text').val('');
        $('#task-priority').val('medium');
        $('#task-date').val('');
        $('#task-time').val('');
        $('#task-category').val('geral');
        $('#task-privacy').val('private');

        hideModal('#addTaskModal');
    });

    $(document).off('change', '.task-checkbox').on('change', '.task-checkbox', async function () {
        let li = $(this).closest('li');
        let taskId = li.attr('data-id');
        let isCompleted = $(this).prop('checked');

        let task = tasks.find(t => t.id === taskId);
        if (!task) return;

        const recursiveCheck = (subtasks) => {
            return subtasks.map(st => ({
                ...st,
                completed: isCompleted,
                subtasks: st.subtasks ? recursiveCheck(st.subtasks) : []
            }));
        };

        const subtasks = recursiveCheck(task.subtasks);
        
        if (CURRENT_USER_UID) {
            await updateTaskInFirestore(taskId, {
                completed: isCompleted,
                subtasks: subtasks
            });
        } else {
            task.completed = isCompleted;
            task.subtasks = subtasks;
            saveLocalTasks(tasks);
        }
    });

    $(document).off('change', '.subtask-checkbox').on('change', '.subtask-checkbox', async function () {
        let li = $(this).closest('li');
        let subId = li.attr('data-id');
        let taskId = $(this).closest('li[data-id][data-category]').attr('data-id');

        let task = tasks.find(t => t.id === taskId);
        if (!task) return;

        const isCompleted = $(this).prop('checked');

        const updateTargetAndChildren = (subtasks) => {
            return subtasks.map(st => {
                if (st.id === subId) {
                    st.completed = isCompleted;
                    if (st.subtasks) st.subtasks = st.subtasks.map(child => ({...child, completed: isCompleted}));
                } else if (st.subtasks && st.subtasks.length > 0) {
                    st.subtasks = updateTargetAndChildren(st.subtasks);
                }
                return st;
            });
        };

        let updatedSubtasks = updateTargetAndChildren(task.subtasks);
        const isMainTaskCompleted = checkCompletionStatusRecursively(updatedSubtasks);

        if (CURRENT_USER_UID) {
            await updateTaskInFirestore(taskId, {
                subtasks: updatedSubtasks,
                completed: isMainTaskCompleted
            });
        } else {
            task.subtasks = updatedSubtasks;
            task.completed = isMainTaskCompleted;
            saveLocalTasks(tasks);
        }
    });

    $(document).off('click', '.remove-btn').on('click', '.remove-btn', function () {
        let li = $(this).closest('li');
        let taskId = li.attr('data-id');
        let task = tasks.find(t => t.id === taskId);
        if (!task) return;

        $('#confirm-title').text('Mover para a Lixeira');
        $('#confirm-text').text(`Deseja realmente mover a tarefa "${task.text}" para a lixeira?`);
        showModal('#confirmModal');

        $('#confirm-ok-btn').off('click').on('click', function() {
            if (CURRENT_USER_UID) {
                moveTaskToTrash(taskId);
            } else {
                tasks = tasks.filter(t => t.id !== taskId);
                saveLocalTasks(tasks);
            }
            hideModal('#confirmModal');
        });

        $('#confirm-cancel-btn').off('click').on('click', function() {
            hideModal('#confirmModal');
        });
    });

    $(document).on('click', '.add-nested-subtask-btn', function() {
        const taskId = $(this).data('task-id');
        const parentId = $(this).data('parent-id');
        openSubtaskModalForCreate(taskId, parentId);
    });

    $(document).on('click', '.add-subtask-btn', function () {
        const taskId = $(this).data('task-id') || $(this).closest('li').data('id');
        if (!taskId) return;
        openSubtaskModalForCreate(taskId, taskId);
    });

    $('#subtask-add-btn').off('click').on('click', async function () {
        const { taskId, subtaskId, isEdit, parentId } = currentSubtaskData;
        const subtaskText = $('#subtask-input').val().trim();

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
        
        if (CURRENT_USER_UID) {
            await saveSubtasksToFirestore(taskId, updatedSubtasks);
        } else {
            task.subtasks = updatedSubtasks;
            saveLocalTasks(tasks);
        }

        hideModal('#subtask-modal');
        currentSubtaskData = { taskId: null, subtaskId: null, isEdit: false, parentId: null };
    });

    $(document).on('click','.edit-btn',function(){
        let li = $(this).closest('li'); currentTaskLi=li;
        let task = tasks.find(t => t.id === li.attr('data-id')); if(!task) return;
        $('#edit-task-name').val(task.text);
        $('#edit-task-priority').val(task.priority);
        $('#edit-task-category').val(task.category);
        $('#edit-task-date').val(task.dueDate);
        $('#edit-task-time').val(task.dueTime);
        $('#edit-task-privacy').val(task.privacy || 'private');
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
            privacy: $('#edit-task-privacy').val(),
        };
        
        if (CURRENT_USER_UID) {
            // Se o usuário está editando a data, garante que o status de notificação seja resetado.
            const originalTask = tasks.find(t => t.id === taskId);
            if (originalTask.dueDate !== updatedData.dueDate || originalTask.dueTime !== updatedData.dueTime) {
                updatedData.deadlineNotified = false;
            }
            
            await updateTaskInFirestore(taskId, updatedData);
        } else {
            const taskIndex = tasks.findIndex(t => t.id === taskId);
            if (taskIndex > -1) {
                tasks[taskIndex] = { ...tasks[taskIndex], ...updatedData };
                saveLocalTasks(tasks);
            }
        }

        hideModal('#editTaskModal');
        currentTaskLi=null;
    });

    $('#search-input').on('input', applyFilter);
    $('#filter-priority').on('change', applyFilter);
    $('#filter-category').on('change', applyFilter);

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
            } catch (error) {
                console.error("🚨 Erro ao salvar a nova ordem:", error);
                $(this).sortable('cancel');
                alert("Erro ao salvar a nova ordem. Verifique sua conexão ou regras de segurança.");
            }
        }
    });

    $(document).on('click', '.toggle-subtasks-btn', function () {
        let li = $(this).closest('li');
        li.find('.subtask-list').slideToggle(200);
        $(this).toggleClass('collapsed');
    });

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
        if(task.subtasks && task.subtasks.length > 0){
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

    let lastScrollTop = 0;
    const nav = document.querySelector("nav");
    window.addEventListener("scroll",()=>{ let currentScroll=window.pageYOffset||document.documentElement.scrollTop; if(currentScroll>lastScrollTop&&currentScroll>100) nav.classList.add("hidden"); else if(currentScroll<lastScrollTop) nav.classList.remove("hidden"); lastScrollTop=currentScroll<=0?0:currentScroll; });

    $('#toggle-calendar-btn').on('click',function(){
        const $container=$('#calendar-container');
        if($container.is(':visible')) $container.slideUp(180);
        else $container.slideDown(180,function(){
            if(!calendarInitialized) initCalendar();
            if(calendar) {
                setTimeout(() => calendar.render(), 10);
            }
        });
    });

    $(document).on('click', '.btn-restore', function() {
        const taskId = $(this).data('id');
        restoreTaskFromTrash(taskId);
    });

    $(document).on('click', '.btn-delete-permanently', function() {
        const taskId = $(this).data('id');
        permanentlyDeleteTask(taskId);
    });
}