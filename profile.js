// profile.js
import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

// Elementos da página
const profileImagePreview = document.getElementById('profile-image-preview');
const imageUploadInput = document.getElementById('image-upload');
const changePictureBtn = document.getElementById('change-picture-btn');
const profileForm = document.getElementById('profile-form');
const profileNameInput = document.getElementById('profile-name');
const profileContactInput = document.getElementById('profile-contact');
const profileEmailInput = document.getElementById('profile-email');
const saveProfileBtn = document.getElementById('save-profile-btn');
const profileMessage = document.getElementById('profile-message');

let currentUser = null;

// Função para exibir mensagens para o usuário
function showMessage(text, type = 'success') {
    profileMessage.textContent = text;
    profileMessage.className = `message ${type}`;
    setTimeout(() => {
        profileMessage.className = 'message';
    }, 4000);
}

// 1. Monitorar o estado de autenticação
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        profileEmailInput.value = user.email; // Preenche o email (desabilitado)
        
        const userDocRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            profileNameInput.value = data.displayName || '';
            profileContactInput.value = data.contact || '';
            if (data.photoURL) {
                profileImagePreview.src = data.photoURL;
            } else {
                profileImagePreview.src = 'https://via.placeholder.com/150';
            }
        } else {
            console.log("Documento de perfil não encontrado, usuário pode ser novo.");
        }
    } else {
        console.log("Nenhum usuário logado.");
    }
});

// 3. Salvar alterações no formulário (nome e contato)
profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) {
        showMessage("Você precisa estar logado para salvar.", "error");
        return;
    }

    // **NOVO: Feedback visual no botão**
    saveProfileBtn.disabled = true;
    saveProfileBtn.textContent = 'Salvando...';

    const userDocRef = doc(db, 'users', currentUser.uid);
    try {
        await setDoc(userDocRef, {
            displayName: profileNameInput.value,
            contact: profileContactInput.value,
        }, { merge: true });

        showMessage("Perfil atualizado com sucesso!");
    } catch (error) {
        console.error("Erro ao salvar perfil:", error);
        let friendlyMessage = "Ocorreu um erro ao salvar.";
        if (error.code === 'permission-denied') {
            friendlyMessage = "Erro de permissão. Verifique suas regras de segurança do Firestore.";
        }
        showMessage(friendlyMessage, "error");
    } finally {
        // **NOVO: Restaura o botão em qualquer cenário (sucesso ou erro)**
        saveProfileBtn.disabled = false;
        saveProfileBtn.textContent = 'Salvar Alterações';
    }
});

// 4. Lógica para upload da foto de perfil
changePictureBtn.addEventListener('click', () => {
    imageUploadInput.click();
});

imageUploadInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !currentUser) return;

    const storageRef = ref(storage, `profile_pictures/${currentUser.uid}/${file.name}`);
    
    showMessage("Enviando imagem...", "neutral");

    try {
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        profileImagePreview.src = downloadURL;

        const userDocRef = doc(db, 'users', currentUser.uid);
        await setDoc(userDocRef, { photoURL: downloadURL }, { merge: true });

        showMessage("Foto de perfil atualizada!");

    } catch (error) {
        console.error("Erro no upload da imagem:", error);
        let friendlyMessage = "Erro ao enviar a imagem.";
        if (error.code === 'storage/unauthorized') {
            friendlyMessage = "Erro de permissão no Storage.";
        } else if (error.code === 'permission-denied') {
            friendlyMessage = "Erro de permissão para salvar a URL no Firestore.";
        }
        showMessage(friendlyMessage, "error");
    }
});