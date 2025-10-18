// settings.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

let currentUser;

// --- Variável de estado para o tema atual ---
let currentTheme = {
    primary: '#4CAF50',
    secondary: '#f0f2f5',
    backgroundImage: 'none'
};

// --- Elementos da página ---
const primaryColorPicker = document.getElementById('primary-color-picker');
const secondaryColorPicker = document.getElementById('secondary-color-picker');
const primaryColorValue = document.getElementById('primary-color-value');
const secondaryColorValue = document.getElementById('secondary-color-value');
const saveThemeBtn = document.getElementById('save-theme-btn');
const resetThemeBtn = document.getElementById('reset-theme-btn');
const themeButtons = document.querySelectorAll('.theme-btn');
const messageEl = document.getElementById('settings-message');

/**
 * Aplica o tema na UI do site e atualiza a variável de estado 'currentTheme'.
 * @param {string} primary - A cor principal.
 * @param {string} secondary - A cor de fundo sólida.
 * @param {string} [backgroundImage='none'] - A URL da imagem de fundo.
 */
function applyTheme(primary, secondary, backgroundImage = 'none') {
    // Atualiza a variável de estado
    currentTheme = { primary, secondary, backgroundImage };

    // Aplica os estilos no documento
    document.documentElement.style.setProperty('--primary-color', primary);
    document.documentElement.style.setProperty('--secondary-color', secondary);
    document.documentElement.style.setProperty('--background-image', backgroundImage === 'none' ? 'none' : `url(${backgroundImage})`);
    
    // Atualiza os controles na página de configurações
    if (primaryColorPicker) primaryColorPicker.value = primary;
    if (secondaryColorPicker) secondaryColorPicker.value = secondary;
    if (primaryColorValue) primaryColorValue.textContent = primary;

    if (backgroundImage && backgroundImage !== 'none') {
        if (secondaryColorValue) secondaryColorValue.textContent = 'Imagem';
    } else {
        if (secondaryColorValue) secondaryColorValue.textContent = secondary;
    }
}

/**
 * Salva o objeto do tema atual no Firestore.
 * @param {string} uid - O UID do usuário.
 */
async function saveUserTheme(uid) {
    saveThemeBtn.disabled = true;
    saveThemeBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Salvando...';
    try {
        const userRef = doc(db, "users", uid);
        await setDoc(userRef, {
            theme: currentTheme // Salva o objeto de estado inteiro
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

// --- Listeners de Eventos ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const userRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists() && docSnap.data().theme) {
            const { primary, secondary, backgroundImage } = docSnap.data().theme;
            applyTheme(primary, secondary, backgroundImage || 'none');
        } else {
            applyTheme('#4CAF50', '#f0f2f5', 'none');
        }
    } else {
        window.location.href = 'login.html';
    }
});

primaryColorPicker.addEventListener('input', (e) => {
    applyTheme(e.target.value, secondaryColorPicker.value, 'none');
});

secondaryColorPicker.addEventListener('input', (e) => {
    applyTheme(primaryColorPicker.value, e.target.value, 'none');
});

themeButtons.forEach(button => {
    button.addEventListener('click', () => {
        const primary = button.dataset.primary;
        const secondary = button.dataset.secondary || '#f0f2f5';
        const backgroundImage = button.dataset.backgroundImage || 'none';
        applyTheme(primary, secondary, backgroundImage);
    });
});

saveThemeBtn.addEventListener('click', () => {
    if (currentUser) {
        saveUserTheme(currentUser.uid);
    }
});

resetThemeBtn.addEventListener('click', () => {
    const defaultPrimary = '#4CAF50';
    const defaultSecondary = '#f0f2f5';
    applyTheme(defaultPrimary, defaultSecondary, 'none');
    if (currentUser) {
        saveUserTheme(currentUser.uid);
    }
});