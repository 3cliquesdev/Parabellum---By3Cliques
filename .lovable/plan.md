

## Plano: Corrigir 5 Problemas Identificados

### Diagnostico Completo

Analisei os logs e codigo detalhadamente. Encontrei os seguintes problemas:

| # | Problema | Causa Raiz | Impacto |
|---|----------|-----------|---------|
| 1 | IA transferindo errado | Modo RAG Estrito ativo (85% threshold) | Handoff automatico quando KB nao tem resposta |
| 2 | IA nao usando persona corretamente | Modo Estrito sobrescreve config | GPT-4o exclusivo ignora persona selecionada |
| 3 | Chat Flow "pre carnaval" nao funciona | Match por substring "Ola" captura tudo | Qualquer mensagem com "Ola" ativa o fluxo errado |
| 4 | Busca por nome no Inbox nao funciona | Logica de filtro OK mas dados podem estar nulos | Contatos sem nome cadastrado |
| 5 | IA nao aprende das conversas | Nao existe sistema de aprendizado implementado | Precisa implementar feedback loop |

---

### Evidencias dos Logs

**Chat Flow fazendo match ERRADO:**
```text
[process-chat-flow] userMessage: "Olá, vim pelo site e gostaria de atendimento"
[process-chat-flow] Match direto (msg contém trigger): "Olá vim pelo email..."
[process-chat-flow] Matched flow: Fluxo de Carnaval   <-- ERRADO!
```

O problema: O trigger e "Olá vim pelo email e gostaria de saber da promoção de pré carnaval"
Mas o matching faz `messageNorm.includes(triggerNorm)` - e a mensagem "Olá, vim pelo site" contem a substring "ola vim pelo" que esta no trigger.

**Modo RAG Estrito forcando handoff:**
```text
[ai-autopilot-chat] 🎯 STRICT RAG MODE ATIVO - Usando GPT-4o exclusivo
[ai-autopilot-chat] Artigos filtrados: { total: 5, highConfidence: 0, threshold: 0.8 }
[ai-autopilot-chat] 🚨 STRICT RAG: Handoff necessario - Nenhum artigo com confiança >= 80%
```

---

### Parte 1: Desativar Modo RAG Estrito (Resolve Problemas 1 e 2)

O modo RAG Estrito esta ativo no banco:

```sql
ai_strict_rag_mode = true
```

**Opcao A - Desativar completamente (recomendado para agora):**

Alterar no banco:
```sql
UPDATE system_configurations 
SET value = 'false' 
WHERE key = 'ai_strict_rag_mode';
```

Isso vai:
- Restaurar uso do modelo configurado (OpenAI GPT-5-mini)
- Restaurar a persona selecionada
- Usar threshold normal de 70% ao inves de 85%
- Parar de forcar handoff quando KB nao tem resposta perfeita

**Opcao B - Ajustar thresholds (se quiser manter modo estrito):**

Modificar constantes no codigo:
```typescript
// supabase/functions/ai-autopilot-chat/index.ts
const STRICT_SCORE_MINIMUM = 0.70;  // Antes: 0.85
const STRICT_SIMILARITY_THRESHOLD = 0.60;  // Antes: 0.80
```

---

### Parte 2: Corrigir Match de Chat Flow (Resolve Problema 3)

**Problema:** O match direto verifica se a mensagem normalizada **contem** o trigger normalizado, mas isso causa falsos positivos quando o trigger e longo.

**Arquivo:** `supabase/functions/process-chat-flow/index.ts` (linhas 524-528)

```typescript
// ANTES (PROBLEMATICO):
if (messageNorm.includes(triggerNorm)) {
  matchedFlow = flow;
  break;
}

// DEPOIS (CORRIGIDO):
// Para triggers longos (>30 chars), exigir match bidirecional
if (triggerNorm.length < 30) {
  // Keyword curto: match exato ou inclusao
  if (messageNorm.includes(triggerNorm) || triggerNorm === messageNorm) {
    matchedFlow = flow;
    break;
  }
} else {
  // Trigger longo: mensagem deve conter palavras-chave ESPECIFICAS
  // "pre carnaval", "promocao" - nao apenas "ola vim pelo"
  const essentialKeywords = triggerNorm.split(/\s+/).filter(w => 
    w.length > 4 && !['pelo', 'email', 'site', 'gostaria', 'saber'].includes(w)
  );
  const matchedEssentials = essentialKeywords.filter(k => messageNorm.includes(k));
  
  // Exigir pelo menos 2 keywords essenciais
  if (matchedEssentials.length >= 2) {
    matchedFlow = flow;
    break;
  }
}
```

**Alternativa mais simples - Adicionar keywords curtas ao fluxo:**

Atualizar o trigger do "Fluxo de Carnaval" para incluir keywords especificas:

```sql
UPDATE chat_flows 
SET trigger_keywords = '["pre carnaval", "promoção carnaval", "promoção pré-carnaval", "vim pelo email promocao"]'
WHERE id = 'adb17db7-d0ba-48c1-b30d-90724353706e';
```

---

### Parte 3: Verificar Busca por Nome (Problema 4)

A logica de busca no `useInboxView.tsx` (linhas 164-175) esta correta:

```typescript
result = result.filter(item => 
  item.contact_name?.toLowerCase().includes(searchLower) ||
  item.contact_email?.toLowerCase().includes(searchLower) ||
  item.contact_phone?.toLowerCase().includes(searchLower)
);
```

**Possiveis causas:**
1. `contact_name` pode estar NULL na view `inbox_view`
2. A view pode nao estar sincronizada com a tabela `contacts`

**Verificar:**
```sql
-- Checar se contact_name esta populado
SELECT conversation_id, contact_name, contact_email 
FROM inbox_view 
WHERE contact_name IS NULL 
LIMIT 10;

-- Checar se filtro funciona
SELECT conversation_id, contact_name 
FROM inbox_view 
WHERE contact_name ILIKE '%ronny%';
```

---

### Parte 4: Sistema de Aprendizado da IA (Problema 5)

**Status atual:** A IA NAO aprende automaticamente das conversas.

O sistema atual tem:
- Few-shot examples manuais (`ai_training_examples`)
- Knowledge Base estatica (`kb_articles`)
- Cache de respostas (`ai_response_cache`)

**Para implementar aprendizado real, seria necessario:**

1. **Feedback Loop** - Agentes marcam respostas como "boa" ou "ruim"
2. **Extracao de Conhecimento** - Extrair Q&A de conversas resolvidas
3. **Fine-tuning** - Nao suportado pelo Lovable AI Gateway

**Implementacao sugerida (NOVA FEATURE - nao vou implementar agora):**

```typescript
// Tabela: ai_conversation_learnings
interface ConversationLearning {
  id: string;
  conversation_id: string;
  customer_question: string;
  agent_answer: string;
  quality_score: number; // 1-5 dado pelo agente
  extracted_at: Date;
  promoted_to_kb: boolean; // Se foi transformado em artigo KB
}
```

---

### Arquivos a Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| Migration SQL | Executar | `ai_strict_rag_mode = false` |
| Migration SQL | Executar | Atualizar triggers do Fluxo Carnaval |
| `supabase/functions/process-chat-flow/index.ts` | Modificar | Melhorar logica de match para triggers longos |

---

### Ordem de Implementacao

1. **Imediato (Migration SQL):**
   - Desativar `ai_strict_rag_mode`
   - Adicionar keywords curtas ao Fluxo Carnaval

2. **Codigo:**
   - Melhorar logica de match no `process-chat-flow`
   - Adicionar log para diagnosticar busca por nome

3. **Futuro (backlog):**
   - Sistema de feedback/aprendizado
   - Dashboard de qualidade de respostas

---

### Resultado Esperado

| Problema | Antes | Depois |
|----------|-------|--------|
| IA transferindo errado | Threshold 85% forca handoff | Threshold normal 70%, responde mais |
| Persona ignorada | GPT-4o exclusivo | Modelo configurado respeitado |
| Chat Flow Carnaval | Match errado com qualquer "Ola" | Match apenas com keywords essenciais |
| Busca por nome | Possivel falha | Diagnostico + correcao se necessario |
| IA aprendendo | Nao implementado | Feature futura planejada |

