
# Plano: Fonte Única de Template — Eliminar Lógica Hardcoded

## Problema Atual

A função `ai-autopilot-chat` tem **4 blocos separados** que geram mensagens de coleta de dados, cada um com seu próprio mapa `fieldLabels`/`FIELD_LABELS` hardcoded e lógica de fallback. Isso significa que a configuração do fluxo (dashboard) é ignorada na maioria dos cenários.

| Bloco | Linhas | Onde é usado |
|-------|--------|-------------|
| `buildCollectionMessage()` | L1219-1259 | Helper centralizado (já correto, mas subutilizado) |
| `identityWallNote` pós-OTP | L6955-6974 | Prompt da IA quando OTP acabou de ser validado |
| `structuredCollectionMessage` | L7057-7072 | Instrução de coleta no system prompt geral |
| OTP verification handler | L8826-8846 | Resposta direta após verificação de OTP inline |

Cada bloco reimplementa a mesma lógica com variações e mapas diferentes, criando divergência.

## Solução

### Passo 1 — Consolidar `buildCollectionMessage` como fonte única

A função `buildCollectionMessage` (L1219) já implementa a prioridade correta:
1. `description_template` do nó → usa direto
2. `smartCollectionFields` → gera com labels
3. Fallback hardcoded

**Ajustes nela:**
- Aceitar um parâmetro opcional `prefix` (ex: "Identidade verificada!") para flexibilidade
- Aceitar `intent` opcional para personalizar ("seu saque" vs "sua solicitação")
- Remover o texto hardcoded "Para processar seu saque" do fallback — usar texto genérico

### Passo 2 — Substituir os 3 blocos duplicados por chamadas a `buildCollectionMessage`

- **L6955-6974** (`identityWallNote`): Substituir a resolução manual do template por `buildCollectionMessage(flow_context, contactName, ...)`
- **L7057-7072** (`structuredCollectionMessage`): Eliminar o `FIELD_LABELS` local e usar `buildCollectionMessage`
- **L8826-8846** (OTP handler): Eliminar `FIELD_LABELS_OTP` e usar `buildCollectionMessage`

### Passo 3 — Eliminar todos os mapas `fieldLabels` duplicados

Após a consolidação, restarão **zero** mapas hardcoded fora de `buildCollectionMessage`. O único mapa sobrevive dentro da função helper como fallback de último recurso (quando não há `description_template` nem `smartCollectionFields`).

### Passo 4 — Corrigir leitura de `isFirstInteraction`

No guard pós-OTP, buscar `interaction_count` também de `flow_context.collectedData.__ai`:
```
const aiInteractions = 
  customer_metadata?.__ai?.interaction_count || 
  flow_context?.collectedData?.__ai?.interaction_count || 0;
```

## Resultado Esperado

- **1 função** (`buildCollectionMessage`) decide o que mostrar
- **0 mapas hardcoded** espalhados pelo código
- O `description_template` configurado no dashboard **sempre** tem prioridade
- Os campos do fluxo controlam 100% do conteúdo da coleta

## Arquivo Afetado

`supabase/functions/ai-autopilot-chat/index.ts` — ~4 regiões, ~80 linhas removidas/simplificadas
