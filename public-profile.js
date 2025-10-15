/**
 * Exibe um modal de informação genérico.
 * @param {string} title - O título do modal.
 * @param {string} message - A mensagem a ser exibida no corpo do modal.
 */
function showInfoModal(title, message) {
    const modal = document.getElementById('infoModal');
    const modalTitle = document.getElementById('info-modal-title');
    const modalText = document.getElementById('info-modal-text');
    const closeBtn = document.getElementById('info-modal-close-btn');
    const closeTopBtn = document.getElementById('info-modal-close-top');

    if (!modal || !modalTitle || !modalText || !closeBtn || !closeTopBtn) {
        console.error("Elementos do modal de informação não encontrados!");
        // Fallback para o alert caso o modal não exista no HTML
        alert(`${title}\n\n${message}`);
        return;
    }

    modalTitle.textContent = title;
    modalText.textContent = message;

    modal.style.display = 'flex'; // Usa flex para centralizar
    
    // Função para fechar o modal
    const closeModal = () => {
        modal.style.display = 'none';
    };

    // Adiciona listeners para fechar o modal
    closeBtn.onclick = closeModal;
    closeTopBtn.onclick = closeModal;
    modal.onclick = (event) => {
        if (event.target === modal) {
            closeModal();
        }
    };
}

// public-profile.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
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
    const currentUser = auth.currentUser;

    if (!profileUid) {
        fullname.textContent = "Usuário não encontrado.";
        return;
    }
    
    addFriendBtn.style.display = 'none';
    addFriendBtn.disabled = true;

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
            
            if (!currentUser || currentUser.uid === profileUid) {
                addFriendBtn.style.display = 'none';
                return;
            }

            addFriendBtn.style.display = 'block';
            
            const isFriendRef = doc(db, "users", currentUser.uid, "friends", profileUid);
            const isFriendSnap = await getDoc(isFriendRef);
            
            const requestSentRef = doc(db, "users", profileUid, "friendRequests", currentUser.uid);
            const requestSentSnap = await getDoc(requestSentRef);

            const requestReceivedRef = doc(db, "users", currentUser.uid, "friendRequests", profileUid);
            const requestReceivedSnap = await getDoc(requestReceivedRef);

            if (isFriendSnap.exists()) {
                addFriendBtn.textContent = "Amigos";
                addFriendBtn.disabled = true;
                addFriendBtn.style.backgroundColor = '#4CAF50';
            } else if (requestSentSnap.exists()) {
                addFriendBtn.textContent = "Pedido Enviado";
                addFriendBtn.disabled = true;
                addFriendBtn.style.backgroundColor = '#FF9800';
            } else if (requestReceivedSnap.exists()) {
                addFriendBtn.textContent = "Aceitar Pedido";
                addFriendBtn.disabled = false;
                addFriendBtn.style.backgroundColor = '#2196F3';
                addFriendBtn.onclick = () => { window.location.href = 'friends.html'; }; 
            } else {
                addFriendBtn.textContent = "Adicionar Amigo";
                addFriendBtn.disabled = false;
                addFriendBtn.style.backgroundColor = '';

                // --- LÓGICA DE ENVIO DE PEDIDO ATUALIZADA ---
                addFriendBtn.onclick = async () => {
                    addFriendBtn.disabled = true;
                    addFriendBtn.textContent = "Enviando...";
                    
                    try {
                        const newRequestRef = doc(db, "users", profileUid, "friendRequests", currentUser.uid);
                        await setDoc(newRequestRef, {
                            from: currentUser.uid,
                            timestamp: serverTimestamp()
                        });
                        
                        // ANTES: alert("Pedido de amizade enviado!");
                        // AGORA: Usa o modal
                        showInfoModal("Sucesso!", "Seu pedido de amizade foi enviado.");
                        
                        addFriendBtn.textContent = "Pedido Enviado";
                        addFriendBtn.style.backgroundColor = '#FF9800';

                    } catch (error) {
                        console.error("Erro ao enviar pedido de amizade:", error);
                        showInfoModal("Erro", "Não foi possível enviar o pedido de amizade. Tente novamente.");
                        // Restaura o botão em caso de erro
                        addFriendBtn.textContent = "Adicionar Amigo";
                        addFriendBtn.disabled = false;
                        addFriendBtn.style.backgroundColor = '';
                    }
                };
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
        window.location.href = 'login.html';
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const profileUid = urlParams.get('uid');

    if (profileUid) {
        loadPublicProfile(profileUid);
    } else {
        loadPublicProfile(user.uid);
    }
});
