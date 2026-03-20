

# Auditoria: Tagging da IA — Problemas Encontrados e Correções

## Diagnóstico

### Problema 1: `auto-close-conversations` SOBRESCREVE tags da IA
Quando a IA aplica uma tag via `tag_conversation` (ex: "5.01 Informações sobre entrega") e depois o `auto-close-conversations` encerra por inatividade, ele **sempre adiciona** a tag "9.98 Falta de Interação" como fallback — sem verificar se já existe uma tag aplicada pela IA. O resultado: a conversa fica com DUAS tags, e a "Falta de Interação" aparece como a mais recente.

**Localização:** `auto-close-conversations/index.ts` — linhas 406-416, 698-703, 796-801 (3 stages) fazem `upsert` de `FALTA_INTERACAO_TAG_ID` sem checar tags existentes.

### Problema 2: IA pode não chamar `tag_conversation` antes de `close_conversation`
Apesar do prompt instruir "SEMPRE chame tag_conversation ANTES de close_conversation", a LLM pode ignorar essa instrução (é probabilística). Não há guard no handler de `close_conversation` que force ou verifique a presença de tag.

### Problema 3: Confirmação de encerramento (linha 2592-2628) não verifica tag
Quando o cliente confirma "sim" no 2-step, o código invoca `close-conversation` diretamente sem verificar se `tag_conversation` foi chamado na iteração anterior.

## Correções

### 1. `auto-close-conversations` — Respeitar tags existentes (3 locais)

Antes de cada `upsert` de "Falta de Interação", verificar se a conversa já tem uma tag aplicada (qualquer tag). Se já tem, **não** adicionar "9.98 Falta de Interação".

```text
// Pseudo-código para cada stage:
const { data: existingTags } = await supabase
  .from('conversation_tags')
  .select('tag_id')
  .eq('conversation_id', conv.id);

const flowCloseTag = await getFlowCloseTagId(supabase, conv.id);

if (existingTags && existingTags.length > 0) {
  // Já tem tag (possivelmente da IA) — NÃO sobrescrever
  console.log(`[Auto-Close] Conversa ${conv.id} já tem ${existingTags.length} tag(s) — mantendo`);
} else {
  // Sem tag — aplicar flowTag ou fallback
  await supabase.from('conversation_tags').upsert({
    conversation_id: conv.id,
    tag_id: flowCloseTag || FALTA_INTERACAO_TAG_ID,
  }, { onConflict: 'conversation_id,tag_id', ignoreDuplicates: true });
}
```

Aplicar em **4 locais**: Stage 3 (linha ~406), Stage 3a (linha ~570), Stage 3b (linha ~698), Stage 3.5 (linha ~796).

### 2. `ai-autopilot-chat` — Guard no close_conversation handler

No handler de `close_conversation` (linha ~10000), quando `customer_confirmed=false` (etapa 1), verificar se já existe tag na conversa. Se não, logar warning mas continuar (a IA deveria ter chamado `tag_conversation` antes, mas não bloquear o encerramento).

### 3. `ai-autopilot-chat` — Guard na confirmação (linha ~2562)

Na seção de confirmação de encerramento (quando cliente diz "sim"), antes de chamar `close-conversation`, verificar se existe tag. Se não existir, logar `ai_event` de warning para monitoramento.

## Arquivos a modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/auto-close-conversations/index.ts` | Checar tags existentes antes de aplicar "Falta de Interação" em 4 locais |
| `supabase/functions/ai-autopilot-chat/index.ts` | Warning log se close_conversation chamado sem tag prévia |

Deploy: `auto-close-conversations` e `ai-autopilot-chat`

