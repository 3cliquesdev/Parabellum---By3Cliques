

# Plano: Zero Delay Inbound — Hotfix Produção (AJUSTADO)

## Ajustes Críticos Aplicados

| # | Ajuste Solicitado | Status |
|---|-------------------|--------|
| 1 | Refs no TOPO do hook (não dentro de queryFn) | ✅ Confirmado |
| 2 | Evitar JSON.stringify — usar comparação leve | ✅ Aplicado |
| 3 | registerEvent apenas quando há gap real | ✅ Mantido |

---

## Arquivo: `src/hooks/useMessages.tsx`

### 1. Novos Estados/Refs (NO TOPO DO HOOK, após linha 35)

```typescript
// Linha 35: lastMessageTimestampRef já existe

// 🆕 HOTFIX: Rastrear visibilidade da aba
const [isTabVisible, setIsTabVisible] = useState(true);

// 🆕 Rastrear último evento Realtime (anti-mascaramento)
const lastRealtimeEventRef = useRef<number>(Date.now());

// 🆕 Rastrear tamanho anterior para detectar novas mensagens
const previousLengthRef = useRef<number>(0);
```

**Por que no topo:** Se ficassem dentro do `queryFn`, seriam recriados a cada render, perdendo o valor anterior.

---

### 2. Importar useState (linha 2)

```typescript
// ANTES:
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useCallback } from "react";

// DEPOIS:
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useCallback, useState } from "react";
```

---

### 3. useEffect para Visibilidade (após linha 36)

```typescript
// 🆕 HOTFIX: Detectar quando aba está visível
useEffect(() => {
  const handleVisibility = () => {
    setIsTabVisible(document.visibilityState === 'visible');
  };
  document.addEventListener('visibilitychange', handleVisibility);
  return () => document.removeEventListener('visibilitychange', handleVisibility);
}, []);
```

---

### 4. Polling Adaptativo (linhas 89-91)

```typescript
// ANTES:
refetchInterval: isEnterpriseV2 
  ? (isHealthy ? false : isDegraded ? 10000 : 5000)
  : 5000, // Legacy: polling fixo 5s

// DEPOIS:
// 🆕 HOTFIX PRODUÇÃO: Polling adaptativo
// - Conversa ativa + aba visível: 3s (safety net)
// - Aba em background: 10s (economia)
// - Sem conversa: desativado
refetchInterval: !conversationId 
  ? false 
  : isTabVisible 
    ? 3000 
    : 10000,
```

---

### 5. Detecção de Inbound no queryFn (dentro do queryFn, após linha 75)

```typescript
// Linha 74-75 atual:
if (data && data.length > 0) {
  lastMessageTimestampRef.current = data[data.length - 1].created_at;
}

// ADICIONAR APÓS (ainda dentro do queryFn, usando as refs do TOPO):
// 🆕 HOTFIX: Detectar novas mensagens inbound via polling
if (data && data.length > previousLengthRef.current) {
  const newCount = data.length - previousLengthRef.current;
  const lastMessages = data.slice(-newCount);
  
  const hasNewInbound = lastMessages.some(m => m.sender_type === 'contact');
  const realtimeGap = Date.now() - lastRealtimeEventRef.current > 5000;
  
  if (hasNewInbound && realtimeGap) {
    console.log('[useMessages] 📥 Inbound detectado via polling (Realtime gap):', newCount);
    registerEvent();
  }
}
previousLengthRef.current = data?.length || 0;
```

**Nota:** As refs `previousLengthRef` e `lastRealtimeEventRef` estão no TOPO do hook, então mantêm seus valores entre renders. O `queryFn` apenas LEIA e ATUALIZA elas.

---

### 6. Marcar Evento Realtime (linha 200)

```typescript
// ANTES:
registerEvent();

// DEPOIS:
registerEvent();
lastRealtimeEventRef.current = Date.now(); // 🆕 Marcar evento Realtime
```

---

### 7. _mediaUpdatedAt Condicional — SEM JSON.stringify (linhas 311-320)

```typescript
// ANTES:
if (isMatch) {
  const deliveryStatus = (newMessage.metadata as any)?.delivery_status;
  
  return { 
    ...m, 
    ...newMessage,
    status: deliveryStatus || newMessage.status || m.status,
  };
}

// DEPOIS:
if (isMatch) {
  const deliveryStatus = (newMessage.metadata as any)?.delivery_status;
  
  // 🆕 Detectar se campos de mídia mudaram (COMPARAÇÃO LEVE)
  const mediaChanged = 
    newMessage.attachment_url !== m.attachment_url ||
    newMessage.attachment_type !== m.attachment_type ||
    (newMessage.media_attachments?.length || 0) !== (m.media_attachments?.length || 0) ||
    newMessage.media_attachments?.[0]?.storage_path !== m.media_attachments?.[0]?.storage_path ||
    newMessage.media_attachments?.[0]?.status !== m.media_attachments?.[0]?.status;
  
  return { 
    ...m, 
    ...newMessage,
    status: deliveryStatus || newMessage.status || m.status,
    // 🆕 _mediaUpdatedAt APENAS quando mídia muda
    ...(mediaChanged && { _mediaUpdatedAt: Date.now() }),
  };
}
```

**Por que não JSON.stringify:**
- `JSON.stringify` é O(n) onde n é tamanho do array
- Comparação leve é O(1) — só checa length + campos chave do primeiro item
- Em chats grandes com muitos attachments, isso evita delay

---

## Resumo de Mudanças

| Local | Mudança | Risco |
|-------|---------|-------|
| Linha 2 | Adicionar `useState` ao import | Zero |
| Após linha 35 | Adicionar 3 refs/states no TOPO | Zero |
| Após linha 36 | useEffect visibilidade | Zero |
| Linhas 89-91 | Polling adaptativo 3s/10s | Baixo |
| Após linha 75 | Detecção de inbound no queryFn | Baixo |
| Linha 200 | Marcar lastRealtimeEventRef | Zero |
| Linhas 311-320 | mediaChanged com comparação leve | Baixo |

---

## Garantias de Não-Regressão

- **Refs no TOPO:** `previousLengthRef` e `lastRealtimeEventRef` mantêm valores entre renders
- **Sem JSON.stringify:** Comparação leve por length + campos chave
- **Polling 3s:** Apenas conversa ativa + aba visível
- **registerEvent via polling:** Apenas quando há gap > 5s do Realtime
- **Dedup por ID:** Intacto
- **Enterprise V2 flags:** Mantidas
- **Realtime handlers:** Apenas adições
- **Catch-up logic:** Intacto

---

## Critério de Aceite

| Cenário | Esperado |
|---------|----------|
| Cliente envia texto (conversa aberta) | Aparece em < 3s |
| Cliente envia áudio (conversa aberta) | Aparece em < 3s com placeholder |
| Áudio termina de processar | UI atualiza automaticamente |
| Aba em background | Polling 10s (não 3s) |
| Realtime funcionando | Mensagem aparece instantaneamente |
| Realtime falha silenciosamente | Polling 3s detecta |
| Console | Zero erros |

---

## Testes Pós-Implementação

1. Abrir conversa no Inbox
2. Enviar texto do WhatsApp cliente → deve aparecer instantaneamente
3. Enviar áudio do WhatsApp cliente → deve aparecer em < 3s
4. Minimizar aba e enviar mensagem → ao voltar, deve aparecer
5. Verificar Console: polling 3s quando ativo, 10s quando background
6. Verificar: não precisar trocar de conversa para ver mensagem

