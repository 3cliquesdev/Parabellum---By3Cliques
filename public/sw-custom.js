// Custom Service Worker for Background Sync
const SUPABASE_URL = 'https://zaeozfdjhrmblfaxsyuu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZW96ZmRqaHJtYmxmYXhzeXV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4NzcxODIsImV4cCI6MjA3OTQ1MzE4Mn0.lowOKwfcgxuGQPcWPEEw6TeCfXMR9h9EQRLAAs4mmZ0';

// Background Sync para mensagens offline
self.addEventListener('sync', async (event) => {
  console.log('[SW] Sync event received:', event.tag);
  
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncPendingMessages());
  }
});

async function syncPendingMessages() {
  console.log('[SW] Starting message sync...');
  
  try {
    // Abrir IndexedDB
    const db = await openDatabase();
    const tx = db.transaction('messageQueue', 'readwrite');
    const store = tx.objectStore('messageQueue');
    
    // Buscar mensagens pendentes
    const pendingMessages = await getAllFromStore(store);
    console.log('[SW] Found pending messages:', pendingMessages.length);
    
    for (const msg of pendingMessages) {
      if (msg.status !== 'pending' && msg.status !== 'failed') continue;
      if (msg.retries >= 3) continue; // Max 3 tentativas
      
      try {
        console.log('[SW] Sending message:', msg.id);
        
        // Enviar para Supabase
        const response = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            conversation_id: msg.conversation_id,
            content: msg.content,
            sender_type: 'contact',
          })
        });

        if (response.ok) {
          console.log('[SW] Message sent successfully:', msg.id);
          
          // Marcar como enviada
          const updateTx = db.transaction('messageQueue', 'readwrite');
          const updateStore = updateTx.objectStore('messageQueue');
          await updateStore.put({ ...msg, status: 'sent' });
          
          // Notificar UI via BroadcastChannel
          const channel = new BroadcastChannel('message-sync');
          channel.postMessage({ type: 'MESSAGE_SENT', id: msg.id });
          channel.close();
        } else {
          console.error('[SW] Failed to send message:', response.status);
          
          // Incrementar retries
          const updateTx = db.transaction('messageQueue', 'readwrite');
          const updateStore = updateTx.objectStore('messageQueue');
          await updateStore.put({ 
            ...msg, 
            status: 'failed',
            retries: msg.retries + 1 
          });
        }
      } catch (error) {
        console.error('[SW] Error sending message:', error);
        
        // Incrementar retries
        const updateTx = db.transaction('messageQueue', 'readwrite');
        const updateStore = updateTx.objectStore('messageQueue');
        await updateStore.put({ 
          ...msg, 
          status: 'failed',
          retries: msg.retries + 1 
        });
      }
    }
    
    console.log('[SW] Message sync completed');
  } catch (error) {
    console.error('[SW] Error in syncPendingMessages:', error);
  }
}

// Listener de conectividade
self.addEventListener('online', () => {
  console.log('[SW] Back online, registering sync');
  self.registration.sync.register('sync-messages');
});

// Helper functions para IndexedDB
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('CRMChatDB', 2);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Criar stores se não existirem (sincronizado com db.ts)
      if (!db.objectStoreNames.contains('messages')) {
        db.createObjectStore('messages', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('conversations')) {
        db.createObjectStore('conversations', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('messageQueue')) {
        db.createObjectStore('messageQueue', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('tickets')) {
        db.createObjectStore('tickets', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('deals')) {
        db.createObjectStore('deals', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('contacts')) {
        db.createObjectStore('contacts', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllFromStore(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
