// js/app.js - Ponto de Entrada Principal
import { initializeAuth, getCurrentUserUID, getUserSettings } from './authManager.js';
import { getTasks } from './taskStore.js';
import { db } from "./firebase-config.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// Importa a nova função de renderização do Kanban
import { renderKanbanBoard } from './uiRenderer.js'; 

// *** NOVO: Importa a função de inicialização do Sortable do Kanban ***
import { initKanbanSortable } from './eventBinder.js';

// --- Variáveis de Estado de UI ---
let currentView = sessionStorage.getItem('activeView') || 'list'; // Carrega o último estado
const taskViewElements = {
    list: $('#task-view-list'),
    board: $('#task-view-board'),
    calendar: $('#task-view-calendar')
};

// --- Lógica do Calendário ---
let calendar = null;
let calendarInitialized = false;

// Esta função é chamada pela switchView APENAS quando o utilizador ativa a view
export function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl || typeof FullCalendar === 'undefined' || !FullCalendar.Calendar) {
        console.warn("Elemento do calendário ou biblioteca FullCalendar não encontrado.");
        return;
    }

    if (!calendarInitialized) {
        calendar = new FullCalendar.Calendar(calendarEl, { 
            initialView: 'timeGridWeek', 
            locale: 'pt-br', 
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' }, 
            events: [],
            eventClick: function (info) { 
                const { taskId } = info.event.extendedProps; 
                if (typeof $ === 'function') {
                    $('.modal.show').each(function() { $(this).hide(); });
                }
                if (taskId) { 
                    const li = $(`#task-list > li[data-id="${taskId}"]`); 
                    if (li.length) li.find('.edit-btn').first().trigger('click'); 
                } 
            }
        });
        
        try { 
            calendar.render(); 
            calendarInitialized = true; 
            console.log("Calendário inicializado e renderizado."); 
        } catch (e) { 
            console.error("Erro ao renderizar calendário na primeira inicialização:", e); 
            calendarInitialized = false; 
        }
    }
    // NOTA: Se já inicializado, a sincronização será feita abaixo
    syncAllToCalendar(); 
}

// Sincroniza o FullCalendar com as tarefas do taskStore
export function syncAllToCalendar() {
    if (!calendarInitialized || !calendar) return; 
    calendar.getEvents().forEach(event => event.remove()); 
    const tasks = getTasks();
    
    const addEventToCalendar = (item, parentTaskId = null) => { 
        if (item.dueDate) { 
            let startDateTime = item.dueDate + (item.dueTime ? `T${item.dueTime}` : ''); 
            try { 
                new Date(startDateTime); 
                calendar.addEvent({ 
                    id: parentTaskId ? `${parentTaskId}_${item.id}` : item.id, 
                    title: item.text || 'Tarefa sem nome', 
                    start: startDateTime, 
                    allDay: !item.dueTime, 
                    color: item.completed ? '#6c757d' : (item.priority === 'high' ? '#dc3545' : item.priority === 'medium' ? '#ffc107' : '#28a745'), 
                    extendedProps: { taskId: parentTaskId || item.id, subtaskId: parentTaskId ? item.id : null } 
                }); 
            } catch(e) { console.warn(`Data inválida ignorada para evento do calendário: ${startDateTime}`); } 
        } 
    };
    
    tasks.forEach(task => { 
        addEventToCalendar(task); 
        if (task.subtasks?.length > 0) { 
            const traverseSubtasks = (subtasks, parentId) => { 
                subtasks.forEach(sub => { 
                    addEventToCalendar(sub, parentId); 
                    if (sub.subtasks?.length > 0) { 
                        traverseSubtasks(sub.subtasks, parentId); 
                    } 
                }); 
            }; 
            traverseSubtasks(task.subtasks, task.id); 
        } 
    });
    console.log("Calendário sincronizado com", tasks.length, "tarefas.");
}


// ===============================================
// LÓGICA DE TROCA DE VISUALIZAÇÃO (CORRIGIDO)
// ===============================================

/**
 * Altera a visualização principal (Lista, Quadro ou Calendário).
 * @param {string} viewId - O ID da visualização a ser exibida ('list', 'board', 'calendar').
 */
export function switchView(viewId) {
    if (!taskViewElements[viewId]) {
        console.error(`Visualização desconhecida: ${viewId}`);
        return;
    }
    
    // 1. Oculta todas as visualizações e remove a classe 'active'
    $('.view-list .view-link').removeClass('active');
    Object.values(taskViewElements).forEach($el => $el.hide());

    // 2. Mostra a visualização solicitada
    const $targetView = taskViewElements[viewId];
    $targetView.show();

    // 3. Atualiza o estado
    currentView = viewId;
    sessionStorage.setItem('activeView', viewId);
    $(`.view-list .view-link[data-view="${viewId}"]`).addClass('active');

    console.log(`Visualização alterada para: ${viewId}`);

    // 4. Ações específicas após a troca
    if (viewId === 'calendar') {
        // CORREÇÃO: Adiciona setTimeout para garantir que o DOM recalcule o layout
        setTimeout(() => {
            // Garante que o elemento 'calendar' esteja visível antes de chamar initCalendar
            initCalendar(); 
            if (calendarInitialized && calendar) {
                 // Força o redimensionamento do calendário
                 calendar.updateSize(); 
            }
        }, 0); // Atraso de 0ms garante o recalculamento do layout
    } else if (viewId === 'board') {
        // *** NOVO: Renderiza o Kanban ao selecionar a view 'board' ***
        renderKanbanBoard(getTasks());
        // *** NOVO: Inicializa o Sortable APÓS a renderização do Kanban ***
        // Adicionando um pequeno delay para garantir que o DOM esteja renderizado antes de inicializar o Sortable
        setTimeout(() => {
             initKanbanSortable(); 
             console.log("Visualização Kanban selecionada. Renderizando tarefas e inicializando Sortable.");
        }, 50); 
    }
    
    // Força o reajuste de layout após a troca
    if (typeof $(window).resize === 'function') {
        $(window).resize(); 
    }
}

// Inicializa a visualização no carregamento
export function initializeViewOnLoad() {
    // Garante que a view salva seja a primeira a ser mostrada após o login
    switchView(currentView);
}


// ===============================================
// OUTRAS FUNÇÕES ÚTEIS (Mantidas)
// ===============================================

export async function createTaskDeadlineNotification(taskId, taskText, dueDateTime) {
     console.warn(`[APP.JS] Chamada a createTaskDeadlineNotification para ${taskText}. A lógica principal está em uiRenderer.`);
}


// ===============================================
// INICIALIZAÇÃO
// ===============================================
initializeAuth();