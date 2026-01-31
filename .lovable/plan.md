

# Plano: Configurar Secrets do Instagram para Validação do Webhook

## Problema Identificado
O Meta não consegue validar o webhook porque o secret `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` não existe no backend. A edge function `instagram-webhook` precisa desse valor para responder corretamente à verificação.

## Dados Encontrados na Sua Configuração Meta

| Campo | Valor |
|-------|-------|
| ID do App Instagram | `1192784686401515` |
| Verify Token (usado no Meta) | `parabellum_instagram_webhook_2026` |
| URL do Webhook | `https://zaeozfdjhrmblfaxsyuu.supabase.co/functions/v1/instagram-webhook` |
| Chave Secreta | (mascarada - você precisará copiar clicando em "Mostrar") |

## Secrets a Adicionar

| Secret | Descrição |
|--------|-----------|
| `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` | Deve ser exatamente `parabellum_instagram_webhook_2026` |
| `FACEBOOK_APP_ID` | `1192784686401515` (ID do App do Instagram) |
| `FACEBOOK_APP_SECRET` | A chave secreta (clicar em "Mostrar" para copiar) |

## Fluxo Após Configuração

```text
┌─────────────────┐     GET ?hub.verify_token=...     ┌─────────────────┐
│   Meta Server   │ ─────────────────────────────────▶│ instagram-webhook│
└─────────────────┘                                    └────────┬────────┘
                                                                │
                                                   Compara com secret
                                                   INSTAGRAM_WEBHOOK_VERIFY_TOKEN
                                                                │
                                          ┌─────────────────────┴─────────────────────┐
                                          ▼                                           ▼
                                   Match: 200 + challenge                      Mismatch: 403
                                   (webhook validado)                          (erro atual)
```

## Passos da Implementação

1. **Adicionar `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`**
   - Valor: `parabellum_instagram_webhook_2026`

2. **Adicionar `FACEBOOK_APP_ID`**
   - Valor: `1192784686401515`

3. **Adicionar `FACEBOOK_APP_SECRET`**
   - Valor: (você cola da tela do Meta clicando em "Mostrar")

4. **Aguardar deploy automático** (alguns segundos)

5. **Voltar ao Meta e clicar em "Verificar e salvar"**

## Resultado Esperado

- Meta consegue validar o webhook
- Você pode prosseguir para o passo 3 ("Configure o login da empresa")
- Comentários e DMs do Instagram serão recebidos pela edge function

## Seção Técnica

O código da edge function já está correto (linha 28-41):

```typescript
const verifyToken = Deno.env.get("INSTAGRAM_WEBHOOK_VERIFY_TOKEN");

if (mode === "subscribe" && token === verifyToken) {
  console.log("[instagram-webhook] Verification successful");
  return new Response(challenge, { 
    status: 200,
    headers: { "Content-Type": "text/plain" }
  });
}
```

O problema é apenas que o secret não existe. Assim que for adicionado, a verificação funcionará.

