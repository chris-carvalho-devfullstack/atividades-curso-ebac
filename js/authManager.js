// js/authManager.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// --- ATUALIZADO: Importações do taskStore.js ---
import {
    // migrateLocalTasksToFirestore, // <-- REMOVIDO DAQUI
    // loadTasksRealTime,           // <-- REMOVIDO DAQUI
    // loadTrash,                   // <-- REMOVIDO DAQUI
    loadTasksFromLocalStorage,
    stopTaskListeners 
} from './taskStore.js'; 

// --- Mantém importações do eventBinder.js ---
import {
    setupCommonEventListeners
} from './eventBinder.js';

import { initCalendar, initializeViewOnLoad } from './app.js'; // <-- ADICIONADO initializeViewOnLoad

// --- ADICIONA A IMPORTAÇÃO DO NOVO WORKSPACE MANAGER ---
import { initializeWorkspaces } from './workspaceManager.js';

// ===============================================
// Variáveis Globais (Exportadas)
// ===============================================

export let CURRENT_USER_UID = null;
export let USER_SETTINGS = {
    taskSettings: {
        alertLeadTimeMinutes: 60 // Padrão: 1 hora
    }
};

// ===============================================
// Funções Internas do Módulo
// ===============================================

async function loadUserSettings() {
    if (!CURRENT_USER_UID) return;
    try {
        const docRef = doc(db, "users", CURRENT_USER_UID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().taskSettings) {
            const settings = docSnap.data().taskSettings;
            // Atualiza a variável exportada diretamente
            USER_SETTINGS.taskSettings.alertLeadTimeMinutes = settings.alertLeadTimeMinutes || 60;
            console.log("Configurações do usuário carregadas:", USER_SETTINGS); // Log adicional
        } else {
             console.log("Nenhuma configuração de usuário encontrada, usando padrão.");
             // Garante que o padrão seja aplicado se não houver dados salvos
             USER_SETTINGS.taskSettings.alertLeadTimeMinutes = 60;
        }
    } catch (error) {
        console.error("Erro ao carregar configurações do usuário:", error);
         // Mantém o padrão em caso de erro
         USER_SETTINGS.taskSettings.alertLeadTimeMinutes = 60;
    }
}

function initializeAuthenticatedSession() {
    console.log("Sessão autenticada iniciada.");
    loadUserSettings().then(() => { 
        initCalendar(); // <- Vem do app.js (ainda)
        
        // ** MODIFICADO: OS LISTENERS SÃO INICIADOS PELO WORKSPACE MANAGER **
        // loadTasksRealTime(); // <-- REMOVIDO
        // loadTrash();       // <-- REMOVIDO

        // ** ADICIONADO: O WorkspaceManager agora inicializa a lógica de dados **
        // Ele vai tratar a migração de tarefas antigas E a migração local
        initializeWorkspaces(CURRENT_USER_UID);
        
        setupCommonEventListeners(); // <- Vem do eventBinder.js
    });
}

function initializeGuestSession() {
    console.log("Sessão de convidado iniciada.");
    loadTasksFromLocalStorage(); // <- Vem do taskStore.js
    setupCommonEventListeners(); // <- Vem do eventBinder.js AGORA
}

// ===============================================
// Função Principal de Inicialização (Exportada)
// ===============================================
export function initializeAuth() {
    console.log("Inicializando Auth Listener..."); // Log de inicialização
    onAuthStateChanged(auth, (user) => {
        console.log("Auth state changed. User:", user ? user.uid : 'null'); // Log de mudança de estado
        const loginPrompt = document.getElementById('login-prompt');
        const goToLoginBtn = document.getElementById('go-to-login-btn');

        // Limpa listeners antigos de tarefas para evitar duplicação ou erros ao logar/deslogar
        stopTaskListeners();

        if (user) {
            // Usuário está LOGADO
            CURRENT_USER_UID = user.uid;
            if(loginPrompt) loginPrompt.style.display = 'none';

            // *** CORREÇÃO: Chama diretamente, sem $(document).ready() ***
            initializeAuthenticatedSession();

        } else {
            // Usuário está DESLOGADO
            CURRENT_USER_UID = null;
            // stopTaskListeners já foi chamado acima

            if(loginPrompt) loginPrompt.style.display = 'block';
            if(goToLoginBtn) {
                // Remove listener antigo para evitar duplicação se logar/deslogar várias vezes
                const newBtn = goToLoginBtn.cloneNode(true);
                goToLoginBtn.parentNode.replaceChild(newBtn, goToLoginBtn);
                newBtn.addEventListener('click', () => {
                    window.location.href = 'login.html';
                });
            }

            // *** CORREÇÃO: Chama diretamente, sem $(document).ready() ***
             initializeGuestSession();
        }
    });
}

// ===============================================
// Funções Getter (Exportadas)
// ===============================================
export function getCurrentUserUID() {
    return CURRENT_USER_UID;
}

export function getUserSettings() {
    // Retorna uma cópia profunda para evitar mutações acidentais
    return JSON.parse(JSON.stringify(USER_SETTINGS));
}