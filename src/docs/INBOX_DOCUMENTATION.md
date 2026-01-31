# 📬 Documentação Completa do Inbox

> Versão: 1.0.0 | Última atualização: 2026-01-31

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura de Dados](#2-arquitetura-de-dados)
3. [Sistema de Filtros](#3-sistema-de-filtros)
4. [Distribuição Automática](#4-distribuição-automática)
5. [Modos de Atendimento (ai_mode)](#5-modos-de-atendimento-ai_mode)
6. [Status do Agente](#6-status-do-agente)
7. [Kill Switch Global](#7-kill-switch-global)
8. [Sistema de SLA](#8-sistema-de-sla)
9. [CSAT (Pesquisa de Satisfação)](#9-csat-pesquisa-de-satisfação)
10. [Realtime e Sincronização](#10-realtime-e-sincronização)
11. [Envio de Mensagens (Otimista)](#11-envio-de-mensagens-otimista)
12. [Ações em Massa](#12-ações-em-massa)
13. [Broadcast de Reengajamento](#13-broadcast-de-reengajamento)
14. [Proteções e Segurança](#14-proteções-e-segurança)
15. [Fluxos de Chat (Chat Flows)](#15-fluxos-de-chat-chat-flows)
16. [Busca Universal](#16-busca-universal)
17. [Hooks Principais](#17-hooks-principais)
18. [Triggers e Funções SQL](#18-triggers-e-funções-sql)

---

## 1. Visão Geral

O Inbox é o módulo central de atendimento multicanal do CRM, suportando:

- **WhatsApp** (Meta Cloud API / Evolution API)
- **Webchat** (widget embeddable)
- **Canais futuros** (arquitetura extensível)

### Princípios Fundamentais

| Princípio | Descrição |
|-----------|-----------|
| **Previsibilidade** | Nenhuma automação pode surpreender o usuário |
| **Controle Humano** | IA nunca substitui humano silenciosamente |
| **Segurança Operacional** | Conversas só fecham por ação explícita |
| **Zero Duplicação** | Deduplicação em todas as camadas |

---

## 2. Arquitetura de Dados

### View Principal: `inbox_view`

```sql
-- Campos principais da inbox_view
id                  UUID          -- ID da conversa
contact_id          UUID          -- ID do contato
contact_name        TEXT          -- Nome do contato
contact_email       TEXT          -- Email do contato
contact_phone       TEXT          -- Telefone do contato
status              TEXT          -- 'open' | 'closed'
ai_mode             TEXT          -- 'autopilot' | 'copilot' | 'waiting_human' | 'disabled'
assigned_to         UUID          -- ID do agente atribuído
department_id       UUID          -- ID do departamento
last_message_at     TIMESTAMPTZ   -- Timestamp da última mensagem
last_sender_type    TEXT          -- 'contact' | 'user' | 'system'
last_snippet        TEXT          -- Preview da última mensagem
updated_at          TIMESTAMPTZ   -- Última atualização
channel             TEXT          -- 'whatsapp' | 'webchat'
awaiting_rating     BOOLEAN       -- Aguardando CSAT
```

### Limite de Consulta Padrão

```typescript
// Limite de 5000 registros para consistência entre sidebar e lista
.limit(5000)
```

> **Importante:** Os hooks `useConversations` e `useInboxCounts` usam o mesmo limite para evitar discrepâncias visuais.

---

## 3. Sistema de Filtros

### Filtros Disponíveis

| Filtro | Query | Descrição |
|--------|-------|-----------|
| **Todas** | `status != 'closed'` | Todas conversas abertas |
| **Minhas** | `assigned_to = user.id AND status != 'closed'` | Atribuídas ao agente logado |
| **Não respondidas** | `assigned_to = user.id AND last_sender_type = 'contact' AND status = 'open'` | Aguardando resposta do agente |
| **Pool de IA** | `ai_mode = 'autopilot' AND assigned_to IS NULL` | Conversas em atendimento automático |
| **Fila Humana** | `ai_mode = 'waiting_human' AND assigned_to IS NULL` | Aguardando atribuição |
| **Histórico** | `status = 'closed' AND assigned_to = user.id` | Conversas encerradas do agente |
| **SLA Crítico** | `last_sender_type = 'contact' AND last_message_at < now() - interval '4 hours'` | SLA excedido |

### Hooks Dedicados

```typescript
// Hook para "Minhas" - consulta direta ao banco
useMyInboxItems()

// Hook para "Não respondidas" - consulta direta ao banco
useMyNotRespondedInboxItems()

// Hook para busca universal
useInboxSearch(searchTerm)

// Hook para SLA excedido
useSlaExceededItems()
```

### Hierarquia de Prioridade

```
1. Busca Global (prioridade máxima)
2. Filtro "Não respondidas" (ignora outros filtros)
3. Filtros de categoria (Minhas, Pool de IA, etc.)
4. Filtros de popover (departamento, anexos, áudio)
```

---

## 4. Distribuição Automática

### Critérios de Elegibilidade da Conversa

```sql
ai_mode = 'waiting_human'
AND assigned_to IS NULL
AND department IS NOT NULL
AND status = 'open'
```

### Critérios de Elegibilidade do Agente

| Critério | Regra |
|----------|-------|
| Status | `availability_status = 'online'` |
| Departamento | Mesmo da conversa (sem fallback) |
| Capacidade | `active_chats < max_concurrent_chats` |
| Bloqueio | Não bloqueado / não em férias |

### Algoritmo de Distribuição

```
1. Least-loaded (menos conversas ativas)
2. Round-robin (em caso de empate)
3. Lock atômico (garante atribuição única)
```

### Regras Invioláveis

- ❌ **NÃO** existe fallback entre departamentos
- ❌ IA **NUNCA** substitui humano por ausência
- ✅ Se não houver agente: conversa permanece `open`, job fica `pending` ou `escalated`

### Capacidade Mínima

```typescript
// Limite mínimo obrigatório: 30 chats por agente
const MIN_CONCURRENT_CHATS = 30;
```

---

## 5. Modos de Atendimento (ai_mode)

### Modos Válidos

| Modo | IA Responde | Fluxo Executa | Humano Responde |
|------|-------------|---------------|-----------------|
| `autopilot` | ✅ Sim | ✅ Sim | ❌ Não |
| `copilot` | 🔵 Sugere | ❌ Não | ✅ Sim |
| `waiting_human` | ❌ Não | ❌ Não | ✅ Sim (quando atribuído) |
| `disabled` | ❌ Não | ❌ Não | ✅ Sim |

### Transições de Modo

```
autopilot → copilot     : Agente envia mensagem
autopilot → waiting_human: Handoff da IA / Kill Switch
copilot → waiting_human  : Agente fica offline
waiting_human → copilot  : Agente é atribuído
```

### Proteção do Modo

- Mensagens automáticas incluem `is_bot_message: true`
- Apenas mensagens de humano (`sender_type: user`) mudam para `copilot`
- Transferência de departamento atualiza `ai_mode` independentemente

---

## 6. Status do Agente

### Status Válidos

| Status | Recebe Novas | Mantém Atuais |
|--------|--------------|---------------|
| `online` | ✅ Sim | ✅ Sim |
| `busy` | ❌ Não | ✅ Sim |
| `away` | ❌ Não | ✅ Sim |
| `offline` | ❌ Não | ✅ Sim* |

> *Ao ficar offline, conversas podem ser movidas para `waiting_human` (redistribuição).

### Regras de Persistência

```typescript
// Heartbeat (last_status_change) - atualiza sem mudar status
// Status persiste através de:
// - Recarregamento de página
// - Troca de abas
// - Reconexão

// Única mudança automática permitida:
// CRON marca 'offline' após 5 min sem heartbeat
```

### Confirmação de Mudança

```typescript
// Transição busy → online requer confirmação
// Evita mudanças acidentais
```

---

## 7. Kill Switch Global

### Quando `ai_global_enabled = false`:

| Ação | Resultado |
|------|-----------|
| IA responder | ❌ Bloqueado |
| Fluxos enviarem mensagem | ❌ Bloqueado |
| Fallbacks automáticos | ❌ Bloqueado |
| Conversas novas | → `waiting_human` |
| Atendimento humano | ✅ Normal |

### Exceção: Modo Teste

```typescript
// is_test_mode = true ignora o Kill Switch
// Usado para testes em sandbox
```

### Regra de Ouro

> **Kill Switch = Zero envio automático**

---

## 8. Sistema de SLA

### Cálculo Dinâmico

```sql
-- SLA é calculado em tempo real, não armazenado
CASE
  WHEN last_sender_type = 'contact' 
    AND last_message_at < now() - interval '4 hours'
  THEN 'critical'
  
  WHEN last_sender_type = 'contact' 
    AND last_message_at < now() - interval '1 hour'
  THEN 'warning'
  
  ELSE 'ok'
END AS sla_status
```

### Thresholds

| Status | Tempo desde última mensagem do cliente |
|--------|----------------------------------------|
| `ok` | < 1 hora |
| `warning` | 1h - 4h |
| `critical` | ≥ 4 horas |

### Consistência

```typescript
// Badge da sidebar e lista usam a mesma query SQL
// Garantia: contador = número de itens na lista
```

---

## 9. CSAT (Pesquisa de Satisfação)

### Fluxo de CSAT

```
1. Conversa é encerrada (status = 'closed')
2. awaiting_rating = true é setado
3. Pesquisa é enviada ao cliente
4. Cliente responde com rating
5. Rating é anexado à conversa fechada
6. awaiting_rating = false
```

### Regras Invioláveis

- ❌ Resposta de CSAT **NÃO** reabre conversa
- ❌ Resposta de CSAT **NÃO** cria nova conversa
- ❌ Resposta de CSAT **NÃO** chama IA
- ❌ Resposta de CSAT **NÃO** inicia fluxo
- ✅ Rating é anexado à conversa original

### Guard de CSAT

```typescript
// No webhook, verificar antes de processar:
if (conversation.awaiting_rating && conversation.status === 'closed') {
  // É resposta de CSAT - processar rating, não criar conversa
  return handleCsatResponse(rating);
}
```

---

## 10. Realtime e Sincronização

### Canais de Realtime

```typescript
// Canal global para todas as conversas
'inbox-messages-global-realtime'

// Canal específico por conversa
`messages:conversation_id=eq.${conversationId}`
```

### Estratégia de Resiliência (3 camadas)

| Camada | Mecanismo | Intervalo |
|--------|-----------|-----------|
| 1 | Realtime WebSocket | Tempo real |
| 2 | Catch-up query | Na reconexão |
| 3 | Polling backup | 5 segundos |

### Catch-up Logic

```typescript
// Ao detectar reconexão ou a cada 30s (heartbeat):
const catchUp = async () => {
  const lastLocalTimestamp = getLastMessageTimestamp();
  const { data } = await supabase
    .from('messages')
    .select('*')
    .gt('created_at', lastLocalTimestamp);
  // Merge com mensagens locais
};
```

### Invalidação de Permissões

```typescript
// Quando permissões mudam:
queryClient.invalidateQueries({ queryKey: ['role-permissions'] });
queryClient.invalidateQueries({ queryKey: ['user-role'] });
queryClient.setQueryData(['permissions-version'], (v) => (v || 0) + 1);
```

---

## 11. Envio de Mensagens (Otimista)

### Arquitetura Otimista

```typescript
// 1. Gerar UUID no cliente
const messageId = crypto.randomUUID();

// 2. Renderizar imediatamente na UI
addOptimisticMessage(messageId, content);

// 3. Enviar em background via queueMicrotask
queueMicrotask(async () => {
  await sendToBackend(messageId, content, { skip_db_save: true });
});
```

### Latência Percebida

```
< 100ms (sub-100ms perceived latency)
```

### Deduplicação

```typescript
// Janela de 30 segundos para deduplicação
const processedIdsRef = useRef(new Map<string, number>());

// Content-matching para reconciliar Realtime com otimista
const isDuplicate = (newMsg) => {
  return processedIdsRef.current.has(newMsg.id) ||
         existingMessages.some(m => 
           m.content === newMsg.content && 
           Math.abs(m.created_at - newMsg.created_at) < 5000
         );
};
```

### Canais Suportados

| Canal | Edge Function | Flag |
|-------|---------------|------|
| WhatsApp Meta | `send-meta-whatsapp` | `skip_db_save: true` |
| WhatsApp Evolution | `send-whatsapp-message` | `skip_db_save: true` |
| Webchat | Supabase direto | N/A |
| Notas Internas | Supabase direto | N/A |

---

## 12. Ações em Massa

### Seleção Múltipla

```typescript
// UI: Botão "Selecionar" no cabeçalho ativa checkboxes
// State: Set<string> com IDs selecionados
const [selectedIds, setSelectedIds] = useState(new Set<string>());
```

### Ações Disponíveis (InboxBulkDistributeBar)

| Ação | Descrição |
|------|-----------|
| **Redistribuir** | Atribuir lote para agente/departamento/fila |
| **Reativar Autopilot** | Voltar conversas para IA |
| **Encerrar** | Fechar conversas em massa |

### Encerramento em Massa

```typescript
// useBulkCloseConversations
const bulkClose = async (ids: string[], options: { sendCsat?: boolean }) => {
  for (const id of ids) {
    await supabase
      .from('conversations')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        ai_mode: 'disabled',
        awaiting_rating: options.sendCsat || false,
      })
      .eq('id', id);
  }
};
```

---

## 13. Broadcast de Reengajamento

### Arquitetura

```typescript
// Edge Function: broadcast-ai-queue
// Tabela: broadcast_jobs
// Realtime: progresso em tempo real
```

### Filtros

```typescript
// Apenas canal WhatsApp
channel: 'whatsapp'

// Conversas na fila de IA
ai_mode: 'autopilot'
assigned_to: null
```

### Throttling

```typescript
// Delay entre mensagens: 200ms
// Evita throttling da API do Meta
await sleep(200);
```

### Permissões

```typescript
// Restrito a cargos de gestão
const ALLOWED_ROLES = ['admin', 'manager', 'general_manager'];
```

---

## 14. Proteções e Segurança

### Proteção `is_bot_message` (CRÍTICO)

```typescript
// ⛔ NUNCA REMOVER esta verificação
const isHumanMessage = body.message && 
                       !body.template && 
                       !body.interactive && 
                       !body.is_bot_message;

// Mensagens de bot/fluxo → NÃO mudam ai_mode
// Mensagens de humano → mudam para copilot
```

### Triggers de Segurança

| Trigger | Função |
|---------|--------|
| `fix_orphan_copilot_conversations` | Reverte para `waiting_human` se agente desatribuído em copilot |
| `fix_handoff_not_completed` | Força `waiting_human` se handoff executado mas modo travado |
| `redistribute_on_agent_offline` | Move para fila quando agente fica offline |

### Proteção de Modo Copilot

```typescript
// Conversas em copilot/disabled (assumidas por humano):
// - NÃO voltam para autopilot automaticamente
// - Vão para waiting_human quando agente fica offline
```

---

## 15. Fluxos de Chat (Chat Flows)

### Validação de `ask_options`

```typescript
// Entradas válidas:
// ✅ Número correspondente (1, 2, 3...)
// ✅ Texto exato do label (case-insensitive)
// ✅ Texto exato do value (case-insensitive)

// Entradas inválidas:
// ❌ Texto parcial ("Ped" para "Pedidos")
// ❌ Números fora do range
// ❌ Qualquer outra resposta

// Comportamento para entrada inválida:
// 1. Fluxo NÃO avança
// 2. Reenvia pergunta com orientação
```

### Proteção de Modo no Fluxo

| ai_mode | Processar Fluxo | Chamar IA | Enviar Resposta |
|---------|-----------------|-----------|-----------------|
| `autopilot` | ✅ | ✅ | ✅ |
| `waiting_human` | ❌ | ❌ | ❌ |
| `copilot` | ❌ | ❌ | ❌ |
| `disabled` | ❌ | ❌ | ❌ |

### Regra Anti-Mudo

```typescript
// Fluxo NUNCA pode "ficar mudo"
// Se nó inicial for sem conteúdo (input/start/condition):
// → Atravessar até nó com mensagem/opções/transfer/ai_response
```

---

## 16. Busca Universal

### Campos Pesquisáveis

```sql
-- Apenas campos TEXT (UUID não suporta ILIKE)
contact_name ILIKE '%termo%'
contact_email ILIKE '%termo%'
contact_phone ILIKE '%termo%'
```

### Ordenação dos Resultados

```sql
ORDER BY status ASC,          -- 'open' antes de 'closed'
         last_message_at DESC -- Mais recentes primeiro
```

### Limite e Debounce

```typescript
// Limite: 100 resultados
// Debounce: 300ms
// Mínimo de caracteres: 2
```

### Hook Dedicado

```typescript
// useInboxSearch.tsx
// Consulta DIRETA ao banco, não usa cache local
// Prioridade máxima sobre outros filtros
```

---

## 17. Hooks Principais

### Listagem

| Hook | Descrição |
|------|-----------|
| `useInboxView` | Lista principal com limite de 5000 |
| `useMyInboxItems` | Conversas "Minhas" (consulta direta) |
| `useMyNotRespondedInboxItems` | Conversas não respondidas (consulta direta) |
| `useSlaExceededItems` | Conversas com SLA crítico |
| `useInboxSearch` | Busca universal |
| `useInboxCounts` | Contadores da sidebar (Edge Function) |

### Ações

| Hook | Descrição |
|------|-----------|
| `useTakeControl` | Assumir conversa (otimista) |
| `useCanTakeControl` | Verificar se pode assumir |
| `useSendMessageInstant` | Envio otimista de mensagens |
| `useBulkCloseConversations` | Encerramento em massa |
| `useBulkRedistribute` | Redistribuição em massa |

### Realtime

| Hook | Descrição |
|------|-----------|
| `useMessages` | Mensagens com catch-up e deduplicação |
| `useRealtimePermissions` | Sincronização de permissões |
| `useUnreadCount` | Contadores de não lidas |

---

## 18. Triggers e Funções SQL

### Triggers de Distribuição

```sql
-- Criar job de distribuição quando conversa elegível
CREATE TRIGGER trigger_create_distribution_job
AFTER UPDATE ON conversations
FOR EACH ROW
WHEN (
  NEW.ai_mode = 'waiting_human' AND
  NEW.assigned_to IS NULL AND
  NEW.department IS NOT NULL AND
  NEW.status = 'open'
)
EXECUTE FUNCTION create_distribution_job();
```

### Triggers de Proteção

```sql
-- Corrigir conversas órfãs em copilot
CREATE TRIGGER fix_orphan_copilot_conversations
AFTER UPDATE ON conversations
FOR EACH ROW
WHEN (
  OLD.assigned_to IS NOT NULL AND
  NEW.assigned_to IS NULL AND
  NEW.ai_mode = 'copilot'
)
EXECUTE FUNCTION set_waiting_human();

-- Corrigir handoff não completado
CREATE TRIGGER fix_handoff_not_completed
AFTER UPDATE ON conversations
FOR EACH ROW
WHEN (
  NEW.handoff_executed_at IS NOT NULL AND
  NEW.ai_mode = 'autopilot'
)
EXECUTE FUNCTION force_waiting_human();
```

### Função de Verificação de Role

```sql
-- Verifica se usuário é gerente ou admin
CREATE OR REPLACE FUNCTION public.is_manager_or_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'manager', 'general_manager', 'support_manager', 'cs_manager')
  );
$$;
```

---

## Referência Rápida: Contratos do Sistema

### Contrato de Status do Agente
- ✅ Apenas `online` recebe novas conversas
- ❌ Mudar status **NUNCA** encerra conversas
- ❌ Mudar status **NUNCA** remove `assigned_to`

### Contrato de Status da Conversa
- Conversas só são encerradas por ação humana explícita ou auto-close por inatividade

### Contrato de Distribuição
- ❌ NÃO existe fallback entre departamentos
- ❌ IA nunca substitui humano por ausência
- ✅ Distribuição é least-loaded + round-robin

### Contrato de UI/UX
- ❌ Proibido: "Suas conversas serão encerradas ao ficar offline"
- ❌ Proibido: "A IA assumirá se não houver atendentes"
- ✅ Correto: "Você deixará de receber novas conversas"

---

## Princípio Final (Inquebrável)

> Nenhuma automação pode surpreender.
> Nenhuma IA pode substituir um humano silenciosamente.
> Nenhuma conversa é encerrada sem intenção clara.

---

*Documentação gerada em 2026-01-31*
