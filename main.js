$(document).ready(function () {
    let tasks = [];
    let currentTaskLi = null;
    let calendar = null;
    let calendarInitialized = false;

    // ... (depois de let calendarInitialized = false;)

    /* ---------- NOVA LÓGICA: Mostrar/Esconder Formulário e Filtros ---------- */
    $('#toggle-form-btn').on('click', function() {
        // Esconde o outro painel se estiver aberto
        $('#filter-container').slideUp(200);

        // Alterna o painel do formulário
        $('#form-container').slideToggle(300, function() {
            // Foca no input de texto quando o formulário aparece
            if ($(this).is(':visible')) {
                $('#task-text').focus();
            }
        });

        // Atualiza o texto do botão para dar feedback ao usuário
        const formVisible = $('#form-container').is(':visible');
        if (!formVisible) {
            $(this).html('<i class="fa-solid fa-times"></i> Fechar Formulário');
        } else {
            $(this).html('<i class="fa-solid fa-plus"></i> Adicionar Nova Tarefa');
        }
    });

    $('#toggle-filter-btn').on('click', function() {
        // Esconde o outro painel se estiver aberto
        $('#form-container').slideUp(200, function() {
            // Reseta o texto do botão do formulário se ele foi fechado
            $('#toggle-form-btn').html('<i class="fa-solid fa-plus"></i> Adicionar Nova Tarefa');
        });
        
        // Alterna o painel de filtros
        $('#filter-container').slideToggle(300, function() {
            // Foca no input de pesquisa quando os filtros aparecem
            if ($(this).is(':visible')) {
                $('#search-input').focus();
            }
        });
    });

    // Fecha os painéis se o usuário pressionar a tecla 'Escape'
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


    // ... (o restante do seu código JS continua aqui, começando com /* ---------- UTIL: Funções de Modal Melhoradas ---------- */)

    function generateId() { return '_' + Math.random().toString(36).substr(2, 9); }

    /* ---------- UTIL: Funções de Modal Melhoradas ---------- */
    function showModal(selector, options = {}) {
        const $modal = (typeof selector === 'string') ? $(selector) : selector;
        if (!$modal || $modal.length === 0) return;

        $('body').css('overflow', 'hidden'); // Impede o scroll da página
        $modal.addClass('show').attr('aria-hidden', 'false').show();

        const $focusableElements = $modal.find('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const $firstFocusable = $focusableElements.first();
        const $lastFocusable = $focusableElements.last();

        setTimeout(() => {
            if ($firstFocusable.length) $firstFocusable.focus();
        }, 100);

        $modal.on('keydown.focusTrap', function (e) {
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

        $('body').css('overflow', ''); // Restaura o scroll da página
        $modal.removeClass('show').attr('aria-hidden', 'true').hide();
        $modal.off('click.modalOverlay');
        $modal.off('keydown.focusTrap'); // Desativa o focus trap
    }

    $(document).on('keydown', function (e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
            $('.modal.show').each(function () { hideModal($(this)); });
        }
    });

    $('.modal .close, .modal .close-top-right').on('click', function() {
        hideModal($(this).closest('.modal'));
    });
     $('#edit-cancel-btn').on('click', () => hideModal('#editTaskModal'));
     $('#subtask-cancel-btn').on('click', () => hideModal('#subtask-modal'));
     $('#view-close-btn').on('click', () => hideModal('#viewTaskModal'));


    /* ---------- ADD TAREFA ---------- */
    $('#task-form').submit(function (e) {
        e.preventDefault();
        let text = $('#task-text').val().trim();
        let priority = $('#task-priority').val();
        let dueDate = $('#task-date').val();
        let dueTime = $('#task-time').val();
        let category = $('#task-category').val() || 'geral';
        if (!text) return;

        let task = { id: generateId(), text, completed: false, priority, dueDate, dueTime, category, subtasks: [] };
        tasks.push(task);
        addTaskHTML(task);
        saveTasks();
        updateProgress();
        syncTaskToCalendar(task);

        $('#task-text').val('');
        $('#task-priority').val('medium');
        $('#task-date').val('');
        $('#task-time').val('');
        $('#task-category').val('geral');
        applyFilter();
    });

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

    /* ---------- MARCAR / DESMARCAR ---------- */
    $(document).on('change', '.task-checkbox', function () {
        let li = $(this).closest('li');
        let task = tasks.find(t => t.id === li.attr('data-id'));
        if (!task) return;
        task.completed = $(this).prop('checked');
        li.find('label').first().toggleClass('completed', task.completed);
        li.find('.subtask-checkbox').prop('checked', task.completed).trigger('change');
        saveTasks();
        updateProgress();
        syncTaskToCalendar(task);
    });

    $(document).on('change', '.subtask-checkbox', function () {
        let li = $(this).closest('li');
        let subId = li.attr('data-id');
        let taskLi = li.closest('ul').closest('li');
        let task = tasks.find(t => t.id === taskLi.attr('data-id'));
        if (!task) return;
        let subtask = task.subtasks.find(st => st.id === subId);
        if (!subtask) return;
        subtask.completed = $(this).prop('checked');
        li.find('label').first().toggleClass('completed', subtask.completed);
        task.completed = task.subtasks.length > 0 && task.subtasks.every(st => st.completed);
        taskLi.find('.task-checkbox').prop('checked', task.completed);
        taskLi.find('label').first().toggleClass('completed', task.completed);
        saveTasks();
        updateProgress();
        syncTaskToCalendar(task);
    });

    /* ---------- REMOVER ---------- */
    $(document).on('click', '.remove-btn', function () {
        let li = $(this).closest('li');
        let taskId = li.attr('data-id');
        let task = tasks.find(t => t.id === taskId);
        if (!task) return;
        
        $('#confirm-title').text('Apagar Tarefa');
        $('#confirm-text').text(`Deseja realmente apagar a tarefa "${task.text}"? Esta ação não pode ser desfeita.`);
        showModal('#confirmModal');

        $('#confirm-ok-btn').off('click').on('click', function() {
            tasks = tasks.filter(t => t.id !== taskId);
            li.remove();
            saveTasks();
            updateProgress();
            removeEventFromCalendar(taskId);
            hideModal('#confirmModal');
        });

        $('#confirm-cancel-btn').off('click').on('click', function() {
            hideModal('#confirmModal');
        });
    });

    $(document).on('click', '.remove-subtask-btn', function () {
        let li = $(this).closest('li');
        let subId = li.attr('data-id');
        let taskLi = li.closest('ul').closest('li');
        let task = tasks.find(t => t.id === taskLi.attr('data-id'));
        if (!task) return;
        task.subtasks = task.subtasks.filter(st => st.id !== subId);
        li.remove();
        saveTasks();
        updateProgress();
        if (task.subtasks.length === 0) taskLi.find('.toggle-subtasks-btn').remove();
        syncTaskToCalendar(task);
    });

    /* ---------- ADD SUBTAREFA VIA MODAL ---------- */
    $(document).on('click', '.add-subtask-btn', function () {
        currentTaskLi = $(this).closest('li');
        let taskText = currentTaskLi.find('label').first().text();
        $('#subtask-input').val('');
        $('#subtask-input').attr('placeholder', `Digite a subtarefa para "${taskText}"`);
        $('#subtask-modal-title').text(`Adicionar subtarefa para "${taskText}"`);
        showModal('#subtask-modal');
    });

    $('#subtask-add-btn').click(function () {
        let subtaskText = $('#subtask-input').val().trim();
        if (!subtaskText || !currentTaskLi) return;
        let task = tasks.find(t => t.id === currentTaskLi.attr('data-id'));
        if (!task) return;
        let subtask = { id: generateId(), text: subtaskText, completed: false };
        task.subtasks.push(subtask);
        addSubtaskHTML(currentTaskLi.find('.subtask-list'), subtask);
        saveTasks();
        if (task.subtasks.length === 1) currentTaskLi.find('.button-group').prepend($('<button type="button" class="toggle-subtasks-btn">▼</button>'));
        hideModal('#subtask-modal');
        currentTaskLi = null;
        applyFilter();
        syncTaskToCalendar(task);
    });

    /* ---------- TOGGLE SUBTASKS ---------- */
    $(document).on('click', '.toggle-subtasks-btn', function () {
        let li = $(this).closest('li');
        li.find('.subtask-list').slideToggle(200);
        $(this).toggleClass('collapsed');
    });

    /* ---------- DRAG & DROP ---------- */
    $('#task-list').sortable({
        update: function () {
            let newTasks = [];
            $('#task-list>li').each(function () { newTasks.push(tasks.find(t => t.id === $(this).attr('data-id'))); });
            tasks = newTasks;
            saveTasks();
            syncAllToCalendar();
        }
    });

    function initSubtaskSortable(sublist) {
        sublist.sortable({
            connectWith: '.subtask-list',
            update: function () {
                let taskLi = sublist.closest('li');
                let task = tasks.find(t => t.id === taskLi.attr('data-id'));
                let newSubs = [];
                sublist.children('li').each(function () { newSubs.push(task.subtasks.find(st => st.id === $(this).attr('data-id'))); });
                task.subtasks = newSubs;
                saveTasks();
                syncTaskToCalendar(task);
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
    $('#search-input').on('input', applyFilter);
    $('#filter-priority').on('change', applyFilter);
    $('#filter-category').on('change', applyFilter);

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
    $('<style>@keyframes gradientAnimation {0%{background-position:0% 50%;}50%{background-position:100% 50%;}100%{background-position:0% 50%;}}</style>').appendTo('head');

    /* ---------- DATAS ---------- */
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

    /* ---------- LOCALSTORAGE ---------- */
    function saveTasks() { localStorage.setItem('tasks', JSON.stringify(tasks)); }
    function loadTasks() {
        let data = localStorage.getItem('tasks');
        if (data) {
            try {
                tasks = JSON.parse(data);
                tasks.forEach(t => { if (!t.category) t.category = 'geral'; });
                tasks.forEach(addTaskHTML);
                updateProgress();
                checkAllDueDates();
                applyFilter();
            } catch(e) { console.error('Erro ao carregar tarefas:', e); tasks=[]; }
        }
        if (!calendarInitialized) initCalendar();
        syncAllToCalendar();
    }

    /* ---------- GOOGLE AGENDA ---------- */
    function exportTaskToGoogleLink(task) {
        if (!task.dueDate) { alert("A tarefa precisa ter uma data para exportar!"); return; }
        
        let startDateTime = task.dueDate + (task.dueTime ? `T${task.dueTime}:00` : 'T09:00:00');
        let startDate = new Date(startDateTime);
        let endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Adiciona 1 hora

        let formatForGoogle = (date) => date.toISOString().replace(/-|:|\.\d+/g, '');
        
        let url = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
                  `&text=${encodeURIComponent(task.text)}` +
                  `&dates=${formatForGoogle(startDate)}/${formatForGoogle(endDate)}` +
                  `&details=${encodeURIComponent(task.subtasks.map(st=>st.text).join('\n'))}`;
        window.open(url,'_blank');
    }

    /* ---------- EDITAR TAREFA VIA MODAL ---------- */
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

    $('#edit-save-btn').click(function(){
        if(!currentTaskLi) return;
        let task = tasks.find(t => t.id === currentTaskLi.attr('data-id')); if(!task) return;
        
        task.text = $('#edit-task-name').val().trim() || 'Tarefa';
        task.priority = $('#edit-task-priority').val();
        task.category = $('#edit-task-category').val();
        task.dueDate = $('#edit-task-date').val();
        task.dueTime = $('#edit-task-time').val();

        currentTaskLi.find('label').first().text(task.text);
        currentTaskLi.removeClass('priority-low priority-medium priority-high').addClass('priority-'+task.priority);
        currentTaskLi.find('.priority-label').first().text(task.priority.charAt(0).toUpperCase()+task.priority.slice(1));
        currentTaskLi.attr('data-category',task.category);
        currentTaskLi.find('.task-category').first().text(task.category.charAt(0).toUpperCase()+task.category.slice(1))
                     .attr('data-tooltip','Categoria: '+task.category.charAt(0).toUpperCase()+task.category.slice(1));
        
        let dateLabel = currentTaskLi.find('.task-datetime');
        if (task.dueDate) {
            let dateText = new Date(task.dueDate + 'T00:00:00').toLocaleDateString();
            let timeText = task.dueTime ? ` ${task.dueTime}` : '';
            let dateTimeText = `📅 ${dateText}${timeText}`;
            if (dateLabel.length) dateLabel.text(dateTimeText);
            else currentTaskLi.find('.task-text').append($('<span class="task-datetime"></span>').text(dateTimeText));
        } else {
            dateLabel.remove();
        }

        updateTaskDueVisual(currentTaskLi,task);
        saveTasks(); applyFilter(); syncTaskToCalendar(task);
        hideModal('#editTaskModal'); currentTaskLi=null;
    });


    /* ---------- MODAL DE VISUALIZAÇÃO ---------- */
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


    /* ---------- SCROLL NAV ---------- */
    let lastScrollTop = 0;
    const nav = document.querySelector("nav");
    window.addEventListener("scroll",()=>{ let currentScroll=window.pageYOffset||document.documentElement.scrollTop; if(currentScroll>lastScrollTop&&currentScroll>100) nav.classList.add("hidden"); else if(currentScroll<lastScrollTop) nav.classList.remove("hidden"); lastScrollTop=currentScroll<=0?0:currentScroll; });

    /* ---------- FULLCALENDAR ---------- */
    function initCalendar() {
        const calendarEl = document.getElementById('calendar');
        if(calendarEl && typeof FullCalendar!=='undefined' && FullCalendar.Calendar){
            calendar = new FullCalendar.Calendar(calendarEl,{
                initialView:'timeGridWeek', // Melhor visualização padrão com horário
                locale: 'pt-br',
                headerToolbar:{left:'prev,next today',center:'title',right:'dayGridMonth,timeGridWeek,listWeek'},
                events: [], // Carregado via syncAllToCalendar
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
                allDay: !task.dueTime, // Evento de dia todo se não tiver hora
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
            tasks.forEach(syncTaskToCalendar); // Reutiliza a função de sincronia individual
        }
    }

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

    /* ---------- INICIALIZAÇÃO ---------- */
    loadTasks();
    setInterval(checkAllDueDates, 60 * 1000); // Verifica a cada minuto
});