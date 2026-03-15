

# Fix: DatePickerWithRange Fechando Após Primeiro Clique

## Problema
O componente `DatePickerWithRange` (`src/components/ui/date-range-picker.tsx`) repassa o `onDateChange` diretamente ao `Calendar`. Quando o usuário clica a primeira data, `react-day-picker` retorna `{ from: date, to: date }` (mesma data), o que faz o componente pai interpretar como range completo e potencialmente causar re-render que fecha o popover.

Usado em **12+ páginas**: SupportFilters, DealFilters, TicketsExport, AuditLogs, PlaybookMetrics, InboxFilters, etc.

O `DateRangePicker.tsx` (com presets) **já tem a lógica correta** — draft state + só fecha no segundo clique. O fix é só no `date-range-picker.tsx`.

## Solução

**Arquivo:** `src/components/ui/date-range-picker.tsx`

Adicionar:
1. **Estado controlado do Popover** (`open` / `onOpenChange`)
2. **`draftRange`** — estado interno para seleção em progresso
3. **`selectionCount` ref** — conta cliques, só fecha e propaga no 2º clique
4. **Reset** ao abrir o popover

```text
Fluxo:
  Popover abre → reset selectionCount=0, draftRange=date
  1º clique → selectionCount=1, draftRange atualiza, popover FICA ABERTO
  2º clique → selectionCount=2, onDateChange(range), popover FECHA
  Fechar sem completar → draftRange reverte para date original
```

Nenhuma mudança nas 12+ páginas consumidoras — a API (`date`, `onDateChange`) permanece idêntica.

## Arquivos

| Arquivo | Alteração |
|---------|-----------|
| `src/components/ui/date-range-picker.tsx` | Adicionar draft state + click counter + popover controlado |

