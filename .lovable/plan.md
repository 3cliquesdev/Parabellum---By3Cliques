

# Fix: Erros ao enviar mensagem e encerrar conversa

## Diagnóstico

Os logs do servidor mostram que as Edge Functions **funcionam quando alcançadas**, mas falham intermitentemente por dois motivos:

1. **`send-meta-whatsapp` com CORS incompleto**: Os headers não incluem `x-supabase-client-platform` e outros headers que o SDK JS envia automaticamente. Isso causa rejeição no preflight (browser bloqueia antes de chegar ao servidor), resultando em "Failed to fetch".

2. **`send-meta-whatsapp` sem warmup fast-path**: Diferente do `close-conversation` e `get-inbox-counts` (já corrigidos), esta função ainda sofre cold starts sem proteção.

3. **Thundering herd residual**: Os logs mostram 10+ boots simultâneos do `get-inbox-counts` em 1 segundo, o que pode saturar o runtime e causar falhas cascata em outras funções.

## Correções

### 1. `supabase/functions/send-meta-whatsapp/index.ts`

- **Atualizar CORS headers** (mesmo padrão já aplicado em `close-conversation`):
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
```

- **Adicionar warmup fast-path** após o OPTIONS check (usa `serve` com `Deno.serve` pattern — verificar qual é usado e adaptar):
```typescript
// Warmup fast-path
if (req.method === "POST") {
  const cloned = await req.clone().json().catch(() => null);
  if (cloned?.warmup === true) {
    return new Response(JSON.stringify({ success: true, warmed: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
```

### 2. Redeploy

Fazer deploy de `send-meta-whatsapp` para ativar as correções.

## Impacto

- Corrige "Failed to fetch" ao enviar mensagens via WhatsApp
- Warmup previne cold starts na função de envio
- O `close-conversation` já foi corrigido na iteração anterior e funciona (confirmado nos logs)

