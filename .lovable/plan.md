

# Fix: IA Ainda Usando "HidraPure" — Duas Causas Raiz

## Diagnóstico Completo

A mensagem "Sou a assistente virtual da HidraPure" **não vem da LLM**. Vem de um **fallback hardcoded** no `meta-whatsapp-webhook` que dispara quando a saudação proativa via autopilot falha.

**Evidência nos logs:**
- `meta-whatsapp-webhook` → "✅ Fallback greeting enviado direto via WhatsApp" (09:43 hoje)
- O fallback faz `organizations.select('name').limit(1)` → retorna "HidraPure" (2ª organização no banco)
- `ai-autopilot-chat` → BUILD-V3 2026-03-18 (deploy antigo, fix do brand NÃO foi deployado)

## Correções

### 1. `meta-whatsapp-webhook/index.ts` — Fallback greeting (CAUSA PRINCIPAL)

Duas ocorrências idênticas (linhas ~1212 e ~1236) que buscam `organizations.name`. Trocar ambas para buscar de `email_branding` com `is_default_customer = true`:

```typescript
// ANTES (ERRADO):
const { data: _orgRow } = await supabase.from('organizations').select('name').limit(1).maybeSingle();
const _orgName = _orgRow?.name || 'nossa equipe';

// DEPOIS (CORRETO):
const { data: _brandRow } = await supabase.from('email_branding').select('name').eq('is_default_customer', true).maybeSingle();
const _brandName = _brandRow?.name || 'nossa equipe';
```

### 2. Deploy de AMBAS as funções

- `ai-autopilot-chat` — contém o fix do brand name no system prompt (feito anteriormente mas nunca deployado)
- `meta-whatsapp-webhook` — com o fallback corrigido

### Resultado Esperado

O fallback greeting passará a usar "3Cliques | CRM" (valor em `email_branding`) em vez de "HidraPure" (organização-cliente). E mesmo que o autopilot responda, o system prompt já terá o brand name correto.

