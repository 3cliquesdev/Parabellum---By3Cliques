

## Status: Ambos os fixes JÁ estão aplicados no código-fonte

### Evidência

**Bug 3 — `meta-whatsapp-webhook/index.ts` linha 1233:**
```typescript
skipInitialMessage: (flowData as any).skipInitialMessage || false,  // ✅ PRESENTE
```

**Bug 4 — `process-buffered-messages/index.ts` linhas 149-170:**
```typescript
if (effFlowData?.skipInitialMessage === true) {
  // Sempre substituir por vazio quando skipInitialMessage
  const greetSuccess = await callPipeline(supabase, {
    concatenatedMessage: "",  // ✅ PRESENTE
    ...
  });
}
```

### Problema potencial: deploy desatualizado

Os logs mostram que ambas as functions estão rodando, mas **nenhum log de `skipInitialMessage`** aparece — o que pode significar:
1. Nenhum cenário de menu+batching ocorreu desde o deploy (possível), **OU**
2. O deploy não incluiu o código mais recente (o build deployado é uma versão anterior)

### Plano: Redeploy forçado + verificação

1. **Redeploy `meta-whatsapp-webhook`** — forçar o código mais recente para produção
2. **Redeploy `process-buffered-messages`** — idem
3. **Verificar logs** após deploy para confirmar que a versão nova está ativa

Isso garante que o código-fonte (que já contém os fixes) esteja efetivamente rodando em produção.

