// auth-listener.js
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { auth } from "./firebase-config.js";

onAuthStateChanged(auth, (user) => {
  const isAuthPage = window.location.pathname.includes("login.html") || window.location.pathname.includes("signup.html");

  if (user) {
    // Se o usuário está logado e tenta acessar a página de login/cadastro,
    // redireciona para a página principal.
    if (isAuthPage) {
      window.location.href = "index.html";
    }
  } else {
    // Se o usuário NÃO está logado e tenta acessar qualquer página
    // que NÃO seja de login/cadastro, redireciona para o login.
    if (!isAuthPage) {
      window.location.href = "login.html";
    }
  }
});