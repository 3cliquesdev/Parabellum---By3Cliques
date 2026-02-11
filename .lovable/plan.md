
# Plano: Aumentar Limite de Capacidade para 40 chats por Agente

## Diagnóstico Confirmado

1. **Nenhuma `team_settings` configurada**: A tabela `team_settings` está vazia.
2. **Fallback ativo**: O código usa o limite hardcoded de **10 chats** por agente (linhas 550 e 576 de `dispatch-conversations/index.ts`).
3. **Por isso a distribuição travou**: Mabile (31 chats), Miguel (14 chats) e Caroline (10 chats) todas estão acima ou no limite de 10, então o dispatcher não atribui novas conversas.

## Solução: Duas Alterações

### 1. Aumentar o Fallback Padrão de 10 para 40
**Arquivo**: `supabase/functions/dispatch-conversations/index.ts`

**Locais a alterar**:
- Linha 550: `const maxChats = configuredMax ?? 10;` → `const maxChats = configuredMax ?? 40;`
- Linha 576: `.filter((a: EligibleAgent) => a.active_chats < a.max_chats)` (já usa `a.max_chats`, então apenas a linha 550 precisa mudar)

Isso garante que:
- O dispatch vai tentar atribuir conversas enquanto agentes tiverem menos de 40 chats
- Quando uma conversa fechar, o agente volta abaixo do limite e recebe novas
- Zero regressão: a lógica continua exatamente igual, apenas o threshold aumenta

### 2. Por que não usar `team_settings` (ainda)
Embora tenhamos a estrutura para isso, criar `team_settings` via UI/API seria mais complexo neste momento. O fallback de 40 resolve o problema imediatamente e é simples de ajustar depois se necessário.

## Validação Obrigatória
1. No preview: confirmar que conversas pendentes/escaladas começam a ser distribuídas
2. Monitorar Miguel: verificar que recebe novas conversas enquanto tiver <40 chats
3. Console sem erros
4. Distribuição continua respeitando `online + agent_departments`

## Rollback Rápido
Se qualquer problema ocorrer: reverter linha 550 para `?? 10` e redeploy

