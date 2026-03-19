

# Auditoria: Coleta Dinâmica via `smartCollectionFields`

## Falhas Encontradas

### FALHA CRÍTICA 1: 6 pontos no `process-chat-flow` NÃO propagam `smartCollectionFields`

O campo só é propagado em **1 de 7** locais que retornam `aiNodeActive: true`:

| Local | Linha | Propaga? |
|-------|-------|----------|
| Intent-routing → ai_response | ~4666 | ✅ SIM |
| OTP not-customer → ai_response | ~2115 | ❌ NÃO |
| OTP verified → ai_response | ~2346 | ❌ NÃO |
| ask_options → ai_response | ~2977 | ❌ NÃO |
| stayOnNode (IA permanece no nó) | ~3887 | ❌ NÃO |
| findNextNode → ai_response | ~5021 | ❌ NÃO |
| Master Flow → ai_response | ~5604 | ❌ NÃO |
| Trigger Flow → ai_response | ~5942 | ❌ NÃO |

**Impacto**: Na maioria dos caminhos (inclusive o mais comum: `stayOnNode`), a IA recebe `smartCollectionFields = undefined`, caindo no fallback hardcoded `['name', 'pix_key', 'bank', 'reason', 'amount']`. Ou seja, **o campo configurado no painel NÃO é respeitado** em quase nenhum cenário.

### FALHA CRÍTICA 2: Webhook Meta NÃO propaga `smartCollectionFields`

Nos 2 blocos do webhook que constroem `flow_context` manualmente (L1172-1197 e L1277-1302), o campo `smartCollectionEnabled` e `smartCollectionFields` **não existem**. Isso significa que chamadas diretas do webhook para o autopilot perdem a informação.

### FALHA MENOR 3: `stayOnNode` usa `currentNode` mas sem smart fields

O ponto `stayOnNode` (L3859-3887) é o **caminho mais executado** durante a coleta de dados — é chamado em cada mensagem do cliente enquanto ele permanece no nó de IA. Se não propagar os campos, a IA perde a configuração após a primeira mensagem.

---

## Plano de Correção

### 1. `process-chat-flow/index.ts` — Adicionar 2 linhas em 7 locais

Em cada bloco que retorna `aiNodeActive: true` com campos do nó, adicionar:
```typescript
smartCollectionEnabled: nodeVar.data?.smart_collection_enabled ?? false,
smartCollectionFields: nodeVar.data?.smart_collection_fields || [],
```

Onde `nodeVar` é `resolvedNode`, `currentNode`, `nextNode`, `node` ou `startNode` conforme o contexto.

**Linhas afetadas**: ~2115, ~2346, ~2977, ~3887, ~5021, ~5604, ~5942

### 2. `meta-whatsapp-webhook/index.ts` — Adicionar em 2 blocos de flow_context

Nos blocos L1172-1197 e L1277-1302, adicionar:
```typescript
smartCollectionEnabled: (flowData as any).smartCollectionEnabled ?? false,
smartCollectionFields: (flowData as any).smartCollectionFields || [],
```

### 3. Deploy de ambas as funções

---

## Resumo

- **9 pontos de falha** onde os campos dinâmicos são perdidos
- Sem essas correções, a coleta sempre usa o fallback hardcoded, ignorando o que está configurado no painel visual
- Correção é mecânica: adicionar 2 linhas em cada ponto

