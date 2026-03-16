

# Fix: Encoding corrompido + prefixo cauteloso vazando no widget

## Problemas identificados

1. **Encoding no source code**: A string na linha 1050 de `ai-autopilot-chat/index.ts` contém `"Baseado nas informaÃ§Ãµes disponÃ­veis:\n\n"` — caracteres UTF-8 corrompidos no próprio código TypeScript. Isso causa o output garbled que aparece no widget.

2. **Prefixo cauteloso ainda ativo**: O bloco nas linhas 7221-7226 continua injetando esse prefixo em respostas com confiança "cautious", vazando metadados internos para o cliente.

## Correção

### Edge Function `ai-autopilot-chat/index.ts`

**Linha 1050**: Mudar o retorno de `'cautious'` para string vazia:
```typescript
case 'cautious':
  return ''; // Removido: prefixo cauteloso vazava metadados internos
```

**Linhas 7221-7227**: Remover o bloco que adiciona o prefixo cauteloso:
```typescript
// Bloco removido — prefixo cauteloso não será mais adicionado
```

## Impacto
- Respostas "cautious" passam a ser entregues sem prefixo, igual às "direct"
- Elimina o encoding corrompido que aparece no widget
- Nenhum impacto na lógica de confiança ou handoff — apenas o prefixo visual é removido

