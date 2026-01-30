# Plano Executado: Distribuição Estrita por Departamento

## ✅ CONCLUÍDO

### Mudanças Realizadas

1. **Edge Function `dispatch-conversations`**: Removido fallback hierárquico
   - Conversas agora só são atribuídas a agentes do departamento exato
   - Se não há agentes disponíveis, conversa aguarda na fila

2. **SQL Executado**: Desatribuídas conversas incorretas da Camila

### Situação Atual

| Departamento | Agente | Status |
|--------------|--------|--------|
| Suporte Sistema | Miguel Fedes | Online (32 chats - capacidade máxima 30) |
| Suporte | Camila de Farias | Online |
| Suporte Pedidos | Juliana Alves | Online |

### Porque as conversas não foram atribuídas ao Miguel

Miguel está com **32 conversas ativas**, acima do limite de 30. As 19 conversas de "Suporte Sistema" agora estão corretamente na **fila do departamento** (não mais indo para Camila).

Quando Miguel fechar conversas e ficar abaixo de 30, o próximo ciclo do dispatcher vai atribuí-las a ele.

### Comportamento Novo

- ✅ Conversa de "Suporte Sistema" → Fila → Miguel (quando disponível)
- ✅ Conversa de "Suporte Pedidos" → Juliana/Oliveira
- ✅ Conversa de "Suporte" (geral) → Camila
- ✅ Sem fallback automático entre departamentos
