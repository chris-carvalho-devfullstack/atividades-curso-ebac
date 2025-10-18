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
const shutterstockQuery = document.getElementById('shutterstock-query');
const shutterstockSearchBtn = document.getElementById('shutterstock-search-btn');
const shutterstockResults = document.getElementById('shutterstock-results');


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

// --- Shutterstock API ---
async function searchShutterstock(query) {
    shutterstockResults.innerHTML = 'Buscando...';
    
    // CORREÇÃO FINAL: Usando o Token de Acesso gerado
    const accessToken = 'v2/a0VSWGs5REpuUll1WXpPYzB1Q2N2NXJoUFFUSEJmQmEvNDIwNDI4ODAzL2N1c3RvbWVyLzQvTXI1VjgxVG1aVkgzekFQWEYzWXlMM0phTEZtb2FxOXZvM3pTR2xMUjdiY05aRFJDTmNXSFhyaUtKRnZyRXFvMGVTSjVNblRGMUFZSnB0Y0FFZzdxeThEUFVWTDlIa012Ymw3RGsxYzdNSUlfdllLZlIxYW4wMzJBbGNieUJiLVNVemI2UVRialdudVhxQi1EbEREZ2ZXaW9sY0k0cko3SmRMT3VEQ2t6dDdGaS1STE91Vm1tU05JTjVfZFJSS1N5SlBWSFJ0ZUhRS3JxMHpIa3hZM3NxUS9oTDRsU2xGWjc0Mi0zQzg2bl9ETVNR';

    const url = `https://api.shutterstock.com/v2/images/search?query=${encodeURIComponent(query)}&per_page=10`;

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Erro na API: ${errorData.message || response.statusText}`);
        }

        const data = await response.json();
        displayShutterstockImages(data.data);

    } catch (error) {
        console.error('Erro ao buscar imagens no Shutterstock:', error);
        shutterstockResults.innerHTML = `Erro ao buscar imagens: ${error.message}`;
    }
}

function displayShutterstockImages(images) {
    shutterstockResults.innerHTML = '';
    images.forEach(image => {
        const imageUrl = image.assets.preview.url;
        const button = document.createElement('button');
        button.className = 'theme-btn image-btn';
        button.style.backgroundImage = `url(${imageUrl})`;
        button.addEventListener('click', () => {
            applyTheme(primaryColorPicker.value, secondaryColorPicker.value, imageUrl);
        });
        shutterstockResults.appendChild(button);
    });
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

shutterstockSearchBtn.addEventListener('click', () => {
    const query = shutterstockQuery.value.trim();
    if (query) {
        searchShutterstock(query);
    }
});

shutterstockQuery.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        shutterstockSearchBtn.click();
    }
});