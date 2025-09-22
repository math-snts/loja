// Formatação de moeda brasileira
function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2
  }).format(value);
}

// Formatação de data brasileira
function formatDate(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

// Gera ID único
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Validação de email
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Validação de senha
function isValidPassword(password) {
  return password && password.length >= 6;
}

// Exibir mensagem de sucesso
function showSuccess(message, duration = 3000) {
  const alert = document.createElement('div');
  alert.className = 'alert alert-success alert-dismissible fade show position-fixed';
  alert.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
  alert.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  document.body.appendChild(alert);
  
  setTimeout(() => {
    alert.remove();
  }, duration);
}

// Exibir mensagem de erro
function showError(message, duration = 5000) {
  const alert = document.createElement('div');
  alert.className = 'alert alert-danger alert-dismissible fade show position-fixed';
  alert.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
  alert.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  document.body.appendChild(alert);
  
  setTimeout(() => {
    alert.remove();
  }, duration);
}

// Loading state para botões
function setLoading(button, isLoading) {
  if (isLoading) {
    button.innerHTML = '<span class="loading"></span> Carregando...';
    button.disabled = true;
  } else {
    button.innerHTML = button.dataset.originalText || button.innerHTML;
    button.disabled = false;
  }
}

// Debounce para evitar múltiplas chamadas
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Scroll suave
function smoothScroll(target, duration = 500) {
  const targetElement = document.querySelector(target);
  if (!targetElement) return;
  
  const targetPosition = targetElement.offsetTop - 70;
  const startPosition = window.pageYOffset;
  const distance = targetPosition - startPosition;
  let startTime = null;
  
  function animation(currentTime) {
    if (startTime === null) startTime = currentTime;
    const timeElapsed = currentTime - startTime;
    const run = ease(timeElapsed, startPosition, distance, duration);
    window.scrollTo(0, run);
    if (timeElapsed < duration) requestAnimationFrame(animation);
  }
  
  function ease(t, b, c, d) {
    t /= d / 2;
    if (t < 1) return c / 2 * t * t + b;
    t--;
    return -c / 2 * (t * (t - 2) - 1) + b;
  }
  
  requestAnimationFrame(animation);
}

// Detectar PWA install
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallPromotion();
});

function showInstallPromotion() {
  const installButton = document.createElement('button');
  installButton.className = 'btn btn-success position-fixed';
  installButton.style.cssText = 'bottom: 20px; right: 20px; z-index: 9999;';
  installButton.innerHTML = '📱 Instalar App';
  installButton.onclick = installApp;
  document.body.appendChild(installButton);
  
  setTimeout(() => {
    installButton.remove();
  }, 10000);
}

function installApp() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        showSuccess('App instalado! Acesse pela tela inicial.');
      }
      deferredPrompt = null;
    });
  }
}

// Service Worker para cache (PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW registrado'))
      .catch(err => console.log('SW falhou'));
  });
}