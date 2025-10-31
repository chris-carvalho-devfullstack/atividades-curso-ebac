// js/workspaceManager.js
import { db, auth } from "./firebase-config.js";
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    setDoc, 
    addDoc, 
    serverTimestamp,
    writeBatch,
    onSnapshot,
    limit,
    getDoc,
    orderBy
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// --- Variáveis de Estado ---
let currentUserId = null;
let activeWorkspaceId = null;
let unsubscribeWorkspaces = null; // Listener para a lista de workspaces

// --- Elementos da UI ---
const workspaceListContainer = document.getElementById('workspace-list-container');
const workspaceTitle = document.getElementById('workspace-title');
const createWorkspaceBtn = document.getElementById('create-workspace-btn');

/**
 * Inicializa os listeners e a lógica dos workspaces quando o utilizador faz login.
 * Esta função deve ser chamada pelo 'authManager.js' após o login.
 */
export async function initializeWorkspaces(uid) {
    if (!uid) return;
    currentUserId = uid;

    // Para o listener antigo se ele existir
    if (unsubscribeWorkspaces) unsubscribeWorkspaces();

    // 1. Ouve a lista de workspaces do utilizador em tempo real
    listenForWorkspaces(uid);

    // 2. Verifica se o utilizador tem *pelo menos um* workspace
    const workspacesRef = collection(db, "workspaces");
    const q = query(workspacesRef, where("members", "array-contains", uid), limit(1));
    
    try {
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            // 2a. Utilizador NOVO ou ANTIGO sem workspace. Cria o workspace pessoal padrão.
            console.log("Nenhum workspace encontrado. Criando workspace pessoal padrão...");
            const newWorkspaceId = await createPersonalWorkspace(uid);
            
            // Após criar, migra as tarefas antigas (se existirem) para este novo workspace
            await migrateOldTasks(uid, newWorkspaceId);
            setActiveWorkspace(newWorkspaceId); // Define o novo como ativo
        } else {
            // 2b. Utilizador existente. Apenas carrega o último workspace ativo ou o primeiro da lista.
            const lastActiveId = sessionStorage.getItem('activeWorkspaceId');
            
            // Valida se o 'lastActiveId' ainda é um workspace do qual o utilizador é membro
            let isValid = false;
            if (lastActiveId) {
                const lastActiveDoc = await getDoc(doc(db, "workspaces", lastActiveId));
                if (lastActiveDoc.exists() && lastActiveDoc.data().members.includes(uid)) {
                    isValid = true;
                }
            }

            if (isValid) {
                setActiveWorkspace(lastActiveId);
            } else {
                // Se não for válido, pega o primeiro da lista que acabou de ser carregada
                setActiveWorkspace(snapshot.docs[0].id);
            }
        }
    } catch (error) {
        console.error("Erro ao inicializar workspaces (verifique as regras do Firestore):", error);
        if (workspaceListContainer) workspaceListContainer.innerHTML = '<div class="sidebar-loading" style="color: red;">Erro de permissão.</div>';
    }


    // Configura o botão de criar novo workspace
    if (createWorkspaceBtn) {
        createWorkspaceBtn.onclick = () => createNewWorkspace(uid);
    }
}

/**
 * Escuta a coleção /workspaces para atualizar o menu lateral em tempo real.
 */
function listenForWorkspaces(uid) {
    const q = query(collection(db, "workspaces"), where("members", "array-contains", uid), orderBy("createdAt", "asc"));
    
    unsubscribeWorkspaces = onSnapshot(q, (snapshot) => {
        if (!workspaceListContainer) return;
        workspaceListContainer.innerHTML = ''; // Limpa a lista
        
        if (snapshot.empty) {
            workspaceListContainer.innerHTML = '<div class="sidebar-loading">Nenhum workspace.</div>';
            return;
        }
        
        snapshot.forEach(doc => {
            const workspace = doc.data();
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = "#";
            a.dataset.id = doc.id;
            // Define o ícone com base no nome (simples)
            a.innerHTML = `<i class="fa-solid ${workspace.name.toLowerCase().includes("pessoal") ? 'fa-user' : 'fa-briefcase'}"></i> <span>${workspace.name}</span>`;
            
            if (doc.id === activeWorkspaceId) {
                a.classList.add('active');
            }
            
            a.onclick = (e) => {
                e.preventDefault();
                setActiveWorkspace(doc.id);
            };
            
            li.appendChild(a);
            workspaceListContainer.appendChild(li);
        });

    }, (error) => {
        console.error("Erro ao carregar lista de workspaces: ", error);
        workspaceListContainer.innerHTML = '<div class="sidebar-loading" style="color: red;">Erro ao carregar.</div>';
    });
}

/**
 * Define qual workspace está ativo, salva no sessionStorage e atualiza a UI.
 */
function setActiveWorkspace(workspaceId) {
    if (!workspaceId) return;
    
    activeWorkspaceId = workspaceId;
    sessionStorage.setItem('activeWorkspaceId', workspaceId);
    
    // Atualiza o título
    if (workspaceTitle) {
        getDoc(doc(db, "workspaces", workspaceId)).then(doc => {
            if (doc.exists()) {
                workspaceTitle.textContent = doc.data().name;
            }
        });
    }

    // Atualiza a classe 'active' no menu lateral
    document.querySelectorAll('.workspace-list li a').forEach(a => {
        a.classList.toggle('active', a.dataset.id === workspaceId);
    });

    // **DISPARA O EVENTO QUE O taskStore.js VAI OUVIR**
    // Isto informa outras partes da app (como o taskStore) que o workspace mudou.
    console.log(`Disparando evento: workspaceChanged (ID: ${workspaceId})`);
    document.dispatchEvent(new CustomEvent('workspaceChanged', { detail: { workspaceId } }));
}

/**
 * Retorna o ID do workspace ativo atualmente.
 * Outros módulos (como o taskStore) usarão isto.
 */
export function getActiveWorkspaceId() {
    return activeWorkspaceId || sessionStorage.getItem('activeWorkspaceId');
}

/**
 * Cria o workspace pessoal padrão para um novo utilizador.
 */
async function createPersonalWorkspace(uid) {
    const userDoc = await getDoc(doc(db, "users", uid));
    const username = userDoc.exists() ? userDoc.data().fullname || "Utilizador" : "Utilizador";
    
    const workspaceData = {
        name: `Workspace Pessoal (${username})`,
        createdAt: serverTimestamp(),
        members: [uid], // Utilizador é o único membro
        admins: [uid]   // Utilizador é o único admin
    };
    
    const docRef = await addDoc(collection(db, "workspaces"), workspaceData);
    return docRef.id;
}

/**
 * Cria um novo workspace de equipa (solicitado pelo utilizador).
 */
async function createNewWorkspace(uid) {
    const workspaceName = prompt("Qual o nome do novo Workspace? (Ex: Projeto Faculdade)");
    if (!workspaceName || workspaceName.trim().length === 0) return;

    try {
        const workspaceData = {
            name: workspaceName,
            createdAt: serverTimestamp(),
            members: [uid], // Você é o primeiro membro
            admins: [uid]   // Você é o primeiro admin
        };
        const docRef = await addDoc(collection(db, "workspaces"), workspaceData);
        
        // Torna o workspace recém-criado ativo
        setActiveWorkspace(docRef.id);
        
    } catch (error) {
        console.error("Erro ao criar novo workspace:", error);
        alert("Não foi possível criar o workspace.");
    }
}

/**
 * Migra tarefas da estrutura antiga (/users/{uid}/tasks) para a nova (/workspaces/{wsId}/tasks).
 * Esta é uma função de execução única para utilizadores antigos.
 */
async function migrateOldTasks(uid, personalWorkspaceId) {
    // 1. Migra Tarefas
    const oldTasksRef = collection(db, "users", uid, "tasks");
    const oldTasksSnapshot = await getDocs(oldTasksRef);

    if (!oldTasksSnapshot.empty) {
        console.log(`Migrando ${oldTasksSnapshot.size} tarefas antigas para o workspace ${personalWorkspaceId}...`);
        const newTasksRef = collection(db, "workspaces", personalWorkspaceId, "tasks");
        const batch = writeBatch(db);

        oldTasksSnapshot.forEach(oldTaskDoc => {
            const taskData = oldTaskDoc.data();
            taskData.authorId = uid; // Adiciona o authorId para as regras de segurança
            
            const newDocRef = doc(newTasksRef, oldTaskDoc.id); // Mantém o ID antigo!
            batch.set(newDocRef, taskData);
            batch.delete(oldTaskDoc.ref); // Apaga a tarefa antiga
        });

        try {
            await batch.commit();
            console.log("Migração de tarefas concluída com sucesso!");
        } catch (error) {
            console.error("Erro CRÍTICO durante a migração de tarefas:", error);
        }
    } else {
        console.log("Nenhuma tarefa antiga (em /users) para migrar.");
    }

    // 2. Migra Lixeira (Trash)
    const oldTrashRef = collection(db, "users", uid, "trash");
    const oldTrashSnapshot = await getDocs(oldTrashRef);

    if (!oldTrashSnapshot.empty) {
        console.log(`Migrando ${oldTrashSnapshot.size} itens da lixeira antiga...`);
        const newTrashRef = collection(db, "workspaces", personalWorkspaceId, "trash");
        const trashBatch = writeBatch(db);

        oldTrashSnapshot.forEach(oldTrashDoc => {
            const trashData = oldTrashDoc.data();
            const newDocRef = doc(newTrashRef, oldTrashDoc.id); // Mantém o ID antigo
            trashBatch.set(newDocRef, trashData);
            trashBatch.delete(oldTrashDoc.ref); // Apaga o item antigo
        });
        
        try {
            await trashBatch.commit();
            console.log("Migração da lixeira concluída com sucesso!");
        } catch (error) {
            console.error("Erro CRÍTICO durante a migração da lixeira:", error);
        }
    } else {
        console.log("Nenhuma tarefa antiga (em /trash) para migrar.");
    }
}