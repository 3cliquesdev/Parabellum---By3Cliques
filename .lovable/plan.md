

# Plano: Widget de Assistente Virtual no Portal do Cliente

## Resumo
Criar um widget de chat flutuante no portal do cliente que se conecta ao motor de IA existente (`ai-autopilot-chat`) via canal `web_chat`, permitindo ao cliente tirar dúvidas sem sair do portal.

## Arquivos

### 1. Criar `src/hooks/useClientAssistant.ts`
- Buscar `contact_id` pelo email do usuário (mesmo padrão do `ClientTicketsList`)
- Buscar conversa ativa com `channel = 'web_chat'` e `status != 'closed'` para o contact_id, ou criar nova via insert em `conversations`
- Função `sendMessage` que:
  - Insere mensagem do cliente na tabela `messages`
  - Chama `supabase.functions.invoke('ai-autopilot-chat', { body: { conversationId, customerMessage, customer_context, flow_context } })`
  - Retorna resposta da IA
- Gerencia estado local de mensagens (array React) e loading

### 2. Criar `src/components/client-portal/AssistantWidget.tsx`
- **Botão flutuante**: círculo 56px, fixo no canto inferior direito, ícone `MessageCircle`
- **Painel de chat** (380x520px): header com título + fechar, área de mensagens com scroll, input + botão enviar
- **Balões**: IA à esquerda (bg-gray-100), cliente à direita (bg-blue-500 text-white)
- **Typing indicator**: 3 dots animados enquanto aguarda resposta
- **Mensagem inicial**: "Olá! Posso te ajudar com pedidos, rastreio, dúvidas ou devoluções. O que você precisa?"
- **Handoff**: se resposta tiver `handoff === true`, mostra mensagem de encaminhamento e link WhatsApp

### 3. Editar `src/pages/ClientPortal.tsx`
- Importar e renderizar `<AssistantWidget />` no nível da página (fora das tabs), antes do fechamento da div raiz

## Detalhes técnicos
- Usa `ai-autopilot-chat` já deployada — sem alteração de backend
- Canal `web_chat` já suportado pelo sistema
- Conversa criada com `ai_mode: 'autopilot'` para ativar o fluxo de IA automaticamente
- Tema claro forçado — estilos inline/hardcoded para consistência com o portal

