

# Tagging Inteligente: IA aplica tag contextual ao encerrar

## Problema

1. **"Falta de Interação" em todas as conversas da IA**: Quando a IA encerra via `close_conversation` (2-step confirmation), nenhuma tag é aplicada. Se a conversa cai no `auto-close-conversations` por timeout, recebe "9.98 Falta de Interação" como fallback — mesmo que a IA tenha resolvido o problema do cliente.

2. **Conversa #1096B783**: IA ajudou com informações sobre entrega, deveria ter a tag "5.01 Informações sobre entrega", mas ficou sem tag ou com "Falta de Interação".

3. **Raiz do problema**: O tool `close_conversation` no `ai-autopilot-chat` NÃO aplica nenhuma tag à conversa. O `classify_and_resolve_ticket` cria/atualiza ticket mas também NÃO aplica tag na conversa.

## Solução

Adicionar uma nova tool `tag_conversation` que a IA usa para aplicar a tag correta ANTES de encerrar, baseada no atendimento prestado.

### 1. Nova tool `tag_conversation` no `ai-autopilot-chat`

**Definição da tool:**
```
name: 'tag_conversation'
description: 'Aplica a tag de classificação na conversa baseada no atendimento prestado. 
Use SEMPRE ANTES de close_conversation. Escolha a tag que melhor representa o motivo do atendimento.'
parameters:
  tag_name: string (enum com todas as tags disponíveis: "1.01 Duvidas gerais", "5.01 Informações sobre entrega", etc.)
```

**Handler:** Busca o `tag_id` pelo nome na tabela `tags`, faz upsert em `conversation_tags` e `protected_conversation_tags`.

### 2. Atualizar system prompt

Adicionar instrução:
```
- tag_conversation: SEMPRE use ANTES de close_conversation para classificar o atendimento. 
  Escolha a tag que melhor descreve o assunto tratado. Exemplos:
  - Cliente perguntou sobre entrega → "5.01 Informações sobre entrega"
  - Cliente com dúvidas gerais → "1.01 Duvidas gerais"
  - Cliente pediu saque → "6.05 Saque do saldo"
  - Cliente pediu cancelamento → "7.01 Cancelamento de assinatura"
```

### 3. Guard no `close_conversation`

Antes de chamar `close-conversation`, verificar se já existe pelo menos uma tag na conversa. Se não, a IA continua sem tag (fallback para o humano aplicar), mas loga um warning.

### Mapeamento de tags disponíveis (carregado dinamicamente)

Em vez de hardcodar as tags, buscar da tabela `tags` no momento da construção do prompt — listar apenas as tags relevantes (categorias 1.x a 7.x) para a IA escolher.

### Arquivos a modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/ai-autopilot-chat/index.ts` | Nova tool `tag_conversation` + handler + prompt atualizado |

Deploy: `ai-autopilot-chat`

