

# Auditoria Final IA — Bloco Cenário B/C do System Prompt

## Estado Atual

Todas as correções funcionais anteriores estão aplicadas e corretas:
- Regex, arrays, indicadores, helpers, ESCAPE_PATTERNS, financial guard, tool handler messages, ticket success messages, auto-exit terms, notFoundPatterns, maskEmail/maskPhone, validateResponseRestrictions — **tudo OK com UTF-8 correto**.

## Problema Restante (Único)

### Cenário B/C do System Prompt (linhas 6710-6879)
O bloco de instruções do "Cérebro Financeiro" enviado à LLM ainda tem mojibake extenso. São ~170 linhas de instruções com caracteres corrompidos como:

- `CENÃRIO B` → `CENÁRIO B`
- `CONFIRMAÃ‡ÃƒO OBRIGATÃ"RIA` → `CONFIRMAÇÃO OBRIGATÓRIA`
- `RESOLUÃ‡ÃƒO` → `RESOLUÇÃO`
- `EVIDÃŠNCIAS` → `EVIDÊNCIAS`
- `REGRAS CRÃTICAS GERAIS` → `REGRAS CRÍTICAS GERAIS`
- Dezenas de `Ã§Ã£o`, `NÃ£o`, `VocÃª`, `cÃ³digo`, `descriÃ§Ã£o`, `opÃ§Ã£o`, etc.

**Impacto**: Desperdiça tokens, pode degradar a qualidade das instruções financeiras para a IA.

## Plano de Correção (1 bloco)

Reescrever as linhas 6710-6879 com UTF-8 correto, mantendo toda a lógica idêntica — apenas restaurando a codificação dos caracteres acentuados e emojis.

## Após esta correção

Restam apenas ~2000 ocorrências em **logs e comentários** (console.log, `//` comments). Estas são puramente cosméticas e não afetam funcionalidade, UX nem qualidade da IA. Podem ser corrigidas progressivamente em rodadas futuras.

