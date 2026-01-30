
# Ajustes Finos — Fase 1 Anti-Alucinação

## Diagnóstico do Estado Atual

| Ajuste | Situação Atual | Impacto |
|--------|----------------|---------|
| `fallback_message` obrigatório | ❌ Default vazio no frontend (`fallback_message: ""`) | Backend depende de fallback hardcoded |
| `maxSentences` pós-processamento | ❌ Só existe no prompt | IA pode ignorar limite |
| `allowed_sources` logging | ❌ Sem validação | Sem visibilidade de violações |
| `useAutopilotTrigger` novos campos | ❌ Não passa Fase 1 fields | Web Chat não usa novos controles |

---

## Alterações Detalhadas

### 1. Frontend: `fallback_message` com Default Obrigatório

**Arquivo:** `src/components/chat-flows/ChatFlowEditor.tsx`

Atualizar `getDefaultData` para incluir default no `ai_response`:

```typescript
ai_response: { 
  label: "Resposta IA", 
  context_prompt: "", 
  use_knowledge_base: true, 
  // 🆕 FASE 1: fallback obrigatório com valor padrão
  fallback_message: "No momento não tenho essa informação.",
  // 🆕 FASE 1: Valores padrão para controles de comportamento
  max_sentences: 3,
  forbid_questions: true,
  forbid_options: true
},
```

### 2. Frontend: Validação Visual no Painel

**Arquivo:** `src/components/chat-flows/AIResponsePropertiesPanel.tsx`

Adicionar indicador visual se fallback estiver vazio:

```tsx
{/* Seção: Fallback */}
<div className="space-y-2">
  <div className="flex items-center gap-2">
    <AlertTriangle className={cn(
      "h-4 w-4",
      selectedNode.data.fallback_message 
        ? "text-orange-500" 
        : "text-red-500 animate-pulse"
    )} />
    <Label className="text-xs font-semibold uppercase tracking-wide">
      Mensagem de Fallback
      {!selectedNode.data.fallback_message && (
        <Badge variant="destructive" className="ml-2 text-[9px]">Obrigatório</Badge>
      )}
    </Label>
  </div>
  
  {/* Se vazio, auto-preencher */}
  <Textarea
    value={selectedNode.data.fallback_message || "No momento não tenho essa informação."}
    onChange={(e) => updateNodeData("fallback_message", e.target.value)}
    ...
  />
</div>
```

### 3. Backend: Função `limitSentences` Pós-Processamento

**Arquivo:** `supabase/functions/ai-autopilot-chat/index.ts`

Adicionar função de truncagem de frases após geração:

```typescript
// 🆕 FASE 1: Truncar resposta ao máximo de frases permitido
function limitSentences(text: string, maxSentences: number): string {
  // Separar por pontuação final (. ! ?)
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  if (sentences.length <= maxSentences) {
    return text;
  }
  
  // Truncar e adicionar indicador se necessário
  const truncated = sentences.slice(0, maxSentences).join(' ').trim();
  console.log(`[ai-autopilot-chat] ✂️ Resposta truncada de ${sentences.length} para ${maxSentences} frases`);
  
  return truncated;
}
```

**Uso após validação (linha ~7420):**

```typescript
// Após validateResponseRestrictions...
if (restrictionCheck.valid) {
  // 🆕 FASE 1: Enforce limite de frases no pós-processamento
  const maxSentences = flow_context.maxSentences ?? 3;
  assistantMessage = limitSentences(assistantMessage, maxSentences);
}
```

### 4. Backend: Logging de Violação de `allowed_sources`

**Arquivo:** `supabase/functions/ai-autopilot-chat/index.ts`

Adicionar validação de fontes após resposta (não bloqueante):

```typescript
// 🆕 FASE 1: Log de violação de allowed_sources (não bloqueante)
function logSourceViolationIfAny(
  response: string, 
  allowedSources: string[],
  kbUsed: boolean,
  crmUsed: boolean,
  trackingUsed: boolean
): void {
  const violations: string[] = [];
  
  // Verificar se IA usou fonte não autorizada
  if (!allowedSources.includes('kb') && kbUsed) {
    violations.push('kb_not_allowed');
  }
  if (!allowedSources.includes('crm') && crmUsed) {
    violations.push('crm_not_allowed');
  }
  if (!allowedSources.includes('tracking') && trackingUsed) {
    violations.push('tracking_not_allowed');
  }
  
  if (violations.length > 0) {
    console.warn('[ai-autopilot-chat] ⚠️ SOURCE VIOLATION (não bloqueante):', {
      violations,
      allowedSources,
      responsePreview: response.substring(0, 100)
    });
  }
}
```

### 5. Frontend: useAutopilotTrigger — Novos Campos Fase 1

**Arquivo:** `src/hooks/useAutopilotTrigger.tsx`

Atualizar `flowContext` para incluir novos campos:

```typescript
flowContext: data?.aiNodeActive ? {
  flow_id: data?.flowId || data?.masterFlowId,
  node_id: data?.nodeId,
  node_type: 'ai_response',
  allowed_sources: data?.allowedSources || ['kb', 'crm', 'tracking'],
  response_format: 'text_only',
  personaId: data?.personaId,
  kbCategories: data?.kbCategories,
  contextPrompt: data?.contextPrompt,
  fallbackMessage: data?.fallbackMessage || 'No momento não tenho essa informação.',
  // 🆕 FASE 1: Novos campos de controle
  objective: data?.objective,
  maxSentences: data?.maxSentences ?? 3,
  forbidQuestions: data?.forbidQuestions ?? true,
  forbidOptions: data?.forbidOptions ?? true,
} : undefined,
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/chat-flows/ChatFlowEditor.tsx` | Default `fallback_message` + campos Fase 1 |
| `src/components/chat-flows/AIResponsePropertiesPanel.tsx` | Indicador visual de fallback obrigatório |
| `supabase/functions/ai-autopilot-chat/index.ts` | `limitSentences` + `logSourceViolationIfAny` |
| `src/hooks/useAutopilotTrigger.tsx` | Passar novos campos Fase 1 |

---

## Resultado Esperado

| Garantia | Antes | Depois |
|----------|-------|--------|
| Fallback sempre definido | ⚠️ Depende do backend | ✅ Frontend garante default |
| Limite de frases | ⚠️ Só no prompt | ✅ Enforce no pós-processamento |
| Violação de fontes | ⚠️ Invisível | ✅ Log para auditoria |
| Web Chat com Fase 1 | ❌ Não propagava | ✅ Campos propagados |

---

## Ordem de Implementação

1. **Frontend**: Atualizar `getDefaultData` em `ChatFlowEditor.tsx`
2. **Frontend**: Adicionar indicador visual em `AIResponsePropertiesPanel.tsx`
3. **Frontend**: Atualizar `useAutopilotTrigger.tsx` com novos campos
4. **Backend**: Criar `limitSentences` e `logSourceViolationIfAny`
5. **Backend**: Aplicar pós-processamento após validação
6. **Deploy**: Publicar edge functions

---

## Nenhuma Breaking Change

- ✅ Nós existentes mantêm comportamento (defaults aplicados)
- ✅ Fallback vazio é auto-preenchido
- ✅ Logging não bloqueante
- ✅ Truncagem só quando necessário
