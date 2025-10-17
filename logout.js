// logout.js (módulo pequeno e independente)
import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

const logoutBtn = document.getElementById('logout-btn');

if (logoutBtn) {
  logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await signOut(auth);
      // CORREÇÃO: Redireciona para a página inicial após o logout
      window.location.href = 'index.html';
    } catch (err) {
      console.error('Erro ao fazer signOut:', err);
      alert('Não foi possível sair. Veja o console para detalhes.');
    }
  });
} else {
  // botão não existe no DOM (talvez em páginas sem nav)
  console.warn('logout.js: #logout-btn não encontrado no DOM.');
}