

## Plano: Seletor de Template ao Iniciar Conversa pelo Pipeline

### Contexto
Atualmente, ao clicar "Abrir no Inbox" no KanbanCard, o sistema cria a conversa e navega direto. O correto é mostrar um seletor de template WhatsApp antes, pois fora da janela de 24h é necessário enviar um HSM.

Já existe o componente `ReengageTemplateDialog` no Inbox que faz exatamente isso -- seleciona template, preenche variáveis e envia via `send-meta-whatsapp`. Vamos reutilizar a mesma lógica.

### Mudanças

**1. `src/components/KanbanCard.tsx`**
- Alterar o fluxo do `handleStartInboxConversation`:
  - Se já existe conversa aberta → navegar direto (conversa ativa, dentro da janela)
  - Se **não** existe conversa aberta → abrir um dialog de seletor de template antes de navegar
- Adicionar estados `showTemplateDialog` e dados do contato para o dialog
- Importar e renderizar um novo componente `PipelineTemplateDialog`

**2. Criar `src/components/pipeline/PipelineTemplateDialog.tsx`** (novo)
- Componente baseado no `ReengageTemplateDialog` existente, adaptado para o contexto do pipeline
- Props: `contactId`, `contactPhone`, `contactName`, `onConversationCreated(conversationId)`
- Fluxo:
  1. Busca instâncias WhatsApp Meta disponíveis (query `whatsapp_meta_instances`)
  2. Lista templates ativos da instância
  3. Usuário seleciona template e preenche variáveis
  4. Ao enviar: cria a conversa → envia template via `send-meta-whatsapp` → callback com `conversationId`
  5. O KanbanCard recebe o callback e faz `navigate(/inbox?conversation=id)`

### Reutilização
- Mesma tabela `whatsapp_message_templates`
- Mesma edge function `send-meta-whatsapp`
- Mesma lógica de variáveis do `ReengageTemplateDialog`

### Arquivos
- **Editar**: `src/components/KanbanCard.tsx`
- **Criar**: `src/components/pipeline/PipelineTemplateDialog.tsx`

