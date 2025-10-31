// js/taskStore.js
import { db } from "./firebase-config.js";
import {
    collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc,
    deleteDoc, serverTimestamp, writeBatch, setDoc, getDoc, getDocs
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

import { getCurrentUserUID, getUserSettings } from './authManager.js';
import { getActiveWorkspaceId } from './workspaceManager.js';
import { generateId } from './utils.js';

// *** CORREÇÃO: REMOVIDAS TODAS AS IMPORTAÇÕES DO uiRenderer.js ***

// --- Estado interno ---
let tasks = [];
let trash = [];
let unsubscribeTasks = null;
let unsubscribeTrash = null;

// ** 2. Adiciona o listener de evento para trocar o workspace **
document.addEventListener('workspaceChanged', (e) => {
    const newWorkspaceId = e.detail.workspaceId;
    if (newWorkspaceId) {
        console.log(`taskStore ouviu 'workspaceChanged': Carregando tarefas para ${newWorkspaceId}`);
        loadTasksRealTime(newWorkspaceId);
        loadTrash(newWorkspaceId);
        migrateLocalTasksToFirestore();
    }
});


// --- Getters para o estado ---
export function getTasks() { return [...tasks]; }
export function getTrash() { return [...trash]; }

// --- Funções Auxiliares Internas ---
function updateNestedSubtasks(subtasks, targetId, callbackFn) {
    if (!subtasks) return [];
    return subtasks.map(subtask => {
        if (subtask.id === targetId) { return callbackFn(subtask); }
        if (subtask.subtasks?.length > 0) {
            subtask.subtasks = updateNestedSubtasks(subtask.subtasks, targetId, callbackFn);
        }
        return subtask;
    });
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


// --- Funções de Armazenamento Local ---
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
}
export function loadTasksFromLocalStorage() {
    tasks = getLocalTasks();
    // *** CORREÇÃO: Dispara evento em vez de renderizar ***
    document.dispatchEvent(new CustomEvent('tasksUpdated'));
}


// ===============================================
// Funções de Operação do Firestore (CRUD)
// ===============================================

export async function addTaskToFirestore(task) {
    const uid = getCurrentUserUID();
    const workspaceId = getActiveWorkspaceId(); 
    if (!uid || !workspaceId) {
        console.error("Não é possível adicionar tarefa: UID ou WorkspaceId em falta.");
        return;
    }
    
    try {
        const tasksRef = collection(db, "workspaces", workspaceId, "tasks"); 
        const newOrderIndex = getNewTaskOrderIndex();
        
        const taskData = { 
            ...task, 
            authorId: uid, 
            createdAt: serverTimestamp(), 
            orderIndex: newOrderIndex, 
            subtasks: task.subtasks || [] 
        };
        
        await addDoc(tasksRef, taskData);
        console.log("✅ Tarefa adicionada com sucesso ao Firestore!");
    } catch (error) { console.error("🚨 Erro ao adicionar tarefa:", error); alert(`🚨 ERRO CRÍTICO AO SALVAR TAREFA. Motivo: ${error.message}.`); }
}

export async function updateTaskInFirestore(taskId, data) {
    const workspaceId = getActiveWorkspaceId(); 
    if (!workspaceId) return;
    try { 
        const taskRef = doc(db, "workspaces", workspaceId, "tasks", taskId); 
        await updateDoc(taskRef, data); 
    }
    catch (error) { console.error("Erro ao atualizar tarefa:", error); }
}

export async function moveTaskToTrash(taskId) {
    const uid = getCurrentUserUID();
    const workspaceId = getActiveWorkspaceId(); 
    if (!uid || !workspaceId) return;
    
    try {
        const taskRef = doc(db, "workspaces", workspaceId, "tasks", taskId);
        const taskDoc = await getDoc(taskRef);
        
        if (taskDoc.exists()) {
            const taskData = taskDoc.data();
            const trashRef = doc(db, "workspaces", workspaceId, "trash", taskId);
            await setDoc(trashRef, { 
                ...taskData, 
                deletedAt: serverTimestamp(), 
                originalAuthorId: taskData.authorId || uid 
            });
            await deleteDoc(taskRef);
        }
    } catch (error) { console.error("Erro ao mover tarefa para a lixeira:", error); }
}

export async function restoreTaskFromTrash(taskId) {
    const workspaceId = getActiveWorkspaceId(); 
    if (!workspaceId) return;
    
    try {
        const trashRef = doc(db, "workspaces", workspaceId, "trash", taskId);
        const taskDoc = await getDoc(trashRef);
        
        if (taskDoc.exists()) {
            const taskData = taskDoc.data();
            delete taskData.deletedAt;
            const taskRef = doc(db, "workspaces", workspaceId, "tasks", taskId);
            await setDoc(taskRef, taskData); 
            await deleteDoc(trashRef);
        }
    } catch (error) { console.error("Erro ao restaurar tarefa:", error); }
}

export async function permanentlyDeleteTask(taskId) {
    const workspaceId = getActiveWorkspaceId(); 
    if (!workspaceId) return;
    try { 
        const trashRef = doc(db, "workspaces", workspaceId, "trash", taskId); 
        await deleteDoc(trashRef); 
    }
    catch (error) { console.error("Erro ao deletar tarefa permanentemente:", error); }
}

export async function saveSubtasksToFirestore(taskId, subtasks) { 
    await updateTaskInFirestore(taskId, { subtasks: subtasks }); 
}

// ===============================================
// Listeners e Migração
// ===============================================

export function loadTasksRealTime(workspaceId) { 
    if (!workspaceId) {
        console.warn("loadTasksRealTime chamado sem workspaceId. A aguardar evento...");
        return;
    }
    if (unsubscribeTasks) unsubscribeTasks();

    const tasksRef = collection(db, "workspaces", workspaceId, "tasks");
    const q = query(tasksRef, orderBy("orderIndex", "asc"));

    console.log(`Iniciando listener para Tarefas em ${workspaceId}`);
    unsubscribeTasks = onSnapshot(q, (snapshot) => {
        console.log(`Snapshot de Tarefas recebido de ${workspaceId}:`, snapshot.docs.length, "documentos");
        
        tasks = [];
        snapshot.forEach((doc) => {
            const task = doc.data();
            task.id = doc.id;
            if (!task.category) task.category = 'geral';
            if (!task.subtasks) task.subtasks = [];
            tasks.push(task);
        });

        // *** CORREÇÃO: Dispara evento em vez de renderizar ***
        document.dispatchEvent(new CustomEvent('tasksUpdated'));
        // (Renderização e outras chamadas foram movidas para uiRenderer)

    }, (error) => { console.error(`Erro ao escutar tarefas em ${workspaceId}:`, error); });
}

export function loadTrash(workspaceId) { 
    if (!workspaceId) return;
    if (unsubscribeTrash) unsubscribeTrash();

    const trashRef = collection(db, "workspaces", workspaceId, "trash");
    const q = query(trashRef, orderBy("deletedAt", "desc"));

    console.log(`Iniciando listener para Lixeira em ${workspaceId}`);
    unsubscribeTrash = onSnapshot(q, (snapshot) => {
        
        trash = [];
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const batch = writeBatch(db);
        let itemsToDelete = 0;

        snapshot.forEach((doc) => {
            const task = doc.data();
            task.id = doc.id;
            if (task.deletedAt?.toDate && task.deletedAt.toDate() < thirtyDaysAgo) {
                batch.delete(doc.ref);
                itemsToDelete++;
            } else {
                trash.push(task);
            }
        });

        if (itemsToDelete > 0) {
            batch.commit().then(() => {
                console.log(`${itemsToDelete} item(ns) antigo(s) removido(s) da lixeira de ${workspaceId}.`);
            }).catch(err => console.error("Erro ao apagar itens antigos da lixeira:", err));
        }
        
        // *** CORREÇÃO: Dispara evento em vez de renderizar ***
        document.dispatchEvent(new CustomEvent('trashUpdated'));

    }, (error) => { console.error(`Erro ao escutar lixeira em ${workspaceId}:`, error); });
}

export async function migrateLocalTasksToFirestore() {
    const uid = getCurrentUserUID();
    const workspaceId = getActiveWorkspaceId(); 
    if (!uid || !workspaceId) { return; }
    
    const localTasks = getLocalTasks();
    if (localTasks.length === 0) { return; }
    console.log(`Encontradas ${localTasks.length} tarefas locais. Migrando para ${workspaceId}...`);
    
    const tasksRef = collection(db, "workspaces", workspaceId, "tasks");
    let currentOrderIndex = getNewTaskOrderIndex(); 
    const batch = writeBatch(db);
    
    localTasks.forEach(task => {
        const { id, ...taskData } = task; 
        const newTaskRef = doc(tasksRef); 
        batch.set(newTaskRef, { 
            ...taskData, 
            authorId: uid, 
            createdAt: serverTimestamp(), 
            orderIndex: currentOrderIndex++ 
        });
    });
    
    try { 
        await batch.commit(); 
        console.log("Migração de localStorage concluída!"); 
        localStorage.removeItem('tasks'); 
        alert("🎉 Suas tarefas locais salvas no dispositivo foram movidas para o seu workspace na nuvem!"); 
    }
    catch (e) { console.error('Erro durante a migração do LocalStorage:', e); alert("Ocorreu um erro ao salvar suas tarefas na nuvem. Por favor, tente novamente."); }
}


// ===============================================
// Funções Abstratas de CRUD (MODIFICADAS PARA DISPARAR EVENTOS)
// ===============================================

export async function addTask(taskData) {
    const uid = getCurrentUserUID();
    if (uid && getActiveWorkspaceId()) { 
        await addTaskToFirestore(taskData);
    } else if (!uid) { // Modo Convidado (local)
        const newTask = { ...taskData, id: generateId() };
        tasks.push(newTask);
        saveLocalTasks(tasks);
        // *** CORREÇÃO: Dispara evento em vez de renderizar ***
        document.dispatchEvent(new CustomEvent('tasksUpdated'));
    }
}

export async function updateTask(taskId, updatedData) {
    const uid = getCurrentUserUID();
    if (uid && getActiveWorkspaceId()) {
        const originalTask = tasks.find(t => t.id === taskId);
         if (originalTask && (originalTask.dueDate !== updatedData.dueDate || originalTask.dueTime !== updatedData.dueTime)) {
            updatedData.deadlineNotified = false;
        }
        await updateTaskInFirestore(taskId, updatedData);
    } else if (!uid) { // Modo Convidado
        const taskIndex = tasks.findIndex(t => t.id === taskId);
        if (taskIndex > -1) {
            tasks[taskIndex] = { ...tasks[taskIndex], ...updatedData };
            saveLocalTasks(tasks);
            // *** CORREÇÃO: Dispara evento em vez de renderizar ***
            document.dispatchEvent(new CustomEvent('tasksUpdated'));
        }
    }
}

export async function updateSubtasks(taskId, updatedSubtasks) {
    const uid = getCurrentUserUID();
    const isMainTaskCompleted = checkCompletionStatusRecursively(updatedSubtasks);

    if (uid && getActiveWorkspaceId()) {
        await updateTaskInFirestore(taskId, { 
            subtasks: updatedSubtasks,
            completed: isMainTaskCompleted
        });
    } else if (!uid) { // Modo Convidado
         const task = tasks.find(t => t.id === taskId);
         if(task){
            task.subtasks = updatedSubtasks;
            task.completed = isMainTaskCompleted;
            saveLocalTasks(tasks);
            // *** CORREÇÃO: Dispara evento em vez de renderizar ***
            document.dispatchEvent(new CustomEvent('tasksUpdated'));
         }
    }
}

export async function deleteTask(taskId) {
    const uid = getCurrentUserUID();
    if (uid && getActiveWorkspaceId()) {
        await moveTaskToTrash(taskId);
    } else if (!uid) { // Modo Convidado
        tasks = tasks.filter(t => t.id !== taskId);
        saveLocalTasks(tasks);
        // *** CORREÇÃO: Dispara evento em vez de renderizar ***
        document.dispatchEvent(new CustomEvent('tasksUpdated'));
    }
}

export async function saveTaskOrder(orderedIds) {
    const uid = getCurrentUserUID();
    const workspaceId = getActiveWorkspaceId(); 
    
    if (!uid) {
        console.warn("Salvamento de ordem local não implementado ainda."); 
        return;
    }
    
    if (!workspaceId) {
        console.error("Utilizador logado mas sem workspace ativo. Não é possível salvar a ordem.");
        return; 
    }
    
    const batch = writeBatch(db);
    const tasksRef = collection(db, "workspaces", workspaceId, "tasks");
    
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
    // *** CORREÇÃO: Dispara evento em vez de renderizar ***
    document.dispatchEvent(new CustomEvent('tasksUpdated'));
    document.dispatchEvent(new CustomEvent('trashUpdated'));
}