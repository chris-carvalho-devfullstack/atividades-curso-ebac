// friends.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    setDoc, 
    deleteDoc, 
    writeBatch 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// O escopo dos listeners é corrigido para que as funções possam ser chamadas diretamente no HTML
window.acceptFriendRequest = acceptFriendRequest;
window.rejectFriendRequest = rejectFriendRequest;

onAuthStateChanged(auth, user => {
    if (user) {
        loadFriendRequests(user.uid);
        loadFriends(user.uid);
    } else {
        window.location.href = 'login.html';
    }
});

// Lógica das abas
const tabs = document.querySelectorAll('.tab-link');
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelector('.tab-link.active').classList.remove('active');
        document.querySelector('.tab-content.active').classList.remove('active');
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
    });
});

// ===================================
// FUNÇÃO PARA CARREGAR AMIGOS
// ===================================
async function loadFriends(uid) {
    const friendsRef = collection(db, "users", uid, "friends");
    const querySnapshot = await getDocs(friendsRef);
    const friendsList = document.getElementById('friends-list');
    friendsList.innerHTML = ''; // Limpa a lista

    if (querySnapshot.empty) {
        friendsList.innerHTML = '<li style="justify-content:center;">Nenhum amigo ainda.</li>';
        return;
    }

    querySnapshot.forEach(async (friendDoc) => {
        const friendData = await getDoc(doc(db, "users", friendDoc.id));
        if (friendData.exists()) {
            const user = friendData.data();
            const username = user.username || 'Usuário Sem Nome';
            const li = `
                <li>
                    <div class="user-info">
                        <img src="${user.fotoURL || 'https://via.placeholder.com/150'}" alt="Foto de Perfil">
                        <span class="username">@${username}</span>
                    </div>
                    <div class="user-actions">
                        <button onclick="window.location.href='public-profile.html?uid=${friendDoc.id}'">Ver Perfil</button>
                    </div>
                </li>
            `;
            friendsList.innerHTML += li;
        }
    });
}

// ===================================
// FUNÇÃO COMPLETA PARA CARREGAR PEDIDOS DE AMIZADE
// ===================================
async function loadFriendRequests(uid) {
    const requestsRef = collection(db, "users", uid, "friendRequests");
    const querySnapshot = await getDocs(requestsRef);
    const requestsList = document.getElementById('requests-list');
    requestsList.innerHTML = ''; // Limpa a lista

    const badge = document.querySelector('[data-tab="requests"] .badge');
    badge.textContent = querySnapshot.size > 0 ? querySnapshot.size : '';
    badge.style.display = querySnapshot.size > 0 ? 'inline' : 'none';

    if (querySnapshot.empty) {
        requestsList.innerHTML = '<li style="justify-content:center;">Nenhum pedido de amizade pendente.</li>';
        return;
    }

    querySnapshot.forEach(async (requestDoc) => {
        const senderUid = requestDoc.id;
        const senderData = await getDoc(doc(db, "users", senderUid));
        
        if (senderData.exists()) {
            const user = senderData.data();
            const username = user.username || 'Usuário';
            const li = `
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
            requestsList.innerHTML += li;
        }
    });
}

// ===================================
// FUNÇÃO PARA ACEITAR PEDIDO DE AMIZADE
// ===================================
async function acceptFriendRequest(senderUid, receiverUid) {
    const batch = writeBatch(db);

    // 1. Adicionar o REMETENTE à lista de amigos do DESTINATÁRIO
    const receiverFriendsRef = doc(db, "users", receiverUid, "friends", senderUid);
    batch.set(receiverFriendsRef, { addedAt: Date.now() });

    // 2. Adicionar o DESTINATÁRIO à lista de amigos do REMETENTE (amizade mútua)
    const senderFriendsRef = doc(db, "users", senderUid, "friends", receiverUid);
    batch.set(senderFriendsRef, { addedAt: Date.now() });
    
    // 3. Remover o pedido de amizade
    const requestRef = doc(db, "users", receiverUid, "friendRequests", senderUid);
    batch.delete(requestRef);

    try {
        await batch.commit();
        alert("Amigo adicionado com sucesso!");
        // Recarrega as listas após a operação
        loadFriendRequests(receiverUid);
        loadFriends(receiverUid);
    } catch (error) {
        console.error("Erro ao aceitar pedido:", error);
        alert("Erro ao aceitar pedido de amizade. Tente novamente.");
    }
}

// ===================================
// FUNÇÃO PARA REJEITAR PEDIDO DE AMIZADE
// ===================================
async function rejectFriendRequest(senderUid, receiverUid) {
    const requestRef = doc(db, "users", receiverUid, "friendRequests", senderUid);
    
    try {
        await deleteDoc(requestRef);
        alert("Pedido de amizade rejeitado.");
        loadFriendRequests(receiverUid); // Recarrega a lista de pedidos
    } catch (error) {
        console.error("Erro ao rejeitar pedido:", error);
        alert("Erro ao rejeitar pedido de amizade. Tente novamente.");
    }
}