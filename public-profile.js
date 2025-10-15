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
 * Exibe um modal de confirmação para ações críticas.
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
import { 
    doc, getDoc, setDoc, deleteDoc, serverTimestamp, writeBatch,
    collection, query, where, orderBy, getDocs, onSnapshot, updateDoc, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

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

let currentUser; // Variável para armazenar o usuário logado

/**
 * Remove a amizade entre dois usuários de forma mútua.
 */
async function removeFriend(currentUserUid, friendUid) {
    const batch = writeBatch(db);
    const userFriendRef = doc(db, "users", currentUserUid, "friends", friendUid);
    batch.delete(userFriendRef);
    const friendUserRef = doc(db, "users", friendUid, "friends", currentUserUid);
    batch.delete(friendUserRef);
    try {
        await batch.commit();
        showInfoModal("Amizade Desfeita", "Você e este usuário não são mais amigos.");
        setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
        console.error("Erro ao remover amigo:", error);
        showInfoModal("Erro", "Não foi possível desfazer a amizade. Tente novamente.");
    }
}

/**
 * Carrega as informações do perfil público.
 */
async function loadPublicProfile(profileUid) {
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
            } else {
                 updateFriendButtonStatus(profileUid);
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

/**
 * Atualiza o estado e a funcionalidade do botão de amigo.
 */
async function updateFriendButtonStatus(profileUid) {
    addFriendBtn.style.display = 'block';
            
    const isFriendRef = doc(db, "users", currentUser.uid, "friends", profileUid);
    const isFriendSnap = await getDoc(isFriendRef);
    
    const requestSentRef = doc(db, "users", profileUid, "friendRequests", currentUser.uid);
    const requestSentSnap = await getDoc(requestSentRef);

    const requestReceivedRef = doc(db, "users", currentUser.uid, "friendRequests", profileUid);
    const requestReceivedSnap = await getDoc(requestReceivedRef);

    if (isFriendSnap.exists()) {
        addFriendBtn.textContent = "Amigos";
        addFriendBtn.disabled = false;
        addFriendBtn.className = 'btn-primary btn-amigos';
        addFriendBtn.onmouseenter = () => { addFriendBtn.textContent = "Remover Amigo"; addFriendBtn.classList.add('btn-remover-amigo'); };
        addFriendBtn.onmouseleave = () => { addFriendBtn.textContent = "Amigos"; addFriendBtn.classList.remove('btn-remover-amigo'); };
        addFriendBtn.onclick = () => {
            showConfirmModal("Remover Amigo", `Você tem certeza que deseja remover este usuário da sua lista de amigos?`, () => removeFriend(currentUser.uid, profileUid));
        };
    } else if (requestSentSnap.exists()) {
        addFriendBtn.textContent = "Pedido Enviado";
        addFriendBtn.disabled = true;
        addFriendBtn.className = 'btn-primary';
        addFriendBtn.style.backgroundColor = '#FF9800';
    } else if (requestReceivedSnap.exists()) {
        addFriendBtn.textContent = "Aceitar Pedido";
        addFriendBtn.disabled = false;
        addFriendBtn.className = 'btn-primary';
        addFriendBtn.style.backgroundColor = '#2196F3';
        addFriendBtn.onclick = () => { window.location.href = 'friends.html'; }; 
    } else {
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
                console.error("Erro ao enviar pedido:", error);
                showInfoModal("Erro", "Não foi possível enviar o pedido. Tente novamente.");
                addFriendBtn.disabled = false;
            }
        };
    }
}


// --- INÍCIO DAS NOVAS FUNÇÕES ---

/**
 * Carrega as publicações de um usuário específico.
 */
async function loadUserPosts(uid) {
    const postsListContainer = document.getElementById('user-posts-list');
    if (!postsListContainer) return;
    postsListContainer.innerHTML = '<p style="text-align: center;">Carregando publicações...</p>';

    const postsRef = collection(db, 'posts');
    const q = query(postsRef, where('userId', '==', uid), orderBy('timestamp', 'desc'));

    // Usamos onSnapshot para atualizações em tempo real (curtidas/comentários)
    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            postsListContainer.innerHTML = '<p style="text-align: center;">Este usuário ainda não fez nenhuma publicação.</p>';
            return;
        }

        postsListContainer.innerHTML = '';
        snapshot.forEach(doc => {
            renderPostOnProfile(doc.data(), doc.id);
        });
    }, (error) => {
        console.error("Erro ao carregar publicações do usuário:", error);
        postsListContainer.innerHTML = '<p style="color: red; text-align: center;">Erro ao carregar publicações.</p>';
    });
}

/**
 * Renderiza um único post na página de perfil.
 */
function renderPostOnProfile(post, postId) {
    const postCard = document.createElement('div');
    postCard.className = 'post-card';
    const postsListContainer = document.getElementById('user-posts-list');

    const timestamp = post.timestamp ? post.timestamp.toDate().toLocaleString('pt-BR') : 'Agora mesmo';
    const isLiked = currentUser && post.likes.includes(currentUser.uid);

    postCard.innerHTML = `
        <div class="post-header">
            <img src="${post.userProfileImage}" alt="Foto do Perfil">
            <div class="post-author-info">
                <span class="username">${post.username}</span>
                <span class="timestamp">${timestamp}</span>
            </div>
        </div>
        <div class="post-content"><p>${post.content}</p></div>
        ${post.imageUrl ? `<div class="post-media"><img src="${post.imageUrl}" alt="Mídia da publicação"></div>` : ''}
        <div class="post-footer">
            <button class="action-btn like-btn ${isLiked ? 'liked' : ''}"><i class="fa fa-heart"></i> ${post.likes.length}</button>
            <button class="action-btn comment-btn"><i class="fa fa-comment"></i> ${post.comments.length}</button>
            <button class="action-btn share-btn"><i class="fa fa-share"></i></button>
        </div>
        <div class="comments-section" style="display: none;">
            <form class="comment-form">
                <input type="text" placeholder="Adicione um comentário..." required>
                <button type="submit">Comentar</button>
            </form>
            <div class="comments-list"></div>
        </div>
    `;

    postsListContainer.appendChild(postCard);

    const commentsList = postCard.querySelector('.comments-list');
    if (post.comments && post.comments.length > 0) {
        post.comments.sort((a, b) => a.timestamp.seconds - b.timestamp.seconds).forEach(comment => {
            const commentElement = document.createElement('div');
            commentElement.className = 'comment';
            commentElement.innerHTML = `<img src="${comment.userProfileImage}" alt="Foto"><div class="comment-content"><strong>${comment.username}</strong> <span>${comment.commentText}</span></div>`;
            commentsList.appendChild(commentElement);
        });
    }

    postCard.querySelector('.like-btn').addEventListener('click', () => toggleLike(postId));
    postCard.querySelector('.comment-btn').addEventListener('click', () => {
        const commentsSection = postCard.querySelector('.comments-section');
        commentsSection.style.display = commentsSection.style.display === 'none' ? 'block' : 'none';
    });
    postCard.querySelector('.comment-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = e.target.querySelector('input');
        addComment(postId, input.value);
        input.value = '';
    });
}

/**
 * Lógica para curtir/descurtir uma publicação.
 */
async function toggleLike(postId) {
    if (!currentUser) return alert("Você precisa estar logado para curtir.");
    const postRef = doc(db, 'posts', postId);
    const postDoc = await getDoc(postRef);
    if (!postDoc.exists()) return;

    const postData = postDoc.data();
    const isLiked = postData.likes.includes(currentUser.uid);

    await updateDoc(postRef, {
        likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
    });
}

/**
 * Adiciona um comentário a uma publicação.
 */
async function addComment(postId, commentText) {
    if (!currentUser) return alert("Você precisa estar logado para comentar.");
    if (!commentText.trim()) return;

    const postRef = doc(db, 'posts', postId);
    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    const userData = userDoc.data();
    const newComment = {
        userId: currentUser.uid,
        username: userData.username || 'Anônimo',
        userProfileImage: userData.fotoURL || 'https://via.placeholder.com/150',
        commentText,
        timestamp: new Date()
    };
    await updateDoc(postRef, {
        comments: arrayUnion(newComment)
    });
}

// --- FIM DAS NOVAS FUNÇÕES ---


// Listener principal que inicia o carregamento da página
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    currentUser = user; // Define o usuário logado globalmente

    const urlParams = new URLSearchParams(window.location.search);
    const profileUid = urlParams.get('uid');
    const uidToLoad = profileUid || user.uid;

    loadPublicProfile(uidToLoad);
    loadUserPosts(uidToLoad); // Carrega os posts do usuário do perfil
});
