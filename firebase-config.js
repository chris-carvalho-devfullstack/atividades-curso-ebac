// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

// =================================================================
// CONFIGURAÇÃO DO FIREBASE
// =================================================================
const firebaseConfig = {
  apiKey: "AIzaSyBsfGTZ1yypzWE4R_thDARSh61Osc6OUbU",
  authDomain: "gerenciador-tarefas-fd5be.firebaseapp.com",
  projectId: "gerenciador-tarefas-fd5be",
  storageBucket: "gerenciador-tarefas-fd5be.appspot.com",
  messagingSenderId: "831715035671",
  appId: "1:831715035671:web:2836e1701f80fc6f602a52"
};
// =================================================================

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Instâncias
export const auth = getAuth(app);
// Aponte para o banco de dados específico pelo nome dele
export const db = getFirestore(app, "banco-de-dados-gerenciador-de-tarefas"); // <-- MUDANÇA AQUI
export const storage = getStorage(app);
export const provider = new GoogleAuthProvider();

// -----------------------------
// Funções de login e logout
// -----------------------------
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

// -----------------------------
// Teste rápido do Firestore
// -----------------------------
export async function testarFirestore() {
  try {
    const snapshot = await getDocs(collection(db, "test")); // Tenta ler uma coleção "test" do seu novo banco
    console.log("Firestore conectado! Documentos:", snapshot.docs.length);
  } catch (error) {
    console.error("Erro ao conectar ao Firestore:", error);
  }
}

// Chamada de teste
testarFirestore();