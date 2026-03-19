

# Fix: Dropdown de Product Tags no AuditArticleEditDialog

## Problema
O `AuditArticleEditDialog.tsx` (dialog de edição rápida na aba de Auditoria) ainda usa `<Input>` de texto livre para Product Tags (linha 136). O dropdown foi aplicado apenas no `KnowledgeArticleDialog.tsx`.

## Solução
Substituir o `<Input>` por um multi-select dropdown idêntico ao do `KnowledgeArticleDialog`, usando `Popover` + `Checkbox` + tags da tabela `product_tags`.

### Alterações no arquivo `src/components/knowledge/AuditArticleEditDialog.tsx`:

1. **Importar** `useProductTags` do hook existente, `Popover`/`PopoverContent`/`PopoverTrigger`, `Checkbox`, `Badge`, `ChevronsUpDown`, `X`
2. **Mudar state** `productTags` de `string` para `string[]` (array)
3. **Ajustar `useEffect`** de carregamento: setar `setProductTags(data.product_tags || [])` direto (sem `.join`)
4. **Ajustar `handleSave`**: passar `product_tags: productTags` direto (sem `.split`)
5. **Substituir o `<Input>`** (linha 136) por um Popover com checkboxes listando as tags da tabela, com badges dismissíveis para as selecionadas

