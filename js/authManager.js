// js/authManager.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

import {
    loadTasksFromLocalStorage,
    stopTaskListeners 
} from './taskStore.js'; 

import {
    setupCommonEventListeners
} from './eventBinder.js';

import { initializeViewOnLoad } from './app.js'; // <-- Importa initializeViewOnLoad

import { initializeWorkspaces } from './workspaceManager.js';

export let CURRENT_USER_UID = null;
export let USER_SETTINGS = {
    taskSettings: {
        alertLeadTimeMinutes: 60 // Padrão: 1 hora
    }
};

async function loadUserSettings() {
    if (!CURRENT_USER_UID) return;
    try {
        const docRef = doc(db, "users", CURRENT_USER_UID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().taskSettings) {
            const settings = docSnap.data().taskSettings;
            USER_SETTINGS.taskSettings.alertLeadTimeMinutes = settings.alertLeadTimeMinutes || 60;
            console.log("Configurações do usuário carregadas:", USER_SETTINGS); 
        } else {
             console.log("Nenhuma configuração de usuário encontrada, usando padrão.");
             USER_SETTINGS.taskSettings.alertLeadTimeMinutes = 60;
        }
    } catch (error) {
        console.error("Erro ao carregar configurações do usuário:", error);
         USER_SETTINGS.taskSettings.alertLeadTimeMinutes = 60;
    }
}

function initializeAuthenticatedSession() {
    console.log("Sessão autenticada iniciada.");
    loadUserSettings().then(() => { 
        
        // initCalendar(); // <-- REMOVIDO, A CHAMADA É FEITA PELA initializeViewOnLoad()
        
        initializeWorkspaces(CURRENT_USER_UID);
        
        // ADICIONADO: Inicializa a visualização (Lista, Kanban, Calendário)
        initializeViewOnLoad(); 
        
        setupCommonEventListeners();
    });
}

function initializeGuestSession() {
    console.log("Sessão de convidado iniciada.");
    loadTasksFromLocalStorage(); 
    setupCommonEventListeners(); 
}

export function initializeAuth() {
    console.log("Inicializando Auth Listener..."); 
    onAuthStateChanged(auth, (user) => {
        console.log("Auth state changed. User:", user ? user.uid : 'null'); 
        const loginPrompt = document.getElementById('login-prompt');
        const goToLoginBtn = document.getElementById('go-to-login-btn');

        stopTaskListeners();

        if (user) {
            CURRENT_USER_UID = user.uid;
            if(loginPrompt) loginPrompt.style.display = 'none';

            initializeAuthenticatedSession();

        } else {
            CURRENT_USER_UID = null;

            if(loginPrompt) loginPrompt.style.display = 'block';
            if(goToLoginBtn) {
                const newBtn = goToLoginBtn.cloneNode(true);
                goToLoginBtn.parentNode.replaceChild(newBtn, goToLoginBtn);
                newBtn.addEventListener('click', () => {
                    window.location.href = 'login.html';
                });
            }

             initializeGuestSession();
        }
    });
}

export function getCurrentUserUID() { return CURRENT_USER_UID; }
export function getUserSettings() { return JSON.parse(JSON.stringify(USER_SETTINGS)); }