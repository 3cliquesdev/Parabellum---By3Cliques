
# Plano: Corrigir Consulta de Base de Conhecimento e Configurações da Persona

## Diagnóstico Detalhado

### Problemas Identificados

| Problema | Causa Raiz | Impacto |
|----------|------------|---------|
| **Temperature ignorada** | Código usa `persona.temperature \|\| 0.7` - quando temp=0 (falsy), usa 0.7 | Persona configurada com temp=0 responde criativamente |
| **Max Tokens ignorado** | Mesmo problema: `persona.max_tokens \|\| 500` - quando =400, usa 400 | Este está OK, 400 > 0 funciona |
| **Artigos não encontrados** | Busca semântica requer embeddings, fallback por keywords pode não casar | IA responde genérico por falta de contexto |
| **Handoff rápido demais** | Score de confiança baixo (<40%) aciona handoff automático | "Quero falar sobre pedidos" → handoff |

### Sua Configuração Atual (Persona Helper)

```
temperature: 0        ← CORRETO (preciso)
max_tokens: 400       ← CORRETO
knowledge_base_paths: null  ← CORRETO (Acesso Global = TODOS artigos)
data_access.knowledge_base: true  ← CORRETO
```

**O problema NÃO é a config, é o código que ignora temperatura 0.**

---

## Solução

### FASE 1: Corrigir Fallback de Temperature (CRÍTICO)

**Arquivo: `supabase/functions/ai-autopilot-chat/index.ts`**

Linha 4412:
```typescript
// ANTES (BUG):
temperature: persona.temperature || 0.7,

// DEPOIS (CORREÇÃO):
temperature: persona.temperature ?? 0.7,
```

O operador `??` (nullish coalescing) só usa fallback quando valor é `null` ou `undefined`, NÃO quando é `0`.

### FASE 2: Melhorar Log de Diagnóstico da KB

Adicionar log detalhado quando artigos NÃO são encontrados:

```typescript
console.log('[ai-autopilot-chat] 📚 KB SEARCH RESULT:', {
  articles_found: knowledgeArticles.length,
  persona_has_global_access: !persona.knowledge_base_paths || persona.knowledge_base_paths.length === 0,
  persona_categories: persona.knowledge_base_paths,
  data_access_kb_enabled: personaDataAccess.knowledge_base,
  embedding_used: !!OPENAI_API_KEY,
  fallback_used: needsKeywordFallback,
  top_matches: knowledgeArticles.slice(0, 3).map(a => ({
    title: a.title,
    similarity: a.similarity,
    category: a.category
  }))
});
```

### FASE 3: Ajustar Threshold de Handoff para Permitir Respostas

O problema "responde genérico" acontece porque:
1. Artigos têm baixa similaridade com "pedidos" 
2. Score de confiança fica abaixo de 40%
3. IA faz handoff ao invés de tentar responder

**Solução**: Baixar threshold mínimo e melhorar fallback por keywords

Linha ~473:
```typescript
// ANTES:
const SCORE_MINIMUM = 0.40;  // Mínimo para tentar responder

// DEPOIS:
const SCORE_MINIMUM = 0.30;  // Mais tolerante - tenta responder com artigos disponíveis
```

Linha ~2823-2826 - Melhorar ordenação para priorizar matches de título:
```typescript
// Boost para matches de título (mais relevante que só conteúdo)
knowledgeArticles = allArticles
  .map((a: any) => ({
    ...a,
    // Boost de +0.15 se título contém palavra-chave do cliente
    similarity: customerMessage.toLowerCase().split(/\s+/).some(word => 
      a.title?.toLowerCase().includes(word) && word.length > 3
    ) ? Math.min((a.similarity || 0.5) + 0.15, 1.0) : (a.similarity || 0.5)
  }))
  .sort((a: any, b: any) => b.similarity - a.similarity)
  .slice(0, 5);
```

### FASE 4: Forçar Busca por Keywords para Termos Comuns

Adicionar termos diretos que sempre acionam busca por keyword:

Linha ~2764:
```typescript
// ANTES:
const directTerms = ['shopeecreation', 'shopee', 'creation', 'loja', 'produtos', 'cadastro', 'nivelamento', 'formulario'];

// DEPOIS:
const directTerms = [
  // Termos existentes
  'shopeecreation', 'shopee', 'creation', 'loja', 'produtos', 'cadastro', 'nivelamento', 'formulario',
  // NOVOS: Termos genéricos que clientes usam muito
  'pedido', 'pedidos', 'entrega', 'rastreio', 'envio', 'frete', 
  'saque', 'dinheiro', 'pix', 'saldo', 'reembolso',
  'assinatura', 'plano', 'curso', 'acesso',
  'horário', 'atendimento', 'suporte'
];
```

---

## Arquivos a Modificar

| Arquivo | Alteração | Prioridade |
|---------|-----------|------------|
| `supabase/functions/ai-autopilot-chat/index.ts` | Corrigir `\|\|` → `??` para temperature | CRÍTICA |
| `supabase/functions/ai-autopilot-chat/index.ts` | Adicionar log detalhado de KB search | ALTA |
| `supabase/functions/ai-autopilot-chat/index.ts` | Baixar SCORE_MINIMUM para 0.30 | ALTA |
| `supabase/functions/ai-autopilot-chat/index.ts` | Expandir directTerms com keywords comuns | ALTA |
| `supabase/functions/ai-autopilot-chat/index.ts` | Boost de similaridade para matches de título | MÉDIA |

---

## Fluxo Após Correção

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ FLUXO CORRIGIDO - KB SEARCH                                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  Cliente: "Quero falar sobre pedidos"                                         │
│         │                                                                     │
│         ▼                                                                     │
│  ┌─────────────────────────────────────────────┐                             │
│  │ 1. Classificar intenção → "search"           │                             │
│  └─────────────────────────────────────────────┘                             │
│         │                                                                     │
│         ▼                                                                     │
│  ┌─────────────────────────────────────────────┐                             │
│  │ 2. Verificar persona.data_access.knowledge  │                             │
│  │    → true (pode acessar KB)                 │                             │
│  └─────────────────────────────────────────────┘                             │
│         │                                                                     │
│         ▼                                                                     │
│  ┌─────────────────────────────────────────────┐                             │
│  │ 3. Buscar artigos:                          │                             │
│  │    A) Query Expansion → "pedidos", "status  │                             │
│  │       pedido", "meus pedidos"               │                             │
│  │    B) Embeddings (se OPENAI_API_KEY)        │                             │
│  │       OU Fallback Keywords                  │                             │
│  │    C) "pedido" está nos directTerms         │ ← NOVO!                     │
│  │       → Busca por título/conteúdo           │                             │
│  └─────────────────────────────────────────────┘                             │
│         │                                                                     │
│         ▼                                                                     │
│  ┌─────────────────────────────────────────────┐                             │
│  │ 4. Encontra artigos:                        │                             │
│  │    - "como sei que meu pedido foi enviado"  │                             │
│  │    - "fiz uma venda porem não estou..."     │                             │
│  │    Boost título: +0.15 → similarity ~0.65   │ ← NOVO!                     │
│  └─────────────────────────────────────────────┘                             │
│         │                                                                     │
│         ▼                                                                     │
│  ┌─────────────────────────────────────────────┐                             │
│  │ 5. Score de confiança:                      │                             │
│  │    ANTES: 0.35 (abaixo de 0.40) → HANDOFF   │                             │
│  │    DEPOIS: 0.55 (acima de 0.30) → RESPONDE  │ ← CORREÇÃO!                 │
│  └─────────────────────────────────────────────┘                             │
│         │                                                                     │
│         ▼                                                                     │
│  ┌─────────────────────────────────────────────┐                             │
│  │ 6. Gerar resposta com:                      │                             │
│  │    - temperature: 0 (preciso)               │ ← CORRIGIDO!                │
│  │    - max_tokens: 400                        │                             │
│  │    - Contexto KB incluído no prompt         │                             │
│  └─────────────────────────────────────────────┘                             │
│         │                                                                     │
│         ▼                                                                     │
│  ✅ IA responde com base nos artigos encontrados                              │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Resposta às Suas Perguntas

### 1. "A IA está consultando todas as bases?"
**Resposta**: Sim, a config está correta (`knowledge_base_paths: null` = Acesso Global). Mas os thresholds de similaridade estavam muito altos, fazendo a IA ignorar artigos que poderiam ser úteis.

### 2. "A temperatura atualizou só para mim ou para o agente?"
**Resposta**: A temperatura foi salva no banco (`temperature: 0`), MAS o código tinha um **BUG** que ignorava temperature=0 e usava 0.7. A correção `||` → `??` resolve isso.

### 3. "A Base Global é tudo oq?"
**Resposta**: `knowledge_base_paths: null` significa **ACESSO GLOBAL = TODOS os 38 artigos** publicados (19 Importado + 10 Manual + 7 Treinamento IA + 1 Produto + 1 Suporte). Isso está correto na sua config.

---

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Temperature usada | 0.7 (fallback incorreto) | 0 (config real) |
| Artigos encontrados para "pedidos" | 0-1 (threshold alto) | 3-5 (threshold relaxado + boost) |
| Score de confiança | ~0.30-0.40 (handoff) | ~0.50-0.65 (responde) |
| Comportamento | Handoff rápido + resposta genérica | Consulta KB + resposta contextual |
