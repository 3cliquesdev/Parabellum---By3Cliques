

# Fix: IA com palavras quebradas e prefixo RAG vazando

## Problemas identificados na conversa #2B2BC37E

### 1. Prefixo "Baseado nas informações disponíveis:" vazando para o cliente
- Quando `confidenceResult.action === 'cautious'` (que acontece em **toda** mensagem com `flow_context` + zero artigos KB), o sistema adiciona o prefixo `"Baseado nas informações disponíveis:\n\n"` na frente da resposta
- Isso **não deveria aparecer** para o cliente — é um artefato interno do RAG
- **Linha 7309-7314**: o prefixo é adicionado incondicionalmente quando `cautious`
- **Linha 5434**: zero confidence + flow_context **força** `cautious`, então **toda saudação** no fluxo recebe o prefixo

### 2. Sem detecção de truncamento (palavras cortadas)
- O código **nunca verifica** `finish_reason` da resposta OpenAI
- Se `finish_reason === 'length'`, a resposta foi cortada por `max_tokens` (500 por padrão)
- Isso causa palavras literalmente cortadas no meio (ex: "inform" em vez de "informações")

## Correções

### Arquivo: `supabase/functions/ai-autopilot-chat/index.ts`

**Fix 1 — Remover prefixo "Baseado nas informações disponíveis:"**
- Linha ~1058: Mudar o retorno de `'cautious'` em `generateResponsePrefix()` para retornar string vazia `''`
- Alternativa mais cirúrgica: na linha ~7309, adicionar condição `&& !flow_context` para não prefixar respostas dentro de fluxos

**Fix 2 — Detectar e reparar truncamento**
- Após `const aiData = await callAIWithFallback(aiPayload)` (linha ~7212), verificar `aiData.choices?.[0]?.finish_reason`
- Se `finish_reason === 'length'`:
  - Cortar até o último `.` ou `!` ou `?` completo (remover frase incompleta)
  - Logar warning `[ai-autopilot-chat] ⚠️ Response truncated by max_tokens`
- Também aumentar `max_tokens` default de 500 para 800 (linha ~6966)

**Fix 3 — Aumentar max_tokens no retry**
- Linha ~7230: retry usa `max_tokens: 300` que é muito baixo, aumentar para 600

### Resultado esperado
- Nenhuma resposta do bot começa com "Baseado nas informações disponíveis:"
- Palavras não são cortadas no meio — frases incompletas são removidas
- Respostas mais longas são possíveis sem truncamento

