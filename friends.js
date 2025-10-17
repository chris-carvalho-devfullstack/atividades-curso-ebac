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

// friends.js (Versão Final com Remoção de Amigo e Modais)

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    deleteDoc,
    writeBatch,
    query,
    where,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// ===========================
// FUNÇÕES GLOBAIS
// ===========================
window.acceptFriendRequest = acceptFriendRequest;
window.rejectFriendRequest = rejectFriendRequest;
window.acceptTaskImport = acceptTaskImport;
window.rejectTaskImport = rejectTaskImport;

/**
 * NOVO: Remove a amizade entre dois usuários de forma mútua.
 * @param {string} currentUserUid - O UID do usuário logado.
 * @param {string} friendUid - O UID do amigo a ser removido.
 */
async function removeFriend(currentUserUid, friendUid) {
    const batch = writeBatch(db);

    const userFriendRef = doc(db, "users", currentUserUid, "friends", friendUid);
    batch.delete(userFriendRef);

    const friendUserRef = doc(db, "users", friendUid, "friends", currentUserUid);
    batch.delete(friendUserRef);

    try {
        await batch.commit();
        showInfoModal("Amizade Desfeita", "A amizade foi desfeita com sucesso.");
        loadFriends(currentUserUid); // Recarrega a lista para refletir a remoção
    } catch (error) {
        console.error("Erro ao remover amigo:", error);
        showInfoModal("Erro", "Não foi possível desfazer a amizade. Tente novamente.");
    }
}

// NOVO: Função intermediária para ser chamada pelo HTML, garantindo a confirmação
window.confirmRemoveFriend = function(friendUid, friendUsername) {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    showConfirmModal(
        "Remover Amigo",
        `Você tem certeza que deseja remover @${friendUsername} da sua lista de amigos?`,
        () => {
            removeFriend(currentUser.uid, friendUid);
        }
    );
};


// ===========================
// LÓGICA PRINCIPAL
// ===========================
onAuthStateChanged(auth, user => {
    if (user) {
        loadFriendRequests(user.uid);
        loadTaskImportRequests(user.uid);
        loadFriends(user.uid);
        setupSearchListeners(user.uid);
        setupTabListeners();
    } else {
        window.location.href = 'login.html';
    }
});

function setupTabListeners() {
    const tabs = document.querySelectorAll('.tab-link');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelector('.tab-link.active')?.classList.remove('active');
            document.querySelector('.tab-content.active')?.classList.remove('active');
            tab.classList.add('active');
            const targetContent = document.getElementById(tab.dataset.tab);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}

/**
 * Carrega e exibe a lista de amigos do usuário (LÓGICA ATUALIZADA).
 */
async function loadFriends(uid) {
    const friendsList = document.getElementById('friends-list');
    if (!friendsList) return;
    friendsList.innerHTML = '<li style="justify-content:center;">Carregando amigos...</li>';

    try {
        const friendsRef = collection(db, "users", uid, "friends");
        const querySnapshot = await getDocs(friendsRef);

        if (querySnapshot.empty) {
            friendsList.innerHTML = '<li style="justify-content:center;">Você ainda não tem amigos. Use a busca para encontrar novos!</li>';
            return;
        }

        const friendPromises = querySnapshot.docs.map(friendDoc => getDoc(doc(db, "users", friendDoc.id)));
        const friendDocs = await Promise.all(friendPromises);

        let friendsHTML = '';
        friendDocs.forEach(friendData => {
            if (friendData.exists()) {
                const user = friendData.data();
                const username = user.username || 'Usuário';
                const fullname = user.fullname ? `(${user.fullname})` : '';
                friendsHTML += `
                    <li>
                        <div class="user-info">
                            <img src="${user.fotoURL || 'https://via.placeholder.com/150'}" alt="Foto de Perfil">
                            <span class="username">@${username} ${fullname}</span>
                        </div>
                        <div class="user-actions">
                            <button onclick="window.location.href='public-profile.html?uid=${friendData.id}'">Ver Perfil</button>
                            <button class="btn-reject" onclick="confirmRemoveFriend('${friendData.id}', '${username}')">Remover</button>
                        </div>
                    </li>
                `;
            }
        });
        friendsList.innerHTML = friendsHTML || '<li style="justify-content:center;">Nenhum amigo encontrado.</li>';

    } catch (error) {
        console.error("Erro ao carregar amigos:", error);
        friendsList.innerHTML = '<li style="justify-content:center; color: #f44336;">Ocorreu um erro ao carregar seus amigos.</li>';
    }
}

// ... (O restante das funções: loadFriendRequests, acceptFriendRequest, rejectFriendRequest, searchUserByUsername, etc., continuam iguais)
async function loadFriendRequests(uid) {
    const requestsList = document.getElementById('requests-list');
    if (!requestsList) return;
    requestsList.innerHTML = '<li style="justify-content:center;">Carregando pedidos...</li>';

    try {
        const requestsRef = collection(db, "users", uid, "friendRequests");
        const querySnapshot = await getDocs(requestsRef);

        const badge = document.getElementById('friend-requests-badge');
        if (badge) {
            badge.textContent = querySnapshot.size > 0 ? querySnapshot.size : '';
            badge.style.display = querySnapshot.size > 0 ? 'inline-block' : 'none';
        }

        if (querySnapshot.empty) {
            requestsList.innerHTML = '<li style="justify-content:center;">Nenhum pedido de amizade pendente.</li>';
            return;
        }

        const requestPromises = querySnapshot.docs.map(requestDoc => getDoc(doc(db, "users", requestDoc.id)));
        const requestDocs = await Promise.all(requestPromises);

        let requestsHTML = '';
        requestDocs.forEach((senderData, index) => {
            if (senderData.exists()) {
                const user = senderData.data();
                const username = user.username || 'Usuário';
                const senderUid = querySnapshot.docs[index].id;
                requestsHTML += `
                    <li>
                        <div class="user-info">
                            <img src="${user.fotoURL || 'https://via.placeholder.com/150'}" alt="Foto de Perfil">
                            <span class="username">@${username}</span>
                        </div>
                        <div class="user-actions">
                            <button class="btn-accept" onclick="acceptFriendRequest('${senderUid}', '${uid}')">Aceitar</button>
                            <button class="btn-reject" onclick="rejectFriendRequest('${senderUid}', '${uid}')">Rejeitar</button>
                        </div>
                    </li>
                `;
            }
        });
        requestsList.innerHTML = requestsHTML || '<li style="justify-content:center;">Nenhum pedido encontrado.</li>';

    } catch (error) {
        console.error("Erro ao carregar pedidos de amizade:", error);
        requestsList.innerHTML = '<li style="justify-content:center; color: #f44336;">Ocorreu um erro ao carregar os pedidos.</li>';
    }
}

// ... (Restante do código de friends.js)
async function loadTaskImportRequests(uid) {
    const requestsList = document.getElementById('task-requests-list');
    if (!requestsList) return;
    requestsList.innerHTML = '<li style="justify-content:center;">Carregando...</li>';

    const requestsRef = collection(db, "users", uid, "taskImportRequests");
    const q = query(requestsRef, where("status", "==", "pending"));
    const querySnapshot = await getDocs(q);

    const badge = document.getElementById('task-requests-badge');
    if (badge) {
        badge.textContent = querySnapshot.size > 0 ? querySnapshot.size : '';
        badge.style.display = querySnapshot.size > 0 ? 'inline-block' : 'none';
    }

    if (querySnapshot.empty) {
        requestsList.innerHTML = '<li style="justify-content:center;">Nenhuma solicitação de importação de tarefa.</li>';
        return;
    }

    let requestsHTML = '';
    querySnapshot.forEach(doc => {
        const request = doc.data();
        requestsHTML += `
            <li>
                <div class="user-info">
                    <span class="username">@${request.fromUsername}</span>
                    <span>solicitou a importação da tarefa: "${request.taskText}"</span>
                </div>
                <div class="user-actions">
                    <button class="btn-accept" onclick="acceptTaskImport('${doc.id}', '${request.fromUid}', '${request.taskId}')">Aceitar</button>
                    <button class="btn-reject" onclick="rejectTaskImport('${doc.id}')">Rejeitar</button>
                </div>
            </li>
        `;
    });
    requestsList.innerHTML = requestsHTML;
}

async function acceptTaskImport(requestId, fromUid, taskId) {
    const ownerUid = auth.currentUser.uid;
    
    try {
        // 1. Pega a tarefa original
        const originalTaskRef = doc(db, "users", ownerUid, "tasks", taskId);
        const taskDoc = await getDoc(originalTaskRef);

        if (!taskDoc.exists()) {
            throw new Error("Tarefa original não encontrada.");
        }
        
        const taskData = taskDoc.data();
        delete taskData.id; // Remove o ID para que o Firestore gere um novo
        taskData.privacy = 'private'; // A tarefa importada se torna privada
        taskData.importedFrom = {
            uid: ownerUid,
            username: auth.currentUser.displayName
        };
        
        // 2. Adiciona a tarefa copiada ao usuário que solicitou
        const requesterTasksRef = collection(db, "users", fromUid, "tasks");
        await addDoc(requesterTasksRef, taskData);

        // 3. Deleta a solicitação
        const requestRef = doc(db, "users", ownerUid, "taskImportRequests", requestId);
        await deleteDoc(requestRef);

        showInfoModal("Sucesso!", "Importação de tarefa aprovada.");
        loadTaskImportRequests(ownerUid);

    } catch (error) {
        console.error("Erro ao aceitar importação:", error);
        showInfoModal("Erro", "Não foi possível aprovar a importação.");
    }
}

async function rejectTaskImport(requestId) {
    const ownerUid = auth.currentUser.uid;
    try {
        const requestRef = doc(db, "users", ownerUid, "taskImportRequests", requestId);
        await deleteDoc(requestRef);
        showInfoModal("Aviso", "Solicitação de importação rejeitada.");
        loadTaskImportRequests(ownerUid);
    } catch (error) {
        console.error("Erro ao rejeitar importação:", error);
        showInfoModal("Erro", "Não foi possível rejeitar a solicitação.");
    }
}


async function acceptFriendRequest(senderUid, receiverUid) {
    const batch = writeBatch(db);
    const receiverFriendsRef = doc(db, "users", receiverUid, "friends", senderUid);
    batch.set(receiverFriendsRef, { addedAt: new Date() });
    const senderFriendsRef = doc(db, "users", senderUid, "friends", receiverUid);
    batch.set(senderFriendsRef, { addedAt: new Date() });
    const requestRef = doc(db, "users", receiverUid, "friendRequests", senderUid);
    batch.delete(requestRef);

    try {
        await batch.commit();
        showInfoModal("Sucesso!", "Amigo adicionado com sucesso!");
        loadFriendRequests(receiverUid);
        loadFriends(receiverUid);
    } catch (error) {
        console.error("Erro ao aceitar pedido:", error);
        showInfoModal("Erro", "Não foi possível aceitar o pedido. Tente novamente.");
    }
}

async function rejectFriendRequest(senderUid, receiverUid) {
    const requestRef = doc(db, "users", receiverUid, "friendRequests", senderUid);
    try {
        await deleteDoc(requestRef);
        showInfoModal("Aviso", "Pedido de amizade rejeitado.");
        loadFriendRequests(receiverUid);
    } catch (error) {
        console.error("Erro ao rejeitar pedido:", error);
        showInfoModal("Erro", "Não foi possível rejeitar o pedido. Tente novamente.");
    }
}

async function searchUserByUsername(currentUserUid, searchTerm) {
    const searchList = document.getElementById('search-list');
    if (!searchList) return;

    const term = searchTerm.toLowerCase().replace('@', '').trim();

    if (term.length < 3) {
        searchList.innerHTML = '<li style="justify-content:center;">Digite um nome de usuário para buscar (mín. 3 caracteres).</li>';
        return;
    }

    searchList.innerHTML = `<li style="justify-content:center;">Buscando por @${term}...</li>`;

    try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("usernameSearch", "==", term));
        const querySnapshot = await getDocs(q);

        const results = new Map();
        querySnapshot.forEach(docSnap => {
            if (docSnap.id !== currentUserUid) {
                results.set(docSnap.id, docSnap.data());
            }
        });

        renderSearchResults(results);

    } catch (error) {
        console.error("Erro na busca por username:", error);
        searchList.innerHTML = '<li style="justify-content:center; color: #f44336;">Ocorreu um erro na busca. Verifique o console.</li>';
    }
}

function renderSearchResults(results) {
    const searchList = document.getElementById('search-list');
    if (!searchList) return;

    if (results.size === 0) {
        searchList.innerHTML = '<li style="justify-content:center;">Nenhum usuário encontrado com este nome.</li>';
        return;
    }

    let searchHTML = '';
    results.forEach((userData, userId) => {
        const username = userData.username || 'Usuário';
        const displayFullname = userData.fullname ? `(${userData.fullname})` : '';

        searchHTML += `
            <li>
                <div class="user-info">
                    <img src="${userData.fotoURL || 'https://via.placeholder.com/150'}" alt="Foto de Perfil">
                    <span class="username">@${username} ${displayFullname}</span>
                </div>
                <div class="user-actions">
                    <button onclick="window.location.href='public-profile.html?uid=${userId}'">Ver Perfil</button>
                </div>
            </li>
        `;
    });
    searchList.innerHTML = searchHTML;
}

function setupSearchListeners(uid) {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); 
            searchUserByUsername(uid, searchInput.value);
        }
    });
}