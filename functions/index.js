/**
 * ARQUIVO: functions/index.js
 * VERSÃO ATUALIZADA: Aponta para o banco de dados (default) e inclui log de trigger.
 */
// Forçando atualização - Oct 21, 2025
const admin = require('firebase-admin');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions, logger } = require('firebase-functions');

// Inicializa a aplicação com a URL do banco de dados (Realtime Database, se usar)
// A inicialização padrão sem argumentos já é suficiente para o Firestore usar o default.
admin.initializeApp({
  databaseURL: "https://gerenciador-tarefas-fd5be.firebaseio.com" // Mantenha se precisar do RDB
});

// Obtém a instância do Firestore PADRÃO
const dbAdmin = admin.firestore();

const APP_URL = 'https://lista20.vercel.app';
setGlobalOptions({ maxInstances: 10 });

exports.sendPushNotification = onDocumentCreated({
    document: 'users/{userId}/notifications/{notificationId}',
    region: 'southamerica-east1'
    // Não precisa da linha 'database: ...' aqui para o default
}, async (event) => {

    // ===== INÍCIO DA LINHA DE LOG ADICIONADA =====
    logger.info("sendPushNotification TRIGGERED! Resource:", event.resource);
    // ===== FIM DA LINHA DE LOG ADICIONADA =====

    logger.info("Função sendPushNotification acionada com sucesso!"); // Log original que pode ser mantido ou removido

    const newNotification = event.data.data();
    const userId = event.params.userId;
    logger.info(`Nova notificação do tipo '${newNotification.type}' para o utilizador: ${userId}`);

    try {
        // Usa dbAdmin que agora aponta para o banco de dados (default)
        const userDoc = await dbAdmin.doc(`users/${userId}`).get();
        if (!userDoc.exists) {
            logger.warn(`Documento do utilizador ${userId} não encontrado na base de dados (default).`);
            return;
        }

        const userData = userDoc.data();
        const fcmToken = userData?.fcmToken;
        // Garante que notificationSettings exista antes de tentar acessar 'channel'
        const notificationSettings = userData?.notificationSettings || {};
        const notificationChannel = notificationSettings.channel;
        const isCriticalAlert = newNotification.type === 'task_deadline';

        logger.info(`Configurações para ${userId}: canal='${notificationChannel}', temToken=${!!fcmToken}, alertaCrítico=${isCriticalAlert}`);

        if (fcmToken && (notificationChannel === 'push' || isCriticalAlert)) {

            logger.info(`Condição para envio de push satisfeita. A enviar para o token: ${fcmToken.substring(0, 20)}...`);

            const payload = {
                notification: {
                    title: isCriticalAlert ? '🚨 ALERTA DE PRAZO URGENTE' : 'Nova Atividade Social',
                    body: newNotification.message,
                    icon: `${APP_URL}/media/icons/icon-192x192.png` // Verifique se este caminho está correto no seu deploy
                },
                webpush: {
                    fcm_options: {
                      link: `${APP_URL}${newNotification.url || '/'}` // Adiciona uma URL padrão caso não exista
                    }
                }
            };

            // Envia a notificação
            await admin.messaging().sendToDevice(fcmToken, payload);
            logger.info(`Push enviado com sucesso para ${userId}!`);

        } else {
            logger.info("Condição para envio de push não satisfeita (sem token, canal errado ou não crítico). A ignorar.");
        }
    } catch (error) {
        logger.error(`Falha CRÍTICA ao processar push para ${userId}:`, error);
    }
}); // Fim da função exports.sendPushNotification