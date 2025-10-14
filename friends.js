// friends.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

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

// Funções principais
async function loadFriends(uid) {
    const friendsRef = collection(db, "users", uid, "friends");
    const querySnapshot = await getDocs(friendsRef);
    const friendsList = document.getElementById('friends-list');
    friendsList.innerHTML = ''; // Limpa a lista

    querySnapshot.forEach(async (friendDoc) => {
        const friendData = await getDoc(doc(db, "users", friendDoc.id));
        if (friendData.exists()) {
            const user = friendData.data();
            const li = `
                <li>
                    <div class="user-info">
                        <img src="${user.fotoURL || 'https://via.placeholder.com/150'}" alt="Foto de Perfil">
                        <span class="username">@${user.username}</span>
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

async function loadFriendRequests(uid) {
    // ... (implementação similar a loadFriends, mas para a subcoleção "friendRequests")
}

// ... (outras funções como searchUsers, acceptFriendRequest, etc.)