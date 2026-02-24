

# Adicionar Validacao de Tags no Backend (Edge Function)

## Problema

A validacao de tags obrigatorias ao encerrar conversa existe **somente no frontend** (CloseConversationDialog). A Edge Function `close-conversation` aceita qualquer request e fecha a conversa sem verificar se ha tags de categoria "conversation". Isso significa:

1. Se o usuario estiver usando uma versao em cache do frontend (sem a validacao), consegue encerrar normalmente
2. Qualquer chamada direta ao backend ignora a regra
3. O `ReengageTemplateDialog` tambem fecha conversas sem validar tags

## Solucao: Validacao Server-Side

### 1. Edge Function `close-conversation` - Adicionar verificacao de tags

**Arquivo:** `supabase/functions/close-conversation/index.ts`

Antes de fechar a conversa (antes da linha 122 - update para "closed"), adicionar:

1. Consultar `system_configurations` para verificar se `conversation_tags_required = "true"`
2. Se ativo, consultar `conversation_tags` JOIN `tags` filtrando `category = 'conversation'`
3. Se nenhuma tag de categoria "conversation" existir, retornar **HTTP 400** com mensagem de erro clara
4. Se nao estiver ativo, prosseguir normalmente

Logica:
```text
system_configurations.key = "conversation_tags_required"
  -> Se value = "true":
    -> Buscar conversation_tags WHERE conversation_id = X
       JOIN tags WHERE category = 'conversation'
    -> Se count = 0: retornar erro 400
       "Conversa nao pode ser encerrada sem tags de conversa"
```

### 2. Frontend - Manter validacao existente como UX guard

O frontend (CloseConversationDialog) continua bloqueando visualmente o botao -- isso serve como primeira camada de UX. O backend serve como segunda camada de seguranca.

### 3. Bulk close - Ja validado no frontend

O `useBulkCloseConversations` ja valida tags no frontend. Como ele faz update direto (sem passar pela Edge Function), considerar adicionar uma RPC ou trigger de banco que valide tambem. Porem, como primeiro passo, a Edge Function e o ponto critico.

## Impacto

- Zero regressao: fluxo normal de encerramento continua igual
- Upgrade de seguranca: backend agora rejeita encerramento sem tags
- Resolve problema de cache/versao publicada: mesmo com frontend antigo, backend bloqueia
- Mensagem de erro clara retornada ao usuario
