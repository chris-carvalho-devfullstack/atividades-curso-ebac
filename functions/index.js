/**
 * ARQUIVO: functions/index.js
 * VERSÃO FINAL CORRIGIDA: Força a inicialização do Admin SDK com a URL
 * do banco de dados do projeto para eliminar qualquer ambiguidade.
 */

const admin = require('firebase-admin');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions, logger } = require('firebase-functions');

// --- CORREÇÃO CRUCIAL ---
// Inicializa a aplicação FORÇANDO a URL do banco de dados do seu projeto.
// Isso garante que todas as operações subsequentes usem o contexto correto.
admin.initializeApp({
  databaseURL: "https://gerenciador-tarefas-fd5be.firebaseio.com"
});
// -------------------------

// Agora, obtemos a instância do Firestore especificando o databaseId.
const dbAdmin = admin.firestore(undefined, { databaseId: 'banco-de-dados-gerenciador-de-tarefas' });

const APP_URL = 'https://lista20.vercel.app'; 
setGlobalOptions({ maxInstances: 10 });

exports.sendPushNotification = onDocumentCreated({
    document: 'users/{userId}/notifications/{notificationId}',
    region: 'southamerica-east1',
    database: 'banco-de-dados-gerenciador-de-tarefas'
}, async (event) => {
    
    logger.info("Função sendPushNotification acionada com sucesso!");

    const newNotification = event.data.data();
    const userId = event.params.userId;
    logger.info(`Nova notificação do tipo '${newNotification.type}' para o utilizador: ${userId}`);

    try {
        const userDoc = await dbAdmin.doc(`users/${userId}`).get();
        if (!userDoc.exists) {
            logger.warn(`Documento do utilizador ${userId} não encontrado na base de dados nomeada.`);
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