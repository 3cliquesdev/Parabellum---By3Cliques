(function() {
  // Prevenir múltiplas cargas
  if (window.__PUBLIC_CHAT_WIDGET_LOADED__) return;
  window.__PUBLIC_CHAT_WIDGET_LOADED__ = true;

  // Detectar departamento via data-attribute
  const scriptTag = document.currentScript;
  const department = scriptTag?.dataset?.department || '';

  // Criar container do widget
  const container = document.createElement('div');
  container.id = 'public-chat-launcher-widget';
  document.body.appendChild(container);

  // Injetar CSS
  const style = document.createElement('style');
  style.textContent = `
    #public-chat-launcher-widget {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      font-family: system-ui, -apple-system, sans-serif;
    }
    
    .pcw-button {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: hsl(var(--primary, 221 83% 53%));
      color: white;
      border: none;
      cursor: pointer;
      box-shadow: 0 10px 25px rgba(0,0,0,0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s;
    }
    
    .pcw-button:hover {
      transform: scale(1.1);
    }
    
    .pcw-menu {
      position: absolute;
      bottom: 70px;
      right: 0;
      width: 320px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.2);
      border: 2px solid hsl(var(--border, 240 5% 84%));
      padding: 16px;
      animation: slideUp 0.3s;
      display: none;
    }
    
    .pcw-menu.open {
      display: block;
    }
    
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .pcw-menu-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    
    .pcw-menu-title {
      font-size: 18px;
      font-weight: 600;
    }
    
    .pcw-close {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      opacity: 0.6;
    }
    
    .pcw-close:hover {
      opacity: 1;
    }
    
    .pcw-option {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border: 1px solid hsl(var(--border, 240 5% 84%));
      border-radius: 8px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: all 0.2s;
      background: white;
      width: 100%;
      text-align: left;
    }
    
    .pcw-option:hover {
      border-color: hsl(var(--primary, 221 83% 53%));
      background: hsl(var(--accent, 240 5% 96%));
    }
    
    .pcw-option-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    
    .pcw-option-content {
      flex: 1;
    }
    
    .pcw-option-title {
      font-weight: 600;
      margin-bottom: 2px;
    }
    
    .pcw-option-desc {
      font-size: 12px;
      opacity: 0.7;
    }
  `;
  document.head.appendChild(style);

  // Criar HTML do widget
  container.innerHTML = `
    <div class="pcw-menu" id="pcw-menu">
      <div class="pcw-menu-header">
        <div class="pcw-menu-title">Como podemos ajudar?</div>
        <button class="pcw-close" id="pcw-close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div id="pcw-options"></div>
    </div>
    <button class="pcw-button" id="pcw-toggle">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    </button>
  `;

  // Fetch configuração do departamento para pegar WhatsApp
  fetch(window.location.origin + '/api/departments?dept=' + department)
    .catch(() => null)
    .then(res => res?.json())
    .then(config => {
      const whatsapp = config?.whatsapp_number;
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      const optionsHtml = `
        ${whatsapp ? `
          <button class="pcw-option" onclick="window.open('https://wa.me/${whatsapp}?text=Olá, preciso de ajuda', '_blank')">
            <div class="pcw-option-icon" style="background: #dcfce7;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                <circle cx="9" cy="10" r="1"/><circle cx="15" cy="10" r="1"/>
              </svg>
            </div>
            <div class="pcw-option-content">
              <div class="pcw-option-title">WhatsApp</div>
              <div class="pcw-option-desc">Resposta rápida via WhatsApp</div>
            </div>
          </button>
        ` : ''}
        <button class="pcw-option" onclick="window.location.href='${window.location.origin}/public-chat${department ? '?source=widget&dept=' + department : '?source=widget'}'">
          <div class="pcw-option-icon" style="background: #dbeafe;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div class="pcw-option-content">
            <div class="pcw-option-title">Chat ao Vivo</div>
            <div class="pcw-option-desc">Converse em tempo real</div>
          </div>
        </button>
        <button class="pcw-option" onclick="window.location.href='${window.location.origin}/open-ticket'">
          <div class="pcw-option-icon" style="background: #fef3c7;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2">
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
              <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
            </svg>
          </div>
          <div class="pcw-option-content">
            <div class="pcw-option-title">Abrir Ticket</div>
            <div class="pcw-option-desc">Envie sua solicitação</div>
          </div>
        </button>
      `;
      
      document.getElementById('pcw-options').innerHTML = optionsHtml;
    });

  // Event listeners
  const toggleBtn = document.getElementById('pcw-toggle');
  const closeBtn = document.getElementById('pcw-close');
  const menu = document.getElementById('pcw-menu');

  toggleBtn.addEventListener('click', () => {
    menu.classList.toggle('open');
  });

  closeBtn.addEventListener('click', () => {
    menu.classList.remove('open');
  });

  // Fechar ao clicar fora
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      menu.classList.remove('open');
    }
  });
})();