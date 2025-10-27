// push-service.js
import { auth, db } from "./firebase-config.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging.js";
// A importação do showToastNotification não é mais necessária aqui.

// Sua Chave Pública VAPID real
const VAPID_KEY = "BCPsHWj8T0E5kQ-GcKDhXiKLrnQxLPM3tFIoE8SbTac2p1vYCLcdTslaDEAqusDo6JS1p1D2YY91aFHBkoVgxvY"; //

/**
 * Solicita permissão para notificações push, obtém o token FCM e o salva no Firestore.
 * @returns {Promise<{success: boolean, message: string}>} - Um objeto indicando sucesso ou falha.
 */
export async function requestPushNotificationPermission() {
    // Verifica se o navegador suporta as APIs necessárias
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        console.warn("Push notifications ou Service Workers não suportados neste navegador.");
        return { success: false, message: "Este navegador não suporta notificações Push." };
    }

    // Verifica se o usuário está logado
    if (!auth.currentUser) {
        console.warn("Usuário não autenticado. Não é possível solicitar permissão de push.");
        return { success: false, message: "Você precisa estar logado para ativar notificações." };
    }

    try {
        // Registra o Service Worker
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('Service Worker registrado com sucesso:', registration);

        // Solicita permissão se ainda não foi concedida ou negada
        if (Notification.permission === 'default') {
            console.log('Solicitando permissão para notificações...');
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.warn('Permissão de notificação negada pelo usuário.');
                return { success: false, message: "Permissão de notificação negada pelo usuário." };
            }
            console.log('Permissão concedida!');
        }

        // Se a permissão foi concedida
        if (Notification.permission === 'granted') {
            const messaging = getMessaging();
            console.log('Obtendo token FCM...');
            const currentToken = await getToken(messaging, {
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: registration
            });

            if (currentToken) {
                console.log('Token FCM obtido:', currentToken);
                // Salva o token no Firestore
                const userRef = doc(db, "users", auth.currentUser.uid);
                await updateDoc(userRef, {
                    fcmToken: currentToken,
                    pushEnabled: true
                }, { merge: true });

                console.log('Token FCM salvo no Firestore.');
                // Configura o listener para mensagens em primeiro plano (agora não faz nada visual)
                setupForegroundListener(messaging);

                return { success: true, message: "Notificações Push ativadas com sucesso!" };
            } else {
                console.warn('Não foi possível obter o token FCM. Verifique as configurações (VAPID key).');
                return { success: false, message: "Não foi possível obter o token de notificação. Verifique as configurações." };
            }
        } else {
            console.warn('Permissão de notificação não está concedida.');
            return { success: false, message: "Permissão para notificações não foi concedida." };
        }

    } catch (error) {
        console.error('Erro detalhado ao solicitar/salvar token:', error);
        if (error.code === 'messaging/permission-blocked') {
            return { success: false, message: "As notificações estão bloqueadas nas configurações do seu navegador." };
        } else if (error.code === 'messaging/failed-serviceworker-registration') {
             return { success: false, message: "Falha ao registrar o Service Worker. Verifique o caminho do arquivo." };
        }
        return { success: false, message: `Erro ao ativar Push: ${error.message}` };
    }
}

/**
 * Configura o listener para receber mensagens Push quando o app está em primeiro plano.
 * AGORA: Apenas loga a mensagem recebida, não interage mais com a UI.
 * @param {object} messaging - A instância do Firebase Messaging.
 */
function setupForegroundListener(messaging) {
  console.log("Configurando listener para mensagens em primeiro plano (onMessage)...");
  onMessage(messaging, (payload) => {
    console.log('Mensagem Push de Foreground recebida (onMessage acionado):', payload);

    // // *** REMOVIDO: Código que atualizava o badge foi retirado daqui ***
    // const badge = document.getElementById('notification-badge');
    // if (badge) {
    //   const currentCount = parseInt(badge.textContent || '0');
    //   badge.textContent = currentCount + 1; // <--- REMOVIDO
    //   badge.style.display = 'block';        // <--- REMOVIDO
    // }
  });
}

// Opcional: Chamar setupForegroundListener se o token já existir ao carregar a página
(async () => {
    // Adicionado um pequeno atraso para garantir que o 'auth.currentUser' seja definido
    setTimeout(async () => {
        if (auth.currentUser && "Notification" in window && Notification.permission === 'granted') {
            console.log("Tentando reativar listener de foreground para token existente...");
            try {
                const registration = await navigator.serviceWorker.ready; // Espera o SW estar pronto
                const messaging = getMessaging();
                const currentToken = await getToken(messaging, {
                    vapidKey: VAPID_KEY,
                    serviceWorkerRegistration: registration
                });
                if (currentToken) {
                    // Se já temos um token válido, apenas ativamos o listener
                    setupForegroundListener(messaging);
                    console.log("Listener de foreground reativado para token existente.");
                } else {
                    console.log("Não foi possível obter token existente para reativar listener.");
                }
            } catch (error) {
                console.error("Erro ao tentar reativar listener de foreground:", error);
            }
        } else {
            console.log("Não reativando listener de foreground (usuário não logado, permissão não concedida ou notificações não suportadas).");
        }
    }, 1000); // Atraso de 1 segundo
})();