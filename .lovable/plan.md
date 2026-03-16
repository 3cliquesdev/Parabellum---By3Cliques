

# Correção: Persona do Portal ignorada (Aurélio responde)

## Problema
O `personaId` é enviado no body raiz da request, mas a edge function só lê de `flow_context.personaId`. Resultado: fallback para Aurélio.

## Correção

### `src/hooks/useClientAssistant.ts`
- Adicionar `personaId: PORTAL_PERSONA_ID` dentro do objeto `flow_context`
- Remover `persona_id` do body raiz (não é lido pela edge function)

```typescript
flow_context: {
  node_type: "ai_response",
  personaId: PORTAL_PERSONA_ID,  // ← adicionar
  allowed_sources: ["kb", "crm", "tracking"],
  contextPrompt: "...",
  // resto igual
}
```

**1 arquivo, ~2 linhas alteradas. Sem redeploy — mudança apenas no frontend.**

