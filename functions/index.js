/**
 * ARQUIVO: functions/index.js
 * VERSÃO FINAL: Inclui todas as correções para inicialização e envio de push.
 */
const admin = require('firebase-admin');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions, logger } = require('firebase-functions');
const { FieldValue } = require('firebase-admin/firestore');

// --- INICIALIZAÇÃO CONDICIONAL DO FIREBASE ADMIN SDK ---
if (process.env.FUNCTIONS_EMULATOR === 'true') {
  const serviceAccount = require('./serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://gerenciador-tarefas-fd5be.firebaseio.com"
  });
  logger.info("Firebase Admin SDK inicializado para emulador local.");
} else {
  admin.initializeApp();
  logger.info("Firebase Admin SDK inicializado para produção.");
}
// --- FIM DA INICIALIZAÇÃO ---

const dbAdmin = admin.firestore();
const APP_URL = 'https://lista20.vercel.app';
setGlobalOptions({ maxInstances: 10 });

// --- FUNÇÃO DE PUSH (CORRIGIDA) ---
exports.sendPushNotification = onDocumentCreated({
    document: 'users/{userId}/notifications/{notificationId}',
    region: 'southamerica-east1'
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
        const isCriticalAlert = newNotification.type === 'task_deadline';

        logger.info(`Configurações para ${userId}: canal='${notificationChannel}', temToken=${!!fcmToken}, alertaCrítico=${isCriticalAlert}`);

        if (fcmToken && (notificationChannel === 'push' || isCriticalAlert)) {
            logger.info(`Condição para envio de push satisfeita. A enviar para o token: ${fcmToken.substring(0, 20)}...`);

            const message = {
                token: fcmToken,
                notification: {
                    title: isCriticalAlert ? '🚨 ALERTA DE PRAZO URGENTE' : (newNotification.title || 'Nova Atividade Social'),
                    body: newNotification.message,
                },
                webpush: {
                    notification: {
                        icon: `${APP_URL}/media/icons/icon-192x192.png`,
                        tag: newNotification.type || 'general'
                    },
                    fcmOptions: {
                        link: `${APP_URL}${newNotification.url || '/'}`
                    }
                }
            };

            await admin.messaging().send(message);
            logger.info(`Push enviado com sucesso para ${userId}!`);
        } else {
            logger.info("Condição para envio de push não satisfeita (sem token, canal errado ou não crítico). A ignorar.");
        }
    } catch (error) {
        logger.error(`Falha CRÍTICA ao processar push para ${userId}:`, error);
    }
});

// --- FUNÇÃO DE LOGS (CORRIGIDA) ---
exports.logNotificationOnCreate = onDocumentCreated({
    document: 'users/{userId}/notifications/{notificationId}',
    region: 'southamerica-east1'
}, async (event) => {
    const notificationData = event.data.data();
    const userId = event.params.userId;
    const notificationId = event.params.notificationId;
    logger.info(`logNotificationOnCreate TRIGGERED para user ${userId}, notif ${notificationId}`);
    try {
        const logData = {
            message: notificationData.message || '',
            type: notificationData.type || 'unknown',
            url: notificationData.url || '',
            originalReadStatus: notificationData.read || false,
            originalNotificationId: notificationId,
            originalTimestamp: notificationData.timestamp,
            loggedAt: FieldValue.serverTimestamp()
        };
        await dbAdmin.collection('users').doc(userId).collection('notificationLogs').add(logData);
        logger.info(`Log criado com sucesso para notificação ${notificationId} do usuário ${userId}.`);
    } catch (error) {
        logger.error(`Erro ao criar log para notificação ${notificationId} do usuário ${userId}:`, error);
    }
});