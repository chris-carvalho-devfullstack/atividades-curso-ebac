// profile.js (Versão Final com Verificação de Username e Compartilhamento)

// ===========================
// IMPORTAÇÕES DO FIREBASE
// ===========================
import { auth, db, storage } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
// ATUALIZADO: Adicionadas as funções necessárias para a consulta de username
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

// ===========================
// ELEMENTOS DO HTML
// ===========================
const profileForm = document.getElementById("profile-form");
const fullnameInput = document.getElementById("profile-fullname");
const usernameInput = document.getElementById("profile-username");
const bioInput = document.getElementById("profile-bio");
const birthdateInput = document.getElementById("profile-birthdate");
const genderInput = document.getElementById("profile-gender"); // Novo campo de gênero
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
const changeCoverBtn = document.getElementById("change-cover-btn");
const coverUpload = document.getElementById("cover-upload");
const coverPreview = document.getElementById("cover-photo-preview");

// ===========================
// MONITORA USUÁRIO LOGADO
// ===========================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
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
            bioInput.value = data.bio || "";
            birthdateInput.value = data.birthdate || "";
            genderInput.value = data.gender || "not-informed"; // Carrega o gênero
            phoneInput.value = data.phone || "";
            instagramInput.value = data.instagram || "";
            linkedinInput.value = data.linkedin || "";
            if (data.fotoURL) imagePreview.src = data.fotoURL;
            if (data.coverURL) coverPreview.src = data.coverURL;
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
changeCoverBtn.addEventListener("click", () => coverUpload.click());

imageUpload.addEventListener("change", () => {
    const file = imageUpload.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => (imagePreview.src = e.target.result);
        reader.readAsDataURL(file);
    }
});

coverUpload.addEventListener("change", () => {
    const file = coverUpload.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => (coverPreview.src = e.target.result);
        reader.readAsDataURL(file);
    }
});


/**
 * NOVO: Verifica se um nome de usuário já está em uso por outro usuário.
 * @param {string} username - O nome de usuário a ser verificado.
 * @param {string} currentUid - O UID do usuário atual para excluí-lo da busca.
 * @returns {Promise<boolean>} - Retorna true se o nome de usuário já estiver em uso.
 */
async function isUsernameTaken(username, currentUid) {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("usernameSearch", "==", username.toLowerCase()));
    const querySnapshot = await getDocs(q);

    let isTaken = false;
    querySnapshot.forEach((doc) => {
        if (doc.id !== currentUid) {
            isTaken = true;
        }
    });
    return isTaken;
}

// ===========================
// SALVAR PERFIL (LÓGICA ATUALIZADA)
// ===========================
profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    saveButton.disabled = true;
    saveButton.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Verificando...';
    message.className = 'message';
    message.textContent = '';

    try {
        const username = usernameInput.value.replace(/\s/g, '').trim();

        // --- NOVA ETAPA DE VALIDAÇÃO DE USERNAME ---
        if (await isUsernameTaken(username, user.uid)) {
            message.textContent = "Este nome de usuário já está em uso. Por favor, escolha outro.";
            message.classList.add('error');
            // Lança um erro para interromper a execução e ir para o bloco catch/finally
            throw new Error("Username taken");
        }
        // --- FIM DA VALIDAÇÃO ---

        saveButton.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Salvando...';

        let fotoURL = imagePreview.src;
        let coverURL = coverPreview.src;

        if (imageUpload.files.length > 0) {
            const file = imageUpload.files[0];
            const storageRef = ref(storage, `profileImages/${user.uid}`);
            await uploadBytes(storageRef, file);
            fotoURL = await getDownloadURL(storageRef);
        }

        if (coverUpload.files.length > 0) {
            const file = coverUpload.files[0];
            const storageRef = ref(storage, `coverImages/${user.uid}`);
            await uploadBytes(storageRef, file);
            coverURL = await getDownloadURL(storageRef);
        }

        const originalFullname = fullnameInput.value.trim();
        const originalUsername = username;
        const lowercaseFullnameSearch = originalFullname.toLowerCase();
        const lowercaseUsernameSearch = originalUsername.toLowerCase();

        // Salva os dados no Firestore
        await setDoc(doc(db, "users", user.uid), {
            fullname: originalFullname,
            username: originalUsername,
            fullnameSearch: lowercaseFullnameSearch,
            usernameSearch: lowercaseUsernameSearch,
            bio: bioInput.value,
            birthdate: birthdateInput.value,
            gender: genderInput.value, // Salva o gênero
            phone: phoneInput.value,
            instagram: instagramInput.value,
            linkedin: linkedinInput.value,
            email: user.email,
            fotoURL,
            coverURL,
        });

        saveButton.classList.add('btn-success');
        saveButton.innerHTML = '<i class="fa fa-check"></i> Salvo!';

    } catch (error) {
        // Se o erro não for o de "username taken", mostra uma mensagem genérica
        if (error.message !== "Username taken") {
            console.error("Erro ao salvar perfil:", error);
            message.textContent = "Erro ao salvar perfil. Tente novamente.";
            message.classList.add('error');
        }
        saveButton.classList.add('btn-error');
        saveButton.innerHTML = '<i class="fa fa-times"></i> Erro ao Salvar';

    } finally {
        setTimeout(() => {
            saveButton.disabled = false;
            saveButton.innerHTML = 'Salvar Alterações';
            saveButton.classList.remove('btn-success', 'btn-error');
        }, 2500);
    }
});

// ===========================
// NOVO: LÓGICA PARA COMPARTILHAR PERFIL
// ===========================
document.addEventListener('DOMContentLoaded', () => {
    const shareBtn = document.getElementById('share-profile-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            const user = auth.currentUser;
            if (user) {
                // Monta a URL completa para o perfil público do usuário
                const profileUrl = `${window.location.origin}/public-profile.html?uid=${user.uid}`;
                
                // Usa a API do navegador para copiar o texto para a área de transferência
                navigator.clipboard.writeText(profileUrl)
                    .then(() => {
                        alert('Link do seu perfil copiado!');
                    })
                    .catch(err => {
                        console.error('Erro ao copiar o link:', err);
                        alert('Não foi possível copiar o link. Tente manualmente.');
                    });
            } else {
                alert('Você precisa estar logado para compartilhar seu perfil.');
            }
        });
    }
});