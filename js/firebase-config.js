// firebase-config.js (VERSÃO FINAL COM TODAS AS CORREÇÕES E OPÇÃO DE EMULADOR)

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { getStorage, connectStorageEmulator } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBsfGTZ1yypzWE4R_thDARSh61Osc6OUbU",
  authDomain: "gerenciador-tarefas-fd5be.firebaseapp.com",
  projectId: "gerenciador-tarefas-fd5be",
  // *** CORRIJA ESTA LINHA EM firebase-config.js SE ESTIVER DIFERENTE ***
  storageBucket: "gerenciador-tarefas-fd5be.firebasestorage.app",
  messagingSenderId: "831715035671",
  appId: "1:831715035671:web:2836e1701f80fc6f602a52"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const provider = new GoogleAuthProvider();

// --- LÓGICA MELHORADA PARA EMULADORES ---
const useEmulator = (() => {
  // Verifica se está rodando em localhost ou 127.0.0.1
  const isLocal = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
  if (!isLocal) {
    console.log("Ambiente de produção detectado (não localhost). Conectando ao Firebase de Produção.");
    return false; // Não usa emulador se não for local
  }

  // Verifica se já existe uma escolha salva no sessionStorage
  const savedChoice = sessionStorage.getItem('useFirebaseEmulator');
  if (savedChoice !== null) {
    const shouldUse = savedChoice === 'true';
    console.log(`Escolha de ambiente encontrada no sessionStorage: Usar Emuladores = ${shouldUse}`);
    return shouldUse; // Retorna a escolha salva
  }

  // Se não houver escolha salva, pergunta ao usuário
  console.log("Ambiente local detectado. Perguntando ao usuário sobre emuladores...");
  const userChoice = confirm(
    "Você está em ambiente de desenvolvimento (localhost).\n\n" +
    "Deseja conectar aos Emuladores Firebase?\n\n" +
    "(Clique 'OK' para Emuladores, 'Cancelar' para Produção)"
  );

  // Salva a escolha no sessionStorage para evitar perguntar novamente na mesma sessão
  sessionStorage.setItem('useFirebaseEmulator', userChoice);
  console.log(`Usuário escolheu: Usar Emuladores = ${userChoice}. Escolha salva no sessionStorage.`);
  return userChoice;
})();


// Conecta aos emuladores SE useEmulator for true
if (useEmulator) {
  console.warn("!! ATENÇÃO: Conectando aos Emuladores Firebase !!");
  try {
    // Use 127.0.0.1 explicitamente para evitar problemas de resolução de 'localhost'
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableCors: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectStorageEmulator(storage, '127.0.0.1', 9199);
    console.log("Conexão com os emuladores (Auth, Firestore, Storage) configurada com sucesso.");
  } catch (e) {
    console.error("Erro ao conectar com os emuladores:", e);
    alert("Falha ao conectar aos emuladores. Verifique se eles estão rodando (comando: firebase emulators:start). Conectando à produção como fallback.");
    // Limpa a escolha para perguntar na próxima vez se a conexão falhar
    sessionStorage.removeItem('useFirebaseEmulator');
  }
} else {
    // Isso será logado se não for local ou se o usuário escolher 'Cancelar'
    if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
        console.log("Conectando ao Firebase de Produção (escolha do usuário ou fallback).");
    }
}
// --- FIM DA LÓGICA DE EMULADORES ---


// Funções de login e logout
export async function loginGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    console.log("Usuário logado com Google:", result.user.displayName, result.user.email);
    // A lógica de redirecionamento para profile.html ou index.html está no login.js
    return result.user;
  } catch (error) {
    console.error("Erro ao fazer login com Google:", error.code, error.message);
    // Informar o usuário sobre possíveis problemas de configuração comuns
    if (error.code === 'auth/operation-not-allowed') {
         alert("Erro ao logar com Google: Login com Google não está habilitado no Firebase Console (Authentication > Sign-in method).");
    } else if (error.code === 'auth/unauthorized-domain') {
        alert("Erro ao logar com Google: O domínio 'localhost' (ou o domínio atual) não está autorizado. Adicione-o em Firebase Console > Authentication > Settings > Authorized domains.");
    } else if (error.code === 'auth/popup-closed-by-user') {
        console.log("Login com Google cancelado pelo usuário."); // Não precisa de alert
    } else {
        alert(`Erro no login com Google: ${error.message} (Código: ${error.code})`);
    }
  }
}

export async function logout() {
  try {
    await signOut(auth);
    console.log("Usuário deslogado com sucesso!");
    // Limpa a escolha do emulador ao deslogar para perguntar novamente no próximo login/recarregamento
    sessionStorage.removeItem('useFirebaseEmulator');
    console.log("Escolha do emulador removida do sessionStorage.");
    // O redirecionamento para index.html geralmente é feito no próprio listener do botão de logout (nav.js ou logout.js)
  } catch (error) {
    console.error("Erro ao deslogar:", error);
  }
}