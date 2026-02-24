

# Pop-up de Historico da Conversa no Sidebar

## O que muda

Ao clicar em uma conversa na secao "Conversas Anteriores" do sidebar, em vez de navegar para o Inbox, abre um **Dialog** com o historico completo de mensagens. O usuario ve o contexto sem sair da tela atual.

## Arquivo impactado

`src/components/ContactDetailsSidebar.tsx`

## Mudancas tecnicas

### 1. Imports adicionais (topo do arquivo)

- `useState` do React
- `Dialog, DialogContent, DialogHeader, DialogTitle` de `@/components/ui/dialog`

### 2. Converter para componente com hooks (mover useNavigate antes dos early returns)

O `useNavigate` na linha 80 esta depois de early returns, o que viola regras de hooks. Mover para antes dos early returns junto com os novos states.

### 3. Novos states (dentro do componente, antes dos early returns)

```typescript
const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
const [selectedConversationMeta, setSelectedConversationMeta] = useState<any>(null);
```

### 4. Query para buscar mensagens da conversa selecionada

```typescript
const { data: conversationMessages = [], isLoading: isLoadingMessages } = useQuery({
  queryKey: ["conversation-history-messages", selectedConversationId],
  queryFn: async () => {
    const { data } = await supabase
      .from("messages")
      .select("id, content, created_at, sender_type, is_ai_generated, is_internal, sender:profiles!sender_id(full_name)")
      .eq("conversation_id", selectedConversationId!)
      .order("created_at", { ascending: true })
      .limit(500);
    return data || [];
  },
  enabled: !!selectedConversationId,
});
```

### 5. Alterar onClick das conversas (linha 342)

De:
```typescript
onClick={() => navigate(`/inbox?conversation=${event.id}`)}
```
Para:
```typescript
onClick={() => {
  setSelectedConversationId(event.id);
  setSelectedConversationMeta({ ...event.metadata, date: event.date });
}}
```

### 6. Adicionar Dialog apos o fechamento do Tabs (antes do ultimo `</div>`)

Dialog controlado por `selectedConversationId !== null`:

- **Header**: canal, status (badge), data, atendente
- **Body**: `ScrollArea` com mensagens em bolhas:
  - `sender_type === 'contact'`: alinhada a esquerda, fundo `bg-muted`
  - `sender_type === 'agent'` ou `is_ai_generated`: alinhada a direita, fundo `bg-primary/10`
  - `is_internal === true`: fundo amarelo (nota interna)
  - Cada bolha mostra: nome do remetente, horario (`HH:mm`), conteudo
- **Footer**: botao "Abrir no Inbox" que navega para `/inbox?conversation=ID`
- `onOpenChange`: quando false, limpa `selectedConversationId` e `selectedConversationMeta`
- Aviso se atingiu 500 mensagens

## Zero regressao

- `useUnifiedTimeline` nao muda
- Abas Tickets e Negocios sem impacto
- Navegacao para inbox preservada como botao no footer do dialog
- Kill Switch, Shadow Mode, CSAT guard: sem impacto

