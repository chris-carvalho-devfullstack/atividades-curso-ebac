$(document).ready(function () {
    let tasks = [];
    let currentTaskLi = null;

    function generateId() { return '_' + Math.random().toString(36).substr(2, 9); }

    const categoryIcons = {
        geral: 'fa-circle-info',
        trabalho: 'fa-briefcase',
        pessoal: 'fa-user',
        estudo: 'fa-book',
        outros: 'fa-tags'
    };

    /* ---------- ADD TAREFA ---------- */
    $('#task-form').submit(function (e) {
        e.preventDefault();
        let text = $('#task-input').val().trim();
        let priority = $('#task-priority').val();
        let dueDate = $('#task-date').val();
        let category = $('#task-category').val() || 'geral';
        if (!text) return;

        let task = { id: generateId(), text, completed: false, priority, dueDate, category, subtasks: [] };
        tasks.push(task);
        addTaskHTML(task);
        saveTasks();
        updateProgress();

        $('#task-input').val('');
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

        // Div envolvendo prioridade + categoria
        let prioCatDiv = $('<div class="task-priority-category"></div>');

        // Prioridade
        let priorityLabel = $('<span class="priority-label"></span>')
            .addClass('priority-' + task.priority)
            .text(task.priority.charAt(0).toUpperCase() + task.priority.slice(1));
        prioCatDiv.append(priorityLabel);

        // Categoria
        let categorySpan = $('<span class="task-category"></span>')
            .text(task.category.charAt(0).toUpperCase() + task.category.slice(1))
            .attr('data-tooltip', 'Categoria: ' + task.category.charAt(0).toUpperCase() + task.category.slice(1));
        prioCatDiv.append(categorySpan);

        textDiv.append(prioCatDiv);

        // Data
        if (task.dueDate) {
            let dateLabel = $('<span class="task-date-label"></span>').text(task.dueDate);
            textDiv.append(dateLabel);
        }

        // Botões
        let btnGroup = $('<div class="button-group"></div>');

        if (task.subtasks.length > 0) {
            let toggleSubBtn = $('<button type="button" class="toggle-subtasks-btn">▼</button>');
            btnGroup.append(toggleSubBtn);
        }

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

        // Subtarefas
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
        task.completed = $(this).prop('checked');
        li.find('label').first().toggleClass('completed', task.completed);
        li.find('.subtask-checkbox').prop('checked', task.completed).trigger('change');
        saveTasks();
        updateProgress();
    });

    $(document).on('change', '.subtask-checkbox', function () {
        let li = $(this).closest('li');
        let subId = li.attr('data-id');
        let taskLi = li.closest('ul').closest('li');
        let task = tasks.find(t => t.id === taskLi.attr('data-id'));
        let subtask = task.subtasks.find(st => st.id === subId);
        subtask.completed = $(this).prop('checked');
        li.find('label').first().toggleClass('completed', subtask.completed);
        task.completed = task.subtasks.length > 0 && task.subtasks.every(st => st.completed);
        taskLi.find('.task-checkbox').prop('checked', task.completed);
        taskLi.find('label').first().toggleClass('completed', task.completed);
        saveTasks();
        updateProgress();
    });

    /* ---------- REMOVER ---------- */
    $(document).on('click', '.remove-btn', function () {
        let li = $(this).closest('li');
        tasks = tasks.filter(t => t.id !== li.attr('data-id'));
        li.remove();
        saveTasks();
        updateProgress();
    });

    $(document).on('click', '.remove-subtask-btn', function () {
        let li = $(this).closest('li');
        let subId = li.attr('data-id');
        let taskLi = li.closest('ul').closest('li');
        let task = tasks.find(t => t.id === taskLi.attr('data-id'));
        task.subtasks = task.subtasks.filter(st => st.id !== subId);
        li.remove();
        saveTasks();
        updateProgress();
        if (task.subtasks.length === 0) {
            taskLi.find('.toggle-subtasks-btn').remove();
        }
    });

    /* ---------- EDITAR ---------- */
    $(document).on('click', '.edit-btn', function () {
        let li = $(this).closest('li');
        let label = li.find('label').first();
        let input = $('<input type="text" class="edit-task">').val(label.text());
        label.replaceWith(input);
        input.focus();
        input.on('keypress', e => { if (e.which === 13) saveEdit(input, li); });
        input.on('blur', () => saveEdit(input, li));

        function saveEdit(input, li) {
            let newText = input.val().trim();
            if (!newText) newText = 'Tarefa';
            let label = $('<label></label>').text(newText);
            input.replaceWith(label);
            let task = tasks.find(t => t.id === li.attr('data-id'));
            task.text = newText;
            saveTasks();
            applyFilter();
        }
    });

    /* ---------- ADD SUBTAREFA VIA MODAL ---------- */
    $(document).on('click', '.add-subtask-btn', function () {
        currentTaskLi = $(this).closest('li');
        let taskText = currentTaskLi.find('label').first().text();
        $('#subtask-input').val('');
        $('#subtask-input').attr('placeholder', `Digite a subtarefa da "${taskText}"`);
        $('#subtask-modal-title').text(`Adicionar subtarefa da "${taskText}"`);
        $('#subtask-modal').fadeIn();
        $('#subtask-input').focus();
    });

    $('#subtask-cancel-btn, .close').click(function () {
        $('#subtask-modal').fadeOut();
        currentTaskLi = null;
    });

    $('#subtask-add-btn').click(function () {
        let subtaskText = $('#subtask-input').val().trim();
        if (!subtaskText) return;
        let task = tasks.find(t => t.id === currentTaskLi.attr('data-id'));
        let subtask = { id: generateId(), text: subtaskText, completed: false };
        task.subtasks.push(subtask);
        addSubtaskHTML(currentTaskLi.find('.subtask-list'), subtask);
        saveTasks();

        if (task.subtasks.length === 1) {
            let toggleSubBtn = $('<button type="button" class="toggle-subtasks-btn">▼</button>');
            currentTaskLi.find('.button-group').prepend(toggleSubBtn);
        }

        $('#subtask-modal').fadeOut();
        applyFilter();
    });

    /* ---------- TOGGLE SUBTASKS ---------- */
    $(document).on('click', '.toggle-subtasks-btn', function () {
        let li = $(this).closest('li');
        let sublist = li.find('.subtask-list');
        sublist.slideToggle(200);
        $(this).toggleClass('collapsed');
    });

    /* ---------- DRAG & DROP ---------- */
    $('#task-list').sortable({
        update: function () {
            let newTasks = [];
            $('#task-list>li').each(function () {
                let id = $(this).attr('data-id');
                newTasks.push(tasks.find(t => t.id === id));
            });
            tasks = newTasks;
            saveTasks();
        }
    });

    function initSubtaskSortable(sublist) {
        sublist.sortable({
            connectWith: '.subtask-list',
            update: function () {
                let taskLi = sublist.closest('li');
                let task = tasks.find(t => t.id === taskLi.attr('data-id'));
                let newSubs = [];
                sublist.children('li').each(function () {
                    let stId = $(this).attr('data-id');
                    newSubs.push(task.subtasks.find(st => st.id === stId));
                });
                task.subtasks = newSubs;
                saveTasks();
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
            let priorityClass = task.attr('class').toLowerCase();
            let taskCategory = task.data('category') || 'geral';
            let matchText = text.includes(searchVal);
            let matchPriority = (priorityVal === 'all') || priorityClass.includes(priorityVal);
            let matchCategory = (categoryVal === 'all') || (taskCategory === categoryVal);
            task.toggle(matchText && matchPriority && matchCategory);
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
        $('.progress-bar').text(percent > 0 ? percent + '%' : '');

        let color;
        if (percent === 0) color = '#f44336';
        else if (percent < 50) color = '#ff9800';
        else if (percent < 80) color = '#4CAF50';
        else color = 'linear-gradient(270deg, #4CAF50, #8BC34A, #4CAF50)';

        if (percent >= 80) {
            $('.progress-bar').css({ 'background': color, 'background-size': '600% 100%', 'animation': 'gradientAnimation 3s ease infinite' });
        } else {
            $('.progress-bar').css({ 'background': color, 'animation': 'none' });
        }
        $('.progress-bar').css('width', percent + '%');
        if (percent === 100) $('.progress-bar').addClass('completed'); else $('.progress-bar').removeClass('completed');
    }

    $('<style>@keyframes gradientAnimation { 0%{background-position:0% 50%;}50%{background-position:100% 50%;}100%{background-position:0% 50%;} }</style>').appendTo('head');

    /* ---------- DATAS ---------- */
    function updateTaskDueVisual(li, task) {
        li.removeClass('due-soon overdue');
        if (!task.dueDate || task.completed) return;
        let today = new Date(), due = new Date(task.dueDate);
        today.setHours(0, 0, 0, 0); due.setHours(0, 0, 0, 0);
        let diffDays = (due - today) / (1000 * 60 * 60 * 24);
        if (diffDays < 0) li.addClass('overdue');
        else if (diffDays <= 1) li.addClass('due-soon');
    }

    function checkAllDueDates() {
        $('#task-list>li').each(function () {
            let li = $(this);
            let task = tasks.find(t => t.id === li.attr('data-id'));
            updateTaskDueVisual(li, task);
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
            } catch (e) {
                console.error('Erro ao carregar tarefas do LocalStorage:', e);
                tasks = [];
            }
        }
    }

    /* ---------- GOOGLE AGENDA ---------- */
    function exportTaskToGoogleLink(task) {
        if (!task.dueDate) { alert("A tarefa precisa ter uma data para exportar!"); return; }
        let start = task.dueDate.replace(/-/g, '') + 'T090000Z';
        let end = task.dueDate.replace(/-/g, '') + 'T100000Z';
        let url = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
            `&text=${encodeURIComponent(task.text)}` +
            `&dates=${start}/${end}` +
            `&details=${encodeURIComponent(task.subtasks.map(st => st.text).join('\n'))}`;
        window.open(url, '_blank');
    }

    // Controle de mostrar/esconder menu ao rolar
let lastScrollTop = 0;
const nav = document.querySelector("nav");

window.addEventListener("scroll", () => {
  let currentScroll = window.pageYOffset || document.documentElement.scrollTop;

  if (currentScroll > lastScrollTop && currentScroll > 100) {
    // Só esconde se rolar para baixo e já tiver passado 100px
    nav.classList.add("hidden");
  } else if (currentScroll < lastScrollTop) {
    // Mostra ao rolar para cima
    nav.classList.remove("hidden");
  }

  lastScrollTop = currentScroll <= 0 ? 0 : currentScroll;
});


    loadTasks();
    
});
