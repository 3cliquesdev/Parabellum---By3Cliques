

# Corrigir botao "Reengajar via Template" que nunca aparece

## Problema raiz

O botao "Reengajar via Template" esta invisivel para 97% das conversas WhatsApp porque o codigo verifica `whatsapp_instance_id` (Evolution API legada), mas quase todas as conversas usam `whatsapp_meta_instance_id` (Meta Cloud API).

Alem disso, o botao so aparece quando `closed_reason === "whatsapp_window_expired"`, ignorando conversas fechadas por outros motivos onde o template tambem seria necessario para reabrir o contato.

## Correcoes planejadas

### 1. ChatWindow.tsx - Condicao de visibilidade do botao (linha 659)

**Antes:**
```
conversation.channel === "whatsapp" 
  && (conversation as any).closed_reason === "whatsapp_window_expired" 
  && conversation.whatsapp_instance_id
```

**Depois:**
```
conversation.channel === "whatsapp" 
  && (conversation.whatsapp_instance_id || conversation.whatsapp_meta_instance_id)
```

Isso mostra o botao em **qualquer conversa WhatsApp fechada** que tenha uma instancia configurada (seja Evolution ou Meta). O agente pode decidir se quer reengajar ou nao.

### 2. ReengageTemplateDialog.tsx - Suporte a Meta Cloud API

O dialog atualmente usa `whatsapp_instance_id` em 3 pontos:
- Interface de props
- Query de templates
- Envio via `send-meta-whatsapp`

Correcoes:
- Adicionar `whatsapp_meta_instance_id` na interface
- Criar variavel `instanceId = conversation.whatsapp_meta_instance_id || conversation.whatsapp_instance_id`
- Usar `instanceId` na query de templates e no envio
- Na query de templates, filtrar por `instance_id` correto (Meta usa a tabela `whatsapp_message_templates` com o `instance_id` da instancia Meta)

### 3. ChatWindow.tsx - Passar `whatsapp_meta_instance_id` para o dialog

Adicionar `whatsapp_meta_instance_id` no objeto conversation passado ao `ReengageTemplateDialog`.

## Arquivos impactados

| Arquivo | Mudanca |
|---------|---------|
| `src/components/ChatWindow.tsx` | Relaxar condicao do botao + passar `whatsapp_meta_instance_id` ao dialog |
| `src/components/inbox/ReengageTemplateDialog.tsx` | Suportar `whatsapp_meta_instance_id` em props, query e envio |

## Zero regressao

- Conversas Evolution (3%) continuam funcionando igual (fallback para `whatsapp_instance_id`)
- Conversas Meta (97%) passam a ver o botao
- Nenhuma outra feature e afetada
- Kill Switch, Shadow Mode, CSAT guard: sem impacto

