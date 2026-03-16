
# Auditoria Conversa #2D12F4F9 — Correções Aplicadas

## Bug 1 — callStrictRAG 400 tokens → ✅ CORRIGIDO
- `max_completion_tokens` aumentado de 400 para 1200 (L4269)
- Deploy realizado

## Bug 2 — FALLBACK_PHRASES genérico `'não consigo'` → ✅ CORRIGIDO
- Substituído `'não consigo'` por duas variações específicas:
  - `'não consigo te ajudar com isso'`
  - `'não consigo resolver'`
- Isso elimina falsos positivos em respostas legítimas como "Não consegui encontrar informações"
- Deploy realizado
