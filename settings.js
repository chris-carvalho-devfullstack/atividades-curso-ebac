// settings.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

let currentUser;

// Elementos da página
const primaryColorPicker = document.getElementById('primary-color-picker');
const secondaryColorPicker = document.getElementById('secondary-color-picker');
const primaryColorValue = document.getElementById('primary-color-value');
const secondaryColorValue = document.getElementById('secondary-color-value');
const saveThemeBtn = document.getElementById('save-theme-btn');
const resetThemeBtn = document.getElementById('reset-theme-btn');
const themeButtons = document.querySelectorAll('.theme-btn');
const messageEl = document.getElementById('settings-message');

// Função para aplicar o tema no site
function applyTheme(primaryColor, secondaryColor) {
    document.documentElement.style.setProperty('--primary-color', primaryColor);
    document.documentElement.style.setProperty('--secondary-color', secondaryColor);

    // Atualiza os seletores de cor na página
    if (primaryColorPicker) primaryColorPicker.value = primaryColor;
    if (secondaryColorPicker) secondaryColorPicker.value = secondaryColor;
    if (primaryColorValue) primaryColorValue.textContent = primaryColor;
    if (secondaryColorValue) secondaryColorValue.textContent = secondaryColor;
}

// Carrega o tema salvo do usuário
async function loadUserTheme(uid) {
    const userRef = doc(db, "users", uid);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists() && docSnap.data().theme) {
        const { primary, secondary } = docSnap.data().theme;
        applyTheme(primary, secondary);
    } else {
        // Aplica o tema padrão se não houver um salvo
        applyTheme('#4CAF50', '#f0f2f5');
    }
}

// Salva o tema no Firestore
async function saveUserTheme(uid, primaryColor, secondaryColor) {
    saveThemeBtn.disabled = true;
    saveThemeBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Salvando...';
    try {
        const userRef = doc(db, "users", uid);
        await setDoc(userRef, {
            theme: {
                primary: primaryColor,
                secondary: secondaryColor
            }
        }, { merge: true });

        messageEl.textContent = 'Tema salvo com sucesso!';
        messageEl.className = 'message success';

    } catch (error) {
        console.error("Erro ao salvar tema: ", error);
        messageEl.textContent = 'Erro ao salvar o tema.';
        messageEl.className = 'message error';
    } finally {
        setTimeout(() => {
            saveThemeBtn.disabled = false;
            saveThemeBtn.textContent = 'Salvar Tema';
            messageEl.textContent = '';
            messageEl.className = 'message';
        }, 2000);
    }
}


// Listeners de Eventos
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loadUserTheme(user.uid);
    } else {
        window.location.href = 'login.html';
    }
});

primaryColorPicker.addEventListener('input', (e) => {
    applyTheme(e.target.value, secondaryColorPicker.value);
});

secondaryColorPicker.addEventListener('input', (e) => {
    applyTheme(primaryColorPicker.value, e.target.value);
});

themeButtons.forEach(button => {
    button.addEventListener('click', () => {
        const primary = button.dataset.primary;
        const secondary = button.dataset.secondary;
        applyTheme(primary, secondary);
    });
});

saveThemeBtn.addEventListener('click', () => {
    if (currentUser) {
        saveUserTheme(currentUser.uid, primaryColorPicker.value, secondaryColorPicker.value);
    }
});

resetThemeBtn.addEventListener('click', () => {
    applyTheme('#4CAF50', '#f0f2f5');
    if (currentUser) {
        saveUserTheme(currentUser.uid, '#4CAF50', '#f0f2f5');
    }
});