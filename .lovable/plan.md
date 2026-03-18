

# Fix: Pipeline padrão pessoal — persistência e UX

## Problemas identificados

1. **Não persiste ao navegar**: O `useEffect` que seleciona o pipeline tem a condição `!selectedPipeline`. Como o `selectedPipeline` já foi definido na primeira renderização (antes do `profile` carregar com `default_pipeline_id`), ao voltar do Inbox o estado é perdido porque o componente remonta com `selectedPipeline = ""`, mas o `profile` pode não estar pronto ainda — ou o efeito dispara antes do `profile` atualizado.

2. **Estrela fora do dropdown**: O usuário quer poder marcar o padrão diretamente na lista de pipelines (dentro do dropdown), não com um botão separado.

## Solução

### 1. Corrigir lógica de seleção inicial
- Adicionar `profile` como dependência real do efeito
- Garantir que quando o `profile.default_pipeline_id` mudar (ex: após refetch), o pipeline selecionado se atualize
- Usar uma ref `hasInitialized` para não sobrescrever seleção manual do usuário, mas permitir que o profile atualizado defina o valor inicial

### 2. Mover estrela para dentro do dropdown
- Substituir o `SelectItem` simples por um layout que inclua o nome do pipeline + ícone de estrela
- Ao clicar na estrela dentro do item, chamar `setDefaultPipeline.mutate` + `refetchProfile`
- Usar `e.stopPropagation()` para que clicar na estrela não feche o dropdown
- Remover o botão de estrela externo

### 3. Indicação visual no dropdown
- Pipeline que é o padrão pessoal do usuário: estrela preenchida amarela
- Pipeline que é o padrão global: texto "(Padrão)" como já está
- Pipeline que é o padrão pessoal: texto "(Meu Padrão)" em vez de "(Padrão)"

### Arquivos a alterar
- `src/pages/Deals.tsx` — corrigir useEffect + mover estrela para dentro do Select dropdown

