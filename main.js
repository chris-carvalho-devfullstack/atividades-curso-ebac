$(document).ready(function () {
    let tasks = [];
    let currentTaskLi = null;
    let calendar = null;
    let calendarInitialized = false;

    function generateId() { return '_' + Math.random().toString(36).substr(2, 9); }

    /* ---------- UTIL: abrir/fechar modais de forma consistente ---------- */
    function showModal(selector, options = {}) {
        const $modal = (typeof selector === 'string') ? $(selector) : selector;
        if (!$modal || $modal.length === 0) return;
        $modal.addClass('show').attr('aria-hidden', 'false').show(); // CSS deve controlar visual, .show indica estado
        // foco no primeiro elemento focável
        setTimeout(() => {
            const $focusable = $modal.find('input, textarea, select, button').filter(':visible').first();
            if ($focusable.length) $focusable.focus();
            // re-render do FullCalendar caso o calendário esteja dentro do modal/contêiner
            if (calendar && $modal.find('#calendar').length) {
                try { calendar.render(); } catch (e) { /* ignore */ }
                setTimeout(() => { try { calendar.render(); } catch (e) {} }, 60);
            }
        }, 60);

        // fechar ao clicar no overlay (fora do .modal-content)
        $modal.off('click.modalOverlay').on('click.modalOverlay', function (evt) {
            if (evt.target === this && !(options && options.disableOverlayClose)) hideModal($modal);
        });
    }

    function hideModal(selector) {
        const $modal = (typeof selector === 'string') ? $(selector) : selector;
        if (!$modal || $modal.length === 0) return;
        $modal.removeClass('show').attr('aria-hidden', 'true').hide();
        $modal.off('click.modalOverlay');
    }

    // fechar modais com Esc
    $(document).on('keydown', function (e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
            $('.modal.show').each(function () { hideModal($(this)); });
        }
    });

    /* ---------- ADD TAREFA ---------- */
    $('#task-form').submit(function (e) {
        e.preventDefault();
        let text = $('#task-text').val().trim();
        let priority = $('#task-priority').val();
        let dueDate = $('#task-date').val();
        let category = $('#task-category').val() || 'geral';
        if (!text) return;

        let task = { id: generateId(), text, completed: false, priority, dueDate, category, subtasks: [] };
        tasks.push(task);
        addTaskHTML(task);
        saveTasks();
        updateProgress();
        syncTaskToCalendar(task);

        $('#task-text').val('');
        $('#task-priority').val('medium');
        $('#task-date').val('');
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
            let dateLabel = $('<span class="task-date-label"></span>').text(task.dueDate);
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
        tasks = tasks.filter(t => t.id !== taskId);
        li.remove();
        saveTasks();
        updateProgress();
        removeEventFromCalendar(taskId);
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
        $('#subtask-input').attr('placeholder', `Digite a subtarefa da "${taskText}"`);
        $('#subtask-modal-title').text(`Adicionar subtarefa da "${taskText}"`);
        showModal('#subtask-modal');
    });

    $('#subtask-cancel-btn, #subtask-modal .close').click(function () { hideModal('#subtask-modal'); currentTaskLi = null; });

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
        let today = new Date(), due = new Date(task.dueDate);
        today.setHours(0,0,0,0); due.setHours(0,0,0,0);
        let diffDays = (due - today)/(1000*60*60*24);
        if (diffDays < 0) li.addClass('overdue');
        else if (diffDays <= 1) li.addClass('due-soon');
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
        // tentar inicializar calendário e sincronizar
        if (!calendarInitialized) initCalendar();
        syncAllToCalendar();
    }

    /* ---------- GOOGLE AGENDA ---------- */
    function exportTaskToGoogleLink(task) {
        if (!task.dueDate) { alert("A tarefa precisa ter uma data para exportar!"); return; }
        let start = task.dueDate.replace(/-/g,'') + 'T090000Z';
        let end = task.dueDate.replace(/-/g,'') + 'T100000Z';
        let url = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
                  `&text=${encodeURIComponent(task.text)}` +
                  `&dates=${start}/${end}` +
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
        showModal('#editTaskModal');
    });

    $('#edit-save-btn').click(function(){
        if(!currentTaskLi) return;
        let task = tasks.find(t => t.id === currentTaskLi.attr('data-id')); if(!task) return;
        task.text = $('#edit-task-name').val().trim() || 'Tarefa';
        task.priority = $('#edit-task-priority').val();
        task.category = $('#edit-task-category').val();
        task.dueDate = $('#edit-task-date').val();
        currentTaskLi.find('label').first().text(task.text);
        currentTaskLi.removeClass('priority-low priority-medium priority-high').addClass('priority-'+task.priority);
        currentTaskLi.find('.priority-label').first().text(task.priority.charAt(0).toUpperCase()+task.priority.slice(1));
        currentTaskLi.attr('data-category',task.category);
        currentTaskLi.find('.task-category').first().text(task.category.charAt(0).toUpperCase()+task.category.slice(1))
                     .attr('data-tooltip','Categoria: '+task.category.charAt(0).toUpperCase()+task.category.slice(1));
        let dateLabel = currentTaskLi.find('.task-date-label');
        if(task.dueDate){ if(dateLabel.length) dateLabel.text(task.dueDate); else currentTaskLi.find('.task-text').append($('<span class="task-date-label"></span>').text(task.dueDate)); }
        else dateLabel.remove();
        updateTaskDueVisual(currentTaskLi,task);
        saveTasks(); applyFilter(); syncTaskToCalendar(task);
        hideModal('#editTaskModal'); currentTaskLi=null;
    });

    $('#edit-cancel-btn, #editTaskModal .close-edit').click(function(){ hideModal('#editTaskModal'); currentTaskLi=null; });

    /* ---------- MODAL DE VISUALIZAÇÃO ---------- */
    $(document).on('click', '#task-list li label', function(){
        let li = $(this).closest('li');
        let task = tasks.find(t => t.id === li.attr('data-id'));
        if(!task) return;

        $('#view-task-name').text(task.text);
        $('#view-task-priority').text(task.priority.charAt(0).toUpperCase()+task.priority.slice(1));
        $('#view-task-category').text(task.category.charAt(0).toUpperCase()+task.category.slice(1));
        $('#view-task-date').text(task.dueDate||'Sem data');
        let $subtasks = $('#view-task-subtasks').empty();
        if(task.subtasks.length){
            task.subtasks.forEach(st => $('<li></li>').text(st.text + (st.completed ? ' ✅' : '')).appendTo($subtasks));
        } else $subtasks.append('<li>Nenhuma subtarefa</li>');

        showModal('#viewTaskModal');

        $('#view-edit-btn').off('click').on('click',function(){
            hideModal('#viewTaskModal');
            currentTaskLi=li;
            $('#edit-task-name').val(task.text);
            $('#edit-task-priority').val(task.priority);
            $('#edit-task-category').val(task.category);
            $('#edit-task-date').val(task.dueDate);
            showModal('#editTaskModal');
        });

        $('#view-delete-btn').off('click').on('click',function(){
            if(confirm('Deseja realmente apagar esta tarefa?')){
                tasks = tasks.filter(t => t.id !== task.id);
                li.remove();
                saveTasks(); updateProgress(); removeEventFromCalendar(task.id);
                hideModal('#viewTaskModal');
            }
        });

        $('#view-close-btn, #viewTaskModal .close-view').off('click').on('click',function(){ hideModal('#viewTaskModal'); });
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
                initialView:'dayGridMonth',
                headerToolbar:{left:'prev,next today',center:'title',right:'dayGridMonth,timeGridWeek,listWeek'},
                events: tasks.filter(t=>t.dueDate).map(t=>({id:t.id,title:t.text,start:t.dueDate,color:t.completed?'#4CAF50':undefined})),
                eventClick:function(info){
                    try{
                        const id=info.event.id;
                        const li=$(`#task-list li[data-id="${id}"]`);
                        if(li.length) {
                            // abrir modal de visualização diretamente
                            li.find('label').first().click();
                            // destacar e rolar
                            try { li.addClass('highlight'); setTimeout(()=>li.removeClass('highlight'),1000); } catch(e){}
                            try { li[0].scrollIntoView({behavior:'smooth', block:'center'}); } catch(e){}
                        }
                    } catch(e){}
                }
            });
            calendar.render(); calendarInitialized=true;
        }
    }

    function syncTaskToCalendar(task){
        if(!calendar) return;
        let existing = calendar.getEventById(task.id);
        if(task.dueDate){
            if(existing){ existing.setProp('title',task.text); existing.setStart(task.dueDate); existing.setProp('color',task.completed?'#4CAF50':undefined); }
            else calendar.addEvent({id:task.id,title:task.text,start:task.dueDate,color:task.completed?'#4CAF50':undefined});
        } else if(existing){ existing.remove(); }
    }

    function removeEventFromCalendar(taskId){ if(calendar){ let ev=calendar.getEventById(taskId); if(ev) ev.remove(); } }
    function syncAllToCalendar(){ if(calendar) { calendar.getEvents().forEach(e=>e.remove()); tasks.filter(t=>t.dueDate).forEach(t=>calendar.addEvent({id:t.id,title:t.text,start:t.dueDate,color:t.completed?'#4CAF50':undefined})); } }

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
    setInterval(checkAllDueDates,60*1000);

    // expose for debugging (opcional)
    window.__tasks = tasks;
    window.__syncAllToCalendar = syncAllToCalendar;
});
