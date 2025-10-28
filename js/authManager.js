// js/authManager.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// --- ATUALIZADO: Importa funções do taskStore.js ---
import {
    migrateLocalTasksToFirestore,
    loadTasksRealTime,
    loadTrash,
    loadTasksFromLocalStorage,
    stopTaskListeners // <- Importa a função de limpeza
} from './taskStore.js'; // <<< Importa do taskStore.js

// --- Mantém importações do app.js que ainda não foram movidas ---
import {
    initCalendar,
    setupCommonEventListeners
} from './eventBinder.js'; // <<< Mantém apenas estas por enquanto

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
    loadUserSettings().then(() => { // Garante que settings carreguem antes
        initCalendar(); // <- Vem do app.js (ainda)
        migrateLocalTasksToFirestore(); // <- Vem do taskStore.js
        loadTasksRealTime(); // <- Vem do taskStore.js
        loadTrash(); // <- Vem do taskStore.js
        setupCommonEventListeners(); // <- Vem do app.js (ainda)
    });
}

function initializeGuestSession() {
    console.log("Sessão de convidado iniciada.");
    loadTasksFromLocalStorage(); // <- Vem do taskStore.js
    setupCommonEventListeners(); // <- Vem do app.js (ainda)
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

        if (user) {
            // Usuário está LOGADO
            CURRENT_USER_UID = user.uid;
            if(loginPrompt) loginPrompt.style.display = 'none';

            // Usar $(document).ready pode ser redundante com módulos ES6,
            // mas mantemos se houver dependência específica do jQuery UI ou similar.
            $(document).ready(function() {
                initializeAuthenticatedSession();
            });

        } else {
            // Usuário está DESLOGADO
            CURRENT_USER_UID = null;
            stopTaskListeners(); // <<< CHAMA A FUNÇÃO DE LIMPEZA DO taskStore

            if(loginPrompt) loginPrompt.style.display = 'block';
            if(goToLoginBtn) {
                // Remove listener antigo para evitar duplicação se logar/deslogar várias vezes
                const newBtn = goToLoginBtn.cloneNode(true);
                goToLoginBtn.parentNode.replaceChild(newBtn, goToLoginBtn);
                newBtn.addEventListener('click', () => {
                    window.location.href = 'login.html';
                });
            }

            // $(document).ready pode ser redundante aqui também
            $(document).ready(function() {
                 initializeGuestSession();
            });
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