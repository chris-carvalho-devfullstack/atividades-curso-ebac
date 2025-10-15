// feed.js (VERSÃO COMPLETA E ATUALIZADA)

import { auth, db, storage } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import {
    collection, addDoc, query, orderBy, onSnapshot,
    doc, getDoc, updateDoc, serverTimestamp, arrayUnion, arrayRemove, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

// =================================================================
// FUNÇÕES AUXILIARES PARA O EDITOR DE TEXTO COM HIGHLIGHT
// =================================================================

/**
 * Salva a posição atual do cursor dentro de um elemento editável.
 * @param {HTMLElement} element - O elemento contenteditable.
 * @returns {object|null} Um objeto com a informação da posição do cursor.
 */
function saveCursorPosition(element) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(element);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        return {
            container: range.endContainer,
            offset: range.endOffset,
            charCount: preCaretRange.toString().length
        };
    }
    return null;
}

/**
 * Restaura a posição do cursor em um elemento editável.
 * @param {HTMLElement} element - O elemento contenteditable.
 * @param {object} savedPosition - A posição salva pela função saveCursorPosition.
 */
function restoreCursorPosition(element, savedPosition) {
    if (!savedPosition) return;

    const selection = window.getSelection();
    const range = document.createRange();
    let charCount = 0;
    
    function findTextNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const nextCharCount = charCount + node.length;
            if (savedPosition.charCount <= nextCharCount) {
                range.setStart(node, savedPosition.charCount - charCount);
                range.collapse(true);
                return true; // Encontrado
            }
            charCount = nextCharCount;
        } else {
            for (const child of node.childNodes) {
                if (findTextNode(child)) {
                    return true; // Encontrado
                }
            }
        }
        return false; // Não encontrado
    }

    if (element.childNodes.length > 0) {
        findTextNode(element);
    }
    selection.removeAllRanges();
    selection.addRange(range);
}

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
const postContent = document.getElementById('post-content'); // Agora é um DIV editável
const imageUpload = document.getElementById('post-image-upload');
const addImageBtn = document.getElementById('add-image-btn');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const removeImageBtn = document.getElementById('remove-image-btn');
const feedPosts = document.getElementById('feed-posts');

// Event listener para highlight em tempo real
postContent.addEventListener('input', () => {
    const text = postContent.textContent;
    const savedPosition = saveCursorPosition(postContent);

    const highlightedHTML = text.replace(/#(\w+)/g, '<span class="hashtag-highlight">#$1</span>');
    
    if (postContent.innerHTML !== highlightedHTML) {
        postContent.innerHTML = highlightedHTML;
        restoreCursorPosition(postContent, savedPosition);
    }
});

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
    // MODIFICADO: Pega o texto puro do DIV editável
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

        // Extrai hashtags do conteúdo de texto puro
        const hashtags = content.match(/#\w+/g)?.map(tag => tag.substring(1).toLowerCase()) || [];

        await addDoc(collection(db, 'posts'), {
            userId: currentUser.uid,
            username: userData.username || 'Anônimo',
            userProfileImage: userData.fotoURL || 'https://via.placeholder.com/150',
            content: content,
            imageUrl: imageUrl,
            timestamp: serverTimestamp(),
            likes: [],
            comments: [],
            hashtags: hashtags
        });

        // MODIFICADO: Limpa o DIV editável
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

/**
 * Função para transformar hashtags em links <a> no post final.
 * @param {string} text - O texto do conteúdo do post.
 * @returns {string} - O texto com HTML formatado.
 */
function linkifyHashtags(text) {
    if (!text) return '';
    return text.replace(/#(\w+)/g, '<a href="hashtag.html?tag=$1" class="hashtag-link">#$1</a>');
}

// Renderizar uma publicação no HTML
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
            <button class="action-btn comment-btn"><i class="fa fa-comment"></i> ${post.comments.length}</button>
            <button class="action-btn share-btn"><i class="fa fa-share"></i> Compartilhar</button>
        </div>
        <div class="comments-section" style="display: none;">
            <form class="comment-form"><input type="text" placeholder="Adicione um comentário..." required><button type="submit">Comentar</button></form>
            <div class="comments-list"></div>
        </div>
    `;

    feedPosts.appendChild(postCard);

    // Adiciona os event listeners para os botões do post
    if (isOwner) {
        const optionsBtn = postCard.querySelector('.post-options-btn');
        const optionsMenu = postCard.querySelector('.options-menu');
        
        optionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.options-menu.active').forEach(menu => menu !== optionsMenu && menu.classList.remove('active'));
            optionsMenu.classList.toggle('active');
        });

        postCard.querySelector('.delete-btn').addEventListener('click', () => {
            showConfirmModal('Apagar Publicação', 'Tem certeza que deseja apagar? Esta ação não pode ser desfeita.', () => {
                deletePost(postId, post.imageUrl);
            });
        });
    }

    const commentsList = postCard.querySelector('.comments-list');
    if (post.comments && post.comments.length > 0) {
        post.comments.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0)).forEach(comment => {
            const commentElement = document.createElement('div');
            commentElement.className = 'comment';
            commentElement.innerHTML = `
                <a href="public-profile.html?uid=${comment.userId}" class="comment-author-link"><img src="${comment.userProfileImage}" alt="Foto"></a>
                <div class="comment-content">
                    <a href="public-profile.html?uid=${comment.userId}" class="comment-author-link"><strong>${comment.username}</strong></a>
                    <span>${comment.commentText}</span>
                </div>`;
            commentsList.appendChild(commentElement);
        });
    }

    postCard.querySelector('.like-btn').addEventListener('click', () => toggleLike(postId));
    postCard.querySelector('.comment-btn').addEventListener('click', () => {
        const commentsSection = postCard.querySelector('.comments-section');
        const isHidden = commentsSection.style.display === 'none';
        commentsSection.style.display = isHidden ? 'block' : 'none';
        if (isHidden) commentsSection.querySelector('input').focus();
    });
    postCard.querySelector('.comment-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = e.target.querySelector('input');
        if (input.value.trim()) {
            addComment(postId, input.value.trim());
            input.value = '';
        }
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
    if (!currentUser) return;
    const postRef = doc(db, 'posts', postId);
    try {
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
    } catch (error) {
        console.error("Erro ao comentar:", error);
    }
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
    if (confirmModal) {
        const modalTitle = confirmModal.querySelector('#confirm-modal-title');
        const modalText = confirmModal.querySelector('#confirm-modal-text');
        const okBtn = confirmModal.querySelector('#confirm-modal-ok-btn');
        const cancelBtn = confirmModal.querySelector('#confirm-modal-cancel-btn');

        if(modalTitle) modalTitle.textContent = title;
        if(modalText) modalText.textContent = message;
        
        confirmModal.style.display = 'flex';

        okBtn.onclick = () => {
            onConfirm();
            confirmModal.style.display = 'none';
        };
        cancelBtn.onclick = () => {
            confirmModal.style.display = 'none';
        };
    } else {
        if (confirm(`${title}\n\n${message}`)) {
            onConfirm();
        }
    }
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.post-options')) {
        document.querySelectorAll('.options-menu.active').forEach(menu => menu.classList.remove('active'));
    }
});