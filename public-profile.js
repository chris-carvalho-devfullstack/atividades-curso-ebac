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
        alert(`${title}\n\n${message}`);
        return;
    }

    modalTitle.textContent = title;
    modalText.textContent = message;
    modal.style.display = 'flex';

    const closeModal = () => {
        modal.style.display = 'none';
    };

    closeBtn.onclick = closeModal;
    closeTopBtn.onclick = closeModal;
    modal.onclick = (event) => {
        if (event.target === modal) {
            closeModal();
        }
    };
}

/**
 * NOVO: Exibe um modal de confirmação para ações críticas.
 * @param {string} title - O título do modal.
 * @param {string} message - A mensagem de confirmação.
 * @param {function} onConfirm - A função a ser executada se o usuário confirmar.
 */
function showConfirmModal(title, message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    const modalTitle = document.getElementById('confirm-modal-title');
    const modalText = document.getElementById('confirm-modal-text');
    const okBtn = document.getElementById('confirm-modal-ok-btn');
    const cancelBtn = document.getElementById('confirm-modal-cancel-btn');

    if (!modal || !modalTitle || !modalText || !okBtn || !cancelBtn) {
        console.error("Elementos do modal de confirmação não encontrados!");
        // Fallback para o confirm do navegador
        if (confirm(`${title}\n\n${message}`)) {
            onConfirm();
        }
        return;
    }
    
    modalTitle.textContent = title;
    modalText.textContent = message;
    modal.style.display = 'flex';

    okBtn.onclick = () => {
        onConfirm();
        modal.style.display = 'none';
    };

    cancelBtn.onclick = () => {
        modal.style.display = 'none';
    };
}

// public-profile.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
// ATUALIZADO: Adicionado 'deleteDoc' e 'writeBatch' para a função de remover amigo
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

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


/**
 * NOVO: Remove a amizade entre dois usuários de forma mútua.
 * @param {string} currentUserUid - O UID do usuário logado.
 * @param {string} friendUid - O UID do amigo a ser removido.
 */
async function removeFriend(currentUserUid, friendUid) {
    const batch = writeBatch(db);

    // Remove o amigo da lista do usuário atual
    const userFriendRef = doc(db, "users", currentUserUid, "friends", friendUid);
    batch.delete(userFriendRef);

    // Remove o usuário atual da lista do (ex)amigo
    const friendUserRef = doc(db, "users", friendUid, "friends", currentUserUid);
    batch.delete(friendUserRef);

    try {
        await batch.commit();
        showInfoModal("Amizade Desfeita", "Você e este usuário não são mais amigos.");
        // Recarrega a página para atualizar o status do botão para "Adicionar Amigo"
        setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
        console.error("Erro ao remover amigo:", error);
        showInfoModal("Erro", "Não foi possível desfazer a amizade. Tente novamente.");
    }
}


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

            // ===========================================
            // LÓGICA DO BOTÃO DE AMIZADE ATUALIZADA
            // ===========================================
            if (isFriendSnap.exists()) {
                // JÁ SÃO AMIGOS
                addFriendBtn.textContent = "Amigos";
                addFriendBtn.disabled = false; // Habilita o botão para ser clicável
                addFriendBtn.className = 'btn-primary btn-amigos'; // Adiciona classes de estilo

                // Efeito de hover para mudar o texto e a cor
                addFriendBtn.onmouseenter = () => {
                    addFriendBtn.textContent = "Remover Amigo";
                    addFriendBtn.classList.remove('btn-amigos');
                    addFriendBtn.classList.add('btn-remover-amigo');
                };
                addFriendBtn.onmouseleave = () => {
                    addFriendBtn.textContent = "Amigos";
                    addFriendBtn.classList.add('btn-amigos');
                    addFriendBtn.classList.remove('btn-remover-amigo');
                };

                // Ação de clique para abrir o modal de confirmação
                addFriendBtn.onclick = () => {
                    const userData = docSnap.data();
                    showConfirmModal(
                        "Remover Amigo",
                        `Você tem certeza que deseja remover @${userData.username} da sua lista de amigos?`,
                        () => {
                            removeFriend(currentUser.uid, profileUid);
                        }
                    );
                };

            } else if (requestSentSnap.exists()) {
                // PEDIDO ENVIADO
                addFriendBtn.textContent = "Pedido Enviado";
                addFriendBtn.disabled = true; // Mantém desabilitado
                addFriendBtn.className = 'btn-primary'; // Reseta classes
                addFriendBtn.style.backgroundColor = '#FF9800';
                // Limpa eventos de mouse para evitar comportamento indesejado
                addFriendBtn.onmouseenter = null;
                addFriendBtn.onmouseleave = null;
                addFriendBtn.onclick = null;

            } else if (requestReceivedSnap.exists()) {
                // PEDIDO RECEBIDO
                addFriendBtn.textContent = "Aceitar Pedido";
                addFriendBtn.disabled = false;
                addFriendBtn.className = 'btn-primary';
                addFriendBtn.style.backgroundColor = '#2196F3';
                addFriendBtn.onclick = () => { window.location.href = 'friends.html'; }; 

            } else {
                // ADICIONAR AMIGO
                addFriendBtn.textContent = "Adicionar Amigo";
                addFriendBtn.disabled = false;
                addFriendBtn.className = 'btn-primary';
                addFriendBtn.style.backgroundColor = '';

                addFriendBtn.onclick = async () => {
                    addFriendBtn.disabled = true;
                    addFriendBtn.textContent = "Enviando...";
                    
                    try {
                        const newRequestRef = doc(db, "users", profileUid, "friendRequests", currentUser.uid);
                        await setDoc(newRequestRef, { from: currentUser.uid, timestamp: serverTimestamp() });
                        showInfoModal("Sucesso!", "Seu pedido de amizade foi enviado.");
                        addFriendBtn.textContent = "Pedido Enviado";
                        addFriendBtn.style.backgroundColor = '#FF9800';
                    } catch (error) {
                        console.error("Erro ao enviar pedido de amizade:", error);
                        showInfoModal("Erro", "Não foi possível enviar o pedido. Tente novamente.");
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