
# Conversas Anteriores na Timeline do Sidebar

## O que muda

A aba **Timeline** do painel lateral direito (ContactDetailsSidebar) sera dividida em duas secoes:

1. **Conversas Anteriores** (topo) -- ate 5 conversas, ordenadas da mais recente para a mais antiga, clicaveis
2. **Outros Eventos** (abaixo) -- tickets, deals, interacoes, onboarding (sem mensagens individuais)

Mensagens individuais (`type === 'message'`) serao removidas do sidebar (ja estao dentro de cada conversa).

## Arquivo impactado

`src/components/ContactDetailsSidebar.tsx`

## Mudancas tecnicas

### 1. Separar e ordenar arrays (linha 80, substituir `recentTimeline`)

```typescript
const conversations = unifiedTimeline
  .filter(e => e.type === 'conversation')
  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  .slice(0, 5);

const otherEvents = unifiedTimeline
  .filter(e => e.type !== 'conversation' && e.type !== 'message')
  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  .slice(0, 5);
```

### 2. Adicionar import do `useNavigate` (linha 1 area)

```typescript
import { useNavigate } from "react-router-dom";
```

E dentro do componente:
```typescript
const navigate = useNavigate();
```

### 3. Adicionar icone `MessageSquare` ao import do lucide-react (linha 8)

### 4. Substituir conteudo da TabsContent "timeline" (linhas 303-332)

Nova UI com duas secoes:

**Secao "Conversas Anteriores":**
- Header com contagem
- Cards com: canal (WhatsApp/Webchat), status (badge verde=aberta, cinza=fechada), quantidade de mensagens, nome do atendente, data
- `cursor-pointer` + `hover:bg-accent/50` + `onClick={() => navigate('/inbox?conversation=' + event.id)}`

**Secao "Outros Eventos":**
- Header com contagem
- Cards iguais ao layout atual (icon, title, description, date)
- Sem interatividade de click

### 5. Helper para badge de status da conversa

```typescript
const getConversationStatusBadge = (status: string) => {
  if (status === 'closed') return { label: 'Fechada', className: 'bg-gray-100 text-gray-700' };
  if (status === 'open') return { label: 'Aberta', className: 'bg-green-100 text-green-700' };
  return { label: status, className: 'bg-blue-100 text-blue-700' };
};
```

### 6. Helper para label do canal

```typescript
const getChannelLabel = (channel: string) => {
  if (channel === 'whatsapp') return 'WhatsApp';
  if (channel === 'webchat') return 'Webchat';
  if (channel === 'email') return 'Email';
  return channel;
};
```

## Criterios de aceite

- Timeline mostra "Conversas Anteriores" no topo com ate 5 itens
- Timeline nao mostra itens type=message no sidebar
- Clique em conversa navega para `/inbox?conversation=ID`
- "Outros Eventos" continua funcionando (tickets/deals/interacoes/onboarding)
- Zero regressao nas abas Tickets e Negocios
