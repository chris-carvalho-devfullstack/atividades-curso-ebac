// auth-listener.js
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { auth } from "./firebase-config.js";

// Lista de páginas que EXIGEM login. Todas as outras são permitidas.
const protectedPages = [
    'profile.html', 
    'public-profile.html', 
    'friends.html', 
    'feed.html', 
    'admin.html', 
    'moderacao-posts.html'
];

onAuthStateChanged(auth, (user) => {
  const currentPage = window.location.pathname.split('/').pop();
  const isAuthPage = currentPage.includes("login.html") || currentPage.includes("signup.html");

  if (user) {
    // USUÁRIO LOGADO:
    // Se estiver na página de login/cadastro, redireciona para a página principal.
    if (isAuthPage) {
      window.location.href = "index.html";
    }
  } else {
    // USUÁRIO DESLOGADO:
    // Se estiver tentando acessar uma página protegida, redireciona para o login.
    if (protectedPages.includes(currentPage)) {
      window.location.href = "login.html";
    }
  }
});