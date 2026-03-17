

# Plano de Correção — Auditoria de Conversas Ativas

## Problemas Identificados

### 1. Mojibake massivo ainda presente (3.894 ocorrências)
A limpeza anterior corrigiu apenas ~100 linhas, mas o arquivo `ai-autopilot-chat/index.ts` (9.897 linhas) ainda tem **3.894 strings com caracteres corrompidos**. Isso afeta:
- **Console.log/warnings**: logs ilegíveis no painel (ex: `âœ… Resposta processada` em vez de `✅ Resposta processada`)
- **Strings de prompt injetadas na LLM**: instruções como `NÃƒO PEÃ‡A OTP` em vez de `NÃO PEÇA OTP` — a IA pode interpretar mal
- **Handler de reembolso** (linhas 6528-6536): texto corrompido `Reembolsos sÃ£o processados automaticamente` sendo injetado no prompt
- **Handler de cancelamento** (linhas 6543-6550): mesmo problema
- **Handler de saque/OTP** (linhas 6511-6518): `Para sua seguranÃ§a` corrompido

### 2. Conversa #832496f2 (Diego Teixeira) — IA fora de escopo
- Cliente no `node_ia_financeiro` pedindo reembolso
- Fix do `isInFinanceiroNode` foi aplicado corretamente (linha 6524-6525) ✅
- **Porém**: a IA respondeu "Obrigado pelo envio. Como prefere que eu ajude agora? Quer que eu redija uma resposta ao Miguel?" — completamente fora do escopo financeiro
- **Causa**: As instruções do prompt financeiro estão com mojibake, a LLM não consegue interpretar o objetivo corretamente e "inventa" comportamentos

### 3. Source Violations (sandbox_not_allowed)
- Conversa `ce541d98` (Casaiq/Pedidos): IA respondeu sobre código de rastreio não encontrado usando conteúdo "sandbox" — warning registrado mas não bloqueado

## Plano de Correção

### Etapa 1: Limpeza completa de mojibake no arquivo inteiro
Substituir TODAS as 3.894 ocorrências de caracteres corrompidos pelo equivalente UTF-8 correto em `supabase/functions/ai-autopilot-chat/index.ts`. Mapeamento principal:
- `Ã£` → `ã`, `Ã§` → `ç`, `Ã©` → `é`, `Ãµ` → `õ`, `Ã¡` → `á`, `Ã³` → `ó`, `Ãª` → `ê`, `Ã­` → `í`, `Ãº` → `ú`, `Ã‚` → `Â`, `Ãƒ` → `Ã`
- Emojis: `ðŸ` → emojis reais, `âœ…` → `✅`, `âš ï¸` → `⚠️`, `âŒ` → `❌`, `â†'` → `→`
- Operação: reescrever o arquivo completo com encoding UTF-8 limpo

### Etapa 2: Deploy da edge function
Após a limpeza, deploy imediato para que todas as conversas ativas passem a receber prompts corretos.

### Etapa 3: Reset do estado da conversa #832496f2
A conversa do Diego está "poluída" com histórico de respostas fora de escopo. Opções:
- Forçar restart do fluxo financeiro (limpar `chat_flow_states` e reiniciar no nó)
- Ou transferir para humano manualmente

## Impacto Esperado
- Prompts injetados na LLM ficam legíveis → IA segue instruções corretamente
- Logs ficam legíveis para auditoria
- Handlers de reembolso/cancelamento/saque funcionam como esperado
- A conversa do Diego é corrigida

## Risco
Zero risco funcional — apenas substituição de texto. A lógica do código não muda.

