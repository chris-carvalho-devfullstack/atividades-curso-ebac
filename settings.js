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
const themeButtons = document.querySelectorAll('.theme-btn'); // Seleciona todos os botões de tema
const messageEl = document.getElementById('settings-message');

// Função para aplicar o tema na UI da página de configurações E no body
function updateThemeUI(primaryColor, secondaryColor, backgroundImage = 'none') {
    document.documentElement.style.setProperty('--primary-color', primaryColor);
    document.documentElement.style.setProperty('--secondary-color', secondaryColor);
    document.documentElement.style.setProperty('--background-image', backgroundImage === 'none' ? 'none' : `url(${backgroundImage})`);
    document.documentElement.style.setProperty('--background-size', backgroundImage === 'none' ? 'auto' : 'auto'); // Ou 'cover' dependendo da imagem
    document.documentElement.style.setProperty('--background-repeat', backgroundImage === 'none' ? 'repeat' : 'repeat'); // Ou 'no-repeat'
    document.documentElement.style.setProperty('--background-position', backgroundImage === 'none' ? 'center center' : 'center top'); // Ajuste conforme necessário
    document.documentElement.style.setProperty('--background-attachment', backgroundImage === 'none' ? 'scroll' : 'scroll');

    if (primaryColorPicker) primaryColorPicker.value = primaryColor;
    if (secondaryColorPicker) secondaryColorPicker.value = secondaryColor;
    if (primaryColorValue) primaryColorValue.textContent = primaryColor;
    if (secondaryColorValue) secondaryColorValue.textContent = secondaryColor;

    // Se houver uma imagem de fundo, o picker de cor de fundo não reflete a imagem
    if (backgroundImage !== 'none') {
        secondaryColorValue.textContent = 'Imagem de Fundo';
    } else {
        secondaryColorValue.textContent = secondaryColor;
    }
}

// Salva o tema no Firestore
async function saveUserTheme(uid, primaryColor, secondaryColor, backgroundImage) {
    saveThemeBtn.disabled = true;
    saveThemeBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Salvando...';
    try {
        const userRef = doc(db, "users", uid);
        await setDoc(userRef, {
            theme: {
                primary: primaryColor,
                secondary: secondaryColor,
                backgroundImage: backgroundImage // Salva a URL da imagem de fundo
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
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        // Carrega o tema do usuário no nav.js, mas a página de settings precisa
        // refletir o tema atual na interface imediatamente.
        const userRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists() && docSnap.data().theme) {
            const { primary, secondary, backgroundImage } = docSnap.data().theme;
            updateThemeUI(primary, secondary, backgroundImage || 'none'); // Aplica o tema carregado
        } else {
            // Aplica o tema padrão se não houver um salvo
            updateThemeUI('#4CAF50', '#f0f2f5', 'none');
        }

    } else {
        window.location.href = 'login.html';
    }
});

primaryColorPicker.addEventListener('input', (e) => {
    // Quando a cor primária é alterada, remove a imagem de fundo se houver uma ativa
    updateThemeUI(e.target.value, secondaryColorPicker.value, 'none');
});

secondaryColorPicker.addEventListener('input', (e) => {
    // Quando a cor secundária é alterada, remove a imagem de fundo se houver uma ativa
    updateThemeUI(primaryColorPicker.value, e.target.value, 'none');
});

themeButtons.forEach(button => {
    button.addEventListener('click', () => {
        const primary = button.dataset.primary;
        const secondary = button.dataset.secondary || '#f0f2f5'; // Valor padrão para secondary
        const backgroundImage = button.dataset.backgroundImage || 'none'; // Pega a imagem de fundo

        updateThemeUI(primary, secondary, backgroundImage);
    });
});

saveThemeBtn.addEventListener('click', () => {
    if (currentUser) {
        const currentPrimary = primaryColorPicker.value;
        const currentSecondary = secondaryColorPicker.value;
        const currentBackgroundImage = document.documentElement.style.getPropertyValue('--background-image').replace(/url\(['"]?(.*?)['"]?\)/, '$1') || 'none';
        
        saveUserTheme(currentUser.uid, currentPrimary, currentSecondary, currentBackgroundImage);
    }
});

resetThemeBtn.addEventListener('click', () => {
    const defaultPrimary = '#4CAF50';
    const defaultSecondary = '#f0f2f5';
    const defaultBackgroundImage = 'none'; // Padrão sem imagem
    updateThemeUI(defaultPrimary, defaultSecondary, defaultBackgroundImage);
    if (currentUser) {
        saveUserTheme(currentUser.uid, defaultPrimary, defaultSecondary, defaultBackgroundImage);
    }
});