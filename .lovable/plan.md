
## Plano de Correção: Status Só Muda Por Decisão do Usuário/Admin

### Problema Atual

O sistema está forçando o status para "online" automaticamente em várias situações:

| Local | Problema |
|-------|----------|
| `useAvailabilityStatus.tsx` (linha 159-167) | Ao montar o componente, se status é "offline", força para "online" |
| `useAvailabilityStatus.tsx` (linha 236-244) | Ao voltar na aba, se status é "offline", força para "online" |
| `useAvailabilityStatus.tsx` (linha 270-280) | Ao fechar o navegador, força para "offline" |
| `check-inactive-users` (linha 58-65) | CRON força "offline" após 5min de inatividade |

Isso cria um ciclo: CRON coloca "offline" por inatividade, usuário volta na aba, hook força "online".

### Regras Solicitadas

1. **Sem auto-mudança**: Sistema NUNCA muda Online/Busy/Offline sozinho
2. **Busy pode virar Offline**: Permitido apenas se o CRON detectar inatividade (heartbeat expirado)
3. **Apenas usuário/admin muda status**: Qualquer mudança é explícita via UI

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useAvailabilityStatus.tsx` | Remover TODA lógica de auto-set para "online" |
| `supabase/functions/check-inactive-users/index.ts` | Manter (pois Busy pode virar Offline por inatividade) |

---

### Implementação Detalhada

#### 1. Remover Auto-Set para Online no Mount (Linhas 136-215)

**Antes:**
```typescript
const setOnlineAndDistribute = async () => {
  const { data: currentProfile } = await supabase...
  const shouldSetOnline = currentStatus === 'offline' || !currentStatus;
  
  if (shouldSetOnline) {
    await supabase.from("profiles").update({ availability_status: "online" })...
    // Distribuir conversas...
  } else {
    // Apenas heartbeat
  }
};
```

**Depois:**
```typescript
const initializeHeartbeat = async () => {
  console.log("[useAvailabilityStatus] Initializing - NOT changing status automatically");
  
  // APENAS enviar heartbeat para indicar atividade
  // NÃO mudar o status para "online" - isso é decisão do usuário
  await supabase
    .from("profiles")
    .update({ 
      last_status_change: new Date().toISOString(),
    })
    .eq("id", user.id);
  
  console.log("[useAvailabilityStatus] Heartbeat initialized (status unchanged)");
};

initializeHeartbeat();
```

#### 2. Remover Auto-Set para Online no Visibility Change (Linhas 217-264)

**Antes:**
```typescript
const handleVisibilityChange = async () => {
  if (document.visibilityState === 'visible') {
    const currentStatus = ...;
    
    if (currentStatus === 'offline') {
      await supabase.from("profiles").update({ availability_status: "online" })...
    } else {
      // Apenas heartbeat
    }
  }
};
```

**Depois:**
```typescript
const handleVisibilityChange = async () => {
  if (document.visibilityState === 'visible') {
    console.log("[useAvailabilityStatus] Tab visible - only sending heartbeat (no auto-online)");
    
    // APENAS enviar heartbeat - NÃO mudar status automaticamente
    await supabase
      .from("profiles")
      .update({ 
        last_status_change: new Date().toISOString(),
      })
      .eq("id", user.id);
  }
};
```

#### 3. Remover Auto-Offline no Unload (Linhas 266-291)

**Antes:**
```typescript
const handleBeforeUnload = async () => {
  await supabase.from("profiles").update({ availability_status: "offline" })...
};
```

**Depois:**
```typescript
// REMOVER COMPLETAMENTE este efeito
// O status não deve mudar automaticamente ao fechar o navegador
// Se o usuário quiser ficar offline, ele deve clicar explicitamente
// O CRON check-inactive-users vai marcar como offline após 5min sem heartbeat
```

#### 4. Manter CRON check-inactive-users (Sem Alteração)

O CRON que marca usuários inativos como "offline" **deve ser mantido**, pois:
- Você confirmou que "Busy pode virar Offline" por inatividade
- Isso é um safety net para quando atendentes esquecem de se marcar offline
- A diferença é que usamos `manual_offline: false` para distinguir de offline manual

---

### Fluxo Corrigido

```text
[Usuário abre o app]
        |
        v
  Hook monta → Apenas heartbeat (status NÃO muda)
        |
        v
  [Status permanece como estava no DB]
  (se estava Busy → continua Busy)
  (se estava Offline → continua Offline)
        |
        v
  [Usuário quer receber chats]
        |
        v
  Clica em "Online" → updateStatus("online")
        |
        v
  [Agora sim está Online!]
```

---

### Resumo das Mudanças

| Comportamento | Antes | Depois |
|---------------|-------|--------|
| Abrir o app quando estava Offline | Força Online | Mantém Offline |
| Abrir o app quando estava Busy | Mantém Busy | Mantém Busy |
| Voltar para a aba | Força Online se estava Offline | Apenas heartbeat |
| Fechar o navegador | Força Offline | Nada (CRON cuida) |
| 5min sem atividade | CRON força Offline | CRON força Offline |
| Usuário clica "Online" | Muda para Online | Muda para Online |
| Usuário clica "Ocupado" | Muda para Busy | Muda para Busy |
| Admin muda status | Muda status | Muda status |

---

### Seção Técnica

**Arquivo principal:**
- `src/hooks/useAvailabilityStatus.tsx`

**Mudanças específicas:**
1. Linhas 136-215: Substituir `setOnlineAndDistribute` por `initializeHeartbeat` (só heartbeat)
2. Linhas 217-264: Remover lógica de auto-online no visibility change
3. Linhas 266-291: Remover completamente o `beforeunload` handler

**Edge Functions:**
- `check-inactive-users`: Manter como está (Busy → Offline por inatividade)
- `go-offline-manual`: Manter como está (offline explícito com redistribuição)

**Comportamento do Heartbeat:**
- Continua enviando a cada 2 minutos para indicar atividade
- Se heartbeat não for enviado por 5min, CRON marca como Offline
- Isso é desejável para evitar atendentes "fantasmas" que fecharam o navegador
