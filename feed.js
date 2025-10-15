// feed.js
import { auth, db, storage } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import {
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    doc,
    getDoc,
    updateDoc,
    serverTimestamp,
    arrayUnion,
    arrayRemove
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

let currentUser;

onAuthStateChanged(auth, user => {
    if (user) {
        currentUser = user;
        loadPosts();
    } else {
        window.location.href = "login.html";
    }
});

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
    const content = postContent.value.trim();
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

        await addDoc(collection(db, 'posts'), {
            userId: currentUser.uid,
            username: userData.username || 'Anônimo',
            userProfileImage: userData.fotoURL || 'https://via.placeholder.com/150',
            content: content,
            imageUrl: imageUrl,
            timestamp: serverTimestamp(),
            likes: [],
            comments: []
        });

        // Limpar o formulário
        postContent.value = '';
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
            const post = doc.data();
            const postId = doc.id;
            renderPost(post, postId);
        });
    });
}

// Renderizar uma publicação no HTML
function renderPost(post, postId) {
    const postCard = document.createElement('div');
    postCard.className = 'post-card';

    const timestamp = post.timestamp ? post.timestamp.toDate().toLocaleString('pt-BR') : 'Agora mesmo';
    const isLiked = post.likes.includes(currentUser.uid);

    postCard.innerHTML = `
        <div class="post-header">
            <img src="${post.userProfileImage}" alt="Foto do Perfil">
            <div class="post-author-info">
                <span class="username">${post.username}</span>
                <span class="timestamp">${timestamp}</span>
            </div>
        </div>
        <div class="post-content">
            <p>${post.content}</p>
        </div>
        ${post.imageUrl ? `<div class="post-media"><img src="${post.imageUrl}" alt="Mídia da publicação"></div>` : ''}
        <div class="post-footer">
            <button class="action-btn like-btn ${isLiked ? 'liked' : ''}" data-post-id="${postId}">
                <i class="fa fa-heart"></i> ${post.likes.length}
            </button>
            <button class="action-btn comment-btn"><i class="fa fa-comment"></i> ${post.comments.length}</button>
            <button class="action-btn share-btn"><i class="fa fa-share"></i> Compartilhar</button>
        </div>
        <div class="comments-section" style="display: none;">
            <form class="comment-form" data-post-id="${postId}">
                <input type="text" placeholder="Adicione um comentário..." required>
                <button type="submit">Comentar</button>
            </form>
            <div class="comments-list">
                </div>
        </div>
    `;

    feedPosts.appendChild(postCard);

    // Event Listeners para as ações
    const likeBtn = postCard.querySelector('.like-btn');
    likeBtn.addEventListener('click', () => toggleLike(postId, isLiked));

    const commentBtn = postCard.querySelector('.comment-btn');
    const commentsSection = postCard.querySelector('.comments-section');
    commentBtn.addEventListener('click', () => {
        commentsSection.style.display = commentsSection.style.display === 'none' ? 'block' : 'none';
    });

    const commentForm = postCard.querySelector('.comment-form');
    commentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const commentText = e.target.querySelector('input').value;
        addComment(postId, commentText);
        e.target.querySelector('input').value = '';
    });
}

// Lógica de curtir/descurtir
async function toggleLike(postId, isLiked) {
    const postRef = doc(db, 'posts', postId);
    try {
        if (isLiked) {
            await updateDoc(postRef, {
                likes: arrayRemove(currentUser.uid)
            });
        } else {
            await updateDoc(postRef, {
                likes: arrayUnion(currentUser.uid)
            });
        }
    } catch (error) {
        console.error("Erro ao curtir:", error);
    }
}

// Adicionar um comentário
async function addComment(postId, commentText) {
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