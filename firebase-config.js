// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

// =================================================================
// CONFIGURAÇÃO DO SEU PROJETO FIREBASE (copiada do console)
// =================================================================
const firebaseConfig = {
  apiKey: "AIzaSyBsfGTZ1yypzWE4R_thDARSh61Osc6OUbU",
  authDomain: "gerenciador-tarefas-fd5be.firebaseapp.com",
  projectId: "gerenciador-tarefas-fd5be",
  storageBucket: "gerenciador-tarefas-fd5be.firebasestorage.app", // 👈 mantenha esse novo domínio
  messagingSenderId: "831715035671",
  appId: "1:831715035671:web:2836e1701f80fc6f602a52"
};
// =================================================================

// !! LINHA DE VERIFICAÇÃO !!
console.log("Firebase config carregada. Projeto ID:", firebaseConfig.projectId);
// !! FIM DA LINHA DE VERIFICAÇÃO !!

// Inicializa os serviços do Firebase
const app = initializeApp(firebaseConfig);

// Exporta as instâncias dos serviços para serem usadas em outros arquivos
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

async function testarFirestore() {
  try {
    const snapshot = await getDocs(collection(db, "test"));
    console.log("Firestore conectado! Documentos:", snapshot.docs.length);
  } catch (error) {
    console.error("Erro ao conectar ao Firestore:", error);
  }
}

testarFirestore();

