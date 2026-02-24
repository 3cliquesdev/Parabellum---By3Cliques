

# Corrigir Scroll e Navegacao do Pop-up de Conversa

## Problemas identificados

1. **Scroll nao funciona**: O `ScrollArea` tem `max-h-[55vh]` mas o layout flex do `DialogContent` nao esta restringindo a altura corretamente. As mensagens ficam cortadas sem possibilidade de rolar.

2. **"Abrir no Inbox" nao navega**: O usuario ja esta na rota `/inbox?conversation=X`. Quando clica "Abrir no Inbox", o `navigate` muda o query param mas o React Router nao remonta a pagina porque a rota base (`/inbox`) e a mesma. Precisa forcar a atualizacao.

## Correcoes

### Arquivo: `src/components/ContactDetailsSidebar.tsx`

### 1. Corrigir scroll do DialogContent

- Mudar `DialogContent` para usar `overflow-hidden` e garantir que o flex funcione
- Mudar `ScrollArea` de `max-h-[55vh]` para `h-full` com `overflow-y-auto` no container
- Adicionar `min-h-0` no wrapper das mensagens para permitir que o flex shrink funcione

### 2. Corrigir navegacao "Abrir no Inbox"

- Usar `window.location.href` como fallback ou `navigate` com `{ replace: true }` + um pequeno truque de estado
- Alternativa mais robusta: fechar o sidebar, navegar com `navigate('/inbox?conversation=ID', { replace: true })` e usar `window.location.reload()` se necessario
- Melhor abordagem: navegar para a rota e disparar um evento ou usar `navigate(0)` apos mudar o param

Abordagem escolhida: usar `window.location.href` para garantir que a pagina recarregue com a conversa correta, ja que e uma acao rara (clicar "Abrir no Inbox") e a simplicidade vale mais que a otimizacao.

## Detalhes tecnicos

### ScrollArea fix (linha 463):
```typescript
// De:
<ScrollArea className="flex-1 min-h-0 max-h-[55vh] pr-2">

// Para:
<ScrollArea className="flex-1 min-h-0 pr-2">
```

O `flex-1 min-h-0` dentro de um container `flex flex-col max-h-[85vh]` ja restringe a altura. O `max-h-[55vh]` adicional impedia o scroll de funcionar corretamente com o Radix ScrollArea.

### Navegacao fix (linhas 529-533):
```typescript
// De:
onClick={() => {
  navigate(`/inbox?conversation=${selectedConversationId}`);
  setSelectedConversationId(null);
  setSelectedConversationMeta(null);
}}

// Para:
onClick={() => {
  setSelectedConversationId(null);
  setSelectedConversationMeta(null);
  window.location.href = `/inbox?conversation=${selectedConversationId}`;
}}
```

## Zero regressao

- Apenas altera o dialog de historico
- Nenhuma outra funcionalidade impactada
- Abas Tickets/Negocios sem mudanca

