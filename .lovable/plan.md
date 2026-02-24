
Analisei o projeto atual e sigo as regras da base de conhecimento.

## Diagnóstico real (por que quebrou)

Com base no código atual de `ContactDetailsSidebar.tsx` e `Inbox.tsx`, os 2 problemas continuam por causa de dois pontos estruturais:

1) **Scroll do pop-up**
- O `DialogContent` global já vem com `overflow-y-auto`.
- Dentro dele, o histórico usa `ScrollArea` (que por padrão tem `overflow-hidden` + `Viewport h-full`).
- Esse combo está competindo entre scroll externo e interno, e sem uma altura “travada” do container de mensagens o `ScrollArea` não vira o dono do scroll.

2) **“Abrir no Inbox” em loop / sem direcionar**
- O botão está usando `window.location.href`, que força reload completo (não SPA).
- No projeto atual, a página `Inbox.tsx` **não usa** `searchParams.get("conversation")` para selecionar conversa automaticamente.
- Resultado: ou recarrega sem abrir a conversa certa, ou entra em ciclo de reload/percepção de looping.

---

## Implementação proposta (upgrade sem regressão)

### Arquivos impactados
- `src/components/ContactDetailsSidebar.tsx`
- `src/pages/Inbox.tsx`

---

## 1) Corrigir scroll do Dialog (ContactDetailsSidebar)

### Ajustes
- Transformar o dialog em layout com altura controlada e scroll único no `ScrollArea`:
  - `DialogContent`: usar `overflow-hidden`, remover disputa de scroll.
  - Wrapper interno: `flex flex-col h-[85vh]` (ou `max-h-[85vh]` com estrutura fixa de header/body/footer).
  - Área de mensagens: `flex-1 min-h-0`.
  - `ScrollArea`: `h-full` (ou `flex-1 min-h-0`) + conteúdo interno com padding.
- Evitar `max-h` adicional no próprio `ScrollArea` (já foi fonte de falha antes).

### Resultado esperado
- Histórico longo rola normalmente, mantendo header e footer fixos.

---

## 2) Remover navegação com reload e usar navegação SPA (ContactDetailsSidebar)

### Ajustes
- Substituir `window.location.href` por `navigate(...)`.
- Ao clicar em “Abrir no Inbox”:
  - fechar popup (`selectedConversationId/meta = null`);
  - navegar para `/inbox?conversation=ID`;
  - se a conversa estiver `closed`, enviar também `filter=archived` para bater com a lista de encerradas.

### Resultado esperado
- Sem reload forçado, sem looping de página.
- URL correta para deep-link da conversa.

---

## 3) Fazer Inbox realmente obedecer `?conversation=` (Inbox.tsx)

Hoje o Inbox ignora esse parâmetro. Vou adicionar sincronização explícita:

### Ajustes
- Ler `conversationFromUrl = searchParams.get("conversation")`.
- Criar efeito para selecionar a conversa quando:
  - `orderedConversations` carregar;
  - `conversationFromUrl` existir;
  - e a conversa estiver na lista.
- Se não estiver na lista (ex.: filtro atual não contém), buscar essa conversa por ID (query única com joins necessários) e setar `activeConversation`.
- Opcional de robustez: ao selecionar conversa manualmente da lista, atualizar `?conversation=` na URL (sem re-carregar) para manter comportamento consistente de deep-link.

### Guardas anti-loop
- Só chamar `setActiveConversation` se o ID alvo for diferente do atual.
- Não fazer `navigate` dentro de `useEffect` sem checagem de mudança real.
- Não usar `window.location.href`.

---

## 4) Compatibilidade e Zero regressão

- Não altera `useUnifiedTimeline`.
- Não altera regras de IA (Kill Switch/Shadow Mode/CSAT/distribuição).
- Não altera backend/schema.
- Tickets/Negócios permanecem iguais.
- “Abrir no Inbox” continua existindo, só troca mecanismo para estável.

---

## Impactos, mitigação e rollback rápido

### Impactos
- UX melhora no popup (scroll funcional).
- Deep-link de conversa no Inbox passa a funcionar de verdade.
- Fim do reload completo no botão.

### Mitigação
- Guardas anti-loop em efeitos de URL-sync.
- Fallback de busca por ID quando conversa não estiver na lista filtrada.
- Preservação da lógica atual de seleção de conversa.

### Rollback rápido
- Reverter apenas os blocos:
  - Dialog layout/scroll em `ContactDetailsSidebar`.
  - Handler do botão “Abrir no Inbox”.
  - Efeitos/query de URL-sync em `Inbox.tsx`.

---

## Critérios de aceite

1. No popup de histórico, rolar até mensagens antigas sem travar.
2. “Abrir no Inbox” abre a conversa correta sem reload infinito.
3. Fechar popup limpa estado e não reabre sozinho.
4. Com conversa encerrada, navegação mantém contexto (preferencialmente `filter=archived`).
5. Abas Tickets/Negócios continuam sem alteração.

---

## Plano de validação (obrigatório)

- Console sem erros (frontend).
- Responsividade (desktop + mobile no dialog).
- Realtime/chat continua funcionando na conversa ativa.
- Edge cases:
  - conversa sem mensagens;
  - >500 mensagens (aviso continua);
  - conversa fechada e aberta.
- Regressão:
  - Timeline continua separando Conversas Anteriores e Outros Eventos;
  - clique nas conversas ainda abre popup corretamente;
  - botão Abrir no Inbox funcional em ambos os status.

Testes realizados: serão executados após implementação e validação completa no fluxo fim-a-fim.  
