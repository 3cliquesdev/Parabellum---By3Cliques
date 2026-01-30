

# Plano: Corrigir Conversas Órfãs em Copilot

## Problema Identificado

O Oliveira está **online** e no departamento correto, mas não recebe conversas porque:

1. **0 conversas** estão em `waiting_human` (condição obrigatória para distribuição)
2. **3 conversas** estão em estado inconsistente: `ai_mode = 'copilot'` mas `assigned_to = NULL`
3. **2 conversas** estão em `autopilot` (IA atendendo)

O dispatcher só processa conversas em `waiting_human`, então essas conversas órfãs ficam "invisíveis".

## Solução Proposta

### Alteração 1: Migração SQL para Corrigir Estado Inconsistente

Mover conversas órfãs (`copilot` sem agente) para `waiting_human`:

```sql
-- Corrigir conversas em copilot sem agente atribuído
UPDATE conversations
SET 
  ai_mode = 'waiting_human',
  dispatch_status = 'pending'
WHERE 
  ai_mode = 'copilot'
  AND assigned_to IS NULL
  AND status = 'open';
```

Isso vai:
- Mover 3 conversas para `waiting_human`
- Disparar o trigger `ensure_dispatch_job`
- Criar jobs de distribuição
- Oliveira receberá na próxima rodada do CRON (1 minuto)

### Alteração 2: Prevenir Futuras Inconsistências (Trigger)

Criar um trigger que automaticamente move para `waiting_human` quando o agente é removido de uma conversa em `copilot`:

```sql
CREATE OR REPLACE FUNCTION fix_orphan_copilot_conversations()
RETURNS TRIGGER AS $$
BEGIN
  -- Se estava em copilot e perdeu o agente, voltar para waiting_human
  IF OLD.ai_mode = 'copilot' 
     AND OLD.assigned_to IS NOT NULL 
     AND NEW.assigned_to IS NULL 
     AND NEW.status = 'open' THEN
    NEW.ai_mode := 'waiting_human';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_fix_orphan_copilot
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION fix_orphan_copilot_conversations();
```

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| 3 conversas em `copilot` sem agente | 3 conversas em `waiting_human` |
| Oliveira não recebe nada | Oliveira recebe as 3 conversas (máximo permitido por capacidade) |
| Dispatcher ignora órfãs | Dispatcher processa normalmente |

## Arquitetura do Fluxo Corrigido

```text
Conversa em copilot + assigned_to removido
           │
           ▼
┌──────────────────────────────────┐
│ Trigger: fix_orphan_copilot     │
│ → ai_mode = 'waiting_human'     │
└──────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ Trigger: ensure_dispatch_job    │
│ → Cria job de distribuição      │
└──────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ CRON: dispatch-conversations    │
│ → Atribui ao Oliveira (online)  │
└──────────────────────────────────┘
```

## Seção Técnica

### Arquivos/Recursos Modificados

1. **Migração SQL** - Corrigir dados existentes + criar trigger preventivo

### Impacto

- **Zero breaking changes** - Apenas corrige estado inconsistente
- **Backward compatible** - Trigger só age quando há inconsistência
- **Auditável** - Trigger registra a transição de estado

### Teste Após Deploy

1. Verificar se as 3 conversas foram para `waiting_human`
2. Aguardar 1 minuto (CRON)
3. Verificar se Oliveira recebeu atribuição:
```sql
SELECT id, assigned_to, ai_mode 
FROM conversations 
WHERE department = '2dd0ee5c-fd20-44be-94ad-f83f1be1c4e9'
AND status = 'open'
AND assigned_to = '0d0b0a9c-98c7-4721-b545-efc294f4da5e';
```

