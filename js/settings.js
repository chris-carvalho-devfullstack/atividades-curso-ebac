// settings.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
// NOVO: Importa a função do serviço de push
import { requestPushNotificationPermission } from "./push-service.js"; 

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

// --- NOVOS ELEMENTOS DE CONFIGURAÇÃO ---
const notifyLikes = document.getElementById('notify-likes');
const notifyComments = document.getElementById('notify-comments');
const notifyFriendRequests = document.getElementById('notify-friend-requests');
const notifyTaskImports = document.getElementById('notify-task-imports');
const notificationChannel = document.getElementById('notification-channel');
const taskAlertLeadTime = document.getElementById('task-alert-lead-time');


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
 * Salva todas as configurações (Tema, Notificação e Tarefas) no Firestore.
 * @param {string} uid - O UID do usuário.
 */
async function saveUserSettings(uid) {
    saveThemeBtn.disabled = true;
    saveThemeBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Salvando...';
    messageEl.textContent = '';
    messageEl.className = 'message';

    // 1. Coleta das Novas Configurações
    const notificationSettings = {
        likes: notifyLikes ? notifyLikes.checked : true,
        comments: notifyComments ? notifyComments.checked : true,
        friendRequests: notifyFriendRequests ? notifyFriendRequests.checked : true,
        taskImports: notifyTaskImports ? notifyTaskImports.checked : true,
        channel: notificationChannel ? notificationChannel.value : 'in_app'
    };
    
    const taskSettings = {
        // Garantindo que o valor seja um número inteiro
        alertLeadTimeMinutes: taskAlertLeadTime ? parseInt(taskAlertLeadTime.value) : 60
    };

    try {
        // --- NOVO: TENTA ATIVAR PUSH SE SELECIONADO ---
        let pushMessage = '';
        if (notificationSettings.channel === 'push') {
             const result = await requestPushNotificationPermission();
             if (!result.success) {
                 pushMessage = `Atenção: Push não ativado. ${result.message}`;
                 // Reverte o canal para in_app se a permissão falhar, mas permite o salvamento dos outros settings
                 notificationSettings.channel = 'in_app';
             } else {
                 pushMessage = result.message;
             }
        }
        // ---------------------------------------------


        const userRef = doc(db, "users", uid);
        await setDoc(userRef, {
            theme: currentTheme, // Tema existente
            notificationSettings: notificationSettings, // Novas configurações
            taskSettings: taskSettings // Novas configurações
        }, { merge: true });

        messageEl.textContent = `Configurações salvas com sucesso! ${pushMessage}`;
        messageEl.className = pushMessage.includes('Atenção') ? 'message error' : 'message success';

    } catch (error) {
        console.error("Erro ao salvar configurações: ", error);
        messageEl.textContent = 'Erro ao salvar as configurações.';
        messageEl.className = 'message error';
    } finally {
        setTimeout(() => {
            saveThemeBtn.disabled = false;
            saveThemeBtn.textContent = 'Salvar Tema';
            messageEl.textContent = '';
            messageEl.className = 'message';
        }, 2500);
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
        // **ALTERAÇÃO AQUI**: Usando 'preview_1000' para alta resolução e 'preview' para o botão pequeno
        const highResUrl = image.assets.preview_1000.url;
        const thumbnailUrl = image.assets.preview.url;

        const button = document.createElement('button');
        button.className = 'theme-btn image-btn';
        button.style.backgroundImage = `url(${thumbnailUrl})`; // Usa a miniatura para o botão
        button.addEventListener('click', () => {
            applyTheme(primaryColorPicker.value, secondaryColorPicker.value, highResUrl); // Aplica a alta resolução
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

        // 1. Carrega as configurações de tema (Existente)
        if (docSnap.exists() && docSnap.data().theme) {
            const { primary, secondary, backgroundImage } = docSnap.data().theme;
            applyTheme(primary, secondary, backgroundImage || 'none');
        } else {
            applyTheme('#4CAF50', '#f0f2f5', 'none');
        }

        // 2. Carrega as novas configurações de Notificação e Alerta
        if (docSnap.exists() && docSnap.data().notificationSettings) {
            const settings = docSnap.data().notificationSettings;
            // Usa 'true' como fallback se o campo não existir, assumindo que as notificações estão ativadas por padrão
            if (notifyLikes) notifyLikes.checked = settings.likes !== false;
            if (notifyComments) notifyComments.checked = settings.comments !== false;
            if (notifyFriendRequests) notifyFriendRequests.checked = settings.friendRequests !== false;
            if (notifyTaskImports) notifyTaskImports.checked = settings.taskImports !== false;
            if (notificationChannel) notificationChannel.value = settings.channel || 'in_app';
        }
        if (docSnap.exists() && docSnap.data().taskSettings) {
            const settings = docSnap.data().taskSettings;
            // Usa '60' (1 hora) como fallback se o campo não existir
            if (taskAlertLeadTime) taskAlertLeadTime.value = settings.alertLeadTimeMinutes?.toString() || '60';
        }

    } else {
        window.location.href = 'login.html';
    }
});

primaryColorPicker.addEventListener('input', (e) => {
    applyTheme(e.target.value, secondaryColorPicker.value, currentTheme.backgroundImage); // Mantém imagem de fundo
});

secondaryColorPicker.addEventListener('input', (e) => {
    applyTheme(primaryColorPicker.value, e.target.value, 'none'); // Remove imagem de fundo ao mudar cor secundária
});

themeButtons.forEach(button => {
    button.addEventListener('click', () => {
        const primary = button.dataset.primary;
        const secondary = button.dataset.secondary || '#f0f2f5';
        const backgroundImage = button.dataset.backgroundImage || 'none';
        applyTheme(primary, secondary, backgroundImage);
    });
});

// ATUALIZADO: Chama a nova função de salvar
saveThemeBtn.addEventListener('click', () => {
    if (currentUser) {
        saveUserSettings(currentUser.uid);
    }
});

resetThemeBtn.addEventListener('click', () => {
    const defaultPrimary = '#4CAF50';
    const defaultSecondary = '#f0f2f5';
    applyTheme(defaultPrimary, defaultSecondary, 'none');
    
    // ATUALIZADO: Salva os defaults, incluindo as configurações não-tema
    if (currentUser) {
        // Redefine as preferências de notificação para o padrão (todos checados, canal in_app, 1h)
        if (notifyLikes) notifyLikes.checked = true;
        if (notifyComments) notifyComments.checked = true;
        if (notifyFriendRequests) notifyFriendRequests.checked = true;
        if (notifyTaskImports) notifyTaskImports.checked = true;
        if (notificationChannel) notificationChannel.value = 'in_app';
        if (taskAlertLeadTime) taskAlertLeadTime.value = '60';

        saveUserSettings(currentUser.uid);
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