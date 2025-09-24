$(document).ready(function() {

    loadTasks();
    updateProgress();

    // Adicionar nova tarefa
    $('#task-form').submit(function(event) {
        event.preventDefault();
        var taskText = $('#task-input').val();
        if(taskText) {
            addTask(taskText, false);
            $('#task-input').val('');
            updateProgress();
            saveTasks();
        }
    });

    // Marcar/desmarcar concluída
    $(document).on('change', '.task-checkbox', function() {
        $(this).next('label').toggleClass('completed');
        updateProgress();
        saveTasks();
    });

    // Remover tarefa
    $(document).on('click', '.remove-btn', function() {
        $(this).closest('li').remove();
        updateProgress();
        saveTasks();
    });

    // Editar tarefa
    $(document).on('click', '.edit-btn', function() {
        var li = $(this).closest('li');
        var label = li.find('label');
        var currentText = label.text();
        var input = $('<input type="text" class="edit-task">').val(currentText);

        label.replaceWith(input);
        input.focus();

        input.on('keypress', function(e) {
            if(e.which === 13) saveEdit(input);
        });

        input.on('blur', function() {
            saveEdit(input);
        });

        function saveEdit(input) {
            var newText = input.val();
            var label = $('<label></label>').text(newText);
            if(input.prev('input').is(':checked')) label.addClass('completed');
            input.replaceWith(label);
            saveTasks();
        }
    });

    // Função para adicionar tarefa
    function addTask(text, completed) {
        var li = $('<li></li>');

        var taskTextDiv = $('<div class="task-text"></div>');
        var checkbox = $('<input type="checkbox" class="task-checkbox">').prop('checked', completed);
        var label = $('<label></label>').text(text);
        if(completed) label.addClass('completed');
        taskTextDiv.append(checkbox).append(label);

        var buttonGroup = $('<div class="button-group"></div>');
        var editBtn = $('<button class="edit-btn" type="button">✎</button>');
        var removeBtn = $('<button class="remove-btn" type="button">X</button>');
        buttonGroup.append(editBtn).append(removeBtn);

        li.append(taskTextDiv).append(buttonGroup);
        $('#task-list').append(li);
    }

    // Atualizar barra de progresso
    function updateProgress() {
        var totalTasks = $('#task-list li').length;
        var completedTasks = $('#task-list li .task-checkbox:checked').length;
        var percent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

        var color;
        if(percent === 100) color = '#4CAF50';
        else if(percent >= 80) color = '#64b5f6';
        else if(percent >= 50) color = '#FFEB3B';
        else color = '#f44336';

        $('.progress-bar').css({
            'width': percent + '%',
            'background-color': color
        }).text(percent + '%');

        if(percent === 100) {
            $('.progress-bar').addClass('completed');
            setTimeout(() => $('.progress-bar').removeClass('completed'), 1200);
        }
    }

    // Salvar tarefas no localStorage
    function saveTasks() {
        var tasks = [];
        $('#task-list li').each(function() {
            var taskText = $(this).find('label').text();
            var completed = $(this).find('.task-checkbox').is(':checked');
            tasks.push({ text: taskText, completed: completed });
        });
        localStorage.setItem('tasks', JSON.stringify(tasks));
    }

    // Carregar tarefas do localStorage
    function loadTasks() {
        var tasks = JSON.parse(localStorage.getItem('tasks')) || [];
        tasks.forEach(function(task) {
            addTask(task.text, task.completed);
        });
    }

    // Tornar lista ordenável
    $('#task-list').sortable({
        update: function() {
            updateProgress();
            saveTasks();
        }
    });

});
