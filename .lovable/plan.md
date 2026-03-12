

# Fix: Validação Kiwify silenciosamente falhando no motor de fluxos

## Diagnóstico

**Confirmado no banco:** Michel (5511920589132) e Alex Chiarelo (5519971552493) TÊM compras na `kiwify_events`, mas estão como `lead` com `kiwify_validated=false`.

**Confirmado nos logs:**
- O nó `validate_customer` **é executado** (`Master traverse: executing validate_customer inline`)
- O resultado é `vcFound: false` (validação retorna falso incorretamente)
- **Zero logs** da função `validate-by-kiwify-phone` — a chamada `fetch()` nunca chega lá

**Causa raiz:** O `process-chat-flow` usa `fetch()` direto para chamar `validate-by-kiwify-phone` como sub-função. Essa chamada HTTP interna está falhando silenciosamente porque o `.catch(() => ({ found: false }))` engole qualquer erro de rede sem logar nada. O resultado: a validação parece executar mas sempre retorna `false`.

## Correção

**Estratégia:** Substituir a chamada `fetch` por query direta à tabela `kiwify_events` dentro do `process-chat-flow`. Isso elimina o hop de rede entre edge functions e garante que a validação funcione.

**Arquivo:** `supabase/functions/process-chat-flow/index.ts`

1. **Criar função helper `inlineKiwifyValidation`** no topo do arquivo — faz a mesma query que `validate-by-kiwify-phone` faz (buscar `kiwify_events` por últimos 9 dígitos do telefone), mas direto no `supabaseClient` já disponível
2. **Substituir os blocos de `fetch` → `validate-by-kiwify-phone`** nas 4+ zonas de execução (Master Flow, Manual, Generic, Auto-advance) por chamadas à função helper inline
3. **Manter a lógica de promoção do contato** (`update status='customer', kiwify_validated=true`) que já existe após o resultado

A função helper fará:
```
- Normalizar telefone (últimos 9 dígitos)
- Query: kiwify_events WHERE event_type IN ('paid','order_approved','subscription_renewed') AND payload->Customer->>mobile ILIKE '%{last9}' 
- Retornar { found, name, email, products }
```

Isso garante que a validação execute de forma síncrona e confiável, sem depender de chamadas HTTP internas que podem falhar silenciosamente.

