// js/app.js - Ponto de Entrada Principal
import { initializeAuth } from './authManager.js';
import { getTasks, updateTaskInFirestore } from './taskStore.js';
import { db } from "./firebase-config.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { getCurrentUserUID, getUserSettings } from './authManager.js';

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

// Esta função é chamada pelo authManager
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
            // ... (restante das configurações do calendário)
            eventClick: function (info) { 
                const { taskId } = info.event.extendedProps; 
                
                if (typeof $ === 'function') {
                    // Oculta modais abertos
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
            syncAllToCalendar(); 
            console.log("Calendário inicializado e renderizado."); 
        } catch (e) { 
            console.error("Erro ao renderizar calendário:", e); 
            calendarInitialized = false; 
        }
    } else if (calendar) { 
        // Se já inicializado, apenas garante que está sincronizado
        console.log("Calendário existente sincronizado."); 
        syncAllToCalendar(); 
    }
}

// Sincroniza o FullCalendar com as tarefas do taskStore
export function syncAllToCalendar() {
    if (!calendarInitialized || !calendar) return; 
    calendar.getEvents().forEach(event => event.remove()); 
    const tasks = getTasks();
    
    // ... (restante da lógica de syncAllToCalendar é mantida)
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
    
    currentView = viewId;
    sessionStorage.setItem('activeView', viewId);

    // 1. Oculta todas as visualizações e remove a classe 'active'
    $('.view-list .view-link').removeClass('active');
    Object.values(taskViewElements).forEach($el => $el.hide());

    // 2. Mostra a visualização solicitada
    const $targetView = taskViewElements[viewId];
    $targetView.show();

    // 3. Atualiza o estado 'active' na barra lateral
    $(`.view-list .view-link[data-view="${viewId}"]`).addClass('active');

    console.log(`Visualização alterada para: ${viewId}`);

    // 4. Ações específicas após a troca
    if (viewId === 'calendar') {
        // CORREÇÃO: Forçamos a renderização do FullCalendar para ajustar o seu tamanho
        // quando o seu container se torna visível.
        initCalendar(); 
        if (calendar) {
             setTimeout(() => { calendar.render(); }, 10);
        }
    } else if (viewId === 'board') {
        // Lógica futura para renderizar o Kanban
        console.warn("Visualização Kanban selecionada. A implementação de renderização está pendente.");
        // Exemplo: renderKanbanBoard(getTasks());
    }
    
    // CORREÇÃO: Força o reajuste de layout após a troca
    if (typeof $(window).resize === 'function') {
        $(window).resize(); 
    }
}

// Inicializa a visualização no carregamento
function initializeViewOnLoad() {
    // Garante que a view salva seja a primeira a ser mostrada após o login
    switchView(currentView);
}


// ===============================================
// OUTRAS FUNÇÕES ÚTEIS (Mantidas)
// ===============================================

/**
 * Cria uma notificação de prazo no Firestore.
 * (A lógica de criação real foi movida para uiRenderer.js)
 */
export async function createTaskDeadlineNotification(taskId, taskText, dueDateTime) {
     console.warn(`[APP.JS] Chamada a createTaskDeadlineNotification para ${taskText}. A lógica principal está em uiRenderer.`);
}


// ===============================================
// INICIALIZAÇÃO
// ===============================================
// Adicionamos a chamada para inicializar a view após a autenticação
initializeAuth(); 

// Exporta a função para que o eventBinder possa usá-la
export { initializeViewOnLoad };