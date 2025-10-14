// auth-listener.js
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { auth } from "./firebase-config.js";

// Lista de páginas que EXIGEM login
const protectedPages = ['profile.html', 'public-profile.html'];

onAuthStateChanged(auth, (user) => {
  const currentPage = window.location.pathname.split('/').pop();
  const isAuthPage = currentPage.includes("login.html") || currentPage.includes("signup.html");

  if (user) {
    // Se o usuário está LOGADO e tenta acessar a página de login,
    // redireciona para a página principal.
    if (isAuthPage) {
      window.location.href = "index.html";
    }
  } else {
    // Se o usuário NÃO está logado e tenta acessar uma PÁGINA PROTEGIDA,
    // redireciona para o login.
    if (protectedPages.includes(currentPage)) {
      window.location.href = "login.html";
    }
  }
});