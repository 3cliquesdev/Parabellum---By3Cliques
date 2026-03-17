

# Correção: IA pedindo email/CPF para consulta de pedidos

## Problema
Apesar da instrução na linha 1318-1322 dizer "NUNCA peça email, CPF ou telefone para consultar pedidos", a IA ainda pede porque existem **3 pontos contraditórios** no código:

1. **Tool `check_tracking` (linha 7207-7209)**: tem parâmetro `customer_email` com descrição "Email do cliente para buscar pedidos com rastreio cadastrado" — a IA vê isso e conclui que pode/deve pedir email
2. **Cenário C de ticket (linha 6938)**: diz literalmente "se cliente não souber o pedido, pergunte: Qual email usou na compra?"
3. **Tool `check_order_status` (linhas 8104-8170)**: busca pedidos inteiramente por email, reforçando o comportamento

## Correções

### 1. Remover `customer_email` do tool `check_tracking` (linha 7207-7210)
Eliminar o parâmetro para que a IA não veja email como opção de busca de pedidos.

### 2. Corrigir instrução do Cenário C (linha 6938)
Trocar:
```
"se cliente não souber, pergunte: Qual email usou na compra?"
```
Por:
```
"se cliente não souber o número do pedido, peça o código de rastreio"
```

### 3. Reforçar instrução no bloco de tools (perto da linha 6958-6962)
Adicionar instrução explícita junto às descrições das ferramentas:
```
REGRA: Para consultar pedidos/rastreio, peça APENAS número do pedido ou código de rastreio. NUNCA peça email, CPF ou telefone para essa finalidade.
```

### 4. Deploy
Deploy imediato de `ai-autopilot-chat`.

### Arquivos afetados
- `supabase/functions/ai-autopilot-chat/index.ts` — 3 edições pontuais

### Impacto
A IA passará a pedir apenas número do pedido ou código de rastreio, eliminando a instrução conflitante sobre email/CPF.

