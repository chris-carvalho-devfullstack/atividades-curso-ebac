// push-service.js
import { auth, db } from "./firebase-config.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging.js";
// *** VERIFIQUE SE ESTA LINHA ESTÁ CORRETA E O ARQUIVO NO LUGAR CERTO ***
import { showToastNotification } from './toast-notification.js'; // Importa a função de toast

// Sua Chave Pública VAPID real (Verifique se esta chave está correta para seu projeto)
const VAPID_KEY = "BCPsHWj8T0E5kQ-GcKDhXiKLrnQxLPM3tFIoE8SbTac2p1vYCLcdTslaDEAqusDo6JS1p1D2YY91aFHBkoVgxvY"; //

/**
 * Solicita permissão para notificações push, obtém o token FCM e o salva no Firestore.
 * @returns {Promise<{success: boolean, message: string}>} - Um objeto indicando sucesso ou falha.
 */
export async function requestPushNotificationPermission() {
    // Verifica se o navegador suporta as APIs necessárias
    if (!("Notification" in window) || !("serviceWorker" in navigator)) { //
        console.warn("Push notifications ou Service Workers não suportados neste navegador."); //
        return { success: false, message: "Este navegador não suporta notificações Push." }; //
    }

    // Verifica se o usuário está logado
    if (!auth.currentUser) {
        console.warn("Usuário não autenticado. Não é possível solicitar permissão de push.");
        return { success: false, message: "Você precisa estar logado para ativar notificações." };
    }

    try {
        // Registra o Service Worker (necessário para receber push em background)
        // Certifique-se que o arquivo 'firebase-messaging-sw.js' está na raiz do seu site
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js'); //
        console.log('Service Worker registrado com sucesso:', registration); //

        // Solicita permissão se ainda não foi concedida ou negada
        if (Notification.permission === 'default') { //
            console.log('Solicitando permissão para notificações...'); //
            const permission = await Notification.requestPermission(); //
            if (permission !== 'granted') { //
                console.warn('Permissão de notificação negada pelo usuário.'); //
                return { success: false, message: "Permissão de notificação negada pelo usuário." }; //
            }
            console.log('Permissão concedida!'); //
        }

        // Se a permissão foi concedida (agora ou anteriormente)
        if (Notification.permission === 'granted') { //
            const messaging = getMessaging(); //
            console.log('Obtendo token FCM...'); //
            const currentToken = await getToken(messaging, { //
                vapidKey: VAPID_KEY, //
                serviceWorkerRegistration: registration //
            });

            if (currentToken) { //
                console.log('Token FCM obtido:', currentToken); //
                // Salva o token no Firestore para o usuário atual
                const userRef = doc(db, "users", auth.currentUser.uid); //
                await updateDoc(userRef, { //
                    fcmToken: currentToken, //
                    pushEnabled: true // Adiciona um campo para indicar que o push está ativo
                }, { merge: true }); // Usa merge para não sobrescrever outros dados

                console.log('Token FCM salvo no Firestore.'); //
                // Configura o listener para mensagens em primeiro plano
                setupForegroundListener(messaging); //

                return { success: true, message: "Notificações Push ativadas com sucesso!" }; //
            } else {
                // Isso pode acontecer se as chaves VAPID estiverem incorretas ou houver problema de configuração
                console.warn('Não foi possível obter o token FCM. Verifique as configurações (VAPID key).'); //
                return { success: false, message: "Não foi possível obter o token de notificação. Verifique as configurações." }; //
            }
        } else {
            // Caso a permissão tenha sido explicitamente negada anteriormente
            console.warn('Permissão de notificação não está concedida.'); //
            return { success: false, message: "Permissão para notificações não foi concedida." }; //
        }

    } catch (error) { //
        console.error('Erro detalhado ao solicitar/salvar token:', error); //
        // Trata erros comuns de forma mais específica
        if (error.code === 'messaging/permission-blocked') {
            return { success: false, message: "As notificações estão bloqueadas nas configurações do seu navegador." };
        } else if (error.code === 'messaging/failed-serviceworker-registration') {
             return { success: false, message: "Falha ao registrar o Service Worker. Verifique o caminho do arquivo." };
        }
        return { success: false, message: `Erro ao ativar Push: ${error.message}` }; //
    }
}

/**
 * Configura o listener para receber mensagens Push quando o app está em primeiro plano.
 * @param {object} messaging - A instância do Firebase Messaging.
 */
function setupForegroundListener(messaging) {
  console.log("Configurando listener para mensagens em primeiro plano (onMessage)..."); // Log adicional
  onMessage(messaging, (payload) => { //
    console.log('Mensagem Push de Foreground recebida (onMessage acionado):', payload); // Log detalhado ao receber

    // Usa a nova função de toast em vez do alert()
    if (payload.notification) { //
      // *** CHAMADA DA FUNÇÃO DE TOAST ***
      showToastNotification( // Chama a função importada
        payload.notification.title || 'Nova Notificação', //
        payload.notification.body || '', //
        payload.data?.type || 'default' // Pega o tipo dos dados da notificação, se houver
      );
      // **********************************
    }

    // Mantém a lógica de atualizar o badge de notificação (se existir no HTML)
    const badge = document.getElementById('notification-badge'); //
    if (badge) { //
      const currentCount = parseInt(badge.textContent || '0'); //
      badge.textContent = currentCount + 1; //
      badge.style.display = 'block'; //
    }
  });
}

// Opcional: Chamar setupForegroundListener se o token já existir ao carregar a página
// Isso garante que o listener seja ativado mesmo que o usuário não precise reativar as permissões
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