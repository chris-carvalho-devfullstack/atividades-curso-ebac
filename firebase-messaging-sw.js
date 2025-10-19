// firebase-messaging-sw.js (DEVE ESTAR NA RAIZ DO PROJETO)

// Importa os scripts do Firebase para o Service Worker
importScripts('https://www.gstatic.com/firebasejs/12.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging-compat.js');

// Configuração do Firebase (Use a config do seu firebase-config.js)
const firebaseConfig = {
  apiKey: "AIzaSyBsfGTZ1yypzWE4R_thDARSh61Osc6OUbU",
  authDomain: "gerenciador-tarefas-fd5be.firebaseapp.com",
  projectId: "gerenciador-tarefas-fd5be",
  storageBucket: "gerenciador-tarefas-fd5be.firebasestorage.app",
  messagingSenderId: "831715035671",
  appId: "1:831715035671:web:2836e1701f80fc6f602a52"
};

// Inicializa o Firebase no Service Worker
firebase.initializeApp(firebaseConfig);

// Obtém a instância de Messaging
const messaging = firebase.messaging();

// Lógica para manipular mensagens recebidas enquanto o navegador está fechado/em segundo plano
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Mensagem Push de Background recebida. ', payload);

  const notificationTitle = payload.notification.title || 'Nova Notificação';
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/media/icons/icon-192x192.png', // Ícone para a notificação
    data: {
      url: payload.data.url || '/index.html' // URL para abrir ao clicar
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Lógica para abrir a página correta quando o usuário clica na notificação
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  // Obtém a URL salva no payload
  const targetUrl = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.endsWith(targetUrl) && 'focus' in client) {
          return client.focus(); // Se a página já estiver aberta, apenas foca
        }
      }
      return clients.openWindow(targetUrl); // Senão, abre uma nova janela
    })
  );
});