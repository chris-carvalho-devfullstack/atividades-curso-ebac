// toast-notification.js

/**
 * Mapeamento de tipos de notificação para ícones Font Awesome.
 */
const notificationIcons = {
  like: 'fa-heart text-red-500',
  comment: 'fa-comment text-green-500',
  friend_request: 'fa-user-plus text-blue-500',
  task_import_request: 'fa-download text-purple-500',
  task_deadline: 'fa-clock text-orange-500',
  default: 'fa-bell text-gray-500'
};

/**
 * Cria e exibe uma notificação toast na tela.
 * @param {string} title - O título da notificação.
 * @param {string} body - O corpo da mensagem.
 * @param {string} type - O tipo da notificação (para definir o ícone).
 * @param {number} duration - Duração em milissegundos que o toast ficará visível.
 */
export function showToastNotification(title, body, type = 'default', duration = 8000) {
  const container = document.getElementById('toast-notification-container');
  if (!container) {
    console.error('Elemento #toast-notification-container não encontrado no DOM.');
    return;
  }

  const toast = document.createElement('div');
  toast.className = 'toast-notification';

  const iconClass = notificationIcons[type] || notificationIcons.default;

  toast.innerHTML = `
    <div class="toast-icon"><i class="fa ${iconClass}"></i></div>
    <div class="toast-content">
      <h4>${title}</h4>
      <p>${body}</p>
    </div>
    <button class="toast-close-btn">&times;</button>
    <div class="toast-progress-bar"></div>
  `;

  // Define a duração da animação da barra de progresso
  const progressBar = toast.querySelector('.toast-progress-bar');
  progressBar.style.animationDuration = `${duration / 1000}s`;

  // Adiciona o toast ao container
  container.appendChild(toast);

  // Força o reflow para garantir que a animação de entrada funcione
  void toast.offsetWidth;

  // Adiciona a classe para mostrar o toast (animação de entrada)
  toast.classList.add('show');

  // Timer para remover o toast
  const timer = setTimeout(() => {
    removeToast(toast);
  }, duration);

  // Botão de fechar
  const closeBtn = toast.querySelector('.toast-close-btn');
  closeBtn.addEventListener('click', () => {
    clearTimeout(timer); // Cancela o timer de remoção automática
    removeToast(toast);
  });
}

/**
 * Remove um toast da tela com animação de fade out.
 * @param {HTMLElement} toastElement - O elemento do toast a ser removido.
 */
function removeToast(toastElement) {
  toastElement.classList.remove('show');
  toastElement.classList.add('fade-out');

  // Remove o elemento do DOM após a animação de fade out
  toastElement.addEventListener('transitionend', () => {
    // Verifica se o elemento ainda existe antes de tentar remover
    if (toastElement.parentNode) {
      toastElement.remove();
    }
  }, { once: true }); // Garante que o listener seja removido após a execução
}