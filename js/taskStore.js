// js/taskStore.js
import { db } from "./firebase-config.js";
import {
    collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc,
    deleteDoc, serverTimestamp, writeBatch, setDoc, getDoc, getDocs
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { getCurrentUserUID } from './authManager.js';
import { generateId } from './utils.js';

// *** ATUALIZADO: Importações reais do uiRenderer.js ***
import {
    renderAllTasks, renderTrash, updateProgress, checkAllDueDates,
    applyFilter /* syncAllToCalendar será chamado de app.js por enquanto */
} from './uiRenderer.js';
// *** syncAllToCalendar removido daqui por enquanto ***

// Estado interno
let tasks = [];
let trash = [];
let unsubscribeTasks = null;
let unsubscribeTrash = null;

// Getters para o estado
export function getTasks() {
  return [...tasks];
}
export function getTrash() {
  return [...trash];
}

// ===============================================
// Funções Auxiliares Internas (Não exportadas)
// ===============================================

// <<< Funções updateNestedSubtasks, findNestedSubtask, checkCompletionStatusRecursively, getNewTaskOrderIndex INALTERADAS >>>
function updateNestedSubtasks(subtasks, targetId, callbackFn) {
    if (!subtasks) return [];
    return subtasks.map(subtask => {
        if (subtask.id === targetId) { return callbackFn(subtask); }
        if (subtask.subtasks?.length > 0) { // Optional chaining
            subtask.subtasks = updateNestedSubtasks(subtask.subtasks, targetId, callbackFn);
        }
        return subtask;
    });
}

function findNestedSubtask(subtasks, targetId) {
    if (!subtasks) return null;
    for (const subtask of subtasks) {
        if (subtask.id === targetId) { return subtask; }
        if (subtask.subtasks?.length > 0) { // Optional chaining
            const found = findNestedSubtask(subtask.subtasks, targetId);
            if (found) return found;
        }
    }
    return null;
}

const checkCompletionStatusRecursively = (subtasks) => {
    if (!subtasks || subtasks.length === 0) return true;
    return subtasks.every(st => st.completed && checkCompletionStatusRecursively(st.subtasks));
};

function getNewTaskOrderIndex() {
    if (tasks.length === 0) return 1.0;
    const highestOrder = tasks.reduce((max, t) => (t.orderIndex || 0) > max ? (t.orderIndex || 0) : max, 0);
    return highestOrder + 1.0;
}


// ===============================================
// Funções de Armazenamento Local (Exportadas)
// ===============================================

export function getLocalTasks() {
    try {
        const localData = localStorage.getItem('tasks');
        return localData ? JSON.parse(localData) : [];
    } catch (e) {
        console.error("Erro ao ler tarefas locais:", e);
        return [];
    }
}

export function saveLocalTasks(tasksArray) {
    localStorage.setItem('tasks', JSON.stringify(tasksArray));
    // A UI será atualizada por quem chama esta função (geralmente addTask, updateTask local)
}

export function loadTasksFromLocalStorage() {
    tasks = getLocalTasks();
    // *** ATUALIZADO: Chama funções de UI importadas ***
    renderAllTasks(tasks);
    updateProgress();
    checkAllDueDates();
}

// ===============================================
// Funções de Operação do Firestore (Exportadas)
// ===============================================

// <<< Funções addTaskToFirestore, updateTaskInFirestore, moveTaskToTrash, restoreTaskFromTrash, permanentlyDeleteTask, saveSubtasksToFirestore INALTERADAS >>>
export async function addTaskToFirestore(task) {
    const uid = getCurrentUserUID();
    if (!uid) return;
    try {
        const tasksRef = collection(db, "users", uid, "tasks");
        const newOrderIndex = getNewTaskOrderIndex();
        await addDoc(tasksRef, { ...task, createdAt: serverTimestamp(), orderIndex: newOrderIndex, subtasks: task.subtasks || [] });
        console.log("✅ Tarefa adicionada com sucesso ao Firestore!");
    } catch (error) { console.error("🚨 Erro ao adicionar tarefa:", error); alert(`🚨 ERRO CRÍTICO AO SALVAR TAREFA. Motivo: ${error.message}.`); }
}
export async function updateTaskInFirestore(taskId, data) {
    const uid = getCurrentUserUID();
    if (!uid) return;
    try { const taskRef = doc(db, "users", uid, "tasks", taskId); await updateDoc(taskRef, data); }
    catch (error) { console.error("Erro ao atualizar tarefa:", error); }
}
export async function moveTaskToTrash(taskId) {
    const uid = getCurrentUserUID();
    if (!uid) return;
    try {
        const taskRef = doc(db, "users", uid, "tasks", taskId);
        const taskDoc = await getDoc(taskRef);
        if (taskDoc.exists()) {
            const taskData = taskDoc.data();
            const trashRef = doc(db, "users", uid, "trash", taskId);
            await setDoc(trashRef, { ...taskData, deletedAt: serverTimestamp() });
            await deleteDoc(taskRef);
        }
    } catch (error) { console.error("Erro ao mover tarefa para a lixeira:", error); }
}
export async function restoreTaskFromTrash(taskId) {
    const uid = getCurrentUserUID();
    if (!uid) return;
    try {
        const trashRef = doc(db, "users", uid, "trash", taskId);
        const taskDoc = await getDoc(trashRef);
        if (taskDoc.exists()) {
            const taskData = taskDoc.data();
            delete taskData.deletedAt;
            const taskRef = doc(db, "users", uid, "tasks", taskId);
            await setDoc(taskRef, taskData);
            await deleteDoc(trashRef);
        }
    } catch (error) { console.error("Erro ao restaurar tarefa:", error); }
}
export async function permanentlyDeleteTask(taskId) {
    const uid = getCurrentUserUID();
    if (!uid) return;
    try { const trashRef = doc(db, "users", uid, "trash", taskId); await deleteDoc(trashRef); }
    catch (error) { console.error("Erro ao deletar tarefa permanentemente:", error); }
}
export async function saveSubtasksToFirestore(taskId, subtasks) { await updateTaskInFirestore(taskId, { subtasks: subtasks }); }

// ===============================================
// Listeners e Migração (Exportados)
// ===============================================

export function loadTasksRealTime() {
    const uid = getCurrentUserUID();
    if (!uid) return;
    if (unsubscribeTasks) unsubscribeTasks();

    const tasksRef = collection(db, "users", uid, "tasks");
    const q = query(tasksRef, orderBy("orderIndex", "asc"));

    console.log("Iniciando listener para Tarefas...");
    unsubscribeTasks = onSnapshot(q, (snapshot) => {
        console.log("Snapshot de Tarefas recebido:", snapshot.docs.length, "documentos");
        tasks = [];
        snapshot.forEach((doc) => {
            const task = doc.data();
            task.id = doc.id;
            if (!task.category) task.category = 'geral';
            if (!task.subtasks) task.subtasks = [];
            tasks.push(task);
        });

        // *** ATUALIZADO: Chama funções de UI importadas ***
        renderAllTasks(tasks);
        updateProgress();
        checkAllDueDates();
        applyFilter();
        // syncAllToCalendar(); // Chamada movida para app.js/initCalendar

    }, (error) => { console.error("Erro ao escutar tarefas em tempo real:", error); });
}

export function loadTrash() {
    const uid = getCurrentUserUID();
    if (!uid) return;
    if (unsubscribeTrash) unsubscribeTrash();

    const trashRef = collection(db, "users", uid, "trash");
    const q = query(trashRef, orderBy("deletedAt", "desc"));

    console.log("Iniciando listener para Lixeira...");
    unsubscribeTrash = onSnapshot(q, (snapshot) => {
        console.log("Snapshot da Lixeira recebido:", snapshot.docs.length, "documentos");
        trash = [];
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const batch = writeBatch(db);
        let itemsToDelete = 0;

        snapshot.forEach((doc) => {
            const task = doc.data();
            task.id = doc.id;
            if (task.deletedAt?.toDate && task.deletedAt.toDate() < thirtyDaysAgo) { // Usa optional chaining
                batch.delete(doc.ref);
                itemsToDelete++;
            } else {
                trash.push(task);
            }
        });

        if (itemsToDelete > 0) {
            batch.commit().then(() => {
                console.log(`${itemsToDelete} item(ns) antigo(s) removido(s) da lixeira.`);
                // Não precisa chamar renderTrash aqui, o próximo snapshot fará isso
            }).catch(err => console.error("Erro ao apagar itens antigos da lixeira:", err));
        }

        // *** ATUALIZADO: Chama função de UI importada ***
        renderTrash(trash); // Renderiza o estado atual (sem os itens que serão apagados)

    }, (error) => { console.error("Erro ao escutar lixeira em tempo real:", error); });
}

export async function migrateLocalTasksToFirestore() {
    // <<< CÓDIGO INALTERADO >>>
    const uid = getCurrentUserUID();
    if (!uid) return;
    const localTasks = getLocalTasks();
    if (localTasks.length === 0) { console.log("Nenhuma tarefa local para migrar."); return; }
    console.log(`Encontradas ${localTasks.length} tarefas locais. Iniciando migração...`);
    const tasksRef = collection(db, "users", uid, "tasks");
    let currentOrderIndex = getNewTaskOrderIndex();
    const batch = writeBatch(db);
    localTasks.forEach(task => {
        const { id, ...taskData } = task;
        const newTaskRef = doc(tasksRef);
        batch.set(newTaskRef, { ...taskData, createdAt: serverTimestamp(), orderIndex: currentOrderIndex++ });
    });
    try { await batch.commit(); console.log("Migração concluída com sucesso!"); localStorage.removeItem('tasks'); alert("🎉 Suas tarefas locais foram salvas na nuvem!"); }
    catch (e) { console.error('Erro durante a migração do LocalStorage:', e); alert("Ocorreu um erro ao salvar suas tarefas na nuvem. Por favor, tente novamente."); }
}

// ===============================================
// Funções Abstratas de CRUD (Exportadas)
// ===============================================

export async function addTask(taskData) {
    const uid = getCurrentUserUID();
    if (uid) {
        await addTaskToFirestore(taskData);
        // UI será atualizada pelo listener loadTasksRealTime
    } else {
        const newTask = { ...taskData, id: generateId() };
        tasks.push(newTask);
        saveLocalTasks(tasks);
        // *** ATUALIZADO: Chama funções de UI importadas ***
        renderAllTasks(tasks);
        updateProgress();
    }
}

export async function updateTask(taskId, updatedData) {
    const uid = getCurrentUserUID();
    if (uid) {
        // Resetar notificação se data mudar
        const originalTask = tasks.find(t => t.id === taskId);
         if (originalTask && (originalTask.dueDate !== updatedData.dueDate || originalTask.dueTime !== updatedData.dueTime)) {
            updatedData.deadlineNotified = false;
        }
        await updateTaskInFirestore(taskId, updatedData);
         // UI será atualizada pelo listener loadTasksRealTime
    } else {
        const taskIndex = tasks.findIndex(t => t.id === taskId);
        if (taskIndex > -1) {
            tasks[taskIndex] = { ...tasks[taskIndex], ...updatedData };
            saveLocalTasks(tasks);
            // *** ATUALIZADO: Chama funções de UI importadas ***
            renderAllTasks(tasks);
            updateProgress();
            checkAllDueDates();
        }
    }
}

export async function updateSubtasks(taskId, updatedSubtasks) {
    const uid = getCurrentUserUID();
    const isMainTaskCompleted = checkCompletionStatusRecursively(updatedSubtasks); // Função auxiliar interna

    if (uid) {
        await updateTaskInFirestore(taskId, { // Reutiliza updateTaskInFirestore
            subtasks: updatedSubtasks,
            completed: isMainTaskCompleted
        });
        // UI será atualizada pelo listener loadTasksRealTime
    } else {
         const task = tasks.find(t => t.id === taskId);
         if(task){
            task.subtasks = updatedSubtasks;
            task.completed = isMainTaskCompleted;
            saveLocalTasks(tasks);
            // *** ATUALIZADO: Chama função de UI importada ***
            renderAllTasks(tasks); // Re-renderiza tudo para atualizar status
         }
    }
}

export async function deleteTask(taskId) {
    const uid = getCurrentUserUID();
    if (uid) {
        await moveTaskToTrash(taskId);
        // UI será atualizada pelos listeners loadTasksRealTime e loadTrash
    } else {
        tasks = tasks.filter(t => t.id !== taskId);
        saveLocalTasks(tasks);
        // *** ATUALIZADO: Chama funções de UI importadas ***
        renderAllTasks(tasks);
        updateProgress();
    }
}

// Funções para a lixeira (já exportadas): restoreTaskFromTrash, permanentlyDeleteTask
// A função loadTrash (exportada) já lida com Firestore e chama renderTrash.

export async function saveTaskOrder(orderedIds) {
    // <<< CÓDIGO INALTERADO >>>
    const uid = getCurrentUserUID();
    if (!uid) { console.warn("Salvamento de ordem local não implementado ainda."); return; }
    const batch = writeBatch(db);
    const tasksRef = collection(db, "users", uid, "tasks");
    orderedIds.forEach((taskId, newIndex) => {
        if (tasks.some(t => t.id === taskId)) {
            const taskRef = doc(tasksRef, taskId);
            batch.update(taskRef, { orderIndex: newIndex });
        } else { console.warn(`Tentativa de salvar ordem para tarefa inexistente (ID: ${taskId}). Ignorando.`); }
    });
    try { await batch.commit(); console.log("Ordem das tarefas salva no Firestore."); }
    catch (error) { console.error("🚨 Erro ao salvar a nova ordem:", error); alert("Erro ao salvar a nova ordem. Verifique sua conexão ou regras de segurança."); }
}

// ===============================================
// Limpeza de Listeners (Exportada)
// ===============================================

export function stopTaskListeners() {
    if (unsubscribeTasks) {
        unsubscribeTasks();
        unsubscribeTasks = null;
        console.log("Listener de Tarefas parado.");
    }
    if (unsubscribeTrash) {
        unsubscribeTrash();
        unsubscribeTrash = null;
        console.log("Listener da Lixeira parado.");
    }
    tasks = [];
    trash = [];
    // *** ATUALIZADO: Chama funções de UI importadas para limpar a tela ***
    renderAllTasks([]);
    renderTrash([]);
    updateProgress();
}