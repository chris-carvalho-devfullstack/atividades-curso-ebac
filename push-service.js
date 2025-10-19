// push-service.js
import { auth, db } from "./firebase-config.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging.js";

// Sua Chave Pública VAPID real
const VAPID_KEY = "BCPsHWj8T0E5kQ-GcKDhXiKLrnQxLPM3tFIoE8SbTac2p1vYCLcdTslaDEAqusDo6JS1p1D2YY91aFHBkoVgxvY"; 

export async function requestPushNotificationPermission() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        return { success: false, message: "Este navegador não suporta notificações Push." };
    }
    
    try {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

        if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                 return { success: false, message: "Permissão de notificação negada pelo usuário." };
            }
        }

        if (Notification.permission === 'granted') {
            const messaging = getMessaging();
            const currentToken = await getToken(messaging, { 
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: registration 
            });

            if (currentToken) {
                const userRef = doc(db, "users", auth.currentUser.uid);
                await updateDoc(userRef, {
                    fcmToken: currentToken,
                    pushEnabled: true 
                }, { merge: true });
                
                // Configura o listener para mensagens em primeiro plano
                setupForegroundListener(messaging);
                
                return { success: true, message: "Notificações Push ativadas com sucesso!" };
            } else {
                return { success: false, message: "Nenhum token disponível. Verifique as chaves VAPID." };
            }
        }

        return { success: false, message: "Permissão não concedida." };

    } catch (error) {
        console.error('Erro ao salvar token:', error);
        return { success: false, message: `Erro ao ativar Push: ${error.message}` };
    }
}

function setupForegroundListener(messaging) {
    onMessage(messaging, (payload) => {
        console.log('Mensagem Push de Foreground recebida:', payload);
        alert(`NOVA NOTIFICAÇÃO PUSH: ${payload.notification.title} - ${payload.notification.body}`);

        const badge = document.getElementById('notification-badge');
        if (badge) {
             badge.textContent = parseInt(badge.textContent || 0) + 1;
             badge.style.display = 'block';
        }
    });
}