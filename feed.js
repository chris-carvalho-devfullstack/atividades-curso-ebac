// feed.js (VERSÃO COMPLETA E ATUALIZADA COM EDIÇÃO E EXCLUSÃO DE COMENTÁRIOS)

import { auth, db, storage } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import {
    collection, addDoc, query, where, orderBy, onSnapshot,
    doc, getDoc, updateDoc, serverTimestamp, arrayUnion, arrayRemove, deleteDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

// =================================================================
// LÓGICA PRINCIPAL DO FEED
// =================================================================

let currentUser;

onAuthStateChanged(auth, user => {
    if (user) {
        currentUser = user;
        loadPosts();
    } else {
        window.location.href = "login.html";
    }
});

// Seletores de elementos do DOM
const createPostForm = document.getElementById('create-post-form');
const postContent = document.getElementById('post-content');
const imageUpload = document.getElementById('post-image-upload');
const addImageBtn = document.getElementById('add-image-btn');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const removeImageBtn = document.getElementById('remove-image-btn');
const feedPosts = document.getElementById('feed-posts');

// Abrir seletor de arquivo ao clicar no botão de imagem
addImageBtn.addEventListener('click', () => imageUpload.click());

// Mostrar preview da imagem
imageUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            imagePreview.src = event.target.result;
            imagePreviewContainer.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
});

// Remover imagem do preview
removeImageBtn.addEventListener('click', () => {
    imageUpload.value = '';
    imagePreview.src = '#';
    imagePreviewContainer.style.display = 'none';
});

// Criar uma nova publicação
createPostForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = postContent.textContent.trim();
    const file = imageUpload.files[0];

    if (!content && !file) return;

    try {
        let imageUrl = null;
        if (file) {
            const storageRef = ref(storage, `posts/${currentUser.uid}/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            imageUrl = await getDownloadURL(storageRef);
        }

        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        const userData = userDoc.data();
        const hashtags = content.match(/#\w+/g)?.map(tag => tag.substring(1).toLowerCase()) || [];
        const taggedUsers = content.match(/@\w+/g)?.map(tag => tag.substring(1).toLowerCase()) || [];


        await addDoc(collection(db, 'posts'), {
            userId: currentUser.uid,
            username: userData.username || 'Anônimo',
            userProfileImage: userData.fotoURL || 'https://via.placeholder.com/150',
            content: content,
            imageUrl: imageUrl,
            timestamp: serverTimestamp(),
            likes: [],
            commentCount: 0,
            hashtags: hashtags,
            taggedUsers: taggedUsers,
        });

        postContent.innerHTML = '';
        removeImageBtn.click();

    } catch (error) {
        console.error("Erro ao criar publicação:", error);
    }
});


// Carregar as publicações
function loadPosts() {
    const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'));

    onSnapshot(q, (snapshot) => {
        feedPosts.innerHTML = '';
        snapshot.forEach(doc => {
            renderPost(doc.data(), doc.id);
        });
    });
}

function linkifyContent(text) {
    if (!text) return '';
    let linkedText = text.replace(/#(\w+)/g, '<a href="hashtag.html?tag=$1" class="hashtag-link">#$1</a>');
    linkedText = linkedText.replace(/@(\w+)/g, '<a href="#" class="usertag-link" data-username="$1">@$1</a>');
    return linkedText;
}


// Renderizar uma publicação no HTML
function renderPost(post, postId) {
    const postCard = document.createElement('div');
    postCard.className = 'post-card';

    const timestamp = post.timestamp ? post.timestamp.toDate().toLocaleString('pt-BR') : 'Agora mesmo';
    const isLiked = currentUser && post.likes.includes(currentUser.uid);
    const isOwner = currentUser && currentUser.uid === post.userId;

    const linkedContent = linkifyContent(post.content);

    postCard.innerHTML = `
        <div class="post-header">
            <div class="post-author-details">
                <a href="public-profile.html?uid=${post.userId}" class="post-author-link"><img src="${post.userProfileImage}" alt="Foto do Perfil"></a>
                <div class="post-author-info">
                    <a href="public-profile.html?uid=${post.userId}" class="post-author-link"><span class="username">${post.username}</span></a>
                    <span class="timestamp">${timestamp}</span>
                </div>
            </div>
            ${isOwner ? `
            <div class="post-options">
                <button class="post-options-btn"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                <div class="options-menu"><button class="delete-btn"><i class="fa-solid fa-trash"></i> Apagar</button></div>
            </div>` : ''}
        </div>
        <div class="post-content"><p>${linkedContent}</p></div>
        ${post.imageUrl ? `<div class="post-media"><img src="${post.imageUrl}" alt="Mídia da publicação"></div>` : ''}
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

    feedPosts.appendChild(postCard);

    if (isOwner) {
        const optionsBtn = postCard.querySelector('.post-options-btn');
        const optionsMenu = postCard.querySelector('.options-menu');
        optionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Fecha outros menus abertos
            document.querySelectorAll('.options-menu.active').forEach(menu => {
                if (menu !== optionsMenu) menu.classList.remove('active');
            });
            optionsMenu.classList.toggle('active');
        });
        postCard.querySelector('.delete-btn').addEventListener('click', () => {
            showConfirmModal('Apagar Publicação', 'Tem certeza que deseja apagar? Esta ação não pode ser desfeita.', () => {
                deletePost(postId, post.imageUrl);
            });
        });
    }

    const commentsSection = postCard.querySelector('.comments-section');
    const commentsList = postCard.querySelector('.comments-list');
    loadAndRenderComments(postId, commentsList);

    postCard.querySelector('.like-btn').addEventListener('click', () => toggleLike(postId));
    postCard.querySelector('.comment-btn').addEventListener('click', () => {
        commentsSection.style.display = commentsSection.style.display === 'none' ? 'block' : 'none';
    });
    postCard.querySelector('.comment-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = e.target.querySelector('input');
        if (input.value.trim()) {
            addComment(postId, input.value.trim(), e.target.dataset.parentId);
            input.value = '';
        }
    });
    postCard.querySelector('.share-btn').addEventListener('click', () => sharePost(postId, post.content));
}

// =================================================================
// SEÇÃO DE COMENTÁRIOS (COM EDIÇÃO E EXCLUSÃO)
// =================================================================

async function loadAndRenderComments(postId, container, parentId = 'root') {
    const commentsRef = collection(db, 'posts', postId, 'comments');
    const q = query(commentsRef, where("parentId", "==", parentId), orderBy('timestamp', 'asc'));

    onSnapshot(q, snapshot => {
        snapshot.docChanges().forEach(change => {
            const commentId = change.doc.id;
            const commentData = change.doc.data();
            const commentElement = container.querySelector(`[data-comment-id="${commentId}"]`);

            if (change.type === "added") {
                if (!commentElement) {
                    renderComment(postId, commentId, commentData, container);
                }
            }
            if (change.type === "modified") {
                if (commentElement) {
                    // Atualiza apenas o texto e os likes para ser mais eficiente
                    const textSpan = commentElement.querySelector('.comment-text');
                    const likeBtn = commentElement.querySelector('.like-comment-btn');
                    if (textSpan) textSpan.innerHTML = linkifyContent(commentData.commentText);
                    if (likeBtn) {
                        likeBtn.innerHTML = `<i class="fa fa-heart"></i> ${commentData.likes.length}`;
                        likeBtn.classList.toggle('liked', commentData.likes.includes(currentUser.uid));
                    }
                }
            }
            if (change.type === "removed") {
                if (commentElement) {
                    commentElement.remove();
                }
            }
        });
    });
}


function renderComment(postId, commentId, commentData, container) {
    const commentElement = document.createElement('div');
    commentElement.className = 'comment';
    commentElement.dataset.commentId = commentId;
    
    const isOwner = currentUser && currentUser.uid === commentData.userId;
    const isLiked = currentUser && commentData.likes.includes(currentUser.uid);

    commentElement.innerHTML = `
        <a href="public-profile.html?uid=${commentData.userId}" class="comment-author-link"><img src="${commentData.userProfileImage}" alt="Foto"></a>
        <div class="comment-body">
            <div class="comment-content-wrapper">
                <div class="comment-content">
                    <a href="public-profile.html?uid=${commentData.userId}" class="comment-author-link"><strong>${commentData.username}</strong></a>
                    <span class="comment-text">${linkifyContent(commentData.commentText)}</span>
                </div>
                ${isOwner ? `
                <div class="post-options comment-options">
                    <button class="post-options-btn comment-options-btn"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                    <div class="options-menu">
                        <button class="edit-comment-btn"><i class="fa-solid fa-pencil"></i> Editar</button>
                        <button class="delete-comment-btn"><i class="fa-solid fa-trash"></i> Apagar</button>
                    </div>
                </div>` : ''}
            </div>
            <div class="comment-actions">
                <button class="comment-action-btn like-comment-btn ${isLiked ? 'liked' : ''}"><i class="fa fa-heart"></i> ${commentData.likes.length}</button>
                <button class="comment-action-btn reply-btn">Responder</button>
            </div>
            <div class="replies-container"></div>
            <div class="reply-form-container" style="display: none;">
                <form class="comment-form" data-parent-id="${commentId}"><input type="text" placeholder="Escreva uma resposta..." required><button type="submit">Responder</button></form>
            </div>
        </div>
    `;
    container.appendChild(commentElement);

    if (isOwner) {
        const optionsBtn = commentElement.querySelector('.comment-options-btn');
        const optionsMenu = commentElement.querySelector('.options-menu');
        optionsBtn.addEventListener('click', e => {
            e.stopPropagation();
            optionsMenu.classList.toggle('active');
        });

        commentElement.querySelector('.delete-comment-btn').addEventListener('click', () => {
            showConfirmModal('Apagar Comentário', 'Tem certeza que deseja apagar este comentário?', () => {
                deleteComment(postId, commentId);
            });
        });

        commentElement.querySelector('.edit-comment-btn').addEventListener('click', () => {
            openEditCommentModal(postId, commentId, commentData.commentText);
        });
    }

    commentElement.querySelector('.like-comment-btn').addEventListener('click', () => toggleCommentLike(postId, commentId));
    commentElement.querySelector('.reply-btn').addEventListener('click', (e) => {
        const replyFormContainer = e.target.closest('.comment-body').querySelector('.reply-form-container');
        replyFormContainer.style.display = replyFormContainer.style.display === 'none' ? 'block' : 'none';
    });
    
    const replyForm = commentElement.querySelector('.comment-form');
    replyForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = e.target.querySelector('input');
        if (input.value.trim()) {
            addComment(postId, input.value.trim(), e.target.dataset.parentId);
            input.value = '';
            e.target.closest('.reply-form-container').style.display = 'none';
        }
    });

    const repliesContainer = commentElement.querySelector('.replies-container');
    loadAndRenderComments(postId, repliesContainer, commentId);
}

async function addComment(postId, commentText, parentId = 'root') {
    if (!currentUser) return;
    try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        const userData = userDoc.data();
        
        const batch = writeBatch(db);

        const newCommentRef = doc(collection(db, 'posts', postId, 'comments'));
        batch.set(newCommentRef, {
            userId: currentUser.uid,
            username: userData.username || 'Anônimo',
            userProfileImage: userData.fotoURL || 'https://via.placeholder.com/150',
            commentText,
            parentId: parentId,
            timestamp: serverTimestamp(),
            likes: [],
        });
        
        const postRef = doc(db, 'posts', postId);
        const postDoc = await getDoc(postRef);
        const currentCount = postDoc.data().commentCount || 0;
        batch.update(postRef, { commentCount: currentCount + 1 });
        
        await batch.commit();

    } catch (error) {
        console.error("Erro ao adicionar comentário:", error);
    }
}

async function toggleCommentLike(postId, commentId) {
    if (!currentUser) return;
    const commentRef = doc(db, 'posts', postId, 'comments', commentId);
    const commentDoc = await getDoc(commentRef);

    if (!commentDoc.exists()) return;

    const isLiked = commentDoc.data().likes.includes(currentUser.uid);
    await updateDoc(commentRef, {
        likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
    });
}

async function deleteComment(postId, commentId) {
    const commentRef = doc(db, 'posts', postId, 'comments', commentId);
    const postRef = doc(db, 'posts', postId);

    try {
        const batch = writeBatch(db);
        batch.delete(commentRef);

        const postDoc = await getDoc(postRef);
        const currentCount = postDoc.data().commentCount || 0;
        batch.update(postRef, { commentCount: Math.max(0, currentCount - 1) });

        await batch.commit();
    } catch (error) {
        console.error("Erro ao apagar comentário:", error);
    }
}

function openEditCommentModal(postId, commentId, currentText) {
    const modal = document.getElementById('confirmModal');
    const modalTitle = modal.querySelector('#confirm-modal-title');
    const modalBody = modal.querySelector('.modal-body');
    const okBtn = modal.querySelector('#confirm-modal-ok-btn');
    const cancelBtn = modal.querySelector('#confirm-modal-cancel-btn');

    modalTitle.textContent = "Editar Comentário";
    modalBody.innerHTML = `<textarea id="edit-comment-input" class="editable-textarea" style="min-height: 100px;">${currentText}</textarea>`;
    okBtn.textContent = "Salvar";
    
    modal.style.display = 'flex';
    
    document.getElementById('edit-comment-input').focus();

    okBtn.onclick = async () => {
        const newText = document.getElementById('edit-comment-input').value.trim();
        if (newText && newText !== currentText) {
            const commentRef = doc(db, 'posts', postId, 'comments', commentId);
            await updateDoc(commentRef, { commentText: newText });
        }
        // Restaura o modal e o fecha
        modalBody.innerHTML = '<p id="confirm-modal-text">Você tem certeza?</p>';
        okBtn.textContent = "Confirmar";
        modal.style.display = 'none';
    };

    cancelBtn.onclick = () => {
        modalBody.innerHTML = '<p id="confirm-modal-text">Você tem certeza?</p>';
        okBtn.textContent = "Confirmar";
        modal.style.display = 'none';
    };
}


// =================================================================
// FUNÇÕES GERAIS DO POST
// =================================================================

async function toggleLike(postId) {
    if (!currentUser) return;
    const postRef = doc(db, 'posts', postId);
    const postDoc = await getDoc(postRef);
    if (!postDoc.exists()) return;
    const isLiked = postDoc.data().likes.includes(currentUser.uid);
    await updateDoc(postRef, {
        likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
    });
}

async function sharePost(postId, postText) {
    const url = `${window.location.origin}/feed.html#${postId}`;
    const shareData = {
        title: 'Veja esta publicação!',
        text: `Confira: "${postText.substring(0, 100)}..."`,
        url: url,
    };
    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            await navigator.clipboard.writeText(url);
            alert('Link da publicação copiado!');
        }
    } catch (err) {
        if (err.name !== 'AbortError') console.error('Erro ao compartilhar:', err);
    }
}

async function deletePost(postId, imageUrl) {
    try {
        await deleteDoc(doc(db, 'posts', postId));
        if (imageUrl) {
            const imageRef = ref(storage, imageUrl);
            await deleteObject(imageRef);
        }
    } catch (error) {
        console.error("Erro ao apagar publicação:", error);
        alert("Erro ao apagar a publicação.");
    }
}

function showConfirmModal(title, message, onConfirm) {
    const confirmModal = document.getElementById('confirmModal');
    if (!confirmModal) {
        if (confirm(`${title}\n\n${message}`)) onConfirm();
        return;
    }
    const modalTitle = confirmModal.querySelector('#confirm-modal-title');
    const modalText = confirmModal.querySelector('#confirm-modal-text');
    const okBtn = confirmModal.querySelector('#confirm-modal-ok-btn');
    const cancelBtn = confirmModal.querySelector('#confirm-modal-cancel-btn');

    if (modalTitle) modalTitle.textContent = title;
    if (modalText) modalText.textContent = message;
    
    confirmModal.style.display = 'flex';

    okBtn.onclick = () => {
        onConfirm();
        confirmModal.style.display = 'none';
    };
    cancelBtn.onclick = () => {
        confirmModal.style.display = 'none';
    };
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.post-options')) {
        document.querySelectorAll('.options-menu.active').forEach(menu => menu.classList.remove('active'));
    }
});