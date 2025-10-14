// profile.js
import { auth, db, storage } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

// ELEMENTOS DO HTML
const profileForm = document.getElementById("profile-form");
const nameInput = document.getElementById("profile-name");
const contactInput = document.getElementById("profile-contact");
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
      nameInput.value = data.nome || "";
      contactInput.value = data.contato || "";
      if (data.fotoURL) imagePreview.src = data.fotoURL;
    } else {
      console.log("Nenhum dado de perfil encontrado — novo usuário.");
    }
  } catch (error) {
    console.error("Erro ao carregar dados do perfil:", error);
    message.textContent = "Erro ao carregar dados do perfil.";
  }
}

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
// SALVAR PERFIL
// ===========================
profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  saveButton.disabled = true;
  message.textContent = "Salvando...";

  try {
    let fotoURL = imagePreview.src;

    // Se o usuário escolheu uma nova imagem, faz upload no Storage
    if (imageUpload.files.length > 0) {
      const file = imageUpload.files[0];
      const storageRef = ref(storage, `profileImages/${user.uid}`);
      await uploadBytes(storageRef, file);
      fotoURL = await getDownloadURL(storageRef);
    }

    // Salva ou atualiza o documento no Firestore
    await setDoc(doc(db, "users", user.uid), {
      nome: nameInput.value,
      contato: contactInput.value,
      email: user.email,
      fotoURL,
    });

    message.textContent = "Perfil atualizado com sucesso!";
    message.style.color = "green";
  } catch (error) {
    console.error("Erro ao salvar perfil:", error);
    message.textContent = "Erro ao salvar perfil. Verifique o console.";
    message.style.color = "red";
  } finally {
    saveButton.disabled = false;
  }
});
