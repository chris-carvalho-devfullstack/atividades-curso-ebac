$(document).ready(function () {

let tasks = [];

function generateId(){return '_' + Math.random().toString(36).substr(2,9);}

// ---------- ADICIONAR TAREFA ---------- //
$('#task-form').submit(function(e){
    e.preventDefault();
    let text = $('#task-input').val().trim();
    let priority = $('#task-priority').val();
    if(!text) return;
    let task = {id:generateId(), text:text, completed:false, priority:priority, subtasks:[]};
    tasks.push(task);
    addTaskHTML(task);
    saveTasks();
    updateProgress();
    $('#task-input').val('');
    $('#task-priority').val('medium');
});

// ---------- ADICIONAR TAREFA AO HTML ---------- //
function addTaskHTML(task){
    let li = $('<li></li>').attr('data-id',task.id).addClass('priority-'+task.priority);

    let taskDiv = $('<div class="task-main"></div>');
    let textDiv = $('<div class="task-text"></div>');
    let checkbox = $('<input type="checkbox" class="task-checkbox">').prop('checked',task.completed);
    let label = $('<label></label>').text(task.text);
    if(task.completed) label.addClass('completed');
    textDiv.append(checkbox,label);

    let priorityLabel = $('<span class="priority-label"></span>').text(task.priority.charAt(0).toUpperCase()+task.priority.slice(1));
    textDiv.append(priorityLabel);

    let btnGroup = $('<div class="button-group"></div>');
    let editBtn = $('<button class="edit-btn" type="button">✎</button>');
    let removeBtn = $('<button class="remove-btn" type="button">X</button>');
    let addSubBtn = $('<button class="add-subtask-btn" type="button">➕ Sub</button>');
    btnGroup.append(editBtn,removeBtn,addSubBtn);

    taskDiv.append(textDiv,btnGroup);
    li.append(taskDiv);

    // Subtarefas
    let subtaskList = $('<ul class="subtask-list"></ul>');
    task.subtasks.forEach(st => addSubtaskHTML(subtaskList,st));
    li.append(subtaskList);
    initSubtaskSortable(subtaskList);

    $('#task-list').append(li);
}

// ---------- ADICIONAR SUBTAREFA AO HTML ---------- //
function addSubtaskHTML(subtaskList,subtask){
    let li = $('<li></li>').attr('data-id',subtask.id);
    let div = $('<div class="task-text"></div>');
    let checkbox = $('<input type="checkbox" class="subtask-checkbox">').prop('checked',subtask.completed);
    let label = $('<label></label>').text(subtask.text);
    if(subtask.completed) label.addClass('completed');
    div.append(checkbox,label);
    let removeBtn = $('<button class="remove-subtask-btn" type="button">X</button>');
    li.append(div,removeBtn);
    subtaskList.append(li);
}

// ---------- MARCAR/DEMARCAR ---------- //
$(document).on('change','.task-checkbox',function(){
    let li = $(this).closest('li');
    let task = tasks.find(t=>t.id===li.attr('data-id'));
    let checked = $(this).prop('checked');
    task.completed = checked;
    li.find('label').first().toggleClass('completed',checked);

    // Marcar/desmarcar todas as subtarefas sem disparar trigger
    li.find('.subtask-checkbox').each(function(){
        $(this).prop('checked',checked);
        let subId = $(this).closest('li').attr('data-id');
        let subtask = task.subtasks.find(st => st.id === subId);
        subtask.completed = checked;
        $(this).closest('li').find('label').first().toggleClass('completed',checked);
    });

    saveTasks();
    updateProgress();
});

$(document).on('change','.subtask-checkbox',function(){
    let li = $(this).closest('li');
    let subId = li.attr('data-id');
    let taskLi = li.closest('ul').closest('li');
    let task = tasks.find(t=>t.id===taskLi.attr('data-id'));
    let subtask = task.subtasks.find(st=>st.id===subId);
    subtask.completed = $(this).prop('checked');
    li.find('label').first().toggleClass('completed',subtask.completed);

    // Atualizar tarefa principal automaticamente
    if(task.subtasks.length > 0){
        let allDone = task.subtasks.every(st=>st.completed);
        task.completed = allDone;
        taskLi.find('.task-checkbox').prop('checked',allDone);
        taskLi.find('.task-text label').first().toggleClass('completed',allDone);
    }

    saveTasks();
    updateProgress();
});

// ---------- REMOVER TAREFA / SUBTAREFA ---------- //
$(document).on('click','.remove-btn',function(){
    let li = $(this).closest('li');
    tasks = tasks.filter(t=>t.id!==li.attr('data-id'));
    li.remove();
    saveTasks();
    updateProgress();
});
$(document).on('click','.remove-subtask-btn',function(){
    let li = $(this).closest('li');
    let subId = li.attr('data-id');
    let taskLi = li.closest('ul').closest('li');
    let task = tasks.find(t=>t.id===taskLi.attr('data-id'));
    task.subtasks = task.subtasks.filter(st=>st.id!==subId);
    li.remove();

    // Atualizar checkbox da tarefa principal
    let allDone = task.subtasks.length>0 && task.subtasks.every(st=>st.completed);
    task.completed = allDone;
    taskLi.find('.task-checkbox').prop('checked',allDone);
    taskLi.find('.task-text label').first().toggleClass('completed',allDone);

    saveTasks();
    updateProgress();
});

// ---------- EDITAR TAREFA ---------- //
$(document).on('click','.edit-btn',function(){
    let li = $(this).closest('li');
    let label = li.find('label').first();
    let currentText = label.text();
    let input = $('<input type="text" class="edit-task">').val(currentText);
    label.replaceWith(input);
    input.focus();

    input.on('keypress',function(e){ if(e.which===13) saveEdit(input,li); });
    input.on('blur',function(){ saveEdit(input,li); });

    function saveEdit(input,li){
        let newText = input.val().trim();
        if(!newText) newText = 'Tarefa';
        let label = $('<label></label>').text(newText);
        input.replaceWith(label);
        let task = tasks.find(t=>t.id===li.attr('data-id'));
        task.text = newText;
        saveTasks();
    }
});

// ---------- ADICIONAR SUBTAREFA ---------- //
$(document).on('click','.add-subtask-btn',function(){
    let li = $(this).closest('li');
    let task = tasks.find(t=>t.id===li.attr('data-id'));
    let subtaskText = prompt("Digite o nome da subtarefa:");
    if(!subtaskText) return;
    let subtask = {id:generateId(), text:subtaskText, completed:false};
    task.subtasks.push(subtask);
    addSubtaskHTML(li.find('.subtask-list'),subtask);
    saveTasks();
});

// ---------- DRAG & DROP ---------- //
$('#task-list').sortable({
    update:function(){
        let newTasks = [];
        $('#task-list>li').each(function(){
            let id = $(this).attr('data-id');
            newTasks.push(tasks.find(t=>t.id===id));
        });
        tasks=newTasks;
        saveTasks();
    }
});

function initSubtaskSortable(sublist){
    sublist.sortable({
        connectWith:'.subtask-list',
        update:function(){
            let taskLi=sublist.closest('li');
            let task=tasks.find(t=>t.id===taskLi.attr('data-id'));
            let newSubs=[];
            sublist.children('li').each(function(){
                let stId=$(this).attr('data-id');
                newSubs.push(task.subtasks.find(st=>st.id===stId));
            });
            task.subtasks=newSubs;
            saveTasks();
        }
    });
}

// ---------- FILTRO / PESQUISA ---------- //
function applyFilter(){
    let val = $('#search-input').val().toLowerCase();
    let priorityFilter = $('#filter-priority').val();
    $('#task-list>li').each(function(){
        let text = $(this).find('label').first().text().toLowerCase();
        let priority = $(this).attr('class').includes('priority-high')?'high':
                       $(this).attr('class').includes('priority-medium')?'medium':'low';
        let matchText = text.includes(val);
        let matchPriority = (priorityFilter==='all') || (priority===priorityFilter);
        $(this).toggle(matchText && matchPriority);
    });
}

$('#search-input').on('keyup',applyFilter);
$('#filter-priority').on('change',applyFilter);

// ---------- BARRA DE PROGRESSO ---------- //
function updateProgress(){
    let total = tasks.length;
    let completed = tasks.filter(t=>t.completed).length;
    let percent = total===0?0:Math.round((completed/total)*100);
    let color = percent===100?'#4CAF50':percent>=80?'#64b5f6':percent>=50?'#FFEB3B':'#f44336';
    $('.progress-bar').css({'width':percent+'%','background-color':color}).text(percent+'%');
    if(percent===100){ 
        $('.progress-bar').addClass('completed'); 
        setTimeout(()=>$('.progress-bar').removeClass('completed'),1200);
    }
}

// ---------- SALVAR / CARREGAR ---------- //
function saveTasks(){localStorage.setItem('tasks',JSON.stringify(tasks));}
function loadTasks(){tasks=JSON.parse(localStorage.getItem('tasks'))||[];tasks.forEach(t=>addTaskHTML(t)); updateProgress();}

// ---------- INICIALIZAÇÃO ---------- //
loadTasks();

});
