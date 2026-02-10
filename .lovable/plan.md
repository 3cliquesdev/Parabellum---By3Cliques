

# Correcoes: Multiplas Evidencias + Bug de Selecao de Cliente

## Bug 1: Cliente nao fica selecionado

**Causa raiz:** Quando o usuario clica num contato, o codigo faz `setCustomerId(contact.id)` e `setCustomerSearch("")`. Ao limpar a busca, o `debouncedSearch` fica vazio, o hook `useSearchContactsForTicket` retorna array vazio, e a linha `selectedContact = contacts.find(c => c.id === customerId)` nao encontra nada porque `contacts` esta vazio. Resultado: o card de "contato selecionado" nunca aparece.

**Correcao:** Guardar o objeto do contato selecionado num state separado em vez de derivar da lista de resultados de busca.

```typescript
// Antes (bug)
const selectedContact = contacts.find((c) => c.id === customerId);

// Depois (fix)
const [selectedContact, setSelectedContact] = useState<ContactResult | null>(null);

// No onClick:
onClick={() => {
  setCustomerId(contact.id);
  setSelectedContact(contact);
  setCustomerSearch("");
}}
```

## Bug 2: Apenas 1 evidencia permitida

**Causa raiz:** O formulario usa estados singulares (`attachmentFile`, `uploadedAttachment`) e o dropzone tem `maxFiles: 1`. O submit envia `attachments: uploadedAttachment ? [uploadedAttachment] : []` - sempre maximo 1.

**Correcao:** Converter para arrays, permitindo multiplos uploads sequenciais.

Mudancas no `CreateTicketDialog.tsx`:

- Substituir `attachmentFile` / `attachmentPreview` / `uploadedAttachment` por arrays
- Remover `maxFiles: 1` do dropzone
- Permitir adicionar novos arquivos sem perder os ja enviados
- Exibir grid de previews com botao X individual para remover cada um
- Submit envia `attachments: uploadedAttachments` (array completo)

## Arquivo modificado

| Arquivo | Mudanca |
|---|---|
| `src/components/support/CreateTicketDialog.tsx` | Fix selecao cliente + multiplas evidencias |

## Detalhes tecnicos

### Estados refatorados para multiplas evidencias:

```typescript
// Antes
const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
const [uploadedAttachment, setUploadedAttachment] = useState<...>(null);

// Depois
const [uploadedAttachments, setUploadedAttachments] = useState<Array<{
  url: string; type: string; name: string; preview?: string;
}>>([]);
```

### onDrop refatorado:

```typescript
const onDrop = useCallback(async (acceptedFiles: File[]) => {
  for (const file of acceptedFiles) {
    const result = await uploadFile(file);
    if (result) {
      let preview: string | undefined;
      if (file.type.startsWith('image/')) {
        preview = URL.createObjectURL(file);
      }
      setUploadedAttachments(prev => [...prev, { ...result, preview }]);
    }
  }
}, [uploadFile]);
```

### UI de previews:

- Grid com miniaturas de cada arquivo enviado
- Botao X em cada item para remover individualmente
- Area de upload sempre visivel para adicionar mais arquivos
- Contador mostrando quantos arquivos foram anexados

## Impacto

- Zero regressao: o campo `attachments` do ticket ja e um array JSON, entao suporta multiplos itens nativamente
- O `TicketAttachments.tsx` (usado na visualizacao do ticket) ja suporta multiplos anexos
- A correcao do cliente e pontual e nao afeta nenhum outro fluxo

