// public-profile.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// Elementos da página
const usernameHeader = document.getElementById('public-username-header');
const profileImage = document.getElementById('public-profile-image');
const fullname = document.getElementById('public-fullname');
const birthdate = document.getElementById('public-birthdate');
const phone = document.getElementById('public-phone');
const instagram = document.getElementById('public-instagram');
const linkedin = document.getElementById('public-linkedin');

async function loadPublicProfile(uid) {
    if (!uid) return;
    
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            
            usernameHeader.textContent = data.username ? `@${data.username}` : "Usuário";
            profileImage.src = data.fotoURL || "https://via.placeholder.com/150";
            fullname.textContent = data.fullname || "Nome não informado";
            birthdate.textContent = data.birthdate ? new Date(data.birthdate + 'T00:00:00').toLocaleDateString('pt-BR') : "Data não informada";
            phone.textContent = data.phone || "Contato não informado";
            instagram.textContent = data.instagram || "Instagram não informado";
            
            if (data.linkedin) {
                linkedin.textContent = "Ver Perfil no LinkedIn";
                linkedin.href = data.linkedin;
            } else {
                linkedin.textContent = "LinkedIn não informado";
                linkedin.href = "#";
            }
            
        } else {
            console.log("Perfil não encontrado.");
            fullname.textContent = "Perfil não encontrado.";
        }
    } catch (error) {
        console.error("Erro ao carregar perfil público:", error);
    }
}

// Carrega o perfil do usuário atualmente logado
onAuthStateChanged(auth, (user) => {
    if (user) {
        loadPublicProfile(user.uid);
    } else {
        // Se não estiver logado, pode redirecionar ou mostrar uma mensagem
        console.log("Nenhum usuário logado para exibir o perfil.");
    }
});