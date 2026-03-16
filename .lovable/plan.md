

# Fix: Erros dos atendentes (close-conversation 503 + React crash)

## Problemas Identificados

Existem **2 problemas distintos** causando erros:

### 1. `close-conversation` retorna 503 (sem logs)
A Edge Function `close-conversation` nao esta nem iniciando (zero logs no servidor). Provavel causa: CORS headers incompletos bloqueando o preflight request. Os headers atuais nao incluem os headers que o cliente Supabase envia automaticamente (`x-supabase-client-platform`, etc.), fazendo o browser rejeitar a requisicao antes mesmo de chegar ao servidor.

### 2. React crash: "observer.getOptimisticResult is not a function"
Erro interno do React Query que causa tela em branco. Provavelmente causado por hot-reload ou incompatibilidade temporaria de cache do Vite. Nao requer mudanca de codigo — se resolve com refresh. Porem, o erro cascata ("fewer hooks") indica que o crash afeta toda a aplicacao.

## Correcoes

### Arquivo 1: `supabase/functions/close-conversation/index.ts`

**Atualizar CORS headers** para incluir todos os headers que o cliente Supabase JS envia:

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
```

**Adicionar warmup fast-path** (consistente com get-inbox-counts):

```typescript
// Apos OPTIONS check, antes do try principal:
const maybeWarmup = req.method === "POST" ? await req.clone().json().catch(() => null) : null;
if (maybeWarmup?.warmup === true) {
  return new Response(JSON.stringify({ success: true, warmed: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

### Arquivo 2: `supabase/functions/keep-alive/index.ts`

Adicionar `close-conversation` na lista de funcoes que recebem warmup periodico (se ainda nao estiver la).

### Deploy

Forcas redeployment da funcao `close-conversation` para garantir que a versao atual esta ativa no runtime.

## Impacto

- Atendentes conseguirao encerrar conversas sem erro 503
- Warmup previne cold starts futuros
- Nenhuma mudanca no frontend necessaria (retry ja existe no `useCloseConversation`)

