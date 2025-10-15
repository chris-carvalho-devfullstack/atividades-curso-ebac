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

// friends.js (Versão Final com Busca por Username Exato e Modais)

// ===========================
// IMPORTAÇÕES DO FIREBASE
// ===========================
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
    where
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// ===========================
// FUNÇÕES GLOBAIS
// ===========================
window.acceptFriendRequest = acceptFriendRequest;
window.rejectFriendRequest = rejectFriendRequest;

// ===========================
// LISTENER DE AUTENTICAÇÃO
// ===========================
onAuthStateChanged(auth, user => {
    if (user) {
        // Se o usuário estiver logado, carrega os dados e configura os listeners.
        loadFriendRequests(user.uid);
        loadFriends(user.uid);
        setupSearchListeners(user.uid);
        setupTabListeners();
    } else {
        // Se não estiver logado, redireciona para a página de login.
        window.location.href = 'login.html';
    }
});

/**
 * Configura os listeners para a navegação por abas.
 */
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
 * Carrega e exibe a lista de amigos do usuário.
 * @param {string} uid - O ID do usuário logado.
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

/**
 * Carrega e exibe os pedidos de amizade pendentes.
 * @param {string} uid - O ID do usuário logado.
 */
async function loadFriendRequests(uid) {
    const requestsList = document.getElementById('requests-list');
    if (!requestsList) return;
    requestsList.innerHTML = '<li style="justify-content:center;">Carregando pedidos...</li>';

    try {
        const requestsRef = collection(db, "users", uid, "friendRequests");
        const querySnapshot = await getDocs(requestsRef);

        const badge = document.querySelector('[data-tab="requests"] .badge');
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

/**
 * Aceita um pedido de amizade, criando uma relação mútua.
 * @param {string} senderUid - O ID de quem enviou o pedido.
 * @param {string} receiverUid - O ID de quem está aceitando o pedido.
 */
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

/**
 * Rejeita um pedido de amizade.
 * @param {string} senderUid - O ID de quem enviou o pedido.
 * @param {string} receiverUid - O ID de quem está rejeitando o pedido.
 */
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

// ==================================================================
// LÓGICA DE BUSCA
// ==================================================================

/**
 * Busca um usuário por correspondência exata do nome de usuário.
 * @param {string} currentUserUid - O ID do usuário que está realizando a busca.
 * @param {string} searchTerm - O termo a ser buscado (o @username).
 */
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

/**
 * Renderiza a lista de resultados da busca de usuários.
 * @param {Map<string, object>} results - Um Map com os dados dos usuários encontrados.
 */
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

/**
 * Configura o listener do campo de busca para acionar com a tecla "Enter".
 * @param {string} uid - O ID do usuário logado.
 */
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
