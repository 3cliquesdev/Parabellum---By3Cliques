
## Plano de Correção: Status "Ocupado" Sendo Sobrescrito

### Problema
O hook `useAvailabilityStatus` força o status para "online" em dois momentos, ignorando se o usuário escolheu manualmente ficar "ocupado":
1. Ao montar o componente (inicialização)
2. Ao voltar para a aba do navegador

### Solução

Modificar a lógica para **respeitar o status "busy"** - só forçar "online" se o usuário estava "offline".

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useAvailabilityStatus.tsx` | Verificar status atual antes de forçar "online" |

---

### Implementação Detalhada

#### 1. Modificar a Inicialização (Linhas 136-180)

**Antes:**
```typescript
const setOnlineAndDistribute = async () => {
  // Força online sem verificar status atual
  await supabase
    .from("profiles")
    .update({ 
      availability_status: "online",
      ...
    })
    .eq("id", user.id);
```

**Depois:**
```typescript
const setOnlineAndDistribute = async () => {
  // 1. Primeiro, buscar o status atual do usuário
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("availability_status")
    .eq("id", user.id)
    .single();
  
  const currentStatus = currentProfile?.availability_status;
  
  // 2. Só definir como "online" se estava "offline"
  // Se estava "busy", manter o status escolhido pelo usuário
  if (currentStatus === 'offline' || !currentStatus) {
    console.log("[useAvailabilityStatus] User was offline, setting to online");
    await supabase
      .from("profiles")
      .update({ 
        availability_status: "online",
        last_status_change: new Date().toISOString(),
      })
      .eq("id", user.id);
    
    queryClient.invalidateQueries({ queryKey: ["availability-status", user.id] });
  } else {
    console.log(`[useAvailabilityStatus] Keeping current status: ${currentStatus}`);
    // Apenas atualizar o heartbeat para indicar atividade
    await supabase
      .from("profiles")
      .update({ 
        last_status_change: new Date().toISOString(),
      })
      .eq("id", user.id);
  }
  
  // 3. Distribuir conversas apenas se ficou online
  if (currentStatus === 'offline' || !currentStatus) {
    // ... lógica de distribuição existente
  }
};
```

#### 2. Modificar o Handler de Visibilidade (Linhas 193-215)

**Antes:**
```typescript
const handleVisibilityChange = async () => {
  if (document.visibilityState === 'visible') {
    // Força online ao voltar para a aba
    await supabase
      .from("profiles")
      .update({ 
        availability_status: "online",
        ...
      })
```

**Depois:**
```typescript
const handleVisibilityChange = async () => {
  if (document.visibilityState === 'visible') {
    // Buscar status atual
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("availability_status")
      .eq("id", user.id)
      .single();
    
    const currentStatus = currentProfile?.availability_status;
    
    // Só voltar para online se estava offline
    // Se estava "busy", respeitar a escolha do usuário
    if (currentStatus === 'offline') {
      console.log("[useAvailabilityStatus] Tab visible + was offline - setting online");
      await supabase
        .from("profiles")
        .update({ 
          availability_status: "online",
          last_status_change: new Date().toISOString(),
        })
        .eq("id", user.id);
      queryClient.invalidateQueries({ queryKey: ["availability-status", user.id] });
    } else {
      console.log(`[useAvailabilityStatus] Tab visible - keeping ${currentStatus}`);
      // Apenas enviar heartbeat para indicar atividade
      await supabase
        .from("profiles")
        .update({ 
          last_status_change: new Date().toISOString(),
        })
        .eq("id", user.id);
    }
  }
};
```

---

### Fluxo Corrigido

```text
[Usuário está BUSY]
        |
        v
[Troca de aba ou página re-renderiza]
        |
        v
[Hook verifica status atual]
        |
        v
   Status = "busy"?
     /        \
   SIM        NÃO (offline)
    |            |
    v            v
  MANTER      MUDAR para
  "busy"      "online"
    |            |
    v            v
[Apenas       [Set online +
heartbeat]    distribuir]
```

---

### Benefícios

- Status "ocupado" é respeitado mesmo após trocar de aba
- Status "ocupado" é mantido após re-renderizações
- Heartbeat continua funcionando para evitar timeout por inatividade
- Distribuição de conversas só ocorre quando realmente fica online
- Logs detalhados para debug

---

### Seção Técnica

**Lógica de Decisão:**
```typescript
// Só forçar online se estava offline
const shouldSetOnline = currentStatus === 'offline' || !currentStatus;
```

**Importante:** O heartbeat (`last_status_change`) deve continuar sendo enviado mesmo quando "busy" para evitar que o CRON `check-inactive-users` marque o usuário como offline por inatividade.

**Arquivo a modificar:**
- `src/hooks/useAvailabilityStatus.tsx`

**Linhas específicas:**
- 136-180 (inicialização)
- 193-215 (visibilidade da tab)
