

# Bug Crítico: `validate-by-kiwify-phone` — Filtro JSON Quebrado

## Problema

A função `validate-by-kiwify-phone` **nunca encontra nenhum cliente**. O filtro PostgREST na linha 108:

```typescript
.filter("payload->Customer->>'mobile'", 'ilike', `%${last9Digits}`)
```

Retorna **0 resultados** silenciosamente. O PostgREST não suporta a sintaxe `->>` (text extraction) dentro do `.filter()`. A sintaxe correta para o Supabase JS client é:

```typescript
.filter("payload->Customer->>mobile", 'ilike', `%${last9Digits}`)
```

(sem aspas simples em volta de `mobile`)

**Prova:** SQL direto `payload->'Customer'->>'mobile' ILIKE '%992163438'` retorna 5 resultados. A edge function retorna `found: false`.

## Correção

### Arquivo: `supabase/functions/validate-by-kiwify-phone/index.ts`

**Linha 108:** Trocar a sintaxe do filtro:
```
// DE:
.filter("payload->Customer->>'mobile'", 'ilike', `%${last9Digits}`)
// PARA:
.filter("payload->Customer->>mobile", 'ilike', `%${last9Digits}`)
```

### Re-deploy + Teste

Após a correção, invocar a função com o contato Weverton (phone `5594992163438`) para confirmar que retorna `found: true` e promove o contato para `customer`.

## Impacto

Este bug afeta **toda** a validação por telefone no sistema:
- Nó `validate_customer` no canvas de fluxos
- Auto-validação silenciosa no nó `ai_response`
- Triagem de leads no Autopilot

Nenhuma validação por telefone está funcionando em produção.

