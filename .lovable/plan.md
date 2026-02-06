

# Plano Enterprise AJUSTADO: Ticket com Evidência Opcional + Tags na Criação

## Ajustes Incorporados (6 pontos do usuário)

| # | Ponto Levantado | Solução |
|---|-----------------|---------|
| 1 | Retorno do hook não pode quebrar `PublicTicketForm.tsx` | Manter retorno como `ticket`, anexar flag `__tagsWarning` se necessário |
| 2 | `useTags()` sem filtro traz tudo | Manter sem filtro - **tags são universais** (podem ser usadas em tickets, conversas, contatos) |
| 3 | Verificar SDK para upsert | Supabase-js v2 suporta `upsert({ onConflict })` |
| 4 | Invalidar mesmas queryKeys | Usar `["ticket-tags", ticket.id]` e `["tickets"]` (confirmado no código) |
| 5 | Verificar constraint de attachments no backend | Campo `attachments` é `jsonb DEFAULT '[]'` - nullable, sem constraint |
| 6 | UX: fechar popover ao selecionar + reset estados | Incluído no código |

---

## Verificações Técnicas Realizadas

**UNIQUE INDEX confirmado no banco:**
```
ticket_tags_ticket_id_tag_id_key ON (ticket_id, tag_id)
```
Não precisa migration - upsert vai funcionar.

**Uso do hook `useCreateTicket`:**
- `CreateTicketDialog.tsx` - usa `.mutateAsync()` mas não usa retorno
- `PublicTicketForm.tsx` - usa `ticketResult.id` (linha 72) - **CRÍTICO: manter retorno compatível**

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/support/CreateTicketDialog.tsx` | Remover obrigatoriedade evidência, adicionar multi-select tags |
| `src/hooks/useCreateTicket.tsx` | Aceitar `tag_ids[]`, inserir com upsert, manter retorno compatível |

---

## Implementação Detalhada

### 1. useCreateTicket.tsx

**Interface atualizada:**
```typescript
interface CreateTicketData {
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
  customer_id: string;
  assigned_to?: string;
  conversation_id?: string;
  attachments?: any[];
  department_id?: string;
  tag_ids?: string[]; // NOVO - opcional
}
```

**mutationFn - retorno compatível (sem breaking change):**
```typescript
mutationFn: async (ticketData: CreateTicketData) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  // Separar tag_ids do payload
  const { tag_ids, ...ticketPayload } = ticketData;
  
  // 1. Criar ticket
  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert({
      ...ticketPayload,
      created_by: user?.id,
    } as any)
    .select()
    .single();

  if (error) throw error;

  // 2. Inserir tags (com upsert para idempotência)
  let tagsWarning = false;
  if (tag_ids && tag_ids.length > 0 && ticket) {
    const tagInserts = tag_ids.map(tag_id => ({
      ticket_id: ticket.id,
      tag_id,
    }));
    
    const { error: tagsError } = await supabase
      .from("ticket_tags")
      .upsert(tagInserts, { 
        onConflict: "ticket_id,tag_id",
        ignoreDuplicates: true 
      });
    
    if (tagsError) {
      console.error("[useCreateTicket] Tags error:", tagsError);
      tagsWarning = true;
    }
  }

  // PONTO 1: Manter retorno compatível - anexar flag opcional
  if (tagsWarning) {
    (ticket as any).__tagsWarning = true;
  }
  
  return ticket; // Retorna ticket direto (compatível com PublicTicketForm)
},
```

**onSuccess - detectar warning sem quebrar:**
```typescript
onSuccess: (ticket: any) => {
  queryClient.invalidateQueries({ queryKey: ["tickets"] });
  
  // Invalidar tags do ticket específico (se existir)
  if (ticket?.id) {
    queryClient.invalidateQueries({ queryKey: ["ticket-tags", ticket.id] });
  }
  
  // Detectar flag de warning
  const tagsWarning = !!ticket?.__tagsWarning;
  
  if (tagsWarning) {
    toast({
      title: "Ticket criado",
      description: "Ticket criado com sucesso, mas houve um problema ao salvar as tags.",
    });
  } else {
    toast({
      title: "Ticket criado com sucesso",
    });
  }
},
```

---

### 2. CreateTicketDialog.tsx

**A) Novos imports (adicionar):**
```typescript
import { useTags } from "@/hooks/useTags";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tag } from "lucide-react";
```

**B) Novos estados (após linha 78):**
```typescript
// Tags
const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
const [tagSearch, setTagSearch] = useState("");
const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
const { data: allTags = [] } = useTags(); // Tags universais (PONTO 2: sem filtro)
```

**C) Remover lógica de obrigatoriedade (linhas 149-151):**
```typescript
// REMOVER estas linhas:
// const isWithdrawal = category === 'saque' || category === 'saque_carteira';
// const requiresEvidence = !isWithdrawal;
```

**D) Atualizar validação canSubmit (linha 187):**
```typescript
// ANTES:
// const canSubmit = customerId && subject.trim() && (isWithdrawal || uploadedAttachment) && !createTicket.isPending;

// DEPOIS:
const canSubmit = customerId && subject.trim() && !createTicket.isPending;
```

**E) Atualizar handleSubmit (linhas 153-183):**
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!subject.trim() || !customerId) return;
  
  // REMOVIDO: if (requiresEvidence && !uploadedAttachment) return;

  await createTicket.mutateAsync({
    subject: subject.trim(),
    description: description.trim(),
    priority,
    category,
    customer_id: customerId,
    department_id: departmentId || undefined,
    assigned_to: assignedTo || undefined,
    attachments: uploadedAttachment ? [uploadedAttachment] : [], // Opcional
    tag_ids: selectedTagIds, // NOVO
  });

  // Reset form completo (PONTO 6: incluir tags)
  setSubject("");
  setDescription("");
  setPriority("medium");
  setCategory("outro");
  setCustomerId("");
  setDepartmentId("");
  setAssignedTo("");
  setCustomerSearch("");
  setAttachmentFile(null);
  setAttachmentPreview(null);
  setUploadedAttachment(null);
  setSelectedTagIds([]);  // NOVO
  setTagSearch("");       // NOVO
  onOpenChange(false);
};
```

**F) Atualizar label de evidência (linhas 283-290):**
```tsx
<Label className="flex items-center gap-1">
  Evidência (Print/Foto)
  <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
</Label>
```

**G) Adicionar seção Tags (após linha 462, antes de Department):**
```tsx
{/* Tags */}
<div className="space-y-2">
  <Label className="flex items-center gap-1">
    <Tag className="h-3.5 w-3.5" />
    Tags
    <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
  </Label>
  
  {/* Badges das tags selecionadas */}
  {selectedTagIds.length > 0 && (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {selectedTagIds.map(tagId => {
        const tag = allTags.find(t => t.id === tagId);
        if (!tag) return null;
        return (
          <Badge 
            key={tagId} 
            variant="secondary"
            className="text-xs pr-1"
            style={{
              backgroundColor: tag.color ? `${tag.color}20` : undefined,
              borderColor: tag.color || undefined,
              color: tag.color || undefined,
            }}
          >
            {tag.name}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
              onClick={() => setSelectedTagIds(prev => prev.filter(id => id !== tagId))}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        );
      })}
    </div>
  )}
  
  {/* Popover para adicionar tags */}
  <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
    <PopoverTrigger asChild>
      <Button 
        type="button" 
        variant="outline" 
        size="sm" 
        className="w-full justify-start text-muted-foreground"
      >
        <Plus className="h-4 w-4 mr-2" />
        Adicionar tag...
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-64 p-2" align="start">
      <Input
        placeholder="Buscar tag..."
        value={tagSearch}
        onChange={(e) => setTagSearch(e.target.value)}
        className="h-8 mb-2"
      />
      <ScrollArea className="max-h-48">
        <div className="space-y-1">
          {allTags
            .filter(tag => 
              !selectedTagIds.includes(tag.id) &&
              tag.name.toLowerCase().includes(tagSearch.toLowerCase())
            )
            .slice(0, 10)
            .map(tag => (
              <Button
                key={tag.id}
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start h-8 px-2"
                onClick={() => {
                  setSelectedTagIds(prev => [...prev, tag.id]);
                  setTagSearch("");
                  setTagPopoverOpen(false); // PONTO 6: fechar ao selecionar
                }}
              >
                <span
                  className="w-3 h-3 rounded-full mr-2 shrink-0"
                  style={{ backgroundColor: tag.color || "#6B7280" }}
                />
                <span className="truncate">{tag.name}</span>
              </Button>
            ))}
          {allTags.filter(tag => 
            !selectedTagIds.includes(tag.id) &&
            tag.name.toLowerCase().includes(tagSearch.toLowerCase())
          ).length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              {allTags.length === 0 ? "Nenhuma tag cadastrada" : "Nenhuma tag encontrada"}
            </p>
          )}
        </div>
      </ScrollArea>
    </PopoverContent>
  </Popover>
</div>
```

---

## Checklist Enterprise (6 Pontos)

| # | Requisito | Status |
|---|-----------|--------|
| 1 | Retorno compatível (`ticket` direto, não `{ ticket, warning }`) | Implementado com `__tagsWarning` flag |
| 2 | Tags universais (sem filtro por categoria) | `useTags()` sem parâmetro |
| 3 | Upsert com SDK correto | Supabase-js v2 suporta |
| 4 | QueryKeys alinhadas | `["ticket-tags", ticket.id]` + `["tickets"]` |
| 5 | Backend não exige attachments | Confirmado: `jsonb DEFAULT '[]'` |
| 6 | UX: fechar popover + reset estados | Incluído no código |

---

## Testes Manuais Obrigatórios

| # | Teste | Esperado |
|---|-------|----------|
| 1 | Criar ticket SEM evidência | Funciona - ticket criado |
| 2 | Criar ticket COM evidência | Funciona - anexo salvo |
| 3 | Criar ticket SEM tags | Funciona - ticket sem tags |
| 4 | Criar ticket COM 2+ tags | Tags aparecem no ticket |
| 5 | Clicar 2x rápido no submit | Sem duplicação (upsert) |
| 6 | Fechar modal e reabrir | Estado limpo |
| 7 | `PublicTicketForm` ainda funciona | `ticketResult.id` acessível |

