$(document).ready(function() {
    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    let history = JSON.parse(localStorage.getItem('pomodoroHistory')) || [];
    let timerInterval;
    let pomodoroCount = 0;
    let sessionType = 'pomodoro';
    let sessionIndex = 0;
    const durations = { pomodoro: 25*60, shortBreak: 5*60, longBreak: 15*60 };
    let totalSeconds = durations.pomodoro;
    let isRunning = false;

    const circle = document.querySelector('.progress-circle');
    const circumference = 2 * Math.PI * 100;
    circle.style.strokeDasharray = circumference;
    circle.style.strokeDashoffset = circumference;

    function setProgress(percent) {
        const offset = circumference - (percent / 100) * circumference;
        circle.style.strokeDashoffset = offset;
    }

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
        let minutes = Math.floor(totalSeconds / 60).toString().padStart(2,'0');
        let seconds = (totalSeconds % 60).toString().padStart(2,'0');
        $('#timer').text(`${minutes}:${seconds}`);
        let percent = ((durations[sessionType] - totalSeconds) / durations[sessionType]) * 100;
        setProgress(percent);
    }

    function updateCurrentTask() {
        let taskId = $('#pomodoro-task').val();
        let taskText = tasks.find(t => t.id === taskId)?.text || 'Nenhuma';
        $('#current-task').text(`Tarefa atual: ${taskText}`);
    }

    function updateSessionTypeDisplay() {
        let text = sessionType === 'pomodoro' ? 'Pomodoro' :
                   sessionType === 'shortBreak' ? 'Pausa Curta' : 'Pausa Longa';
        $('#session-type').text(`Sessão: ${text}`);
        let color = sessionType === 'pomodoro' ? '#4CAF50' :
                    sessionType === 'shortBreak' ? '#FF9800' : '#2196F3';
        circle.style.stroke = color;
    }

    function playAlarm() { document.getElementById('alarm-sound').play(); }

    function startTimer() {
        if(isRunning) return;
        isRunning = true;
        timerInterval = setInterval(() => {
            if(totalSeconds > 0) {
                totalSeconds--;
                updateDisplay();
            } else {
                clearInterval(timerInterval);
                isRunning = false;
                logSession();
                completeSession();
            }
        },1000);
    }

    function pauseTimer() {
        clearInterval(timerInterval);
        isRunning = false;
    }

    function resetTimer() {
        clearInterval(timerInterval);
        totalSeconds = durations[sessionType];
        updateDisplay();
        isRunning = false;
    }

    function skipSession() {
        clearInterval(timerInterval);
        isRunning = false;
        logSession();
        completeSession();
    }

    function completeSession() {
        if(sessionType === 'pomodoro') {
            pomodoroCount++;
            sessionIndex++;
            sessionType = sessionIndex % 4 === 0 ? 'longBreak' : 'shortBreak';
        } else {
            sessionType = 'pomodoro';
        }
        totalSeconds = durations[sessionType];
        updateSessionTypeDisplay();
        updateDisplay();
        startTimer();
    }

    function logSession() {
        let taskId = $('#pomodoro-task').val();
        let taskName = tasks.find(t => t.id === taskId)?.text || 'Nenhuma';
        let now = new Date();
        let duration = Math.floor(durations[sessionType]/60);
        history.push({
            task: taskName,
            sessionType: sessionType,
            date: now.toLocaleString(),
            duration: duration
        });
        localStorage.setItem('pomodoroHistory', JSON.stringify(history));
        updateHistoryTable();
    }

    function updateHistoryTable() {
        const tbody = $('#pomodoro-history tbody');
        tbody.empty();
        history.forEach(entry => {
            tbody.append(`<tr>
                <td>${entry.task}</td>
                <td>${entry.sessionType === 'pomodoro' ? 'Pomodoro' :
                     entry.sessionType === 'shortBreak' ? 'Pausa Curta' : 'Pausa Longa'}</td>
                <td>${entry.date}</td>
                <td>${entry.duration}</td>
            </tr>`);
        });
    }

    // Resetar histórico
$('#reset-history-btn').click(function() {
    if(confirm("Tem certeza que deseja apagar todo o histórico?")) {
        history = [];
        localStorage.setItem('pomodoroHistory', JSON.stringify(history));
        updateHistoryTable();
    }
});

// Exportar histórico em CSV
$('#export-history-btn').click(function() {
    if(history.length === 0){
        alert("Não há histórico para exportar!");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Tarefa,Sessão,Data/Hora,Duração (min)\n";
    history.forEach(entry => {
        let row = [
            entry.task,
            entry.sessionType === 'pomodoro' ? 'Pomodoro' :
            entry.sessionType === 'shortBreak' ? 'Pausa Curta' : 'Pausa Longa',
            entry.date,
            entry.duration
        ].join(",");
        csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `pomodoro_history_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});


    $('#start-btn').click(startTimer);
    $('#pause-btn').click(pauseTimer);
    $('#reset-btn').click(resetTimer);
    $('#skip-btn').click(skipSession);
    $('#pomodoro-task').change(updateCurrentTask);

    updateDisplay();
    updateCurrentTask();
    updateSessionTypeDisplay();
    updateHistoryTable();
});
