/**
 * ARQUIVO: functions/index.js
 * * Implementação da Cloud Function para enviar notificações Push
 * via Firebase Cloud Messaging (FCM) sempre que uma nova notificação
 * for criada no Firestore.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// 🚨 CORREÇÃO DE ERRO: Importa corretamente a função setGlobalOptions
const { setGlobalOptions } = require('firebase-functions');

// Inicializa o Admin SDK.
admin.initializeApp();
const dbAdmin = admin.firestore();

// 🚨 URL DE DEPLOY ATUALIZADO (Vercel)
const APP_URL = 'https://lista20.vercel.app'; 

// Opções globais (mantidas do boilerplate)
// NOTA: Esta função só é aplicada se as funções usarem a API v1.
setGlobalOptions({ maxInstances: 10 });


// =================================================================
// CLOUD FUNCTION: Monitora novas notificações no Firestore
// Gatilho: on Document Create em users/{userId}/notifications/{notificationId}
// =================================================================
exports.sendPushNotification = functions.firestore
    .document('users/{userId}/notifications/{notificationId}')
    .onCreate(async (snapshot, context) => {
        const newNotification = snapshot.data();
        const userId = context.params.userId;

        // 1. Busca os dados de configuração (token e canal) do usuário destinatário
        const userDoc = await dbAdmin.doc(`users/${userId}`).get();
        const userData = userDoc.data();
        
        const fcmToken = userData?.fcmToken;
        const notificationChannel = userData?.notificationSettings?.channel;
        
        // Alertas críticos (como prazo de tarefa) sempre tentam enviar Push se o token existir
        const isCriticalAlert = newNotification.type === 'task_deadline';

        // 2. FILTRO DE ENVIO
        // Condição: Deve existir um token válido E (o canal deve ser 'push' OU deve ser um alerta crítico)
        if (fcmToken && (notificationChannel === 'push' || isCriticalAlert)) {
            
            // 3. Monta o Payload (a mensagem Push)
            const payload = {
                notification: {
                    title: isCriticalAlert ? '🚨 ALERTA DE PRAZO URGENTE' : 'Nova Atividade Social',
                    body: newNotification.message,
                    icon: `${APP_URL}/media/icons/icon-192x192.png`, 
                    
                    // click_action: A URL completa para onde o usuário será levado ao clicar
                    click_action: `${APP_URL}${newNotification.url}`
                }
            };

            // 4. Envia a mensagem via FCM (Firebase Cloud Messaging)
            try {
                const response = await admin.messaging().sendToDevice(fcmToken, payload);
                console.log(`Push Notification enviado com sucesso para ${userId}:`, response);
                return response;
            } catch (error) {
                console.error(`Falha ao enviar Push para ${userId}:`, error);
                return null;
            }
        }
        
        return console.log(`Notificação no App criada. Push ignorado para ${userId}. Canal: ${notificationChannel}`);
    });