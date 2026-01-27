

## Plano: Corrigir Nome do Fluxo + Botao de Iniciar Fluxo Manual

### Problema 1: Editar Nome do Fluxo

**Situacao atual**: O nome do fluxo so pode ser definido na criacao. Depois disso, nao ha como editar.

**Solucao**: Adicionar campo de nome no Dialog de Palavras-chave (que ja existe) e tornar o nome no header clicavel para editar.

---

### Alteracoes para Renomear Fluxo

#### Arquivo: `src/pages/ChatFlowEditorPage.tsx`

**Mudanca 1**: Adicionar estado para o nome do fluxo
```typescript
const [flowName, setFlowName] = useState("");

// Inicializar quando flow carregar
useEffect(() => {
  if (flow) {
    setFlowName(flow.name);
    setKeywordsText((flow.trigger_keywords || []).join(", "));
    setTriggersText((flow.triggers || []).join("\n"));
  }
}, [flow]);
```

**Mudanca 2**: Adicionar input de nome no Dialog de Configuracoes (linha 226)
```tsx
<div className="space-y-2">
  <Label htmlFor="flowName">Nome do fluxo *</Label>
  <Input
    id="flowName"
    value={flowName}
    onChange={(e) => setFlowName(e.target.value)}
    placeholder="Nome do fluxo"
  />
</div>
```

**Mudanca 3**: Atualizar handleSaveSettings para incluir nome
```typescript
updateFlow.mutate({
  id,
  name: flowName,  // ADICIONAR
  trigger_keywords,
  triggers,
});
```

**Mudanca 4**: Tornar o nome clicavel no header (linha 139)
```tsx
<h1 
  className="font-semibold cursor-pointer hover:text-primary"
  onClick={handleOpenSettings}
>
  {flow.name}
</h1>
```

---

### Problema 2: Iniciar Fluxo Manualmente (Sem IA)

**Situacao atual**: Fluxos so sao ativados quando a IA detecta as palavras-chave na mensagem do cliente.

**Solucao**: Adicionar um botao no ChatWindow (similar ao botao de templates) que lista os fluxos disponiveis e permite iniciar manualmente.

---

### Alteracoes para Iniciar Fluxo Manual

#### Arquivo 1: `src/components/ChatWindow.tsx`

**Adicionar botao de fluxos** ao lado do botao de templates existente no toolbar de envio de mensagem.

```tsx
import { Workflow } from "lucide-react";
import { FlowPickerButton } from "./FlowPickerButton"; // Novo componente

// No toolbar de acoes:
<FlowPickerButton 
  conversationId={activeConversationId}
  customerId={customerData?.id}
/>
```

#### Arquivo 2: `src/components/FlowPickerButton.tsx` (NOVO)

**Componente que lista fluxos ativos e inicia manualmente:**

```tsx
export function FlowPickerButton({ conversationId, customerId }) {
  const { data: flows } = useChatFlows();
  const activeFlows = flows?.filter(f => f.is_active) || [];
  
  const handleStartFlow = async (flowId: string) => {
    // Chamar edge function para iniciar o fluxo
    await supabase.functions.invoke("process-chat-flow", {
      body: {
        conversation_id: conversationId,
        customer_id: customerId,
        flow_id: flowId,
        manual_trigger: true, // Flag para indicar que foi iniciado manualmente
      }
    });
    toast.success("Fluxo iniciado!");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={activeFlows.length === 0}>
          <Workflow className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Iniciar Fluxo</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {activeFlows.map((flow) => (
          <DropdownMenuItem 
            key={flow.id} 
            onClick={() => handleStartFlow(flow.id)}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            {flow.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

#### Arquivo 3: `supabase/functions/process-chat-flow/index.ts`

**Adicionar suporte para trigger manual:**

Na funcao principal, adicionar verificacao de `manual_trigger`:

```typescript
// Se for trigger manual, pular verificacao de palavras-chave
if (body.manual_trigger && body.flow_id) {
  const { data: flow } = await supabaseClient
    .from("chat_flows")
    .select("*")
    .eq("id", body.flow_id)
    .single();
    
  if (flow && flow.is_active) {
    // Iniciar o fluxo diretamente
    return startFlowExecution(flow, body.conversation_id, body.customer_id);
  }
}
```

---

### Resumo das Alteracoes

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `src/pages/ChatFlowEditorPage.tsx` | Edicao | Adicionar campo nome no dialog, nome clicavel no header |
| `src/components/FlowPickerButton.tsx` | Novo | Botao dropdown para iniciar fluxo manualmente |
| `src/components/ChatWindow.tsx` | Edicao | Adicionar FlowPickerButton no toolbar |
| `supabase/functions/process-chat-flow/index.ts` | Edicao | Suporte para trigger manual |

---

### Fluxo do Agente Apos Implementacao

```text
Agente no chat com cliente
        |
        v
Clica no botao [Workflow] no toolbar
        |
        v
Lista de fluxos ativos aparece
        |
        v
Seleciona "Coleta Pre-Carnaval"
        |
        v
Sistema inicia o fluxo automaticamente
        |
        v
Cliente recebe a primeira mensagem do fluxo
```

### Garantias

- Nao quebra fluxos existentes (deteccao por IA continua funcionando)
- Agente tem controle total para iniciar qualquer fluxo
- Nome do fluxo pode ser editado a qualquer momento
- Compatibilidade total com o sistema atual

