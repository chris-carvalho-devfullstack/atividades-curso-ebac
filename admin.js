// admin.js (Versão ATUALIZADA - APENAS Usuários e Estatísticas)
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { 
    doc, 
    getDoc, 
    collection, 
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

let currentUser = null;
let currentEditingUser = null;
let originalUsername = '';

// Checar se o usuário é admin
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists() && userDoc.data().role === 'admin') {
            loadStats();
            loadUsers();
            setupSearchListener(); 
        } else {
            alert("Acesso negado. Você não é um administrador.");
            window.location.href = "index.html";
        }
    } else {
        window.location.href = "login.html";
    }
});

// Carregar estatísticas
async function loadStats() {
    const usersCollection = collection(db, "users");
    const postsCollection = collection(db, "posts");
    
    const usersSnapshot = await getDocs(usersCollection);
    const postsSnapshot = await getDocs(postsCollection);
    
    document.getElementById('total-users-stat').textContent = usersSnapshot.size;
    document.getElementById('total-posts-stat').textContent = postsSnapshot.size;
    document.getElementById('total-tasks-stat').textContent = "N/A";
}

// Carregar lista de usuários
async function loadUsers() {
    const usersCollection = collection(db, "users");
    const usersSnapshot = await getDocs(usersCollection);
    const usersTableBody = document.getElementById('users-table-body');
    usersTableBody.innerHTML = '';

    usersSnapshot.forEach(userDoc => {
        const userData = userDoc.data();
        const tr = document.createElement('tr');
        tr.dataset.search = `${userData.email} ${userData.fullname} ${userData.username} ${userDoc.id}`.toLowerCase();
        tr.innerHTML = `
            <td>
                <div class="user-info-cell">
                    <img src="${userData.fotoURL || 'https://via.placeholder.com/150'}" alt="Foto do perfil">
                    <span>${userData.fullname || userData.username || 'Sem nome'}</span>
                </div>
            </td>
            <td>${userData.email}</td>
            <td>${userData.role || 'user'}</td>
            <td>
                <div class="user-actions">
                    <button class="btn-view" data-uid="${userDoc.id}" data-tooltip="Visualizar"><i class="fa fa-eye"></i></button>
                    <button class="btn-edit" data-uid="${userDoc.id}" data-tooltip="Editar"><i class="fa fa-pencil"></i></button>
                    <button class="btn-delete" data-uid="${userDoc.id}" data-tooltip="Apagar Usuário"><i class="fa fa-trash"></i></button>
                </div>
            </td>
        `;
        usersTableBody.appendChild(tr);
    });
}

// Função de busca local
function setupSearchListener() {
    const searchInput = document.getElementById('user-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            const rows = document.querySelectorAll('#users-table-body tr');
            rows.forEach(row => {
                if (row.dataset.search && row.dataset.search.includes(searchTerm)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        });
    }
}

// Lógica de eventos para a tabela
document.getElementById('users-table-body').addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    const uid = button.getAttribute('data-uid');
    if (button.classList.contains('btn-view')) openViewModal(uid);
    if (button.classList.contains('btn-edit')) openEditModal(uid);
    if (button.classList.contains('btn-delete')) {
        if (confirm('Tem certeza que deseja excluir este usuário e todos os seus dados? Esta ação não pode ser desfeita.')) {
            deleteUser(uid);
        }
    }
});

// Resto do código (openViewModal, closeViewModal, openEditModal, closeEditModal, save-user-changes-btn, deleteUser)
// ... (funções modais e de CRUD de usuário continuam as mesmas) ...
async function openViewModal(uid) {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
        const data = userDoc.data();
        const placeholder = "Não informado";

        document.getElementById('view-cover-photo').src = data.coverURL || 'https://via.placeholder.com/800x250/e0e0e0/ffffff?text=+';
        document.getElementById('view-profile-image').src = data.fotoURL || 'https://via.placeholder.com/150';
        document.getElementById('view-fullname').textContent = data.fullname || 'Usuário sem Nome';
        document.getElementById('view-username').textContent = data.username ? `@${data.username}` : '@usuario';
        document.getElementById('view-bio').textContent = data.bio || 'Este usuário ainda não escreveu uma bio.';
        document.getElementById('view-email').textContent = data.email || placeholder;
        document.getElementById('view-role').textContent = (data.role || 'user').toUpperCase();
        document.getElementById('view-birthdate').textContent = data.birthdate || placeholder;
        document.getElementById('view-phone').textContent = data.phone || placeholder;
        document.getElementById('view-instagram').textContent = data.instagram || placeholder;
        
        const linkedinLink = document.getElementById('view-linkedin');
        if (data.linkedin) {
            linkedinLink.href = data.linkedin;
            linkedinLink.textContent = "Ver Perfil";
        } else {
            linkedinLink.textContent = placeholder;
            linkedinLink.removeAttribute('href');
        }

        document.getElementById('viewUserModal').style.display = 'flex';
    } else {
        alert("Não foi possível encontrar os dados deste usuário.");
    }
}

function closeViewModal() {
    document.getElementById('viewUserModal').style.display = 'none';
}
document.getElementById('view-modal-close-top').onclick = closeViewModal;
document.getElementById('view-modal-close-btn').onclick = closeViewModal;

async function openEditModal(uid) {
    currentEditingUser = uid;
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
        const userData = userDoc.data();
        originalUsername = userData.username || '';
        
        document.getElementById('edit-fullname').value = userData.fullname || '';
        document.getElementById('edit-username').value = userData.username || '';
        document.getElementById('edit-bio').value = userData.bio || '';
        document.getElementById('edit-birthdate').value = userData.birthdate || '';
        document.getElementById('edit-phone').value = userData.phone || '';
        document.getElementById('edit-instagram').value = userData.instagram || '';
        document.getElementById('edit-linkedin').value = userData.linkedin || '';
        document.getElementById('edit-email').value = userData.email || '';
        document.getElementById('edit-user-role').value = userData.role || 'user';
        
        document.getElementById('editUserModal').style.display = 'flex';
    }
}

function closeEditModal() {
    document.getElementById('editUserModal').style.display = 'none';
    document.getElementById('edit-message').textContent = '';
    document.getElementById('edit-message').className = 'message';
}
document.getElementById('edit-modal-close-top').onclick = closeEditModal;
document.getElementById('cancel-edit-btn').onclick = closeEditModal;

document.getElementById('save-user-changes-btn').addEventListener('click', async () => {
    const saveButton = document.getElementById('save-user-changes-btn');
    const messageEl = document.getElementById('edit-message');
    
    saveButton.disabled = true;
    saveButton.textContent = 'Salvando...';
    messageEl.textContent = '';
    messageEl.className = 'message';

    const newUsername = document.getElementById('edit-username').value.trim();

    if (newUsername !== originalUsername) {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("usernameSearch", "==", newUsername.toLowerCase()));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            messageEl.textContent = "Este nome de usuário já está em uso.";
            messageEl.classList.add('error');
            saveButton.disabled = false;
            saveButton.textContent = 'Salvar Alterações';
            return;
        }
    }
    
    const userDocRef = doc(db, "users", currentEditingUser);
    try {
        await updateDoc(userDocRef, {
            fullname: document.getElementById('edit-fullname').value,
            username: newUsername,
            usernameSearch: newUsername.toLowerCase(),
            bio: document.getElementById('edit-bio').value,
            birthdate: document.getElementById('edit-birthdate').value,
            phone: document.getElementById('edit-phone').value,
            instagram: document.getElementById('edit-instagram').value,
            linkedin: document.getElementById('edit-linkedin').value,
            role: document.getElementById('edit-user-role').value
        });

        messageEl.textContent = 'Usuário atualizado com sucesso!';
        messageEl.classList.add('success');
        
        setTimeout(() => {
            closeEditModal();
            loadUsers();
        }, 1500);

    } catch (error) {
        console.error("Erro ao atualizar usuário: ", error);
        messageEl.textContent = 'Erro ao atualizar usuário.';
        messageEl.classList.add('error');
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Salvar Alterações';
    }
});

async function deleteUser(uid) {
    if (uid === currentUser.uid) {
        alert("Você não pode excluir sua própria conta de administrador.");
        return;
    }
    try {
        await deleteDoc(doc(db, "users", uid));
        alert('Usuário excluído com sucesso!');
        loadUsers();
    } catch (error) {
        console.error("Erro ao excluir usuário: ", error);
        alert('Erro ao excluir usuário.');
    }
}