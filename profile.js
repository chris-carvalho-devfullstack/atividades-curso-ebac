// profile.js
import { auth, db, storage } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

// ELEMENTOS DO HTML
const profileForm = document.getElementById("profile-form");
const fullnameInput = document.getElementById("profile-fullname");
const usernameInput = document.getElementById("profile-username");
const bioInput = document.getElementById("profile-bio"); // <-- NOVO
const birthdateInput = document.getElementById("profile-birthdate");
const phoneInput = document.getElementById("profile-phone");
const instagramInput = document.getElementById("profile-instagram");
const linkedinInput = document.getElementById("profile-linkedin");
const emailInput = document.getElementById("profile-email");
const saveButton = document.getElementById("save-profile-btn");
const message = document.getElementById("profile-message");

// Elementos das Imagens
const changePictureBtn = document.getElementById("change-picture-btn");
const imageUpload = document.getElementById("image-upload");
const imagePreview = document.getElementById("profile-image-preview");
const changeCoverBtn = document.getElementById("change-cover-btn"); // <-- NOVO
const coverUpload = document.getElementById("cover-upload");       // <-- NOVO
const coverPreview = document.getElementById("cover-photo-preview"); // <-- NOVO


// ===========================
// MONITORA USUÁRIO LOGADO
// ===========================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  emailInput.value = user.email;
  // Fallback inicial para as imagens
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
      bioInput.value = data.bio || ""; // <-- NOVO
      birthdateInput.value = data.birthdate || "";
      phoneInput.value = data.phone || "";
      instagramInput.value = data.instagram || "";
      linkedinInput.value = data.linkedin || "";
      
      // Carrega as imagens salvas, se existirem
      if (data.fotoURL) imagePreview.src = data.fotoURL;
      if (data.coverURL) coverPreview.src = data.coverURL; // <-- NOVO

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
// LÓGICA PARA ALTERAR IMAGENS
// ===========================
changePictureBtn.addEventListener("click", () => imageUpload.click());
changeCoverBtn.addEventListener("click", () => coverUpload.click()); // <-- NOVO

imageUpload.addEventListener("change", () => {
  const file = imageUpload.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => (imagePreview.src = e.target.result);
    reader.readAsDataURL(file);
  }
});

coverUpload.addEventListener("change", () => { // <-- NOVO
  const file = coverUpload.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => (coverPreview.src = e.target.result);
    reader.readAsDataURL(file);
  }
});

// ===========================
// SALVAR PERFIL (LÓGICA CORRIGIDA PARA DISPLAY E BUSCA)
// ===========================
profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    saveButton.disabled = true;
    saveButton.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Salvando...';
    message.className = 'message';

    try {
        let fotoURL = imagePreview.src;
        let coverURL = coverPreview.src; // <-- NOVO

        // Faz upload da FOTO DE PERFIL, se uma nova foi escolhida
        if (imageUpload.files.length > 0) {
            const file = imageUpload.files[0];
            const storageRef = ref(storage, `profileImages/${user.uid}`);
            await uploadBytes(storageRef, file);
            fotoURL = await getDownloadURL(storageRef);
        }

        // Faz upload da FOTO DE CAPA, se uma nova foi escolhida // <-- NOVO
        if (coverUpload.files.length > 0) {
            const file = coverUpload.files[0];
            const storageRef = ref(storage, `coverImages/${user.uid}`); // Salva em uma pasta separada
            await uploadBytes(storageRef, file);
            coverURL = await getDownloadURL(storageRef);
        }

        // --- CORREÇÃO FINAL AGRESSIVA: Limpa espaços em branco e garante o dado correto para a busca ---
        
        // 1. Limpa espaços nas bordas para o nome de exibição (fullname)
        const originalFullname = fullnameInput.value.trim(); 
        
        // 2. Para o username, remove TODOS os espaços (incluindo invisíveis)
        const originalUsername = usernameInput.value.replace(/\s/g, '').trim(); 
        
        // 3. Versões em minúsculas para uso exclusivo na BUSCA
        const lowercaseFullnameSearch = originalFullname.toLowerCase(); 
        const lowercaseUsernameSearch = originalUsername.toLowerCase();
        // --- FIM DA CORREÇÃO ---

        // Salva ou atualiza o documento no Firestore
        await setDoc(doc(db, "users", user.uid), {
            // Campos de EXIBIÇÃO (limpos e com capitalização correta)
            fullname: originalFullname,
            username: originalUsername,

            // NOVOS CAMPOS DE BUSCA (minúsculas e garantidamente limpas)
            fullnameSearch: lowercaseFullnameSearch, 
            usernameSearch: lowercaseUsernameSearch,
            
            bio: bioInput.value, // <-- NOVO
            birthdate: birthdateInput.value,
            phone: phoneInput.value,
            instagram: instagramInput.value,
            linkedin: linkedinInput.value,
            email: user.email,
            fotoURL,
            coverURL, // <-- NOVO
        });

        saveButton.classList.add('btn-success');
        saveButton.innerHTML = '<i class="fa fa-check"></i> Salvo!';

    } catch (error) {
        console.error("Erro ao salvar perfil:", error);
        message.textContent = "Erro ao salvar perfil. Tente novamente.";
        message.classList.add('error');
        saveButton.classList.add('btn-error');
        saveButton.innerHTML = '<i class="fa fa-times"></i> Erro ao Salvar';

    } finally {
        setTimeout(() => {
            saveButton.disabled = false;
            saveButton.innerHTML = 'Salvar Alterações';
            saveButton.classList.remove('btn-success', 'btn-error');
        }, 2000);
    }
});