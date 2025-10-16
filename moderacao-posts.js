// moderacao-posts.js
import { auth, db, storage } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { 
    doc, 
    getDoc,
    getDocs,
    deleteDoc,
    collection, 
    query,
    orderBy 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { ref, deleteObject } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

let currentUser = null;

// Checar se o usuário é admin
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists() && userDoc.data().role === 'admin') {
            loadAllPosts(); // Carrega apenas os posts
        } else {
            alert("Acesso negado. Você não é um administrador.");
            window.location.href = "index.html";
        }
    } else {
        window.location.href = "login.html";
    }
});

// =============================================
// SEÇÃO: GERENCIAMENTO DE POSTS
// =============================================

// Carrega todos os posts de todos os usuários
async function loadAllPosts() {
    const postsContainer = document.getElementById('admin-posts-feed');
    postsContainer.innerHTML = '<p>Carregando posts...</p>';

    const postsRef = collection(db, 'posts');
    const q = query(postsRef, orderBy('timestamp', 'desc')); // Ordena do mais novo para o mais antigo

    try {
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            postsContainer.innerHTML = '<p>Nenhum post encontrado no site.</p>';
            return;
        }

        postsContainer.innerHTML = ''; // Limpa a mensagem de "carregando"
        querySnapshot.forEach(postDoc => {
            renderPostForAdmin(postDoc.id, postDoc.data());
        });
    } catch (error) {
        console.error("Erro ao carregar todos os posts:", error);
        postsContainer.innerHTML = '<p style="color: red;">Erro ao carregar posts.</p>';
    }
}

// Renderiza um post no painel do admin
function renderPostForAdmin(postId, postData) {
    const postsContainer = document.getElementById('admin-posts-feed');
    const postCard = document.createElement('div');
    postCard.className = 'post-card';

    const timestamp = postData.timestamp ? postData.timestamp.toDate().toLocaleString('pt-BR') : 'Data indisponível';
    const userImage = postData.userProfileImage || 'https://via.placeholder.com/150';

    // Conteúdo do post, similar ao feed.js
    postCard.innerHTML = `
        <div class="post-header">
            <div class="post-author-details">
                <a href="public-profile.html?uid=${postData.userId}" target="_blank"><img src="${userImage}" alt="Foto"></a>
                <div class="post-author-info">
                    <a href="public-profile.html?uid=${postData.userId}" target="_blank"><span class="username">${postData.username}</span></a>
                    <span class="timestamp">${timestamp}</span>
                </div>
            </div>
            <div class="post-options">
                <button class="admin-delete-post-btn" data-post-id="${postId}" data-image-url="${postData.imageUrl || ''}"><i class="fa fa-trash"></i> Apagar Post</button>
            </div>
        </div>
        <div class="post-content"><p>${postData.content}</p></div>
        ${postData.imageUrl ? `<div class="post-media"><img src="${postData.imageUrl}" alt="Mídia"></div>` : ''}
    `;

    postsContainer.appendChild(postCard);
}

// Event listener para os botões de apagar post
document.addEventListener('click', (e) => {
    const deleteButton = e.target.closest('.admin-delete-post-btn');
    if (deleteButton) {
        const postId = deleteButton.getAttribute('data-post-id');
        const imageUrl = deleteButton.getAttribute('data-image-url');
        
        showConfirmModal('Apagar Post', `Tem certeza que deseja apagar o post? Esta ação não pode ser desfeita.`, () => {
            adminDeletePost(postId, imageUrl);
        });
    }
});

// Função para o admin apagar qualquer post
async function adminDeletePost(postId, imageUrl) {
    try {
        await deleteDoc(doc(db, 'posts', postId));
        if (imageUrl) {
            const imageRef = ref(storage, imageUrl);
            await deleteObject(imageRef);
        }
        alert('Post apagado com sucesso!');
        loadAllPosts(); // Recarrega a lista de posts
    } catch (error) {
        console.error("Erro ao apagar post (admin):", error);
        alert("Ocorreu um erro ao apagar o post.");
    }
}

// Função utilitária de modal de confirmação
function showConfirmModal(title, message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    if (!modal) { if (confirm(`${title}\n\n${message}`)) onConfirm(); return; }
    
    const modalTitle = modal.querySelector('#confirm-modal-title');
    const modalBody = modal.querySelector('.modal-body');
    const okBtn = modal.querySelector('#confirm-modal-ok-btn');
    const cancelBtn = modal.querySelector('#confirm-modal-cancel-btn');

    modalBody.innerHTML = `<p id="confirm-modal-text">${message}</p>`;
    if (modalTitle) modalTitle.textContent = title;
    
    modal.style.display = 'flex';

    okBtn.onclick = () => { onConfirm(); modal.style.display = 'none'; };
    cancelBtn.onclick = () => { modal.style.display = 'none'; };
}