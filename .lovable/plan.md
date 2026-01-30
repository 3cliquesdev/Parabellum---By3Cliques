
# Plano: Adicionar CRON Job para Dispatcher de Conversas

## Diagnóstico Completo

Após análise profunda, identifiquei o **problema raiz** que impede a distribuição automática:

### Estado Atual

| Componente | Status |
|------------|--------|
| Trigger `ensure_dispatch_job` | ✅ Funciona (cria jobs quando conversa entra em waiting_human) |
| Edge function `dispatch-conversations` | ✅ Funciona (atribuiu 5 conversas à Juliana quando chamado manualmente) |
| **CRON Job para dispatcher** | ❌ **NÃO EXISTE** |

### Por que as conversas ficam paradas 18+ minutos?

1. O trigger SQL cria jobs na tabela `conversation_dispatch_jobs` corretamente
2. **MAS** não há nenhum CRON job que execute `dispatch-conversations` periodicamente
3. O único momento que o dispatcher é chamado é quando um agente muda status para "online" (via hook `useAvailabilityStatus`)
4. Como Juliana já estava online, ninguém acionou o dispatcher

### Evidências

**Jobs encontrados sem processamento:**
```text
Suporte Pedidos: 6 jobs pendentes (READY)
Suporte Sistema: 10 jobs pendentes (READY)
Total: 16 jobs aguardando um dispatcher que nunca vem
```

**Após chamar manualmente:**
```json
{
  "assigned": 5,
  "processed": 16,
  "results": [
    {"agent": "Juliana Alves", "status": "assigned"},
    // ... 4 mais para Juliana
  ]
}
```

**CRONs existentes (nenhum para dispatcher):**
- `process-playbook-queue-every-minute` (cada minuto) ✅
- `auto-close-inactive-conversations` (cada hora) ✅
- `process-pending-deal-closures` (cada 5 min) ✅
- `dispatch-conversations` ❌ **FALTA**

## Solução

Criar um **CRON job nativo do Supabase** que execute `dispatch-conversations` a cada minuto, garantindo que:

1. Conversas em `waiting_human` sejam processadas em < 1 minuto
2. O sistema seja resiliente (não dependa de ações do usuário)
3. Mantenha o hook `useAvailabilityStatus` como "fast path" para latência < 1s quando agente fica online

## Implementação

### Migration SQL

```sql
-- Adicionar CRON job para processar fila de dispatch a cada minuto
SELECT cron.schedule(
  'dispatch-conversations-every-minute',  -- nome do job
  '* * * * *',                            -- a cada minuto
  $$
  SELECT
    net.http_post(
        url:='https://zaeozfdjhrmblfaxsyuu.supabase.co/functions/v1/dispatch-conversations',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZW96ZmRqaHJtYmxmYXhzeXV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4NzcxODIsImV4cCI6MjA3OTQ1MzE4Mn0.lowOKwfcgxuGQPcWPEEw6TeCfXMR9h9EQRLAAs4mmZ0"}'::jsonb,
        body:=jsonb_build_object('source', 'cron', 'time', now())
    ) as request_id;
  $$
);
```

## Impacto Esperado

### Antes (Bug)

| Situação | Tempo de Espera |
|----------|----------------|
| Conversa entra em waiting_human | ∞ (até alguém mudar status) |
| Agente já online | ∞ (sem trigger) |

### Depois (Corrigido)

| Situação | Tempo de Espera |
|----------|----------------|
| Conversa entra em waiting_human | < 1 minuto (CRON) |
| Agente muda para online | < 1 segundo (hook fast path) |

## Arquivos a Modificar

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| Nova migration SQL | Banco de Dados | Adicionar CRON job |

## Compatibilidade

- ✅ Não afeta distribuições existentes
- ✅ Mantém hook de fast path para latência mínima
- ✅ Segue padrão dos outros CRONs do projeto
- ✅ Usa mesma anon key dos outros CRONs

## Verificação Pós-Deploy

Após aplicar a migration:
1. Aguardar 1-2 minutos
2. Verificar `cron.job` - deve aparecer o novo job
3. Verificar `cron.job_run_details` - deve mostrar execuções bem-sucedidas
4. Novas conversas em waiting_human devem ser atribuídas em < 1 min

---

## Seção Tecnica

### Fluxo Completo Corrigido

```text
Cliente pede transferência para humano
        ↓
ai-autopilot-chat seta ai_mode = 'waiting_human'
        ↓
Trigger ensure_dispatch_job cria job
        ↓
CRON (a cada minuto) → dispatch-conversations
        ↓
findEligibleAgent(dept) → Juliana (11 chats < 30)
        ↓
UPDATE conversations SET assigned_to = Juliana, ai_mode = 'copilot'
        ↓
Juliana recebe notificação no inbox ✅
```

### Arquitetura de Resiliência

```text
┌─────────────────────────────────────────────────────────────┐
│                     ENTRADAS DE DISTRIBUIÇÃO                │
├─────────────────────────────────────────────────────────────┤
│  1. CRON (cada minuto) - Garantia de processamento          │
│  2. Hook useAvailabilityStatus (ao ficar online) - Fast     │
│  3. Manual via API - Debug/emergência                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
              ┌───────────────────────────────┐
              │    dispatch-conversations    │
              │    (Edge Function)           │
              └───────────────────────────────┘
                              ↓
              ┌───────────────────────────────┐
              │  conversation_dispatch_jobs  │
              │  (Fila persistente)          │
              └───────────────────────────────┘
```

### Nota sobre Memória do Projeto

A memória `infrastructure/distribution-cron-and-agent-trigger-logic` menciona que deveria existir um CRON:

> "O sistema utiliza um cron job nativo do Supabase (`schedule = "* * * * *"`) para invocar a função `dispatch-conversations` a cada minuto"

Porém este CRON **nunca foi criado** ou foi removido. Esta migration corrige essa lacuna.
