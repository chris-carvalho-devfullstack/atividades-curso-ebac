/**
 * ARQUIVO: functions/index.js
 * CORREÇÃO DEFINITIVA: Inicializa o Admin SDK apontando explicitamente
 * para a base de dados nomeada, eliminando a ambiguidade causada pela
 * existência de uma base de dados "(default)".
 */

const admin = require('firebase-admin');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions, logger } = require('firebase-functions');

// 🚨 CORREÇÃO ESSENCIAL: Inicializa a aplicação especificando QUAL base de dados usar.
// Isto força o Admin SDK a conectar-se à instância correta.
admin.initializeApp({
    databaseId: 'banco-de-dados-gerenciador-de-tarefas' 
});

// Agora, dbAdmin irá usar a base de dados correta garantidamente.
const dbAdmin = admin.firestore();

const APP_URL = 'https://lista20.vercel.app'; 
setGlobalOptions({ maxInstances: 10 });

exports.sendPushNotification = onDocumentCreated({
    document: 'users/{userId}/notifications/{notificationId}',
    instance: 'banco-de-dados-gerenciador-de-tarefas',
    region: 'southamerica-east1' // <-- PARA A REGIÃO CORRETA
}, async (event) => {
    
    logger.info("Função sendPushNotification acionada!");

    const newNotification = event.data.data();
    const userId = event.params.userId;
    logger.info(`Nova notificação do tipo '${newNotification.type}' para o utilizador: ${userId}`);

    try {
        // Esta chamada agora usa o dbAdmin que foi inicializado corretamente.
        const userDoc = await dbAdmin.doc(`users/${userId}`).get();
        if (!userDoc.exists) {
            logger.warn(`Documento do utilizador ${userId} não encontrado.`);
            return;
        }

        const userData = userDoc.data();
        const fcmToken = userData?.fcmToken;
        const notificationChannel = userData?.notificationSettings?.channel;
        const isCriticalAlert = newNotification.type === 'task_deadline';

        logger.info(`Configurações para ${userId}: canal='${notificationChannel}', temToken=${!!fcmToken}, alertaCrítico=${isCriticalAlert}`);

        if (fcmToken && (notificationChannel === 'push' || isCriticalAlert)) {
            
            logger.info(`Condição para envio de push satisfeita. A enviar para o token: ${fcmToken.substring(0, 20)}...`);

            const payload = {
                notification: {
                    title: isCriticalAlert ? '🚨 ALERTA DE PRAZO URGENTE' : 'Nova Atividade Social',
                    body: newNotification.message,
                    icon: `${APP_URL}/media/icons/icon-192x192.png`
                },
                webpush: {
                    fcm_options: {
                      link: `${APP_URL}${newNotification.url}`
                    }
                }
            };

            await admin.messaging().sendToDevice(fcmToken, payload);
            logger.info(`Push enviado com sucesso para ${userId}!`);

        } else {
            logger.info("Condição para envio de push não satisfeita. A ignorar.");
        }
    } catch (error) {
        logger.error(`Falha CRÍTICA ao processar push para ${userId}:`, error);
    }
});