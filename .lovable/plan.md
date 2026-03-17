

# Auditoria Completa — Estado Atual das Correções

## Resultado: 1 falha encontrada no pós-filtro

### O que está funcionando (✅)

1. **Tool `check_tracking`**: Limpo — sem `customer_email` na definição (linha 7194-7210) nem no runtime (linha 8117: `// customer_email REMOVIDO`)
2. **Tool `check_order_status`**: Removido corretamente (linha 8100: comentário de remoção)
3. **Prompt global** (linha 1318-1322): Instrução "NUNCA peça email, CPF ou telefone" presente
4. **Cenário C** (linha 6938): Corrigido para "peça o código de rastreio como alternativa"
5. **Instrução de tools** (linha 6963): Regra explícita "NUNCA peça email, CPF ou telefone para consultar pedidos/rastreio"
6. **Deduplicação de webhook**: Index parcial + check por `provider_message_id` ativos
7. **Todas as tools restantes** (`verify_customer_email`, `send_financial_otp`, etc.): Intactas e corretas para seus cenários legítimos (identificação, OTP)

### Falha encontrada (❌): Pós-filtro com regex muito curto

A mensagem problemática da conversa `#F865982D`:
```
"me informe um dos itens abaixo:\n\n- O(s) código(s)...\n- Ou o e-mail de cadastro"
```

O `FORBIDDEN_REQUEST_PATTERN` usa `[\s\S]{0,40}` entre o verbo e "email" — a distância real nessa frase é ~80+ chars. O segundo filtro `EMAIL_AS_SEARCH` usa `[\s\S]{0,30}` — mesma limitação.

**Nenhum dos dois filtros teria bloqueado essa resposta**, mesmo com o deploy atual.

### Correção necessária

Simplificar os pós-filtros para não depender de proximidade verbo↔email. A lógica correta:
- Se `customerMessage` menciona pedido/rastreio/envio **E** `assistantMessage` menciona "email" em contexto de pedido → bloquear
- Novo regex mais amplo: verificar se a resposta contém **qualquer menção a email como forma de busca**, independente da distância do verbo

```
// Filtro simplificado: se o tema é pedido/rastreio E a resposta sugere email como opção
const RESPONSE_SUGGESTS_EMAIL = /e-?mail[\s\S]{0,60}(?:cadastr|compra|busca|localiz|consult)|(?:informe|envie|passe|diga)[\s\S]{0,120}e-?mail/i;
```

E adicionar um filtro no `assistantMessage` sozinho (sem depender do customerMessage):
```
// Se a resposta da IA menciona pedido/rastreio E email no mesmo texto → bloquear
if (ORDER_TRACKING_KEYWORDS.test(assistantMessage) && /e-?mail/i.test(assistantMessage)) {
  // Exceção: se contexto é verificação de identidade (verify_customer_email), não bloquear
  if (!toolCallsMade.includes('verify_customer_email')) { ... }
}
```

### Arquivos a alterar
- `supabase/functions/ai-autopilot-chat/index.ts` — linhas 9233-9246 (pós-filtro)

### Resumo
- 7 de 8 correções estão 100% operacionais
- O pós-filtro precisa de regex mais amplo para cobrir o padrão real da IA
- Nenhuma outra função foi quebrada pelas alterações anteriores

