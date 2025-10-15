// hashtag.js
import { auth, db, storage } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import {
    collection, query, where, orderBy, onSnapshot,
    doc, getDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { ref, deleteObject } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

let currentUser;

// Pega a tag da URL
const urlParams = new URLSearchParams(window.location.search);
const currentTag = urlParams.get('tag');

const feedPosts = document.getElementById('feed-posts');
const hashtagTitle = document.getElementById('hashtag-title');

if (hashtagTitle && currentTag) {
    hashtagTitle.textContent = `#${currentTag}`;
    document.title = `#${currentTag} - Feed`;
}

onAuthStateChanged(auth, user => {
    if (user) {
        currentUser = user;
        if (currentTag) {
            loadPostsByHashtag(currentTag);
        } else {
            feedPosts.innerHTML = "<p>Nenhuma hashtag especificada.</p>";
            if(hashtagTitle) hashtagTitle.textContent = "Hashtag não encontrada";
        }
    } else {
        window.location.href = "login.html";
    }
});

/**
 * Busca posts no Firestore que contenham a hashtag específica.
 * @param {string} tag - A hashtag para buscar (sem o '#').
 */
function loadPostsByHashtag(tag) {
    feedPosts.innerHTML = "<p>Buscando publicações...</p>";
    try {
        const postsRef = collection(db, 'posts');
        const q = query(postsRef,
            where("hashtags", "array-contains", tag.toLowerCase()),
            orderBy('timestamp', 'desc')
        );

        onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                feedPosts.innerHTML = `<p>Nenhuma publicação encontrada para #${tag}.</p>`;
                return;
            }

            feedPosts.innerHTML = '';
            snapshot.forEach(doc => {
                renderPost(doc.data(), doc.id);
            });
        }, (error) => {
            console.error("Erro ao escutar posts por hashtag:", error);
            feedPosts.innerHTML = "<p style='color: red;'>Ocorreu um erro ao carregar as publicações.</p>";
        });

    } catch (error) {
        console.error("Erro ao buscar posts por hashtag:", error);
        feedPosts.innerHTML = "<p style='color: red;'>Ocorreu um erro ao carregar as publicações.</p>";
    }
}

// =================================================================
// FUNÇÕES REUTILIZADAS DO feed.js (Necessárias para a página funcionar)
// =================================================================

function linkifyHashtags(text) {
    if (!text) return '';
    return text.replace(/#(\w+)/g, '<a href="hashtag.html?tag=$1" class="hashtag-link">#$1</a>');
}

function renderPost(post, postId) {
    const postCard = document.createElement('div');
    postCard.className = 'post-card';

    const timestamp = post.timestamp ? post.timestamp.toDate().toLocaleString('pt-BR') : 'Agora mesmo';
    const isLiked = currentUser && post.likes.includes(currentUser.uid);
    const isOwner = currentUser && currentUser.uid === post.userId;
    const linkedContent = linkifyHashtags(post.content);

    postCard.innerHTML = `
        <div class="post-header">
            <div class="post-author-details">
                <a href="public-profile.html?uid=${post.userId}" class="post-author-link"><img src="${post.userProfileImage}" alt="Foto"></a>
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
        ${post.imageUrl ? `<div class="post-media"><img src="${post.imageUrl}" alt="Mídia"></div>` : ''}
        <div class="post-footer">
            <button class="action-btn like-btn ${isLiked ? 'liked' : ''}"><i class="fa fa-heart"></i> ${post.likes.length}</button>
            <button class="action-btn comment-btn"><i class="fa fa-comment"></i> ${post.comments.length}</button>
            <button class="action-btn share-btn"><i class="fa fa-share"></i> Compartilhar</button>
        </div>
        <div class="comments-section" style="display: none;">
            <form class="comment-form"><input type="text" placeholder="Adicione um comentário..." required><button type="submit">Comentar</button></form>
            <div class="comments-list"></div>
        </div>
    `;

    feedPosts.appendChild(postCard);

    // Event listeners para os botões do post
    if (isOwner) {
        postCard.querySelector('.delete-btn').addEventListener('click', () => {
            showConfirmModal('Apagar Publicação', 'Tem certeza?', () => deletePost(postId, post.imageUrl));
        });
        const optionsBtn = postCard.querySelector('.post-options-btn');
        const optionsMenu = postCard.querySelector('.options-menu');
        optionsBtn.addEventListener('click', e => {
            e.stopPropagation();
            optionsMenu.classList.toggle('active');
        });
    }

    const commentsList = postCard.querySelector('.comments-list');
    if (post.comments && post.comments.length > 0) {
        post.comments.forEach(comment => {
            const commentElement = document.createElement('div');
            commentElement.className = 'comment';
            commentElement.innerHTML = `
                <a href="public-profile.html?uid=${comment.userId}"><img src="${comment.userProfileImage}" alt="Foto"></a>
                <div class="comment-content"><strong>${comment.username}</strong> <span>${comment.commentText}</span></div>`;
            commentsList.appendChild(commentElement);
        });
    }

    postCard.querySelector('.like-btn').addEventListener('click', () => toggleLike(postId));
    postCard.querySelector('.comment-btn').addEventListener('click', () => {
        postCard.querySelector('.comments-section').style.display = postCard.querySelector('.comments-section').style.display === 'none' ? 'block' : 'none';
    });
    postCard.querySelector('.comment-form').addEventListener('submit', e => {
        e.preventDefault();
        addComment(postId, e.target.querySelector('input').value);
        e.target.querySelector('input').value = '';
    });
    postCard.querySelector('.share-btn').addEventListener('click', () => sharePost(postId, post.content));
}

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

async function addComment(postId, commentText) {
    if (!currentUser || !commentText.trim()) return;
    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    const newComment = {
        userId: currentUser.uid,
        username: userDoc.data().username || 'Anônimo',
        userProfileImage: userDoc.data().fotoURL || 'https://via.placeholder.com/150',
        commentText,
        timestamp: new Date()
    };
    await updateDoc(doc(db, 'posts', postId), { comments: arrayUnion(newComment) });
}

async function sharePost(postId, postText) {
    const url = `${window.location.origin}/feed.html#${postId}`;
    try {
        await navigator.share({ title: 'Veja esta publicação!', text: postText, url });
    } catch (err) {
        navigator.clipboard.writeText(url).then(() => alert('Link copiado!'));
    }
}

async function deletePost(postId, imageUrl) {
    try {
        await deleteDoc(doc(db, 'posts', postId));
        if (imageUrl) await deleteObject(ref(storage, imageUrl));
    } catch (error) {
        console.error("Erro ao apagar publicação:", error);
    }
}

function showConfirmModal(title, message, onConfirm) {
    const confirmModal = document.getElementById('confirmModal');
    if (confirmModal) {
        confirmModal.querySelector('#confirm-modal-title').textContent = title;
        confirmModal.querySelector('#confirm-modal-text').textContent = message;
        confirmModal.style.display = 'flex';
        confirmModal.querySelector('#confirm-modal-ok-btn').onclick = () => { onConfirm(); confirmModal.style.display = 'none'; };
        confirmModal.querySelector('#confirm-modal-cancel-btn').onclick = () => { confirmModal.style.display = 'none'; };
    } else if (confirm(`${title}\n\n${message}`)) {
        onConfirm();
    }
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.post-options')) {
        document.querySelectorAll('.options-menu.active').forEach(menu => menu.classList.remove('active'));
    }
});