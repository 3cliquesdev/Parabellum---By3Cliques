

# Auditoria Final da IA — Correções Restantes para 100%

## Resumo do Estado Atual

Nas rodadas anteriores corrigimos: regex de detecção de intenção, arrays de indicadores, emojis, fallbacks vazios, retry logic, auto-exit terms, OTP de saque, cancelamento Kiwify, ticket success messages, notFoundPatterns. **Tudo isso está correto.**

Restam **3 categorias** de mojibake:

---

## 1. CRÍTICO — Regex e Strings Funcionais (Afetam Lógica)

### 1a. `validateResponseRestrictions` — regex de opções (linha 1374-1375)
`opÃ§Ã£o` nunca casa com "opção" no output real da IA. **A detecção de violação de opções está quebrada.**
```
/opÃ§Ã£o.*[:\-]/i  →  /opção.*[:\-]/i
/escolha.*opÃ§Ã£o/i  →  /escolha.*opção/i
```

### 1b. `maskEmail` / `maskPhone` fallback strings (linhas 247-249)
Retornam `NÃ£o identificado` e `Email invÃ¡lido` — texto ilegível se exibido ao cliente via logs ou interações.
```
'NÃ£o identificado' → 'Não identificado'
'Email invÃ¡lido' → 'Email inválido'
'NÃ£o cadastrado' → 'Não cadastrado'
```

---

## 2. ALTO — Mensagens Enviadas ao Cliente (Tool Handlers)

Todas as `assistantMessage` com mojibake em tool handlers que o cliente vê diretamente:

| Linha | Texto corrompido | Correção |
|-------|-----------------|----------|
| 7273-7277 | `NÃ£o encontrei o email...` | `Não encontrei o email...` |
| 7340 | `NÃ£o encontrei seu email cadastrado...cÃ³digo` | `Não encontrei...código` |
| 7351 | `NÃ£o consegui reenviar o cÃ³digo` | `Não consegui reenviar o código` |
| 7378-7382 | `CÃ³digo reenviado...dÃ­gitos...vocÃª recebido` | `Código reenviado...dígitos...você recebeu` |
| 7602 | `NÃ£o localizei...poderÃ¡` | `Não localizei...poderá` |
| 7635-7637 | `NÃ£o localizei...estÃ¡ offline` | `Não localizei...está offline` |
| 7683 | `CÃ³digo invÃ¡lido ou expirado` | `Código inválido ou expirado` |
| 7752 | `cÃ³digo...vocÃª` | `código...você` |
| 7987 | `NÃ£o encontrei nenhum cliente...Ã©` | `Não encontrei...é` |
| 8004 | `OlÃ¡...nÃ£o hÃ¡ pedidos` | `Olá...não há pedidos` |
| 8027-8033 | `OlÃ¡...vocÃª` | `Olá...você` |
| 8076 | `NÃ£o encontrei...Ã©` | `Não encontrei...é` |
| 8090 | `OlÃ¡...nÃ£o hÃ¡...cÃ³digo...VocÃª...mÃ£os` | `Olá...não há...código...Você...mãos` |
| 8098 | `cÃ³digo de rastreio` | `código de rastreio` |

---

## 3. ALTO — System Prompt para a IA (Degrada Qualidade)

O `generateRestrictedPrompt` (linhas 1228-1340) e o `contextualizedSystemPrompt` (linhas 6603-6700) contêm centenas de mojibake. Embora a IA consiga interpretar, isso:
- Desperdiça tokens (caracteres corrompidos ocupam mais bytes)
- Pode causar confusão em instruções críticas (ex: `NÃƒO faÃ§a perguntas` vs `NÃO faça perguntas`)
- Degrada a qualidade das respostas

Seções a corrigir:
- `generateRestrictedPrompt` (linhas 1228-1340)
- `contextualizedSystemPrompt` handoff rules (linhas 6605-6670)
- `contextualizedSystemPrompt` financial brain (linhas 6672-6700)

---

## 4. COSMÉTICO — Logs e Comentários (~3000 ocorrências restantes)

Console.log e comentários internos — não afetam funcionalidade mas dificultam debugging. **Prioridade baixa**, corrigir progressivamente.

---

## Plano de Execução (3 blocos)

**Bloco 1**: Corrigir regex de `validateResponseRestrictions` + `maskEmail`/`maskPhone` (5 linhas)

**Bloco 2**: Corrigir todos os ~15 `assistantMessage` em tool handlers (linhas 7273-8098)

**Bloco 3**: Restaurar encoding do `generateRestrictedPrompt` (linhas 1228-1340) e `contextualizedSystemPrompt` (linhas 6605-6700)

Não vamos tocar nos logs/comentários nesta rodada — foco 100% na funcionalidade e experiência do cliente.

