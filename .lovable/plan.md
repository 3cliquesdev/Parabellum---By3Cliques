

# Auditoria Completa da IA — Todos os Problemas Identificados

## Resumo

O arquivo `ai-autopilot-chat/index.ts` (9812 linhas) ainda contém **~3896 ocorrências de mojibake** (encoding corrompido). Nas rodadas anteriores corrigimos apenas os fallbacks das linhas 7211-7216 e o retry da linha 7148. A grande maioria do arquivo permanece com caracteres corrompidos, afetando:

---

## Problemas Críticos (Afetam Funcionalidade)

### 1. Regex de auto-exit com mojibake — linhas 7171-7173
As regex que detectam intenção financeira/cancelamento/comercial quando a IA retorna vazio contêm mojibake e **nunca farão match** com input UTF-8 real:
```
devoluÃ§Ã£o → devolução
transferÃªncia → transferência  
desistÃªncia → desistência
preÃ§o → preço
```
**Impacto**: Auto-exit por intent não funciona para essas palavras.

### 2. Regex de `detectIntentCategory` — linha 375
```
desinscriÃ§Ã£o → desinscrição
```
**Impacto**: Detecção de intenção de cancelamento falha para essa variação.

### 3. Labels de `getIntentCategoryLabel` — linhas 405-409
```
problema tÃ©cnico → problema técnico
acesso Ã  plataforma → acesso à plataforma
cobranÃ§a → cobrança
sua dÃºvida → sua dúvida
```
**Impacto**: Labels internos corrompidos em logs e contexto de recovery.

### 4. Mensagem OTP de saque (cliente vê) — linhas 6283-6289
Toda a mensagem de verificação de saque tem mojibake:
```
VerificaÃ§Ã£o de SeguranÃ§a → Verificação de Segurança
OlÃ¡ → Olá
cÃ³digo → código
vocÃª → você
```
**Impacto**: Cliente vê texto ilegível ao solicitar saque.

### 5. Mensagem de cancelamento (cliente vê) — linhas 5814-5822
```
Ã© feito → é feito
VocÃª tem → Você tem
ðŸ"Œ → 📌 (emojis corrompidos)
```
**Impacto**: Resposta de cancelamento Kiwify ilegível.

### 6. `HALLUCINATION_INDICATORS` — linhas 837-848
```
nÃ£o tenho certeza → não tenho certeza
Ã© possÃ­vel que → é possível que
```
**Impacto**: Detecção de alucinação falha — essas strings nunca casam com output real da IA.

### 7. `CONFLICT_INDICATORS` — linha 851
```
porÃ©m → porém
contrÃ¡rio → contrário
```
**Impacto**: Detecção de conflitos entre documentos falha.

### 8. `INFORMATIONAL_PATTERNS` — linhas 1129-1135
```
/como\s+(funciona|faz|Ã©|posso)/i → é
/o\s+que\s+(Ã©|significa)/i → é
/qual\s+(Ã©|o)/i → é
```
**Impacto**: Regex não faz match correto com input do usuário.

### 9. `FINANCIAL_ACTION_PATTERNS` — linhas 1077-1080
```
cadÃª → cadê
nÃ£o → não
```
**Impacto**: Padrões financeiros não fazem match.

### 10. `REFUND_ACTION_PATTERNS` — linha 1112
```
devoluÃ§Ã£o → devolução
```

### 11. `CANCELLATION_ACTION_PATTERNS` — linha 1124
```
nÃ£o quero mais pagar → não quero mais pagar
```

### 12. `EXPLICIT_HUMAN_REQUEST_PATTERNS` — linhas 826, 830
```
alguÃ©m → alguém
nÃ£o consigo → não consigo
```

### 13. `formatOptionsAsText` emojis — linha 355
Todos os emojis numéricos estão corrompidos.

### 14. Mensagens em tool handlers (cliente vê)
- Linhas 7400, 7414, 7425, 7449, 7467, 7493, 7500: Vários `assistantMessage` com mojibake
- Linhas 8412-8419, 8435, 8458: Mensagens de handoff/close com mojibake

### 15. `createTicketSuccessMessage` — linhas 1164-1184
Todas as mensagens de sucesso de ticket têm mojibake (cliente vê).

### 16. `notFoundPatterns` no Strict RAG — linhas 4234-4237
```
nÃ£o encontrei essa informaÃ§Ã£o → não encontrei essa informação
```
**Impacto**: Detecção de "not found" no RAG estrito falha.

---

## Plano de Correção

Devido ao volume (3896 ocorrências em 9812 linhas), a abordagem será **reescrever todas as seções afetadas em blocos**, priorizando por impacto:

### Bloco 1: Arrays de constantes e regex (linhas 780-1135)
Corrigir: `HALLUCINATION_INDICATORS`, `CONFLICT_INDICATORS`, `EXPLICIT_HUMAN_REQUEST_PATTERNS`, `FINANCIAL_ACTION_PATTERNS`, `WITHDRAWAL_ACTION_PATTERNS`, `REFUND_ACTION_PATTERNS`, `CANCELLATION_ACTION_PATTERNS`, `INFORMATIONAL_PATTERNS`

### Bloco 2: Funções helper (linhas 350-410)
Corrigir: `formatOptionsAsText` (emojis), `detectIntentCategory` (regex), `getIntentCategoryLabel` (labels)

### Bloco 3: Mensagens ao cliente — OTP saque (linhas 6283-6289)
Reescrever string template com UTF-8 correto

### Bloco 4: Mensagens ao cliente — Cancelamento (linhas 5814-5822)
Reescrever resposta Kiwify com UTF-8 correto

### Bloco 5: Regex auto-exit (linhas 7171-7173)
Corrigir `financialTerms`, `cancellationTerms`, `commercialTerms`

### Bloco 6: Tool handlers — mensagens assistantMessage
Corrigir todas as strings em tool handlers (verify_email, send_otp, create_ticket, handoff, close)

### Bloco 7: `createTicketSuccessMessage` (linhas 1164-1184)
Corrigir mensagens de sucesso de ticket

### Bloco 8: Strict RAG patterns (linhas 4234-4237)
Corrigir `notFoundPatterns`

### Bloco 9: Logs e comentários restantes
Cosmético, mas importante para debugging — corrigir progressivamente

---

## Resultado Esperado
- Todas as regex de detecção de intenção funcionam com input UTF-8 real
- Todas as mensagens visíveis ao cliente são legíveis
- Detecção de alucinação e conflitos funciona corretamente
- Auto-exit por intent opera para palavras acentuadas
- Emojis exibidos corretamente no WhatsApp

