// firebase-config.js (VERSÃO FINAL COM TODAS AS CORREÇÕES)

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { getStorage, connectStorageEmulator } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBsfGTZ1yypzWE4R_thDARSh61Osc6OUbU",
  authDomain: "gerenciador-tarefas-fd5be.firebaseapp.com",
  projectId: "gerenciador-tarefas-fd5be",
  storageBucket: "gerenciador-tarefas-fd5be.firebasestorage.app",
  messagingSenderId: "831715035671",
  appId: "1:831715035671:web:2836e1701f80fc6f602a52"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const provider = new GoogleAuthProvider();

// Conecta aos emuladores se estiver em ambiente de desenvolvimento.
if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
  console.log("Ambiente local detectado. Conectando aos emuladores...");
  try {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableCors: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectStorageEmulator(storage, '127.0.0.1', 9199);
    console.log("Conexão com os emuladores configurada com sucesso.");
  } catch (e) {
    console.error("Erro ao conectar com os emuladores:", e);
  }
}

// Funções de login e logout
export async function loginGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    console.log("Usuário logado:", result.user.displayName, result.user.email);
    return result.user;
  } catch (error) {
    console.error("Erro ao fazer login com Google:", error.code, error.message);
  }
}

export async function logout() {
  try {
    await signOut(auth);
    console.log("Usuário deslogado com sucesso!");
  } catch (error) {
    console.error("Erro ao deslogar:", error);
  }
}