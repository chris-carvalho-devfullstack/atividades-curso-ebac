/**
 * ARQUIVO: functions/index.js
 * CORREÇÃO APLICADA: Uso da API v2 com o parâmetro 'databaseId' na inicialização do Admin SDK.
 */

const admin = require('firebase-admin');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions');

// 🚨 CORREÇÃO ESSENCIAL #1: Inicializa o app com o nome do banco de dados.
// Isso garante que o Admin SDK (dbAdmin) use a instância correta, parando de procurar por (default).
admin.initializeApp({
    databaseId: 'banco-de-dados-gerenciador-de-tarefas' 
});
const dbAdmin = admin.firestore();


const APP_URL = 'https://lista20.vercel.app'; 
setGlobalOptions({ maxInstances: 10 });

// =================================================================
// CLOUD FUNCTION (API V2) - Gatilho que escuta a instância nomeada
// =================================================================
exports.sendPushNotification = onDocumentCreated({
    document: 'users/{userId}/notifications/{notificationId}',
    
    // 🚨 CORREÇÃO ESSENCIAL #2: Define o nome da instância também no gatilho v2
    instance: 'banco-de-dados-gerenciador-de-tarefas',
    
    // Usamos a região onde a função foi deployada nas tentativas anteriores
    region: 'us-central1' 
}, async (event) => {
    // A API v2 passa o novo documento em event.data
    const newNotification = event.data.data();
    const userId = event.params.userId; 

    // O dbAdmin carregado acima já usa a instância nomeada
    // Se precisar fazer uma query:
    const userDoc = await dbAdmin.doc(`users/${userId}`).get();
    const userData = userDoc.data();
    
    const fcmToken = userData?.fcmToken;
    const notificationChannel = userData?.notificationSettings?.channel;
    const isCriticalAlert = newNotification.type === 'task_deadline';

    if (fcmToken && (notificationChannel === 'push' || isCriticalAlert)) {
        
        const payload = {
            notification: {
                title: isCriticalAlert ? '🚨 ALERTA DE PRAZO URGENTE' : 'Nova Atividade Social',
                body: newNotification.message,
                icon: `${APP_URL}/media/icons/icon-192x192.png`, 
                click_action: `${APP_URL}${newNotification.url}`
            }
        };

        try {
            await admin.messaging().sendToDevice(fcmToken, payload);
        } catch (error) {
            console.error(`Falha ao enviar Push para ${userId}:`, error);
        }
    }
});