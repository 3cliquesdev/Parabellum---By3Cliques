

# Filtros de busca na gestão de devoluções

## O que será feito
Adicionar um campo de busca textual ao lado do filtro de status existente, permitindo buscar por:
- **Rastreio original** (`tracking_code_original`)
- **Pedido** (`external_order_id`)
- **Rastreio reverso** (`tracking_code_return`)

## Implementação

### 1. `ReturnsManagement.tsx`
- Adicionar estado `searchTerm` (string)
- Adicionar um `Input` com ícone de busca e placeholder "Buscar por pedido, rastreio ou rastreio reverso..."
- Filtrar `returns` client-side: se `searchTerm` não está vazio, filtrar os resultados verificando se `external_order_id`, `tracking_code_original` ou `tracking_code_return` contém o termo (case-insensitive)
- Posicionar o input entre o select de status e o botão "Nova Devolução"

### Layout da barra de filtros
```text
[Status ▼] [🔍 Buscar por pedido, rastreio ou rastreio reverso...          ] [+ Nova Devolução]
```

Filtragem client-side (sem mudanças no hook/query), pois os dados já são carregados completos.

