

# Fix: Mapeamento de Colunas não funciona

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Causa Raiz

Dois problemas combinados:

### 1. `Select value=""` quebra o Radix UI
Na linha 54 do `ColumnMapper.tsx`:
```tsx
value={mapping[field.value] || ''}
```
Quando não há mapeamento, `value` vira `''` (string vazia). O Radix Select controlado com `value=""` **não tem nenhum `SelectItem` correspondente** (o item "Não mapear" tem value `__none__`, não `""`). Isso faz o Select travar — não mostra placeholder e não permite interação.

### 2. Auto-mapeamento frágil
O auto-mapping usa `lowerHeader.includes(name)` sem normalizar acentos. Headers como `"Endereço"`, `"Inscrição Estadual"`, `"Número"` podem não bater se a normalização de acentos falhar dependendo da codificação do arquivo.

## Correção

### Fix 1: Corrigir valor do Select (resolve o "não deixa mapear")
Trocar `value={mapping[field.value] || ''}` por `value={mapping[field.value] ?? undefined}`. Quando `undefined`, o Radix Select mostra o placeholder e funciona normalmente.

```tsx
<Select
  value={mapping[field.value] ?? undefined}
  onValueChange={(value) => onMappingChange(field.value, value)}
>
```

### Fix 2: Normalizar headers no auto-mapping (resolve o "não mapeou")
Adicionar função de normalização que remove acentos antes de comparar:

```tsx
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\s]+/g, " ")
    .trim();
}
```

E usar `normalize(header).includes(normalize(name))` na comparação.

### Fix 3: Adicionar log de debug
Console.log dos headers parseados para diagnosticar problemas futuros.

## Impacto
- Zero regressão — mesma UI, mesmos campos, mesmo fluxo
- Arquivos alterados: `ColumnMapper.tsx` (value fix) e `ImportClients.tsx` (normalização no auto-map)

