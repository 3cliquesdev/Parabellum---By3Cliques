

# Plano: Botão de download da conversa no modal de preview

## O que será feito

Adicionar um botão "Baixar Conversa" ao lado do botão "Abrir no Inbox" no modal de histórico da conversa (em `ContactDetailsSidebar.tsx`). O download gera um arquivo `.txt` formatado com todas as mensagens visíveis.

## Formato do arquivo

```text
Conversa WhatsApp - Ronildo Oliveira
Status: Aberta | Data: 15/03/2026 13:37
Atendente: Fulano
========================================

[13:37] Cliente: oi

[13:37] Agente: Seja bem-vindo à 3 Cliques!...

[13:39] Cliente: Eae

[13:40] IA: Ronildo! Tudo bem?

...
```

## Alterações

### 1. `src/components/ContactDetailsSidebar.tsx`
- Adicionar uma função `handleDownloadConversation` que:
  - Formata as mensagens já carregadas (`conversationMessages`) em texto legível
  - Inclui header com canal, status, data e atendente
  - Gera um Blob `.txt` e dispara o download
- Adicionar um botão `Download` (ícone `Download`) ao lado do botão "Abrir no Inbox" no footer do modal (linha ~686)
- Os dois botões ficam lado a lado no footer

### 2. Nenhuma alteração de banco ou edge function
Usa apenas os dados já carregados no modal (array `conversationMessages`). Zero chamadas extras.

