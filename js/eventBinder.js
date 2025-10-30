// js/eventBinder.js
import { showModal, hideModal } from './modalHandler.js';
import { addTask, updateTask, deleteTask, updateSubtasks, getTasks, saveTaskOrder, restoreTaskFromTrash, permanentlyDeleteTask, getTrash } from './taskStore.js';
// *** CORRIGIDO: Importa funções de UI do uiRenderer ***
import { applyFilter, checkAllDueDates } from './uiRenderer.js';
// *** CORRIGIDO: Importa findNestedSubtask de utils ***
import { findNestedSubtask } from './utils.js';
import { generateId } from './utils.js';

// Importa funções que AINDA ESTÃO em app.js
import {
    openSubtaskModalForCreate, openSubtaskModalForEdit, deleteSubtaskViaModal, toggleSubtaskMenu,
    exportTaskToGoogleLink, setCurrentTaskLi, setCurrentSubtaskData, getCurrentSubtaskData,
    initCalendar, currentTaskLi // Importa a variável exportada currentTaskLi
} from './app.js';

// Importa showToastNotification para o botão de teste
import { showToastNotification } from './toast-notification.js';

// Exporta a função principal que será chamada pelo authManager
export function setupCommonEventListeners() {
    console.log("Configurando Event Listeners comuns (eventBinder.js)...");

    // Remove listeners antigos para evitar duplicação (mais seguro)
    $(document).off('click', '#toggle-form-btn');
    $(document).off('click', '#toggle-filter-btn');
    $(document).off('click', '#toggle-trash-btn');
    $(document).off('click', '#toggle-calendar-btn');
    $(document).off('click', '#add-task-cancel-btn');
    $(document).off('click', '#filter-apply-btn');
    $(document).off('click', '#filter-cancel-btn');
    $(document).off('click', '.modal .close, .modal .close-top-right');
    $(document).off('click', '#edit-cancel-btn');
    $(document).off('click', '#subtask-cancel-btn');
    $(document).off('click', '#view-close-btn');
    $(document).off('keydown');
    $('#task-form').off('submit');
    $('#edit-save-btn').off('click');
    $('#subtask-add-btn').off('click');
    $('#search-input').off('input');
    $('#filter-priority').off('change');
    $('#filter-category').off('change');
    $(document).off('change', '.task-checkbox');
    $(document).off('change', '.subtask-checkbox');
    $(document).off('click', '.remove-btn');
    $(document).off('click', '.edit-btn');
    $(document).off('click', '.add-subtask-btn');
    $(document).off('click', '.subtask-options-btn');
    $(document).off('click', '.subtask-label');
    $(document).off('click', '#task-list > li > .task-main > .task-text > label');
    $(document).off('click', '.toggle-subtasks-btn');
    $(document).off('click', '.google-calendar-btn');
    $(document).off('click', '.btn-restore');
    $(document).off('click', '.btn-delete-permanently');
    $('#empty-trash-btn').off('click');
    
    // --- NOVO: Listener para o menu de opções da tarefa ---
    $(document).off('click', '.task-options-btn'); 
    // ------------------------------------------------------
    
    // Limpa o botão de teste
    const testButton = document.getElementById('test-toast-btn');
    if (testButton) {
        const newTestButton = testButton.cloneNode(true); // Cria um clone sem listeners
        if(testButton.parentNode) testButton.parentNode.replaceChild(newTestButton, testButton);
    }
    // Limpa o intervalo antigo, se existir
    if (window.checkDatesIntervalId) { clearInterval(window.checkDatesIntervalId); }

    // --- Adiciona Novos Listeners ---

    // Verifica prazos periodicamente
    window.checkDatesIntervalId = setInterval(checkAllDueDates, 60 * 1000);

    // Abertura de Modais
    $(document).on('click', '#toggle-form-btn', () => { showModal('#addTaskModal'); setTimeout(() => $('#task-text').focus(), 150); });
    $(document).on('click', '#toggle-filter-btn', () => { showModal('#filterModal'); setTimeout(() => $('#search-input').focus(), 150); });
    $(document).on('click', '#toggle-trash-btn', () => showModal('#trashModal'));
    $(document).on('click', '#toggle-calendar-btn', () => {
        const $container = $('#calendar-container');
        if ($container.is(':visible')) {
             $container.slideUp(180);
             $('#toggle-calendar-btn').html('📅 Mostrar calendário'); // Atualiza texto
        } else {
             $container.slideDown(180, () => { initCalendar(); }); // initCalendar só ao mostrar
             $('#toggle-calendar-btn').html('📅 Ocultar calendário'); // Atualiza texto
        }
    });

    // Fechamento de Modais
    $(document).on('click', '#add-task-cancel-btn', () => hideModal('#addTaskModal'));
    $(document).on('click', '#filter-apply-btn', () => { applyFilter(); hideModal('#filterModal'); });
    $(document).on('click', '#filter-cancel-btn', () => hideModal('#filterModal'));
    $(document).on('click', '.modal .close, .modal .close-top-right', function() { hideModal($(this).closest('.modal')); });
    $(document).on('click', '#edit-cancel-btn', () => hideModal('#editTaskModal'));
    $(document).on('click', '#subtask-cancel-btn', () => hideModal('#subtask-modal'));
    $(document).on('click', '#view-close-btn', () => hideModal('#viewTaskModal'));
    $(document).on('keydown', (e) => { if (e.key === 'Escape') $('.modal.show').each(function () { hideModal($(this)); }); });

    // Formulário Principal (Adicionar Tarefa)
    $('#task-form').on('submit', async function (e) {
        e.preventDefault(); let text = $('#task-text').val()?.trim(); if (!text) return;
        let task = { text, completed: false, priority: $('#task-priority').val() || 'medium', dueDate: $('#task-date').val() || null, dueTime: $('#task-time').val() || null, category: $('#task-category').val() || 'geral', privacy: $('#task-privacy').val() || 'private', subtasks: [] };
        if (!task.dueDate) delete task.dueDate; if (!task.dueTime) delete task.dueTime;
        await addTask(task); $(this).trigger('reset'); $('#task-priority').val(''); $('#task-category').val(''); $('#task-privacy').val('private'); $('#task-date').val(''); $('#task-time').val(''); hideModal('#addTaskModal');
    });

    // --- Listeners Delegados ---

    // Checkboxes de Tarefa Principal
    $(document).on('change', '.task-checkbox', async function () {
        let li = $(this).closest('li'); let taskId = li.attr('data-id'); let isCompleted = $(this).prop('checked');
        const task = getTasks().find(t => t.id === taskId); if (!task) return;
        const recursiveCheck = (subtasks, completedStatus) => (!subtasks ? [] : subtasks.map(st => ({ ...st, completed: completedStatus, subtasks: recursiveCheck(st.subtasks, completedStatus) })));
        const updatedSubtasks = recursiveCheck(task.subtasks, isCompleted);
        await updateTask(taskId, { completed: isCompleted, subtasks: updatedSubtasks });
    });

    // Checkboxes de Subtarefa
    $(document).on('change', '.subtask-checkbox', async function () {
        let subLi = $(this).closest('li'); let subId = subLi.attr('data-id'); let taskLi = subLi.closest('li[data-id][data-category]'); let taskId = taskLi.attr('data-id');
        const task = getTasks().find(t => t.id === taskId); if (!task || !task.subtasks) return;
        const isCompleted = $(this).prop('checked');
        const updateTargetAndChildren = (subtasks) => { if (!subtasks) return []; return subtasks.map(st => { if (st.id === subId) { st.completed = isCompleted; const updateChildren = (children) => (!children ? [] : children.map(child => ({ ...child, completed: isCompleted, subtasks: updateChildren(child.subtasks) }))); st.subtasks = updateChildren(st.subtasks); } else if (st.subtasks?.length > 0) { st.subtasks = updateTargetAndChildren(st.subtasks); } return st; }); };
        let updatedSubtasks = updateTargetAndChildren([...task.subtasks]);
        await updateSubtasks(taskId, updatedSubtasks);
    });

    // Botão Remover Tarefa (AGORA DENTRO DO MENU)
    $(document).on('click', '.remove-btn', function () {
        let li = $(this).closest('li'); let taskId = li.attr('data-id');
        const task = getTasks().find(t => t.id === taskId); if (!task) return;
        $('#confirm-title').text('Mover para a Lixeira'); $('#confirm-text').text(`Deseja realmente mover a tarefa "${task.text}" para a lixeira?`); showModal('#confirmModal');
        $('#confirm-ok-btn').off('click').on('click', async () => { await deleteTask(taskId); hideModal('#confirmModal'); });
        $('#confirm-cancel-btn').off('click').on('click', () => hideModal('#confirmModal'));
    });

    // Botão Editar Tarefa (AGORA DENTRO DO MENU)
    $(document).on('click', '.edit-btn', function() {
        let li = $(this).closest('li'); setCurrentTaskLi(li); // Salva a referência do LI
        const task = getTasks().find(t => t.id === li.attr('data-id')); if (!task) return;
        $('#edit-task-name').val(task.text); $('#edit-task-priority').val(task.priority || 'medium'); $('#edit-task-category').val(task.category || 'geral');
        $('#edit-task-date').val(task.dueDate || ''); $('#edit-task-time').val(task.dueTime || ''); $('#edit-task-privacy').val(task.privacy || 'private');
        showModal('#editTaskModal');
    });

     // Botão Salvar Edição
     $('#edit-save-btn').on('click', async function() {
        const currentLiRef = currentTaskLi; // Usa a variável importada/salva de app.js
        if (!currentLiRef) return; let taskId = currentLiRef.attr('data-id');
        const updatedData = { text: $('#edit-task-name').val()?.trim() || 'Tarefa', priority: $('#edit-task-priority').val(), category: $('#edit-task-category').val(), dueDate: $('#edit-task-date').val() || null, dueTime: $('#edit-task-time').val() || null, privacy: $('#edit-task-privacy').val(), };
        if (!updatedData.dueDate) delete updatedData.dueDate; if (!updatedData.dueTime) delete updatedData.dueTime;
        await updateTask(taskId, updatedData); hideModal('#editTaskModal'); setCurrentTaskLi(null); // Limpa a referência
    });

    // Botão Adicionar Subtarefa (AGORA DENTRO DO MENU)
    $(document).on('click', '.add-subtask-btn', function () {
        const taskId = $(this).data('task-id') || $(this).closest('li[data-id]').data('id'); if (!taskId) return;
        openSubtaskModalForCreate(taskId, taskId); // Abre modal para adicionar à tarefa principal
    });

    // Botão Salvar/Adicionar Subtarefa
    $('#subtask-add-btn').on('click', async function () {
         const { taskId, subtaskId, isEdit, parentId } = getCurrentSubtaskData(); const subtaskText = $('#subtask-input').val()?.trim(); if (!subtaskText || !taskId) return;
         const task = getTasks().find(t => t.id === taskId); if (!task) return;
         const newSubtaskData = { text: subtaskText, priority: $('#subtask-priority').val() || 'medium', category: $('#subtask-category').val() || 'geral', dueDate: $('#subtask-date').val() || null, dueTime: $('#subtask-time').val() || null, };
         if (!newSubtaskData.dueDate) delete newSubtaskData.dueDate; if (!newSubtaskData.dueTime) delete newSubtaskData.dueTime;
         let updatedSubtasks; let originalSubtasks = task.subtasks ? [...task.subtasks] : [];
         // Funções auxiliares para encontrar e modificar/adicionar
         const findAndUpdate = (subs, id, data) => { if (!subs) return []; return subs.map(sub => { if (sub.id === id) return { ...sub, ...data }; if (sub.subtasks?.length > 0) sub.subtasks = findAndUpdate(sub.subtasks, id, data); return sub; }); };
         const findAndAdd = (subs, pId, newSub) => { if (!subs) return pId === taskId ? [newSub] : []; if (pId === taskId) return [...subs, newSub]; return subs.map(sub => { if (sub.id === pId) sub.subtasks = sub.subtasks ? [...sub.subtasks, newSub] : [newSub]; else if (sub.subtasks?.length > 0) sub.subtasks = findAndAdd(sub.subtasks, pId, newSub); return sub; }); };

         if (isEdit) { updatedSubtasks = findAndUpdate(originalSubtasks, subtaskId, newSubtaskData); } else { const newSubtask = { id: generateId(), completed: false, subtasks: [], ...newSubtaskData }; updatedSubtasks = findAndAdd(originalSubtasks, parentId, newSubtask); }
         await updateSubtasks(taskId, updatedSubtasks); hideModal('#subtask-modal');
         // Reset modal state after adding/editing
         setCurrentSubtaskData({ taskId: null, subtaskId: null, isEdit: false, parentId: null, priority: 'medium', category: 'geral', dueDate: '', dueTime: '' });
         $('#subtask-modal-title').text('Adicionar Subtarefa');$('#subtask-input').val('');$('#subtask-priority').val('medium');$('#subtask-category').val('geral');$('#subtask-date').val('');$('#subtask-time').val('');$('#subtask-add-btn').text('Adicionar');
    });

     // Botão de Opções da Subtarefa (Já existia)
    $(document).on('click', '.subtask-options-btn', function(e) {
        e.stopPropagation(); const taskId = $(this).data('task-id'); const subtaskId = $(this).data('subtask-id'); const parentId = $(this).data('parent-id');
        toggleSubtaskMenu($(this), taskId, subtaskId, parentId); // Chama a função que está em app.js
    });
    
    // --- **MUDANÇA**: Listener para o botão de Opções da TAREFA PRINCIPAL ---
    $(document).on('click', '.task-options-btn', function(e) {
        e.stopPropagation(); // Impede que o clique feche o menu imediatamente
        
        const $menu = $(this).siblings('.task-actions-menu');
        const $li = $(this).closest('li[data-id]');
        
        // Fecha todos os *outros* menus (de tarefa e subtarefa)
        $('.task-actions-menu.active').not($menu).removeClass('active');
        $('.subtask-options-menu.active').removeClass('active');
        
        // **MUDANÇA (Z-index): Remove a classe de todos os LIs**
        $('#task-list > li').removeClass('menu-active');
        
        // Alterna o menu atual
        $menu.toggleClass('active');
        
        // **MUDANÇA (Z-index): Adiciona a classe apenas no LI atual se o menu estiver ativo**
        if ($menu.hasClass('active')) {
            $li.addClass('menu-active');
        } else {
            $li.removeClass('menu-active');
        }
    });
    // -----------------------------------------------------------------


    // Label da Subtarefa (para edição rápida - DESATIVADO por abrir modal)
     /*
     $(document).on('click', '.subtask-label', function(e) {
         e.stopPropagation();
         const taskId = $(this).data('task-id');
         const subtaskId = $(this).data('subtask-id');
         openSubtaskModalForEdit(taskId, subtaskId); // Abre o modal para edição
     });
     */

    // --- Filtros ---
    $('#search-input').on('input', applyFilter);
    $('#filter-priority').on('change', applyFilter);
    $('#filter-category').on('change', applyFilter);

    // --- Sortable ---
    $('#task-list').sortable({
        handle: '.task-main', // Permite arrastar apenas pelo cabeçalho da tarefa principal
        update: async function (event, ui) { if (ui.sender) return; const orderedIds = $(this).children('li').map(function() { return $(this).attr('data-id'); }).get(); await saveTaskOrder(orderedIds); },
        placeholder: "ui-state-highlight", forcePlaceholderSize: true, axis: "y", cursor: "grabbing", opacity: 0.8, items: "> li[data-id]" // Garante que só arraste itens com data-id
    }).disableSelection();

    // --- **MUDANÇA**: Botão Expandir/Colapsar Subtarefas ---
    $(document).on('click', '.toggle-subtasks-btn', function () {
        $(this).toggleClass('collapsed');
        const isCollapsed = $(this).hasClass('collapsed');
        
        if (isCollapsed) {
            $(this).attr('title', 'Mostrar Subtarefas');
            $(this).html('►');
        } else {
            $(this).attr('title', 'Ocultar Subtarefas');
            $(this).html('▼');
        }
        
        $(this).closest('li').children('.subtask-list').slideToggle(200);
    });

    // --- Abrir Modal de Visualização (Label Principal) ---
    $(document).on('click', '#task-list > li > .task-main > .task-text > label', function() {
        let li = $(this).closest('li'); const taskId = li.attr('data-id'); const task = getTasks().find(t => t.id === taskId); if (!task) return;
        // Função recursiva para renderizar subtarefas aninhadas no modal de visualização
        const renderNestedSubtasksForView = (subtasks, $list) => { if (!subtasks || subtasks.length === 0) return; subtasks.forEach(st => { const $li = $('<li></li>').text(st.text + (st.completed ? ' ✅' : '')).appendTo($list); if (st.subtasks?.length > 0) { const $ul = $('<ul class="subtasks-list" style="margin-left: 20px; border-left: 2px solid #ddd; padding-left: 10px;"></ul>').appendTo($li); renderNestedSubtasksForView(st.subtasks, $ul); } }); };
        $('#view-task-name').text(task.text); $('#view-task-priority').text((task.priority || 'medium').charAt(0).toUpperCase()+(task.priority || 'medium').slice(1)); $('#view-task-category').text((task.category || 'geral').charAt(0).toUpperCase()+(task.category || 'geral').slice(1));
        let dateText = task.dueDate ? new Date(task.dueDate + 'T00:00:00Z').toLocaleDateString(undefined, { timeZone: 'UTC'}) : 'Sem data'; let timeText = task.dueTime ? ` às ${task.dueTime}` : ''; $('#view-task-date').text(dateText + timeText);
        let $subtasks = $('#view-task-subtasks').empty(); if (task.subtasks?.length > 0) renderNestedSubtasksForView(task.subtasks, $subtasks); else $subtasks.append('<li>Nenhuma subtarefa</li>');
        showModal('#viewTaskModal');
        // Reatribui os listeners dos botões do modal de visualização
        $('#view-edit-btn').off('click').on('click', () => { hideModal('#viewTaskModal'); li.find('.edit-btn').first().trigger('click'); });
        $('#view-delete-btn').off('click').on('click', () => { hideModal('#viewTaskModal'); li.find('.remove-btn').first().trigger('click'); });
    });

    // --- Botão Google Calendar (AGORA DENTRO DO MENU) ---
    $(document).on('click', '.google-calendar-btn', function () {
        const taskId = $(this).closest('li[data-id]').data('id'); const task = getTasks().find(t => t.id === taskId);
        if (task) exportTaskToGoogleLink(task); // Chama a função que está em app.js
    });

    // --- Lixeira ---
     $(document).on('click', '.btn-restore', function() { restoreTaskFromTrash($(this).data('id')); });
     $(document).on('click', '.btn-delete-permanently', function() {
         const taskId = $(this).data('id'); const trash = getTrash(); const task = trash.find(t => t.id === taskId);
        $('#confirm-title').text('Excluir Permanentemente'); $('#confirm-text').html(`Tem certeza que deseja excluir a tarefa "<strong>${task?.text || 'Tarefa'}</strong>" permanentemente? <br><strong style='color:red;'>Esta ação NÃO pode ser desfeita.</strong>`); showModal('#confirmModal');
        $('#confirm-ok-btn').off('click').on('click', async () => { await permanentlyDeleteTask(taskId); hideModal('#confirmModal'); });
        $('#confirm-cancel-btn').off('click').on('click', () => hideModal('#confirmModal'));
    });
     $('#empty-trash-btn').on('click', function() {
        const trash = getTrash(); if (trash.length === 0) { alert("A lixeira já está vazia."); return; }
        $('#confirm-title').text('Esvaziar Lixeira'); $('#confirm-text').html(`Tem certeza que deseja excluir permanentemente TODOS os ${trash.length} itens da lixeira? <br><strong style='color:red;'>Esta ação NÃO pode ser desfeita.</strong>`); showModal('#confirmModal');
        $('#confirm-ok-btn').off('click').on('click', async () => {
             $('#confirm-ok-btn').prop('disabled', true).text('Esvaziando...'); const deletePromises = trash.map(item => permanentlyDeleteTask(item.id)); try { await Promise.all(deletePromises); } catch (error) { console.error("Erro ao esvaziar a lixeira:", error); alert("Ocorreu um erro ao esvaziar a lixeira."); } finally { hideModal('#confirmModal'); $('#confirm-ok-btn').prop('disabled', false).text('Confirmar'); } });
        $('#confirm-cancel-btn').off('click').on('click', () => hideModal('#confirmModal'));
     });

    // --- Scroll da Navbar ---
    let lastScrollTop = 0; const nav = document.querySelector("nav"); if(nav) { window.addEventListener("scroll", () => { let currentScroll = window.pageYOffset || document.documentElement.scrollTop; if (currentScroll > lastScrollTop && currentScroll > 100) nav.classList.add("hidden"); else if (currentScroll < lastScrollTop) nav.classList.remove("hidden"); lastScrollTop = currentScroll <= 0 ? 0 : currentScroll; }); }

     // --- Botão de Teste Toast ---
     const finalTestButton = document.getElementById('test-toast-btn');
     if (finalTestButton) {
         finalTestButton.addEventListener('click', () => {
             console.log("Botão de teste do toast clicado!");
             showToastNotification('Notificação de Teste', 'Esta é uma mensagem de teste manual.', 'default', 5000);
         });
     } else { console.warn("Botão de teste do toast (#test-toast-btn) não encontrado para adicionar listener."); }

     // --- **MUDANÇA**: Fechar menus ao clicar fora ---
    $(document).on('click', function(e) {
        // Se o clique NÃO for dentro de um botão de menu E NÃO for dentro de um menu...
        if (!$(e.target).closest('.subtask-options-btn').length && 
            !$(e.target).closest('.subtask-options-menu').length &&
            !$(e.target).closest('.task-options-btn').length &&
            !$(e.target).closest('.task-actions-menu').length) 
        {
            // Fecha todos os menus
            $('.subtask-options-menu.active').removeClass('active');
            $('.task-actions-menu.active').removeClass('active');
            // Remove a classe de z-index de todos os LIs
            $('#task-list > li.menu-active').removeClass('menu-active');
        }
    });

     console.log("Event Listeners comuns configurados.");
}