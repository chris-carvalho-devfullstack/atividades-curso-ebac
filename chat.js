// chat.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    addDoc,
    serverTimestamp,
    doc,
    getDoc,
    getDocs,
    limit,
    setDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

let currentUser;

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        initializeChatListeners();
    }
});

function createChatWindow(friend) {
    const existingChat = document.getElementById(`chat-box-${friend.uid}`);
    if (existingChat) {
        existingChat.classList.remove('collapsed');
        return;
    }

    const chatContainer = document.querySelector('.chat-container');

    const chatBox = document.createElement('div');
    chatBox.className = 'chat-box';
    chatBox.id = `chat-box-${friend.uid}`;

    chatBox.innerHTML = `
        <div class="chat-header">
            <div class="user-info">
                <img src="${friend.photoURL || 'https://via.placeholder.com/150'}" alt="Foto de ${friend.username}">
                <span>${friend.username}</span>
            </div>
            <div class="actions">
                <button class="close-chat-btn">&times;</button>
            </div>
            <div class="chat-notification-badge"></div>
        </div>
        <div class="chat-body">
            <div class="messages-list"></div>
        </div>
        <div class="chat-footer">
            <input type="text" placeholder="Digite uma mensagem...">
            <button class="send-message-btn"><i class="fa fa-paper-plane"></i></button>
        </div>
    `;

    chatContainer.appendChild(chatBox);
    setupChatBoxEventListeners(chatBox, friend);
    loadMessages(chatBox, friend);
}

function setupChatBoxEventListeners(chatBox, friend) {
    const header = chatBox.querySelector('.chat-header');
    const closeBtn = chatBox.querySelector('.close-chat-btn');
    const sendBtn = chatBox.querySelector('.send-message-btn');
    const input = chatBox.querySelector('.chat-footer input');
    const badge = chatBox.querySelector('.chat-notification-badge');

    header.addEventListener('click', () => {
        chatBox.classList.toggle('collapsed');
        if (!chatBox.classList.contains('collapsed')) {
            // Ao expandir, esconde o badge e reseta a contagem
            badge.style.display = 'none';
            badge.textContent = '0';
            // Aqui você adicionaria a lógica para marcar as mensagens como lidas no banco de dados
        }
    });

    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chatBox.remove();
    });

    sendBtn.addEventListener('click', () => {
        sendMessage(input.value, friend.uid);
        input.value = '';
    });

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage(input.value, friend.uid);
            input.value = '';
        }
    });
}

async function sendMessage(text, receiverId) {
    if (!text.trim()) return;

    const chatId = [currentUser.uid, receiverId].sort().join('_');
    const chatDocRef = doc(db, 'chats', chatId);
    const messagesRef = collection(chatDocRef, 'messages');

    // Garante que o documento do chat exista com os participantes
    const chatDoc = await getDoc(chatDocRef);
    if (!chatDoc.exists()) {
        await setDoc(chatDocRef, {
            participants: [currentUser.uid, receiverId],
            lastUpdate: serverTimestamp()
        });
    } else {
        await updateDoc(chatDocRef, {
            lastUpdate: serverTimestamp()
        });
    }

    await addDoc(messagesRef, {
        text,
        senderId: currentUser.uid,
        receiverId,
        timestamp: serverTimestamp(),
        read: false
    });
}

function loadMessages(chatBox, friend) {
    const messagesList = chatBox.querySelector('.messages-list');
    const chatId = [currentUser.uid, friend.uid].sort().join('_');
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('timestamp', 'desc'), limit(50));

    onSnapshot(q, (snapshot) => {
        messagesList.innerHTML = '';
        snapshot.docs.reverse().forEach(doc => {
            const message = doc.data();
            const messageEl = document.createElement('div');
            messageEl.className = `message ${message.senderId === currentUser.uid ? 'sent' : 'received'}`;
            messageEl.textContent = message.text;
            messagesList.appendChild(messageEl);
        });
        // Rola para a mensagem mais recente
        const chatBody = chatBox.querySelector('.chat-body');
        chatBody.scrollTop = chatBody.scrollHeight;
    });
}

function initializeChatListeners() {
    if (!currentUser) return;

    const chatsRef = collection(db, 'chats');
    // Query para escutar apenas os chats onde o usuário atual é um participante
    const q = query(chatsRef, where('participants', 'array-contains', currentUser.uid));

    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            // Nos interessa quando um chat é modificado (nova mensagem)
            if (change.type === "modified") {
                const chatId = change.doc.id;
                const messagesRef = collection(db, 'chats', chatId, 'messages');
                // Query para buscar a última mensagem não lida enviada PARA o usuário atual
                const q2 = query(messagesRef, where('receiverId', '==', currentUser.uid), where('read', '==', false), orderBy('timestamp', 'desc'), limit(1));

                const messageSnapshot = await getDocs(q2);
                if (!messageSnapshot.empty) {
                    const newMessage = messageSnapshot.docs[0].data();
                    const senderId = newMessage.senderId;

                    const userDoc = await getDoc(doc(db, "users", senderId));
                    if (userDoc.exists()) {
                        const friendData = userDoc.data();
                        const friend = {
                            uid: senderId,
                            username: friendData.username || 'Usuário',
                            photoURL: friendData.fotoURL
                        };

                        const existingChat = document.getElementById(`chat-box-${friend.uid}`);
                        if (existingChat) {
                            // Se o chat já existe, expande e/ou mostra notificação
                            const isCollapsed = existingChat.classList.contains('collapsed');
                            existingChat.classList.remove('collapsed'); // Abre a janela

                            if(isCollapsed) { // Só incrementa se estava fechado, para não contar múltiplas vezes
                                const badge = existingChat.querySelector('.chat-notification-badge');
                                badge.style.display = 'flex';
                                badge.textContent = (parseInt(badge.textContent) || 0) + 1;
                            }
                        } else {
                            // Se o chat não existe, cria a janela já com a notificação
                            createChatWindow(friend);
                            const newChatBox = document.getElementById(`chat-box-${friend.uid}`);
                            const badge = newChatBox.querySelector('.chat-notification-badge');
                            badge.style.display = 'flex';
                            badge.textContent = '1';
                        }
                    }
                }
            }
        });
    });
}

// Expõe a função para ser chamada globalmente (a partir de botões no HTML)
window.openChatWith = async (friendUid) => {
    const userDoc = await getDoc(doc(db, "users", friendUid));
    if (userDoc.exists()) {
        const friendData = userDoc.data();
        createChatWindow({
            uid: friendUid,
            username: friendData.username || 'Usuário',
            photoURL: friendData.fotoURL
        });
    }
};