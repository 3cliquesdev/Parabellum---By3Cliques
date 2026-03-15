

# Atualizar todas as 23 edge functions de `@0.168.0` para `@0.190.0`

## O que será feito

Atualizar o import `https://deno.land/std@0.168.0/http/server.ts` para `https://deno.land/std@0.190.0/http/server.ts` em todas as 23 edge functions que ainda usam a versão antiga, prevenindo erros de deploy futuros.

## Arquivos a atualizar (linha 1 ou 2 de cada)

1. `check-rotten-deals/index.ts`
2. `instagram-send-dm/index.ts`
3. `fetch-tracking/index.ts`
4. `integrations-test/index.ts`
5. `integration-status/index.ts`
6. `cron-process-queue/index.ts`
7. `instagram-start-oauth/index.ts`
8. `analyze-dashboard/index.ts`
9. `bulk-redistribute/index.ts`
10. `instagram-oauth-callback/index.ts`
11. `instagram-reply-comment/index.ts`
12. `fix-affiliate-attribution/index.ts`
13. `integrations-set/index.ts`
14. `integration-encrypt/index.ts`
15. `test-octadesk/index.ts`
16. `instagram-webhook/index.ts`
17. `validate-by-cpf/index.ts`
18. `instagram-sync/index.ts`
19. `resend-domain-manager/index.ts`
20. `update-instagram-secrets/index.ts`
21. `validate-by-kiwify-phone/index.ts`
22. `integrations-get/index.ts`
23. `integration-decrypt/index.ts`

## Alteração

Em cada arquivo, trocar:
```
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
```
por:
```
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
```

Nenhuma outra mudança necessária — a API do `serve` é idêntica entre as versões.

