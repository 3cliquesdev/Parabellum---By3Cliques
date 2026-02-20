

## Adicionar Botao "Filtrar" no Relatorio de Conversas

### Problema
Atualmente os filtros aplicam automaticamente a cada mudanca (data, departamento, agente, etc.), o que pode confundir alguns usuarios. Falta um botao explicito "Filtrar" para tornar a experiencia mais intuitiva.

### Solucao
Mudar a logica para que os filtros sejam "staged" (pendentes) ate o usuario clicar no botao "Filtrar". Isso segue o mesmo padrao ja usado no relatorio de Playbook Email Sequence (`PlaybookEmailSequenceReport.tsx`), que tem um botao "Buscar".

### Detalhes Tecnicos

**Arquivo: `src/pages/ConversationsReport.tsx`**

1. Criar estados separados para filtros "pendentes" (o que o usuario esta selecionando) e filtros "aplicados" (o que a query usa):
   - Os selects e inputs atualizam os estados pendentes
   - O botao "Filtrar" copia os pendentes para os aplicados e reseta a pagina

2. Adicionar botao "Filtrar" com icone de Search ao lado dos filtros existentes

3. Adicionar botao "Limpar" para resetar todos os filtros de uma vez

4. A query `useCommercialConversationsReport` passa a usar somente os filtros aplicados

### Comportamento
- Usuario abre a pagina: carrega com filtros padrao (mes atual, sem departamento, etc.)
- Usuario muda qualquer filtro: nada acontece na tabela ainda
- Usuario clica "Filtrar": tabela atualiza com os novos filtros
- Usuario clica "Limpar": todos os filtros voltam ao padrao e tabela atualiza

### Impacto
- Upgrade de UX: mais claro e previsivel para o usuario
- Zero regressao: mesma query, mesmos dados, mesmo export
- Padrao consistente com o relatorio de Playbook que ja funciona assim
