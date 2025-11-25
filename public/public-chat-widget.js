(function() {
  // Prevenir múltiplas cargas
  if (window.__PUBLIC_CHAT_WIDGET_LOADED__) return;
  window.__PUBLIC_CHAT_WIDGET_LOADED__ = true;

  // Constantes
  const IDENTITY_STORAGE_KEY = "public_chat_identity";
  const IDENTITY_EXPIRES_DAYS = 30;

  // Detectar departamento via data-attribute
  const scriptTag = document.currentScript;
  const department = scriptTag?.dataset?.department || '';

  // Verificar identidade armazenada
  function getStoredIdentity() {
    const stored = localStorage.getItem(IDENTITY_STORAGE_KEY);
    if (!stored) return null;

    try {
      const identity = JSON.parse(stored);
      const expiresAt = new Date(identity.expires_at);
      const now = new Date();

      if (expiresAt > now) {
        return identity;
      } else {
        localStorage.removeItem(IDENTITY_STORAGE_KEY);
        return null;
      }
    } catch (error) {
      console.error("Erro ao ler identidade:", error);
      localStorage.removeItem(IDENTITY_STORAGE_KEY);
      return null;
    }
  }

  // Salvar identidade
  function saveIdentity(email, firstName) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + IDENTITY_EXPIRES_DAYS);

    const identity = {
      email,
      first_name: firstName,
      last_name: "",
      identified_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
    };

    localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identity));
    return identity;
  }

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
    
    .pcw-identity-form {
      margin-bottom: 16px;
    }
    
    .pcw-form-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 8px;
      color: #333;
    }
    
    .pcw-input {
      width: 100%;
      padding: 10px;
      border: 1px solid hsl(var(--border, 240 5% 84%));
      border-radius: 6px;
      margin-bottom: 8px;
      font-size: 14px;
      box-sizing: border-box;
    }
    
    .pcw-input:focus {
      outline: none;
      border-color: hsl(var(--primary, 221 83% 53%));
    }
    
    .pcw-submit-btn {
      width: 100%;
      background: hsl(var(--primary, 221 83% 53%));
      color: white;
      border: none;
      padding: 10px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: opacity 0.2s;
    }
    
    .pcw-submit-btn:hover {
      opacity: 0.9;
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
      <div class="pcw-identity-form" id="pcw-identity-form" style="display: none;">
        <div class="pcw-form-title">Identifique-se para começar</div>
        <input type="email" id="pcw-email-input" class="pcw-input" placeholder="Seu email" required />
        <input type="text" id="pcw-name-input" class="pcw-input" placeholder="Seu nome" required />
        <button id="pcw-submit-identity" class="pcw-submit-btn">Continuar</button>
      </div>
      <div id="pcw-options"></div>
    </div>
    <button class="pcw-button" id="pcw-toggle">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    </button>
  `;

  // Event listeners
  const toggleBtn = document.getElementById('pcw-toggle');
  const closeBtn = document.getElementById('pcw-close');
  const menu = document.getElementById('pcw-menu');
  const identityForm = document.getElementById('pcw-identity-form');
  const emailInput = document.getElementById('pcw-email-input');
  const nameInput = document.getElementById('pcw-name-input');
  const submitIdentityBtn = document.getElementById('pcw-submit-identity');
  const optionsContainer = document.getElementById('pcw-options');

  // Toggle menu
  toggleBtn.addEventListener('click', () => {
    const isOpen = menu.classList.contains('open');
    const storedIdentity = getStoredIdentity();
    
    if (!isOpen) {
      // Abrindo menu
      menu.classList.add('open');
      
      if (!storedIdentity) {
        // Mostrar formulário de identificação
        identityForm.style.display = 'block';
        optionsContainer.style.display = 'none';
      } else {
        // Já identificado, mostrar opções de chat
        identityForm.style.display = 'none';
        optionsContainer.style.display = 'block';
      }
    } else {
      // Fechando menu
      menu.classList.remove('open');
    }
  });

  // Submit identity
  submitIdentityBtn.addEventListener('click', () => {
    const email = emailInput.value.trim();
    const name = nameInput.value.trim();

    if (!email || !name) {
      alert('Por favor, preencha email e nome');
      return;
    }

    if (!email.includes('@')) {
      alert('Por favor, digite um email válido');
      return;
    }

    // Salvar identidade
    saveIdentity(email, name);

    // Esconder formulário e mostrar opções
    identityForm.style.display = 'none';
    optionsContainer.style.display = 'block';

    // Limpar inputs
    emailInput.value = '';
    nameInput.value = '';
  });

  // Close menu
  closeBtn.addEventListener('click', () => {
    menu.classList.remove('open');
  });

  // Fechar ao clicar fora
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      menu.classList.remove('open');
    }
  });

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
      
      optionsContainer.innerHTML = optionsHtml;
    });
})();
