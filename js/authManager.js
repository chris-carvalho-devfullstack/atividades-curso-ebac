// js/authManager.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// Importe as funções que serão chamadas DENTRO de initializeAuthenticatedSession/initializeGuestSession
// Por enquanto, vamos importá-las do app.js (resolveremos isso depois)
import {
    initCalendar,
    migrateLocalTasksToFirestore,
    loadTasksRealTime,
    loadTrash,
    setupCommonEventListeners,
    loadTasksFromLocalStorage
} from './app.js'; // <-- Importando temporariamente do app.js

// ===============================================
// Variáveis Globais (Exportadas)
// ===============================================

export let CURRENT_USER_UID = null; // <<< ADICIONADO EXPORTante
export let USER_SETTINGS = { // <<< ADICIONADO EXPORT
    taskSettings: {
        alertLeadTimeMinutes: 60 // Padrão: 1 hora
    }
};

// ===============================================
// Funções Internas do Módulo
// ===============================================

async function loadUserSettings() {
    // <<< CÓDIGO INALTERADO >>>
    if (!CURRENT_USER_UID) return;
    try {
        const docRef = doc(db, "users", CURRENT_USER_UID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().taskSettings) {
            const settings = docSnap.data().taskSettings;
            // Atualiza a variável exportada diretamente
            USER_SETTINGS.taskSettings.alertLeadTimeMinutes = settings.alertLeadTimeMinutes || 60;
        }
    } catch (error) {
        console.error("Erro ao carregar configurações do usuário:", error);
    }
}

function initializeAuthenticatedSession() {
    // <<< CÓDIGO INALTERADO >>>
    console.log("Sessão autenticada iniciada.");
    loadUserSettings();
    initCalendar();
    migrateLocalTasksToFirestore();
    loadTasksRealTime();
    loadTrash();
    setupCommonEventListeners();
}

function initializeGuestSession() {
    // <<< CÓDIGO INALTERADO >>>
    console.log("Sessão de convidado iniciada.");
    loadTasksFromLocalStorage();
    setupCommonEventListeners();
}

// ===============================================
// Função Principal de Inicialização (Exportada)
// ===============================================
export function initializeAuth() { // <<< ENVOLVIDO EM UMA FUNÇÃO EXPORTADA
    onAuthStateChanged(auth, (user) => {
        const loginPrompt = document.getElementById('login-prompt');
        const goToLoginBtn = document.getElementById('go-to-login-btn');

        if (user) {
            // Usuário está LOGADO
            CURRENT_USER_UID = user.uid; // Atualiza a variável exportada
            if(loginPrompt) loginPrompt.style.display = 'none';

            $(document).ready(function() {
                initializeAuthenticatedSession();
            });

        } else {
            // Usuário está DESLOGADO
            CURRENT_USER_UID = null; // Atualiza a variável exportada
            if(loginPrompt) loginPrompt.style.display = 'block';
            if(goToLoginBtn) {
                goToLoginBtn.addEventListener('click', () => {
                    window.location.href = 'login.html';
                });
            }

            $(document).ready(function() {
                initializeGuestSession();
            });
        }
    });
}

// ===============================================
// Funções Getter (Exportadas - Opcional)
// ===============================================
export function getCurrentUserUID() {
    return CURRENT_USER_UID;
}

export function getUserSettings() {
    return USER_SETTINGS;
}