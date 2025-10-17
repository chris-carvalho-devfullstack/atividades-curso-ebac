// public-profile.js

import { auth, db, storage } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import {
    doc, getDoc, setDoc, deleteDoc, serverTimestamp, writeBatch,
    collection, query, where, orderBy, onSnapshot, updateDoc, arrayUnion, arrayRemove, addDoc, getDocs
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { ref, deleteObject } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

// =================================================================
// FUNÇÃO DE NOTIFICAÇÃO
// =================================================================

/**
 * Cria uma notificação no Firestore para um usuário específico.
 * @param {string} userId - O UID do usuário que receberá a notificação.
 * @param {string} type - O tipo de notificação (ex: 'friend_request', 'like', 'comment').
 * @param {string} message - A mensagem da notificação.
 * @param {string} url - O URL para onde o usuário será redirecionado ao clicar.
 */
async function createNotification(userId, type, message, url) {
    // Evita que usuários notifiquem a si mesmos
    if (auth.currentUser && userId === auth.currentUser.uid) {
        return;
    }
    try {
        const notificationsRef = collection(db, 'users', userId, 'notifications');
        await addDoc(notificationsRef, {
            type,
            message,
            url,
            read: false,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Erro ao criar notificação:", error);
    }
}


// =================================================================
// FUNÇÕES DE MODAL
// =================================================================

function showInfoModal(title, message) {
    const modal = document.getElementById('infoModal');
    if (!modal) { alert(`${title}\n\n${message}`); return; }
    modal.querySelector('#info-modal-title').textContent = title;
    modal.querySelector('#info-modal-text').textContent = message;
    modal.style.display = 'flex';
    const closeModal = () => modal.style.display = 'none';
    modal.querySelector('#info-modal-close-btn').onclick = closeModal;
    modal.querySelector('#info-modal-close-top').onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };
}

function showConfirmModal(title, message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    if (!modal) { if (confirm(`${title}\n\n${message}`)) onConfirm(); return; }

    const modalTitle = modal.querySelector('#confirm-modal-title');
    const modalBody = modal.querySelector('.modal-body');
    const okBtn = modal.querySelector('#confirm-modal-ok-btn');
    const cancelBtn = modal.querySelector('#confirm-modal-cancel-btn');

    okBtn.textContent = "Confirmar";
    modalBody.innerHTML = `<p id="confirm-modal-text">${message}</p>`;
    if (modalTitle) modalTitle.textContent = title;

    modal.style.display = 'flex';

    okBtn.onclick = () => { onConfirm(); modal.style.display = 'none'; };
    cancelBtn.onclick = () => { modal.style.display = 'none'; };
}

// =================================================================
// ELEMENTOS DO DOM E VARIÁVEIS GLOBAIS
// =================================================================

const usernameHeader = document.getElementById('public-username-header');
const profileImage = document.getElementById('public-profile-image');
const coverPreview = document.getElementById('cover-photo-preview');
const fullname = document.getElementById('public-fullname');
const bio = document.getElementById('public-bio');
const addFriendBtn = document.getElementById('add-friend-btn');
let currentUser;
let profileUid;

// =================================================================
// LÓGICA PRINCIPAL DA PÁGINA
// =================================================================

onAuthStateChanged(auth, (user) => {
    if (!user) { window.location.href = 'login.html'; return; }
    currentUser = user;
    const urlParams = new URLSearchParams(window.location.search);
    profileUid = urlParams.get('uid') || user.uid;
    loadPublicProfile(profileUid);
    loadUserPosts(profileUid);
    loadPublicTasks(profileUid);
});

async function loadPublicProfile(profileUid) {
    if (!profileUid) { fullname.textContent = "Usuário não encontrado."; return; }
    addFriendBtn.style.display = 'none';

    try {
        const docRef = doc(db, "users", profileUid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            document.title = data.fullname || data.username || "Perfil de Usuário";
            usernameHeader.textContent = data.username ? `@${data.username}` : "Usuário";
            profileImage.src = data.fotoURL || "https://via.placeholder.com/150";
            coverPreview.src = data.coverURL || "https://via.placeholder.com/800x250/e0e0e0/ffffff?text=+";
            fullname.textContent = data.fullname || "Nome não informado";
            bio.textContent = data.bio || "Este usuário ainda não escreveu uma bio.";

            document.getElementById('public-birthdate').textContent = data.birthdate || "Data não informada";
            document.getElementById('public-phone').textContent = data.phone || "Contato não informado";
            document.getElementById('public-instagram').textContent = data.instagram || "Instagram não informado";
            
            const linkedin = document.getElementById('public-linkedin');
            if (data.linkedin) {
                linkedin.href = data.linkedin;
                linkedin.textContent = data.linkedin;
            } else {
                linkedin.textContent = "LinkedIn não informado";
                linkedin.removeAttribute('href');
            }

            if (currentUser.uid !== profileUid) {
                updateFriendButtonStatus(profileUid);
            }
        } else {
            fullname.textContent = "Perfil não encontrado.";
        }
    } catch (error) {
        console.error("Erro ao carregar perfil público:", error);
    }
}

async function updateFriendButtonStatus(profileUid) {
    addFriendBtn.style.display = 'block';
    addFriendBtn.disabled = true;

    const friendDoc = await getDoc(doc(db, "users", currentUser.uid, "friends", profileUid));
    const requestSentDoc = await getDoc(doc(db, "users", profileUid, "friendRequests", currentUser.uid));
    const requestReceivedDoc = await getDoc(doc(db, "users", currentUser.uid, "friendRequests", profileUid));

    addFriendBtn.disabled = false;
    addFriendBtn.onclick = null;

    if (friendDoc.exists()) {
        addFriendBtn.textContent = "Amigos";
        addFriendBtn.className = 'btn-primary btn-amigos';
        addFriendBtn.onclick = () => showConfirmModal("Remover Amigo", `Tem certeza que deseja remover este usuário?`, () => removeFriend(currentUser.uid, profileUid));
    } else if (requestSentDoc.exists()) {
        addFriendBtn.textContent = "Pedido Enviado";
        addFriendBtn.disabled = true;
        addFriendBtn.className = 'btn-neutral';
    } else if (requestReceivedDoc.exists()){
        addFriendBtn.textContent = "Aceitar Pedido";
        addFriendBtn.className = 'btn-primary';
        addFriendBtn.onclick = () => window.location.href = 'friends.html?tab=requests';
    } else {
        addFriendBtn.textContent = "Adicionar Amigo";
        addFriendBtn.className = 'btn-primary';
        addFriendBtn.onclick = () => sendFriendRequest(profileUid);
    }
}

async function sendFriendRequest(profileUid) {
    addFriendBtn.disabled = true;
    addFriendBtn.textContent = "Enviando...";
    try {
        await setDoc(doc(db, "users", profileUid, "friendRequests", currentUser.uid), { from: currentUser.uid, timestamp: serverTimestamp() });
        
        // *** CRIAR NOTIFICAÇÃO PARA O DESTINATÁRIO ***
        const currentUserDoc = await getDoc(doc(db, "users", currentUser.uid));
        const currentUsername = currentUserDoc.data().username || 'Alguém';
        await createNotification(
            profileUid,
            'friend_request',
            `@${currentUsername} enviou um pedido de amizade.`,
            '/friends.html?tab=requests'
        );

        showInfoModal("Sucesso!", "Seu pedido de amizade foi enviado.");
        updateFriendButtonStatus(profileUid);
    } catch (error) {
        console.error("Erro ao enviar pedido:", error);
        showInfoModal("Erro", "Não foi possível enviar o pedido. Verifique suas permissões de banco de dados.");
        updateFriendButtonStatus(profileUid);
    }
}

async function removeFriend(currentUserUid, friendUid) {
    const batch = writeBatch(db);
    batch.delete(doc(db, "users", currentUserUid, "friends", friendUid));
    batch.delete(doc(db, "users", friendUid, "friends", currentUserUid));
    try {
        await batch.commit();
        showInfoModal("Amizade Desfeita", "Vocês não são mais amigos.");
        updateFriendButtonStatus(friendUid);
    } catch (error) {
        console.error("Erro ao remover amigo:", error);
    }
}

// =================================================================
// LÓGICA DE TAREFAS PÚBLICAS
// =================================================================

async function loadPublicTasks(uid) {
    const tasksList = document.getElementById('public-tasks-list');
    if (!tasksList) return;
    tasksList.innerHTML = '<li>Carregando tarefas...</li>';

    const tasksRef = collection(db, 'users', uid, 'tasks');
    const q = query(tasksRef, where('privacy', '==', 'public'), orderBy('createdAt', 'desc'));

    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            tasksList.innerHTML = '<li>Este usuário não tem tarefas públicas.</li>';
            return;
        }

        tasksList.innerHTML = '';
        querySnapshot.forEach(doc => {
            renderPublicTask(doc.id, doc.data());
        });
    } catch (error) {
        console.error("Erro ao carregar tarefas públicas:", error);
        tasksList.innerHTML = '<li>Ocorreu um erro ao carregar as tarefas.</li>';
    }
}

function renderPublicTask(taskId, taskData) {
    const tasksList = document.getElementById('public-tasks-list');
    const li = document.createElement('li');
    li.className = 'public-task-item';
    li.innerHTML = `
        <span class="task-text">${taskData.text}</span>
        <button class="btn-import-task" data-task-id="${taskId}">
            <i class="fa fa-download"></i> Importar
        </button>
    `;
    tasksList.appendChild(li);

    li.querySelector('.btn-import-task').addEventListener('click', function() {
        this.disabled = true;
        this.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Solicitando...';
        requestTaskImport(profileUid, taskId, this);
    });
}

async function requestTaskImport(ownerUid, taskId, buttonElement) {
    try {
        const taskText = buttonElement.parentElement.querySelector('.task-text').textContent;
        const requestsRef = collection(db, "users", ownerUid, "taskImportRequests");
        await addDoc(requestsRef, {
            fromUid: currentUser.uid,
            fromUsername: auth.currentUser.displayName || 'Usuário',
            taskId: taskId,
            status: 'pending',
            timestamp: serverTimestamp()
        });
        
        // *** CRIAR NOTIFICAÇÃO PARA O DONO DA TAREFA ***
        const currentUserDoc = await getDoc(doc(db, "users", currentUser.uid));
        const currentUsername = currentUserDoc.data().username || 'Alguém';
        await createNotification(
            ownerUid,
            'task_import_request',
            `@${currentUsername} quer importar sua tarefa: "${taskText}".`,
            '/friends.html?tab=task-requests'
        );

        showInfoModal('Sucesso!', 'Sua solicitação para importar a tarefa foi enviada.');
        buttonElement.innerHTML = '<i class="fa fa-check"></i> Solicitado';
    } catch (error) {
        console.error("Erro ao solicitar importação de tarefa:", error);
        showInfoModal('Erro', 'Não foi possível enviar a solicitação.');
        buttonElement.disabled = false;
        buttonElement.innerHTML = '<i class="fa fa-download"></i> Importar';
    }
}

// =================================================================
// LÓGICA DE POSTS E COMENTÁRIOS
// =================================================================

function loadUserPosts(uid) {
    const container = document.getElementById('user-posts-list');
    if (!container) return;
    container.innerHTML = '<p style="text-align: center;">Carregando...</p>';
    const q = query(collection(db, 'posts'), where('userId', '==', uid), orderBy('timestamp', 'desc'));
    onSnapshot(q, s => {
        container.innerHTML = s.empty ? '<p style="text-align: center;">Nenhuma publicação encontrada.</p>' : '';
        s.forEach(d => renderPostOnProfile(d.data(), d.id));
    }, e => console.error("Erro ao carregar posts:", e));
}

function renderPostOnProfile(post, postId) {
    const postCard = document.createElement('div');
    postCard.className = 'post-card';
    document.getElementById('user-posts-list').appendChild(postCard);

    const isLiked = currentUser && post.likes.includes(currentUser.uid);
    const isOwner = currentUser && currentUser.uid === post.userId;
    const linkedContent = linkifyContent(post.content);

    postCard.innerHTML = `
        <div class="post-header">
            <div class="post-author-details">
                <a href="public-profile.html?uid=${post.userId}" class="post-author-link"><img src="${post.userProfileImage}" alt="Foto"></a>
                <div class="post-author-info">
                    <a href="public-profile.html?uid=${post.userId}" class="post-author-link"><span class="username">${post.username}</span></a>
                    <span class="timestamp">${post.timestamp ? post.timestamp.toDate().toLocaleString('pt-BR') : 'Agora'}</span>
                </div>
            </div>
            ${isOwner ? `<div class="post-options"><button class="post-options-btn"><i class="fa-solid fa-ellipsis-vertical"></i></button><div class="options-menu"><button class="delete-btn"><i class="fa-solid fa-trash"></i> Apagar</button></div></div>` : ''}
        </div>
        <div class="post-content"><p>${linkedContent}</p></div>
        ${post.imageUrl ? `<div class="post-media"><img src="${post.imageUrl}" alt="Mídia"></div>` : ''}
        <div class="post-footer">
            <button class="action-btn like-btn ${isLiked ? 'liked' : ''}"><i class="fa fa-heart"></i> ${post.likes.length}</button>
            <button class="action-btn comment-btn"><i class="fa fa-comment"></i> ${post.commentCount || 0}</button>
            <button class="action-btn share-btn"><i class="fa fa-share"></i> Compartilhar</button>
        </div>
        <div class="comments-section" style="display: none;">
            <form class="comment-form" data-parent-id="root"><input type="text" placeholder="Adicione um comentário..." required><button type="submit">Comentar</button></form>
            <div class="comments-list"></div>
        </div>
    `;

    if (isOwner) {
        postCard.querySelector('.post-options-btn').addEventListener('click', e => { e.stopPropagation(); e.target.closest('.post-options').querySelector('.options-menu').classList.toggle('active'); });
        postCard.querySelector('.delete-btn').addEventListener('click', () => showConfirmModal('Apagar Publicação', 'Tem certeza?', () => deletePost(postId, post.imageUrl)));
    }

    loadAndRenderComments(postId, postCard.querySelector('.comments-list'));
    postCard.querySelector('.like-btn').addEventListener('click', () => toggleLike(postId, post.userId));
    postCard.querySelector('.comment-btn').addEventListener('click', (e) => {
        const commentsSection = e.target.closest('.post-card').querySelector('.comments-section');
        commentsSection.style.display = commentsSection.style.display === 'none' ? 'block' : 'none';
    });
    postCard.querySelector('.comment-form').addEventListener('submit', e => {
        e.preventDefault();
        const input = e.target.querySelector('input');
        if (input.value.trim()) { addComment(postId, input.value.trim(), e.target.dataset.parentId, post.userId); input.value = ''; }
    });
    postCard.querySelector('.share-btn').addEventListener('click', () => sharePost(postId, post.content));
}

async function addComment(postId, text, parentId, postOwnerId) {
    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    const userData = userDoc.data();
    const batch = writeBatch(db);
    const newCommentRef = doc(collection(db, 'posts', postId, 'comments'));
    batch.set(newCommentRef, { userId: currentUser.uid, username: userData.username, userProfileImage: userData.fotoURL, commentText: text, parentId: parentId, timestamp: serverTimestamp(), likes: [] });
    
    const postRef = doc(db, 'posts', postId);
    const postDoc = await getDoc(postRef);
    batch.update(postRef, { commentCount: (postDoc.data().commentCount || 0) + 1 });
    await batch.commit();

    // *** CRIAR NOTIFICAÇÃO PARA O DONO DO POST ***
    await createNotification(
        postOwnerId,
        'comment',
        `@${userData.username} comentou na sua publicação.`,
        `/feed.html#post-${postId}` // Idealmente, o feed.html deve conseguir rolar para o post
    );
}

async function toggleLike(postId, postOwnerId) {
    const ref = doc(db, 'posts', postId);
    const docSnap = await getDoc(ref);
    if (docSnap.exists()) {
        const postData = docSnap.data();
        const isLiked = postData.likes.includes(currentUser.uid);
        
        await updateDoc(ref, { likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid) });

        // *** CRIAR NOTIFICAÇÃO DE LIKE (APENAS QUANDO CURTE, NÃO QUANDO DESCURTE) ***
        if (!isLiked) {
            const currentUserDoc = await getDoc(doc(db, "users", currentUser.uid));
            const currentUsername = currentUserDoc.data().username || 'Alguém';
            await createNotification(
                postOwnerId,
                'like',
                `@${currentUsername} curtiu sua publicação.`,
                `/feed.html#post-${postId}`
            );
        }
    }
}


// (O resto das funções de comentário, share, delete, etc. não precisam criar notificações e permanecem iguais)
// ...
function linkifyContent(text) {
    if (!text) return '';
    let linkedText = text.replace(/#(\w+)/g, '<a href="hashtag.html?tag=$1" class="hashtag-link">#$1</a>');
    linkedText = linkedText.replace(/@(\w+)/g, '<a href="#" class="usertag-link" data-username="$1">@$1</a>');
    return linkedText;
}

async function loadAndRenderComments(postId, container, parentId = 'root') {
    const q = query(collection(db, 'posts', postId, 'comments'), where("parentId", "==", parentId), orderBy('timestamp', 'asc'));
    onSnapshot(q, snapshot => {
        snapshot.docChanges().forEach(change => {
            const el = container.querySelector(`[data-comment-id="${change.doc.id}"]`);
            if (change.type === "added" && !el) renderComment(postId, change.doc.id, change.doc.data(), container);
            if (change.type === "modified" && el) {
                const textSpan = el.querySelector('.comment-text');
                if (textSpan) textSpan.innerHTML = linkifyContent(change.doc.data().commentText);
                const likeBtn = el.querySelector('.like-comment-btn');
                if (likeBtn) {
                    likeBtn.innerHTML = `<i class="fa fa-heart"></i> ${change.doc.data().likes.length}`;
                    likeBtn.classList.toggle('liked', change.doc.data().likes.includes(currentUser.uid));
                }
            }
            if (change.type === "removed" && el) el.remove();
        });
    });
}

function renderComment(postId, commentId, data, container) {
    const el = document.createElement('div');
    el.className = 'comment';
    el.dataset.commentId = commentId;
    const isOwner = currentUser.uid === data.userId;
    const isLiked = data.likes.includes(currentUser.uid);

    el.innerHTML = `
        <a href="public-profile.html?uid=${data.userId}" class="comment-author-link"><img src="${data.userProfileImage}" alt="Foto"></a>
        <div class="comment-body">
            <div class="comment-content-wrapper">
                <div class="comment-content">
                    <a href="public-profile.html?uid=${data.userId}" class="comment-author-link"><strong>${data.username}</strong></a>
                    <span class="comment-text">${linkifyContent(data.commentText)}</span>
                </div>
                ${isOwner ? `<div class="post-options comment-options"><button class="post-options-btn comment-options-btn"><i class="fa-solid fa-ellipsis-vertical"></i></button><div class="options-menu"><button class="edit-comment-btn"><i class="fa fa-pencil"></i> Editar</button><button class="delete-comment-btn"><i class="fa fa-trash"></i> Apagar</button></div></div>` : ''}
            </div>
            <div class="comment-actions">
                <button class="comment-action-btn like-comment-btn ${isLiked ? 'liked' : ''}"><i class="fa fa-heart"></i> ${data.likes.length}</button>
                <button class="comment-action-btn reply-btn">Responder</button>
            </div>
            <div class="replies-container"></div>
            <div class="reply-form-container" style="display:none;"><form class="comment-form" data-parent-id="${commentId}"><input type="text" placeholder="Escreva uma resposta..." required><button type="submit">Responder</button></form></div>
        </div>
    `;
    container.appendChild(el);

    if (isOwner) {
        el.querySelector('.comment-options-btn').addEventListener('click', e => { e.stopPropagation(); e.target.closest('.comment-options').querySelector('.options-menu').classList.toggle('active'); });
        el.querySelector('.delete-comment-btn').addEventListener('click', () => showConfirmModal('Apagar Comentário', 'Certeza?', () => deleteComment(postId, commentId)));
        el.querySelector('.edit-comment-btn').addEventListener('click', () => openEditCommentModal(postId, commentId, data.commentText));
    }

    el.querySelector('.like-comment-btn').addEventListener('click', () => toggleCommentLike(postId, commentId, data.userId));
    el.querySelector('.reply-btn').addEventListener('click', () => el.querySelector('.reply-form-container').style.display = 'block');
    el.querySelector('.comment-form').addEventListener('submit', e => {
        e.preventDefault();
        const input = e.target.querySelector('input');
        if (input.value.trim()) { addComment(postId, input.value.trim(), e.target.dataset.parentId, data.userId); input.value = ''; el.querySelector('.reply-form-container').style.display = 'none'; }
    });

    loadAndRenderComments(postId, el.querySelector('.replies-container'), commentId);
}

async function toggleCommentLike(postId, commentId, commentOwnerId) {
    const ref = doc(db, 'posts', postId, 'comments', commentId);
    const docSnap = await getDoc(ref);
    if (docSnap.exists()) {
        const isLiked = docSnap.data().likes.includes(currentUser.uid);
        await updateDoc(ref, { likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid) });

        if(!isLiked){
            const currentUserDoc = await getDoc(doc(db, "users", currentUser.uid));
            const currentUsername = currentUserDoc.data().username || 'Alguém';
            await createNotification(
                commentOwnerId,
                'like',
                `@${currentUsername} curtiu seu comentário.`,
                `/feed.html#post-${postId}`
            );
        }
    }
}

async function deleteComment(postId, commentId) {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'posts', postId, 'comments', commentId));
    const postRef = doc(db, 'posts', postId);
    const postDoc = await getDoc(postRef);
    batch.update(postRef, { commentCount: Math.max(0, (postDoc.data().commentCount || 1) - 1) });
    await batch.commit();
}

function openEditCommentModal(postId, commentId, currentText) {
    const modal = document.getElementById('confirmModal');
    modal.querySelector('#confirm-modal-title').textContent = "Editar Comentário";
    modal.querySelector('.modal-body').innerHTML = `<textarea id="edit-comment-input" class="editable-textarea" style="min-height: 100px;">${currentText}</textarea>`;
    const okBtn = modal.querySelector('#confirm-modal-ok-btn');
    okBtn.textContent = "Salvar";
    modal.style.display = 'flex';
    document.getElementById('edit-comment-input').focus();
    okBtn.onclick = async () => {
        const newText = document.getElementById('edit-comment-input').value.trim();
        if (newText && newText !== currentText) {
            await updateDoc(doc(db, 'posts', postId, 'comments', commentId), { commentText: newText });
        }
        modal.style.display = 'none';
        // Reset modal to default
        okBtn.textContent = "Confirmar";
        modal.querySelector('.modal-body').innerHTML = '<p id="confirm-modal-text">Você tem certeza?</p>';
    };
}

async function sharePost(postId, postText) {
    const url = `${window.location.origin}/feed.html#${postId}`;
    try {
        if (navigator.share) {
            await navigator.share({ title: 'Veja esta publicação!', text: postText, url });
        } else {
            await navigator.clipboard.writeText(url);
            alert('Link copiado!');
        }
    } catch (err) {
        console.error("Erro ao compartilhar", err);
    }
}

async function deletePost(postId, imageUrl) {
    try {
        await deleteDoc(doc(db, 'posts', postId));
        if (imageUrl) await deleteObject(ref(storage, imageUrl));
    } catch (e) { console.error("Erro ao apagar publicação:", e); }
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.post-options')) {
        document.querySelectorAll('.options-menu.active').forEach(menu => menu.classList.remove('active'));
    }
});