// firebase-messaging-sw.js (DEVE ESTAR NA RAIZ DO PROJETO)

// Importa os scripts do Firebase para o Service Worker
importScripts('https://www.gstatic.com/firebasejs/12.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging-compat.js');

console.log('[SW] Service Worker sendo carregado.'); // LOG INICIAL

// Configuração do Firebase (VERIFIQUE SE ESTÁ IGUAL AO firebase-config.js)
const firebaseConfig = {
  apiKey: "AIzaSyBsfGTZ1yypzWE4R_thDARSh61Osc6OUbU",
  authDomain: "gerenciador-tarefas-fd5be.firebaseapp.com",
  projectId: "gerenciador-tarefas-fd5be",
  storageBucket: "gerenciador-tarefas-fd5be.firebasestorage.app", // Garanta que está correto
  messagingSenderId: "831715035671",
  appId: "1:831715035671:web:2836e1701f80fc6f602a52"
};

try {
  // Inicializa o Firebase no Service Worker
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();
  console.log('[SW] Firebase inicializado no Service Worker.'); // LOG DE INICIALIZAÇÃO

  // --- Listener de Push Genérico (para debug) ---
  self.addEventListener('push', (event) => {
    console.log('[SW] Evento PUSH recebido!', event.data?.text()); // LOG: Evento push chegou
    // O Firebase SDK (onBackgroundMessage) geralmente lida com isso,
    // mas este log ajuda a confirmar se o evento chega ao SW.
  });
  // ---------------------------------------------

  // Lógica para manipular mensagens recebidas enquanto o navegador está fechado/em segundo plano
  messaging.onBackgroundMessage(function(payload) {
    console.log('[SW] onBackgroundMessage acionado:', payload); // LOG: Tratando background

    const notificationTitle = payload.notification?.title || 'Nova Notificação'; // Usar optional chaining
    const notificationOptions = {
      body: payload.notification?.body || 'Você tem uma nova mensagem.', // Usar optional chaining e fallback
      icon: '/media/icons/icon-192x192.png', // Verifique se este caminho está correto
      data: {
        url: payload.data?.url || '/index.html' // Usar optional chaining
      }
    };

    // Verifica se self.registration está disponível antes de chamar showNotification
    if (self.registration) {
      event.waitUntil(self.registration.showNotification(notificationTitle, notificationOptions));
    } else {
       console.error('[SW] self.registration não está disponível para showNotification.');
    }
  });

  console.log('[SW] Listener onBackgroundMessage configurado.'); // LOG: Listener background OK

} catch (error) {
   console.error('[SW] Erro ao inicializar Firebase ou configurar listeners no SW:', error); // LOG DE ERRO
}


// Lógica para abrir a página correta quando o usuário clica na notificação (mantida)
self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Clique na notificação recebido:', event.notification.data); // LOG: Clique detectado
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/'; // Usar optional chaining e fallback

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) { // includeUncontrolled pode ajudar
      // Tenta focar uma aba existente com a URL exata ou base
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        // Verifica se a URL do cliente termina com a targetUrl ou se a targetUrl é apenas '/'
         if (client.url && client.url.endsWith(targetUrl) && 'focus' in client) {
           console.log('[SW] Focando cliente existente:', client.url);
          return client.focus();
        }
      }
      // Se não encontrou, abre uma nova janela/aba
      if (clients.openWindow) {
        console.log('[SW] Abrindo nova janela para:', targetUrl);
        return clients.openWindow(targetUrl);
      } else {
         console.warn('[SW] clients.openWindow não suportado.');
      }
    })
  );
});

console.log('[SW] Listener notificationclick configurado.'); // LOG: Listener clique OK