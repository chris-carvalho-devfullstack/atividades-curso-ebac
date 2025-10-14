// public-profile.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
// Corrigido: Todas as importações do firestore em uma única linha, sem duplicatas.
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// Elementos da página
const usernameHeader = document.getElementById('public-username-header');
const profileImage = document.getElementById('public-profile-image');
const coverPreview = document.getElementById('cover-photo-preview');
const fullname = document.getElementById('public-fullname');
const bio = document.getElementById('public-bio');
const birthdate = document.getElementById('public-birthdate');
const phone = document.getElementById('public-phone');
const instagram = document.getElementById('public-instagram');
const linkedin = document.getElementById('public-linkedin');
const addFriendBtn = document.getElementById('add-friend-btn');

async function loadPublicProfile(profileUid) {
    if (!profileUid) {
        fullname.textContent = "Usuário não encontrado.";
        return;
    }

    try {
        const docRef = doc(db, "users", profileUid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            
            usernameHeader.textContent = data.username ? `@${data.username}` : "Usuário";
            profileImage.src = data.fotoURL || "https://via.placeholder.com/150";
            coverPreview.src = data.coverURL || "https://via.placeholder.com/800x250/e0e0e0/ffffff?text=+";
            fullname.textContent = data.fullname || "Nome não informado";
            bio.textContent = data.bio || "Este usuário ainda não escreveu uma bio.";
            birthdate.textContent = data.birthdate ? new Date(data.birthdate + 'T00:00:00').toLocaleDateString('pt-BR') : "Data não informada";
            phone.textContent = data.phone || "Contato não informado";
            instagram.textContent = data.instagram || "Instagram não informado";
            
            if (data.linkedin) {
                linkedin.textContent = "Ver Perfil no LinkedIn";
                linkedin.href = data.linkedin;
            } else {
                linkedin.textContent = "LinkedIn não informado";
                linkedin.href = "#";
                linkedin.style.pointerEvents = "none";
            }
            
            // --- Lógica do Botão "Adicionar Amigo" ---
            const currentUser = auth.currentUser;

            // Mostra o botão apenas se houver um usuário logado E ele não estiver vendo o próprio perfil.
            if (currentUser && currentUser.uid !== profileUid) {
                addFriendBtn.style.display = 'block';

                addFriendBtn.addEventListener('click', async () => {
                    const requestRef = doc(db, "users", profileUid, "friendRequests", currentUser.uid);
                    await setDoc(requestRef, {
                        from: currentUser.uid,
                        timestamp: serverTimestamp()
                    });
                    alert("Pedido de amizade enviado!");
                    addFriendBtn.disabled = true;
                    addFriendBtn.textContent = "Pedido Enviado";
                });
            } else {
                addFriendBtn.style.display = 'none';
            }

        } else {
            console.log("Perfil não encontrado.");
            fullname.textContent = "Perfil não encontrado.";
        }
    } catch (error) {
        console.error("Erro ao carregar perfil público:", error);
        fullname.textContent = "Erro ao carregar perfil.";
    }
}

// Monitora o estado de autenticação
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // Se o usuário não estiver logado, ele não pode ver perfis. Redireciona para o login.
        window.location.href = 'login.html';
        return;
    }

    // Corrigido: Pega o UID do usuário a ser exibido a partir da URL.
    const urlParams = new URLSearchParams(window.location.search);
    const profileUid = urlParams.get('uid');

    if (profileUid) {
        loadPublicProfile(profileUid);
    } else {
        // Se não houver UID na URL, carrega o perfil do próprio usuário logado.
        loadPublicProfile(user.uid);
    }
});