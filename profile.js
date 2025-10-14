// profile-teste.js
import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { doc, getDoc, setDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
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

function showMessage(text, type = 'success') {
    profileMessage.textContent = text;
    profileMessage.className = `message ${type}`;
    setTimeout(() => profileMessage.className = 'message', 4000);
}

// ===== 1. Monitorar estado de autenticação =====
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        showMessage("Nenhum usuário logado.", "error");
        return;
    }
    currentUser = user;
    profileEmailInput.value = user.email;

    // ===== 2. Testar conexão com Firestore =====
    try {
        const snapshot = await getDocs(collection(db, "users"));
        console.log("Firestore conectado! Total de documentos:", snapshot.docs.length);
    } catch (err) {
        console.error("Erro ao conectar no Firestore:", err);
        showMessage("Erro ao conectar no Firestore. Verifique regras e domínio.", "error");
        return;
    }

    // ===== 3. Carregar dados do perfil =====
    try {
        const userDocRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            profileNameInput.value = data.displayName || '';
            profileContactInput.value = data.contact || '';
            profileImagePreview.src = data.photoURL || 'https://via.placeholder.com/150';
        } else {
            console.log("Documento do usuário não encontrado.");
        }
    } catch (err) {
        console.error("Erro ao carregar dados do perfil:", err);
        showMessage("Erro ao carregar perfil. Regras de Firestore podem estar bloqueando.", "error");
    }
});

// ===== 4. Salvar alterações =====
profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    saveProfileBtn.disabled = true;
    saveProfileBtn.textContent = 'Salvando...';

    const userDocRef = doc(db, 'users', currentUser.uid);
    try {
        await setDoc(userDocRef, {
            displayName: profileNameInput.value,
            contact: profileContactInput.value,
        }, { merge: true });
        showMessage("Perfil atualizado com sucesso!");
    } catch (err) {
        console.error("Erro ao salvar perfil:", err);
        showMessage("Erro ao salvar perfil. Verifique regras do Firestore.", "error");
    } finally {
        saveProfileBtn.disabled = false;
        saveProfileBtn.textContent = 'Salvar Alterações';
    }
});

// ===== 5. Upload da foto =====
changePictureBtn.addEventListener('click', () => imageUploadInput.click());

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
    } catch (err) {
        console.error("Erro no upload da imagem:", err);
        showMessage("Erro ao enviar imagem. Verifique Storage e regras.", "error");
    }
});
