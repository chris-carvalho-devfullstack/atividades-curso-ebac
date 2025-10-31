// js/overview.js

import { getTasks } from './taskStore.js';
import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { getCurrentUserUID } from './authManager.js';
import { showModal, hideModal } from './modalHandler.js'; // Importa funções de modal

let miniCalendar = null;
let miniCalendarInitialized = false;

// Função auxiliar para converter data YYYY-MM-DD em DD/MM/YYYY
const formatDateToBr = (dateString) => {
    try {
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    } catch (e) {
        return dateString;
    }
};

/**
 * Abre o modal de visualização de tarefa detalhada (reutilizando #viewTaskModal).
 * @param {string} taskId - O ID da tarefa a ser exibida.
 */
function openViewModalForTask(taskId) {
    const tasks = getTasks();
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
        console.error("Tarefa não encontrada para o ID:", taskId);
        return;
    }

    // 1. Preenche os campos principais do modal
    $('#view-task-name').text(task.text);
    $('#view-task-priority').text((task.priority || 'medium').charAt(0).toUpperCase() + (task.priority || 'medium').slice(1));
    $('#view-task-category').text((task.category || 'geral').charAt(0).toUpperCase() + (task.category || 'geral').slice(1));
    let dateText = task.dueDate ? new Date(task.dueDate + 'T00:00:00Z').toLocaleDateString(undefined, { timeZone: 'UTC' }) : 'Sem data';
    let timeText = task.dueTime ? ` às ${task.dueTime}` : '';
    $('#view-task-date').text(dateText + timeText);

    // 2. Preenche Subtarefas
    let $subtasks = $('#view-task-subtasks').empty();
    const renderNestedSubtasksForView = (subtasks, $list) => {
        if (!subtasks || subtasks.length === 0) return;
        subtasks.forEach(st => {
            const $li = $('<li></li>').text(st.text + (st.completed ? ' ✅' : '')).appendTo($list);
            if (st.subtasks?.length > 0) {
                const $ul = $('<ul class="subtasks-list" style="margin-left: 20px; border-left: 2px solid #ddd; padding-left: 10px;"></ul>').appendTo($li);
                renderNestedSubtasksForView(st.subtasks, $ul);
            }
        });
    };
    if (task.subtasks?.length > 0) {
        renderNestedSubtasksForView(task.subtasks, $subtasks);
    } else {
        $subtasks.append('<li>Nenhuma subtarefa</li>');
    }

    // 3. Reatacha listeners dos botões Editar/Apagar para #viewTaskModal
    // Estes botões devem disparar o evento de clique nos botões da lista padrão (eventBinder.js)
    
    // Cria uma referência temporária no DOM para simular o item da lista
    const tempLi = $(`#task-list > li[data-id="${taskId}"]`);

    $('#view-edit-btn').off('click').on('click', () => { 
        hideModal('#viewTaskModal'); 
        tempLi.find('.edit-btn').first().trigger('click'); 
    });
    
    $('#view-delete-btn').off('click').on('click', () => { 
        hideModal('#viewTaskModal'); 
        tempLi.find('.remove-btn').first().trigger('click'); 
    });
    
    $('#view-close-btn').off('click').on('click', () => hideModal('#viewTaskModal'));


    // 4. Exibe o modal
    showModal('#viewTaskModal');
}


/**
 * Exibe as tarefas de um dia específico em um modal (Mini-Calendário).
 * @param {string} dateString - A data clicada (YYYY-MM-DD).
 * @param {Array} allTasks - Lista de todas as tarefas.
 */
function displayDayTasksInModal(dateString, allTasks) {
    const modalTitle = document.getElementById('day-tasks-modal-title');
    const tasksList = document.getElementById('day-tasks-list');
    
    // ... (restante da lógica do modal do calendário - mantida) ...
    const tasksForDay = allTasks
        .filter(t => t.dueDate === dateString)
        .sort((a, b) => (a.dueTime || '23:59') > (b.dueTime || '23:59') ? 1 : -1);

    modalTitle.textContent = `Tarefas em ${formatDateToBr(dateString)}`;
    tasksList.innerHTML = '';

    if (tasksForDay.length === 0) {
        tasksList.innerHTML = '<li style="padding: 10px; color: #888;">Nenhuma tarefa agendada para este dia.</li>';
    } else {
        tasksForDay.forEach(task => {
            const time = task.dueTime ? `(${task.dueTime.substring(0, 5)})` : '';
            const status = task.completed ? '✅ Concluída' : '⏳ Pendente';
            const priority = task.priority === 'high' ? '🔴 Alta' : task.priority === 'medium' ? '🟡 Média' : '🟢 Baixa';
            
            const listItem = document.createElement('li');
            listItem.style.borderLeft = `4px solid ${task.completed ? '#6c757d' : task.priority === 'high' ? '#dc3545' : task.priority === 'medium' ? '#ff9800' : '#4CAF50'}`;
            listItem.style.padding = '8px 10px';
            listItem.style.marginBottom = '5px';
            listItem.style.borderRadius = '4px';
            listItem.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
            listItem.style.cursor = 'pointer'; // Adiciona cursor para indicar clique
            listItem.innerHTML = `
                <strong>${task.text}</strong> ${time}<br>
                <span style="font-size: 0.9em; color: #555;">
                    ${status} - ${priority}
                </span>
            `;
            // ADICIONA LISTENER PARA O MODAL DE VISUALIZAÇÃO
            listItem.onclick = () => openViewModalForTask(task.id); 
            
            tasksList.appendChild(listItem);
        });
    }
    
    document.querySelectorAll('#overviewDayTasksModal .close-modal-btn, #overviewDayTasksModal .close').forEach(btn => {
        btn.onclick = () => hideModal('#overviewDayTasksModal');
    });

    showModal('#overviewDayTasksModal');
}


/**
 * Inicializa o mini-calendário e o sincroniza com as tarefas.
 * @param {Array} tasks - Lista de todas as tarefas.
 */
function initMiniCalendar(tasks) {
    const calendarEl = document.getElementById('mini-calendar');
    if (!calendarEl || typeof FullCalendar === 'undefined' || !FullCalendar.Calendar) {
        console.warn("Elemento do mini-calendário ou biblioteca FullCalendar não encontrado.");
        return;
    }

    // 1. Prepara os eventos para o calendário
    const events = [];
    tasks.forEach(task => { 
        if (task.dueDate && !task.completed) { 
             let start = task.dueDate;
             if (start.includes('T')) {
                 start = start.split('T')[0];
             }

             events.push({ 
                 id: task.id, 
                 title: task.text || 'Tarefa', 
                 start: start, 
                 allDay: true,
                 color: task.priority === 'high' ? '#dc3545' : task.priority === 'medium' ? '#ff9800' : '#4CAF50', 
             }); 
        } 
    });

    if (!miniCalendarInitialized) {
        miniCalendar = new FullCalendar.Calendar(calendarEl, { 
            initialView: 'dayGridMonth', 
            locale: 'pt-br', 
            height: '350px',
            headerToolbar: { 
                left: 'title', 
                center: '', 
                right: 'prev,next'
            }, 
            events: events,
            
            eventDisplay: 'background', 
            eventContent: function(arg) { return { html: '' }; },
            eventDidMount: function(info) {
                info.el.style.backgroundColor = 'transparent';
                info.el.style.border = 'none';

                const dateEl = info.el.closest('.fc-daygrid-day-frame');
                if (dateEl && !dateEl.querySelector('.mini-calendar-marker')) { 
                    const marker = document.createElement('div');
                    marker.className = 'mini-calendar-marker';
                    marker.style.backgroundColor = info.event.backgroundColor || '#4CAF50'; 
                    dateEl.appendChild(marker);
                }
            },
            
            // HANDLER DE CLIQUE NA DATA - CHAMA O MODAL DO DIA
            dateClick: function(info) {
                 displayDayTasksInModal(info.dateStr, tasks); 
            }
        });
        
        try { 
            miniCalendar.render(); 
            miniCalendarInitialized = true; 
            console.log("Mini Calendário inicializado e renderizado."); 
        } catch (e) { 
            console.error("Erro ao renderizar mini-calendário:", e); 
            miniCalendarInitialized = false; 
        }
    } else {
        miniCalendar.setOption('events', events);
        miniCalendar.refetchEvents(); 
        
        miniCalendar.setOption('dateClick', (info) => displayDayTasksInModal(info.dateStr, tasks));
    }
}

/**
 * Renderiza o conteúdo da página de Visão Geral.
 */
export function renderOverview() {
    console.log("Renderizando Visão Geral...");
    
    const tasks = getTasks();
    const today = new Date();
    
    // --- 1. Renderiza Agenda de Hoje ---
    const agendaDateEl = document.getElementById('agenda-date');
    const agendaListEl = document.getElementById('agenda-list');
    
    if (!agendaDateEl || !agendaListEl) {
        return;
    }

    agendaDateEl.textContent = today.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    agendaListEl.innerHTML = '';
    const todayISO = today.toISOString().split('T')[0]; 
    
    const tasksForToday = tasks
        .filter(t => t.dueDate === todayISO && t.dueTime && !t.completed)
        .sort((a, b) => (a.dueTime || '23:59') > (b.dueTime || '23:59') ? 1 : -1);

    if (tasksForToday.length === 0) {
        agendaListEl.innerHTML = '<li>Nenhuma tarefa agendada para hoje.</li>';
    } else {
        tasksForToday.forEach(task => {
            const time = task.dueTime ? task.dueTime.substring(0, 5) : '';
            const listItem = document.createElement('li');
            listItem.textContent = `${time} - ${task.text}`;
            // --- NOVO: Adiciona o listener de clique para a tarefa ---
            listItem.style.cursor = 'pointer'; 
            listItem.onclick = () => openViewModalForTask(task.id);
            // ----------------------------------------------------
            agendaListEl.appendChild(listItem);
        });
    }

    // --- 2. Renderiza Blocos de Categoria (Cards de baixo) ---
    const categoriesContainer = document.getElementById('category-blocks-container');
    if (!categoriesContainer) {
        return;
    }
    
    const categories = {
        'trabalho': { count: 0, color: '#3F51B5' }, 
        'estudo': { count: 0, color: '#FF9800' },   
        'pessoal': { count: 0, color: '#E91E63' },  
        'outros': { count: 0, color: '#607D8B' }    
    };
    const categoryMap = { 'trabalho': 'TRABALHO', 'estudo': 'ESTUDO', 'pessoal': 'PESSOAL', 'outros': 'OUTROS' };

    tasks.filter(t => !t.completed).forEach(task => {
        const categoryKey = task.category || 'outros';
        if (categories[categoryKey]) {
             categories[categoryKey].count++;
        } else {
             categories['outros'].count++;
        }
    });

    categoriesContainer.innerHTML = ''; 
    
    const blocksWrapper = document.createElement('div');
    blocksWrapper.className = 'category-blocks';

    Object.keys(categories).forEach(key => {
        const block = document.createElement('div');
        block.className = 'category-block';
        block.style.backgroundColor = categories[key].color;
        block.innerHTML = `<div>${categoryMap[key] || 'OUTROS'}</div><div style="font-size: 2.5rem; margin-top: 5px;">${categories[key].count}</div>`;
        blocksWrapper.appendChild(block);
    });
    
    categoriesContainer.appendChild(blocksWrapper);

    // --- 3. Inicializa e sincroniza o Mini Calendário ---
    initMiniCalendar(tasks);
}


// Ouve o evento de atualização de tarefas e workspace para redesenhar
document.addEventListener('tasksUpdated', renderOverview);

document.addEventListener('viewSwitched', (e) => {
    if (e.detail.viewId === 'overview') {
        renderOverview();
        if (miniCalendarInitialized && miniCalendar) {
            miniCalendar.updateSize();
        }
    }
});