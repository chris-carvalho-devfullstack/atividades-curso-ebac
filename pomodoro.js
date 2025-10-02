$(document).ready(function() {
    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    let timerInterval;
    const totalSecondsDefault = 25 * 60;
    let totalSeconds = totalSecondsDefault;
    let isRunning = false;

    const circle = document.querySelector('.progress-circle');
    const circumference = 2 * Math.PI * 100; // 2*PI*R
    circle.style.strokeDasharray = circumference;

    function setProgress(percent) {
        const offset = circumference - (percent / 100) * circumference;
        circle.style.strokeDashoffset = offset;
    }

    // Preencher select com tarefas
    function populateTaskSelect() {
        const select = $('#pomodoro-task');
        select.empty();
        select.append('<option value="">Nenhuma tarefa selecionada</option>');
        tasks.forEach(task => {
            select.append(`<option value="${task.id}">${task.text}</option>`);
        });
    }

    populateTaskSelect();

    function updateDisplay() {
        let minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        let seconds = (totalSeconds % 60).toString().padStart(2, '0');
        $('#timer').text(`${minutes}:${seconds}`);

        let percent = ((totalSecondsDefault - totalSeconds) / totalSecondsDefault) * 100;
        setProgress(percent);
    }

    function updateCurrentTask() {
        let taskId = $('#pomodoro-task').val();
        let taskText = tasks.find(t => t.id === taskId)?.text || 'Nenhuma';
        $('#current-task').text(`Tarefa atual: ${taskText}`);
    }

    // Start
    $('#start-btn').click(function() {
        if (isRunning) return;
        isRunning = true;
        timerInterval = setInterval(() => {
            if (totalSeconds > 0) {
                totalSeconds--;
                updateDisplay();
            } else {
                clearInterval(timerInterval);
                isRunning = false;
                alert("Pomodoro finalizado!");
            }
        }, 1000);
    });

    // Pause
    $('#pause-btn').click(function() {
        clearInterval(timerInterval);
        isRunning = false;
    });

    // Reset
    $('#reset-btn').click(function() {
        clearInterval(timerInterval);
        totalSeconds = totalSecondsDefault;
        updateDisplay();
        isRunning = false;
    });

    // Mudar tarefa
    $('#pomodoro-task').change(updateCurrentTask);

    updateDisplay();
    updateCurrentTask();
});
