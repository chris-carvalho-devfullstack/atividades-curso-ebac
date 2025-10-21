/**
 * ARQUIVO: functions/index.js
 * VERSÃO ATUALIZADA: Inclui a função logNotificationOnCreate.
 */
// Forçando atualização - Oct 21, 2025
const admin = require('firebase-admin');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions, logger } = require('firebase-functions');

admin.initializeApp({
  databaseURL: "https://gerenciador-tarefas-fd5be.firebaseio.com" // Mantenha se precisar do RDB
});

// Obtém a instância do Firestore PADRÃO
const dbAdmin = admin.firestore();

const APP_URL = 'https://lista20.vercel.app'; // URL do seu app Vercel ou onde está hospedado
setGlobalOptions({ maxInstances: 10 }); // Configuração de instâncias (opcional)

// --- FUNÇÃO EXISTENTE PARA PUSH ---
exports.sendPushNotification = onDocumentCreated({
    document: 'users/{userId}/notifications/{notificationId}',
    region: 'southamerica-east1' // Defina a região correta para suas functions
}, async (event) => {

    logger.info("sendPushNotification TRIGGERED! Resource:", event.resource);

    const newNotification = event.data.data();
    const userId = event.params.userId;
    logger.info(`Nova notificação do tipo '${newNotification.type}' para o utilizador: ${userId}`);

    try {
        const userDoc = await dbAdmin.doc(`users/${userId}`).get();
        if (!userDoc.exists) {
            logger.warn(`Documento do utilizador ${userId} não encontrado.`);
            return;
        }

        const userData = userDoc.data();
        const fcmToken = userData?.fcmToken;
        const notificationSettings = userData?.notificationSettings || {};
        const notificationChannel = notificationSettings.channel;
        const isCriticalAlert = newNotification.type === 'task_deadline'; // Exemplo para tarefas urgentes

        logger.info(`Configurações para ${userId}: canal='${notificationChannel}', temToken=${!!fcmToken}, alertaCrítico=${isCriticalAlert}`);

        if (fcmToken && (notificationChannel === 'push' || isCriticalAlert)) {

            logger.info(`Condição para envio de push satisfeita. A enviar para o token: ${fcmToken.substring(0, 20)}...`);

            const payload = {
                notification: {
                    title: isCriticalAlert ? '🚨 ALERTA DE PRAZO URGENTE' : (newNotification.title || 'Nova Atividade Social'), // Título dinâmico
                    body: newNotification.message,
                    icon: `${APP_URL}/media/icons/icon-192x192.png` // Verifique o caminho do ícone
                },
                webpush: {
                    fcm_options: {
                      link: `${APP_URL}${newNotification.url || '/'}` // URL para abrir ao clicar
                    },
                    notification: { // Adiciona dados extras visíveis na notificação Web Push
                         icon: `${APP_URL}/media/icons/icon-192x192.png`,
                         // actions: [ // Exemplo de botões de ação (opcional)
                         //   { action: 'view', title: 'Ver Detalhes' }
                         // ],
                         tag: newNotification.type || 'general' // Agrupa notificações do mesmo tipo
                    }
                },
                // Pode adicionar dados específicos para Android/APNS se necessário
                // data: { url: newNotification.url || '/' } // Campo data para fallback
            };

            await admin.messaging().sendToDevice(fcmToken, payload);
            logger.info(`Push enviado com sucesso para ${userId}!`);

        } else {
            logger.info("Condição para envio de push não satisfeita (sem token, canal errado ou não crítico). A ignorar.");
        }
    } catch (error) {
        logger.error(`Falha CRÍTICA ao processar push para ${userId}:`, error);
    }
}); // Fim da função exports.sendPushNotification


// --- NOVA FUNÇÃO PARA CRIAR LOGS ---
exports.logNotificationOnCreate = onDocumentCreated({
    document: 'users/{userId}/notifications/{notificationId}',
    region: 'southamerica-east1' // Use a mesma região da outra função
}, async (event) => {
    const notificationData = event.data.data();
    const userId = event.params.userId;
    const notificationId = event.params.notificationId; // ID da notificação original

    logger.info(`logNotificationOnCreate TRIGGERED para user ${userId}, notif ${notificationId}`);

    try {
        const logData = {
            message: notificationData.message || '', // Garante que campos existam
            type: notificationData.type || 'unknown',
            url: notificationData.url || '',
            originalReadStatus: notificationData.read || false, // Renomeia 'read' para clareza no log
            originalNotificationId: notificationId, // Guarda referência ao ID original
            originalTimestamp: notificationData.timestamp, // Guarda o timestamp original da notificação
            loggedAt: admin.firestore.FieldValue.serverTimestamp() // Adiciona timestamp de quando o log foi criado
            // Você pode adicionar mais campos aqui se precisar, como quem gerou a notificação, etc.
        };

        // Adiciona o log à subcoleção notificationLogs
        await dbAdmin.collection('users').doc(userId).collection('notificationLogs').add(logData);

        logger.info(`Log criado com sucesso para notificação ${notificationId} do usuário ${userId}.`);

    } catch (error) {
        logger.error(`Erro ao criar log para notificação ${notificationId} do usuário ${userId}:`, error);
    }
});
// --- FIM DA NOVA FUNÇÃO ---