// profile.js
import { auth, db, storage } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

// ELEMENTOS DO HTML
const profileForm = document.getElementById("profile-form");
const fullnameInput = document.getElementById("profile-fullname");
const usernameInput = document.getElementById("profile-username");
const birthdateInput = document.getElementById("profile-birthdate");
const phoneInput = document.getElementById("profile-phone");
const instagramInput = document.getElementById("profile-instagram");
const linkedinInput = document.getElementById("profile-linkedin");
const emailInput = document.getElementById("profile-email");
const saveButton = document.getElementById("save-profile-btn");
const message = document.getElementById("profile-message");
const changePictureBtn = document.getElementById("change-picture-btn");
const imageUpload = document.getElementById("image-upload");
const imagePreview = document.getElementById("profile-image-preview");

// ===========================
// MONITORA USUÁRIO LOGADO
// ===========================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.warn("Nenhum usuário logado. Redirecionando...");
    window.location.href = "login.html";
    return;
  }

  emailInput.value = user.email;
  imagePreview.src = user.photoURL || "https://via.placeholder.com/150";
  await carregarDados(user.uid);
});

// ===========================
// CARREGAR PERFIL DO FIRESTORE
// ===========================
async function carregarDados(uid) {
  try {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      fullnameInput.value = data.fullname || "";
      usernameInput.value = data.username || "";
      birthdateInput.value = data.birthdate || "";
      phoneInput.value = data.phone || "";
      instagramInput.value = data.instagram || "";
      linkedinInput.value = data.linkedin || "";
      if (data.fotoURL) imagePreview.src = data.fotoURL;
    } else {
      console.log("Nenhum dado de perfil encontrado — novo usuário.");
    }
  } catch (error) {
    console.error("Erro ao carregar dados do perfil:", error);
    message.textContent = "Erro ao carregar dados do perfil.";
    message.classList.add('error');
  }
}

// ===========================
// FORMATAÇÃO E VALIDAÇÃO DOS CAMPOS
// ===========================
phoneInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
    value = value.replace(/(\d)(\d{4})$/, '$1-$2');
    e.target.value = value;
});

usernameInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/[^a-zA-Z0-9_.]/g, '');
    e.target.value = value;
});

instagramInput.addEventListener('input', (e) => {
    let value = e.target.value;
    if (value.length > 0 && value[0] !== '@') {
        value = '@' + value.replace(/[^a-zA-Z0-9_.]/g, '');
    } else if (value.length > 0) {
        value = '@' + value.substring(1).replace(/[^a-zA-Z0-9_.]/g, '');
    }
    e.target.value = value;
});


// ===========================
// ALTERAR FOTO DE PERFIL
// ===========================
changePictureBtn.addEventListener("click", () => imageUpload.click());

imageUpload.addEventListener("change", () => {
  const file = imageUpload.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => (imagePreview.src = e.target.result);
    reader.readAsDataURL(file);
  }
});

// ===========================
// SALVAR PERFIL (COM FEEDBACK VISUAL)
// ===========================
profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  // --- Início: Feedback visual de "Salvando" ---
  saveButton.disabled = true;
  saveButton.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Salvando...';
  message.textContent = "";
  message.className = 'message';
  // --- Fim: Feedback visual ---

  try {
    let fotoURL = imagePreview.src;

    if (imageUpload.files.length > 0) {
      const file = imageUpload.files[0];
      const storageRef = ref(storage, `profileImages/${user.uid}`);
      await uploadBytes(storageRef, file);
      fotoURL = await getDownloadURL(storageRef);
    }

    await setDoc(doc(db, "users", user.uid), {
      fullname: fullnameInput.value,
      username: usernameInput.value,
      birthdate: birthdateInput.value,
      phone: phoneInput.value,
      instagram: instagramInput.value,
      linkedin: linkedinInput.value,
      email: user.email,
      fotoURL,
    });
    
    // --- Início: Feedback de sucesso ---
    saveButton.classList.add('btn-success');
    saveButton.innerHTML = '<i class="fa fa-check"></i> Salvo!';
    // --- Fim: Feedback de sucesso ---

  } catch (error) {
    console.error("Erro ao salvar perfil:", error);
    message.textContent = "Erro ao salvar perfil. Tente novamente.";
    message.classList.add('error');

    // --- Início: Feedback de erro ---
    saveButton.classList.add('btn-error');
    saveButton.innerHTML = '<i class="fa fa-times"></i> Erro ao Salvar';
    // --- Fim: Feedback de erro ---

  } finally {
    // --- Início: Reverter o botão ao estado original ---
    setTimeout(() => {
        saveButton.disabled = false;
        saveButton.innerHTML = 'Salvar Alterações';
        saveButton.classList.remove('btn-success', 'btn-error');
    }, 2000); // Espera 2 segundos antes de voltar ao normal
    // --- Fim: Reverter o botão ao estado original ---
  }
});