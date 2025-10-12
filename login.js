// login.js
import { auth } from './firebase-config.js';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

// Inicializa o provider do Google
const provider = new GoogleAuthProvider();

// ELEMENTOS DO HTML
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const showSignup = document.getElementById("show-signup");
const showLogin = document.getElementById("show-login");
const loginError = document.getElementById("login-error");
const signupError = document.getElementById("signup-error");
const googleBtn = document.getElementById("google-login-btn");

// ===== TROCAR FORMULÁRIOS =====
showSignup.addEventListener("click", () => {
  loginForm.classList.remove("active");
  signupForm.classList.add("active");
  loginError.textContent = "";
  signupError.textContent = "";
});

showLogin.addEventListener("click", () => {
  signupForm.classList.remove("active");
  loginForm.classList.add("active");
  loginError.textContent = "";
  signupError.textContent = "";
});

// ===== LOGIN EMAIL/SENHA =====
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "index.html";
  } catch (error) {
    console.error("Erro login email/senha:", error.code, error.message);
    loginError.textContent = "Email ou senha incorretos.";
  }
});

// ===== LOGIN COM GOOGLE =====
googleBtn.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    console.log("Usuário logado com Google:", user.displayName, user.email);
    window.location.href = "index.html";
  } catch (error) {
    console.error("Erro login Google:", error.code, error.message);
    loginError.textContent = `Erro ao fazer login com Google: ${error.code}`;
  }
});

// ===== CADASTRO EMAIL/SENHA =====
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    signupError.textContent = "Cadastro realizado! Faça login.";
    signupForm.classList.remove("active");
    loginForm.classList.add("active");
  } catch (error) {
    console.error("Erro cadastro:", error.code, error.message);
    signupError.textContent = `Erro ao cadastrar: ${error.code}`;
  }
});
