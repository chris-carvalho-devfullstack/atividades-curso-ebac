// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

// =================================================================
// COLE AQUI A CONFIGURAÇÃO DO SEU NOVO PROJETO FIREBASE
// =================================================================
const firebaseConfig = {
  apiKey: "AIzaSyBsfGTZ1yypzWE4R_thDARSh61Osc6OUbU",
  authDomain: "gerenciador-tarefas-fd5be.firebaseapp.com",
  projectId: "gerenciador-tarefas-fd5be",
  storageBucket: "gerenciador-tarefas-fd5be.firebasestorage.app",
  messagingSenderId: "831715035671",
  appId: "1:831715035671:web:2836e1701f80fc6f602a52"
};
// =================================================================

// !! LINHA DE VERIFICAÇÃO !!
// Esta linha vai imprimir o ID do projeto no console do navegador.
console.log("Firebase config carregada. Projeto ID:", firebaseConfig.projectId);
// !! FIM DA LINHA DE VERIFICAÇÃO !!

// Inicializa os serviços do Firebase
const app = initializeApp(firebaseConfig);

// Exporta as instâncias dos serviços para serem usadas em outros arquivos
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// ... (resto do seu código)

export const storage = getStorage(app);

// Forçando atualização no deploy - 13/10/2025