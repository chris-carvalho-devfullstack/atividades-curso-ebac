// login.js
import { auth, db } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  getAdditionalUserInfo
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";


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

// Função para verificar se é um novo usuário e redirecionar
const handleAuthRedirect = (result) => {
    const additionalUserInfo = getAdditionalUserInfo(result);
    if (additionalUserInfo?.isNewUser) {
        // Se for um novo usuário, cria um documento inicial no Firestore
        const user = result.user;
        const userRef = doc(db, "users", user.uid);
        setDoc(userRef, {
            email: user.email,
            fullname: user.displayName || '',
            createdAt: new Date()
        }, { merge: true });
        window.location.href = "profile.html"; // Redireciona para completar o perfil
    } else {
        window.location.href = "index.html"; // Vai para a página principal se já for um usuário existente
    }
}


// ===== LOGIN EMAIL/SENHA =====
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    handleAuthRedirect(result);
  } catch (error) {
    console.error("Erro login email/senha:", error.code, error.message);
    loginError.textContent = "Email ou senha incorretos.";
  }
});

// ===== LOGIN COM GOOGLE =====
googleBtn.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    handleAuthRedirect(result);
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
    const result = await createUserWithEmailAndPassword(auth, email, password);
    handleAuthRedirect(result);
  } catch (error) {
    console.error("Erro cadastro:", error.code, error.message);
    signupError.textContent = `Erro ao cadastrar: ${error.code}`;
  }
});