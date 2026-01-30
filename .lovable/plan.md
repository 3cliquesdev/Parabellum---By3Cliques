

# Plano de Implementação: Fase 2 — Aprendizado Passivo Controlado

## Resumo Executivo

Esta fase evolui o sistema de aprendizado automático para garantir que **todo conhecimento extraído passe por critérios rigorosos de elegibilidade e curadoria humana**. O objetivo é criar um ciclo de aprendizado seguro, estruturado e auditável.

---

## Diagnóstico do Estado Atual

| Componente | Status | Observação |
|------------|--------|------------|
| `ai-auto-trainer` | ✅ Existe | CRON hora em hora, extrai de conversas fechadas |
| Critério CSAT ≥ 4 | ⚠️ Parcial | Verifica rating, mas não bloqueia se sem rating |
| Prompt de extração | ⚠️ Básico | Falta campos estruturados `when_to_use`, `when_not_to_use` |
| `knowledge_articles` | ⚠️ Genérico | Falta colunas `problem`, `solution`, `source_conversation_id`, `confidence_score`, `department_id` |
| Curadoria UI | ❌ Não existe | Link para `/knowledge?filter=draft` existe mas filtro não implementado |
| Versionamento KB | ❌ Não existe | Sobrescreve artigos diretamente |
| Gatilho CSAT | ❌ Fraco | Processa conversas sem validar rating explicitamente |

---

## Arquitetura da Solução

```text
┌─────────────────────────┐
│   Conversa Encerrada    │
│   (close-conversation)  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐         ┌─────────────────────────┐
│   CSAT Recebido (1-5)   │────────►│   Gatilho de Elegibil.  │
│   (handle-whatsapp)     │         │   CSAT ≥ 4?             │
└─────────────────────────┘         │   Intervenção manual?   │
                                    │   Status = closed?      │
                                    └───────────┬─────────────┘
                                                │
                                    ┌───────────▼─────────────┐
                                    │   ai-auto-trainer       │
                                    │   (CRON - 1x/hora)      │
                                    │   OU                    │
                                    │   extract-knowledge...  │
                                    │   (on-demand após CSAT) │
                                    └───────────┬─────────────┘
                                                │
                                    ┌───────────▼─────────────┐
                                    │   Prompt Estruturado    │
                                    │   - problem             │
                                    │   - solution            │
                                    │   - when_to_use         │
                                    │   - when_not_to_use     │
                                    │   - tags                │
                                    └───────────┬─────────────┘
                                                │
                                    ┌───────────▼─────────────┐
                                    │   knowledge_candidates  │
                                    │   status = 'pending'    │
                                    │   confidence_score      │
                                    └───────────┬─────────────┘
                                                │
                                    ┌───────────▼─────────────┐
                                    │   Painel de Curadoria   │
                                    │   (Frontend)            │
                                    │   Revisar / Editar /    │
                                    │   Aprovar / Rejeitar    │
                                    └───────────┬─────────────┘
                                                │
                            ┌───────────────────┴───────────────────┐
                            │                                       │
                   ┌────────▼────────┐                    ┌─────────▼────────┐
                   │  status=approved │                    │  status=rejected │
                   │  Move para KB    │                    │  Arquiva / Descarta│
                   └────────┬─────────┘                    └───────────────────┘
                            │
                   ┌────────▼─────────┐
                   │ knowledge_versions│
                   │ (Histórico)       │
                   └──────────────────┘
```

---

## Alterações Detalhadas

### 1. Criar Tabela `knowledge_candidates` (Nova)

**Tipo:** Migração SQL

Esta tabela armazena conhecimento extraído **antes** da aprovação:

```sql
CREATE TABLE public.knowledge_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem TEXT NOT NULL,
  solution TEXT NOT NULL,
  when_to_use TEXT,
  when_not_to_use TEXT,
  category TEXT DEFAULT 'Aprendizado Passivo',
  tags TEXT[] DEFAULT '{}',
  department_id UUID REFERENCES departments(id),
  source_conversation_id UUID REFERENCES conversations(id),
  confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
  extracted_by TEXT, -- 'ai-auto-trainer', 'extract-knowledge-from-chat', 'manual'
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.knowledge_candidates ENABLE ROW LEVEL SECURITY;

-- Índices
CREATE INDEX idx_knowledge_candidates_status ON knowledge_candidates(status);
CREATE INDEX idx_knowledge_candidates_source ON knowledge_candidates(source_conversation_id);
```

### 2. Criar Tabela `knowledge_versions` (Nova)

**Tipo:** Migração SQL

Para manter histórico de alterações na KB:

```sql
CREATE TABLE public.knowledge_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_article_id UUID NOT NULL REFERENCES knowledge_articles(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT[],
  changed_by UUID REFERENCES auth.users(id),
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.knowledge_versions ENABLE ROW LEVEL SECURITY;

-- Índice para buscar versões de um artigo
CREATE INDEX idx_knowledge_versions_article ON knowledge_versions(knowledge_article_id, version DESC);
```

### 3. Atualizar Tabela `knowledge_articles`

**Tipo:** Migração SQL

Adicionar colunas estruturadas:

```sql
ALTER TABLE public.knowledge_articles 
  ADD COLUMN IF NOT EXISTS problem TEXT,
  ADD COLUMN IF NOT EXISTS solution TEXT,
  ADD COLUMN IF NOT EXISTS when_to_use TEXT,
  ADD COLUMN IF NOT EXISTS when_not_to_use TEXT,
  ADD COLUMN IF NOT EXISTS source_conversation_id UUID REFERENCES conversations(id),
  ADD COLUMN IF NOT EXISTS confidence_score INTEGER,
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id),
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
```

### 4. Atualizar Edge Function: `ai-auto-trainer`

**Arquivo:** `supabase/functions/ai-auto-trainer/index.ts`

#### 4.1 Gatilho de Elegibilidade (CRÍTICO)

```typescript
// NOVO: Critérios rigorosos de elegibilidade
const eligibleConversations = (successConversations || []).filter((c: any) => {
  const rating = c.conversation_ratings?.[0]?.rating;
  
  // Critério 1: CSAT >= 4 (OBRIGATÓRIO)
  if (!rating || rating < 4) {
    console.log(`[ai-auto-trainer] Conversa ${c.id} pulada: CSAT ${rating || 'null'} < 4`);
    return false;
  }
  
  // Critério 2: Status fechado
  if (c.status !== 'closed') {
    return false;
  }
  
  // Critério 3: Teve intervenção humana (pelo menos 1 mensagem de agente)
  // Será verificado no mineSuccessConversation
  
  return true;
});
```

#### 4.2 Prompt Estruturado

```typescript
const structuredPrompt = `Você é um Agente de Extração de Conhecimento.

Analise este atendimento BEM-SUCEDIDO (CSAT >= 4) e extraia conhecimento REUTILIZÁVEL.

IGNORE COMPLETAMENTE:
- Saudações, agradecimentos, despedidas
- Informações específicas do cliente (nome, CPF, pedido)
- Contexto pessoal ou emocional
- Promessas ou exceções feitas para este cliente

EXTRAIA APENAS:
- Procedimentos técnicos explicados
- Regras de negócio mencionadas
- Soluções para problemas recorrentes
- Políticas da empresa

RETORNE JSON ESTRUTURADO:
{
  "extracted_items": [
    {
      "problem": "Problema em 1 frase clara (máx 150 caracteres)",
      "solution": "Solução objetiva e completa (máx 500 caracteres)",
      "when_to_use": "Quando aplicar esta solução",
      "when_not_to_use": "Quando NÃO aplicar (exceções)",
      "tags": ["tag1", "tag2"]
    }
  ],
  "confidence_score": 0-100,
  "reasoning": "Por que você extraiu isso"
}

Se não houver conhecimento útil, retorne: { "extracted_items": [], "confidence_score": 0 }`;
```

#### 4.3 Salvar em `knowledge_candidates` (não em KB diretamente)

```typescript
// NOVO: Salvar em knowledge_candidates para curadoria
async function saveCandidate(
  supabase: any,
  item: any,
  source: string,
  conversationId: string,
  departmentId?: string
): Promise<{ created: boolean; candidateId?: string }> {
  const { data, error } = await supabase
    .from('knowledge_candidates')
    .insert({
      problem: item.problem,
      solution: item.solution,
      when_to_use: item.when_to_use,
      when_not_to_use: item.when_not_to_use,
      category: item.category || 'Aprendizado Passivo',
      tags: item.tags || [],
      source_conversation_id: conversationId,
      department_id: departmentId,
      confidence_score: item.confidence_score,
      extracted_by: source,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('[ai-auto-trainer] Erro salvando candidato:', error);
    return { created: false };
  }

  return { created: true, candidateId: data.id };
}
```

### 5. Criar Painel de Curadoria (Frontend)

**Arquivo:** `src/pages/KnowledgeCuration.tsx` (Novo)

Interface para gerentes revisarem conhecimento pendente:

- **Lista de Candidatos** com filtros (pendente, aprovado, rejeitado)
- **Card de Revisão** com:
  - Problema original
  - Solução proposta
  - Quando usar / Quando não usar
  - Tags sugeridas
  - Score de confiança (visual)
  - Link para conversa original
- **Ações:**
  - ✅ Aprovar (move para KB)
  - ✏️ Editar e Aprovar
  - ❌ Rejeitar (com motivo)

### 6. Atualizar Página Knowledge.tsx

**Arquivo:** `src/pages/Knowledge.tsx`

- Adicionar filtro por `?filter=draft` da URL
- Implementar filtro por `is_published = false` quando `filter=draft`
- Adicionar tab "Pendentes de Aprovação" que redireciona para `/knowledge/curation`

### 7. Hook `useKnowledgeCandidates`

**Arquivo:** `src/hooks/useKnowledgeCandidates.tsx` (Novo)

```typescript
export function useKnowledgeCandidates(status: 'pending' | 'approved' | 'rejected' | 'all' = 'pending') {
  return useQuery({
    queryKey: ['knowledge-candidates', status],
    queryFn: async () => {
      let query = supabase
        .from('knowledge_candidates')
        .select(`
          *,
          conversations:source_conversation_id (
            id,
            contact:contact_id (first_name, last_name),
            closed_at
          ),
          departments:department_id (name)
        `)
        .order('created_at', { ascending: false });

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}
```

### 8. Mutation `useApproveCandidate`

**Arquivo:** `src/hooks/useApproveCandidate.tsx` (Novo)

```typescript
export function useApproveCandidate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      candidateId, 
      edits 
    }: { 
      candidateId: string; 
      edits?: Partial<KnowledgeCandidate> 
    }) => {
      // 1. Buscar candidato
      const { data: candidate } = await supabase
        .from('knowledge_candidates')
        .select('*')
        .eq('id', candidateId)
        .single();

      if (!candidate) throw new Error('Candidato não encontrado');

      // 2. Criar artigo na KB
      const { data: article } = await supabase
        .from('knowledge_articles')
        .insert({
          title: edits?.problem || candidate.problem,
          content: edits?.solution || candidate.solution,
          problem: edits?.problem || candidate.problem,
          solution: edits?.solution || candidate.solution,
          when_to_use: edits?.when_to_use || candidate.when_to_use,
          when_not_to_use: edits?.when_not_to_use || candidate.when_not_to_use,
          category: edits?.category || candidate.category,
          tags: edits?.tags || candidate.tags,
          source: 'passive_learning',
          source_conversation_id: candidate.source_conversation_id,
          department_id: candidate.department_id,
          confidence_score: candidate.confidence_score,
          is_published: true,
          approved_by: (await supabase.auth.getUser()).data.user?.id,
          approved_at: new Date().toISOString(),
          version: 1,
        })
        .select()
        .single();

      // 3. Atualizar candidato como aprovado
      await supabase
        .from('knowledge_candidates')
        .update({
          status: 'approved',
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', candidateId);

      // 4. Gerar embedding (assíncrono)
      supabase.functions.invoke('generate-article-embedding', {
        body: { articleId: article.id }
      });

      return article;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-candidates'] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-articles'] });
      toast.success('Conhecimento aprovado e publicado!');
    },
  });
}
```

### 9. Atualizar `passive-learning-cron`

**Arquivo:** `supabase/functions/passive-learning-cron/index.ts`

Adicionar validação de CSAT:

```typescript
// NOVO: Validar CSAT antes de processar
const { data: rating } = await supabase
  .from('conversation_ratings')
  .select('rating')
  .eq('conversation_id', conversation.id)
  .maybeSingle();

if (!rating || rating.rating < 4) {
  console.log(`[passive-learning-cron] Conversa ${conversation.id} pulada: CSAT ${rating?.rating || 'null'} < 4`);
  skippedCount++;
  continue;
}
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| Migração SQL | Criar | Tabelas `knowledge_candidates`, `knowledge_versions`, ALTER `knowledge_articles` |
| `supabase/functions/ai-auto-trainer/index.ts` | Modificar | Prompt estruturado, gatilho CSAT, salvar em candidates |
| `supabase/functions/passive-learning-cron/index.ts` | Modificar | Validar CSAT >= 4 |
| `src/pages/KnowledgeCuration.tsx` | Criar | Painel de curadoria |
| `src/pages/Knowledge.tsx` | Modificar | Filtro ?filter=draft, link para curadoria |
| `src/hooks/useKnowledgeCandidates.tsx` | Criar | Hook para candidatos |
| `src/hooks/useApproveCandidate.tsx` | Criar | Mutation para aprovar |
| `src/hooks/useRejectCandidate.tsx` | Criar | Mutation para rejeitar |
| `src/components/settings/AITrainerStatsWidget.tsx` | Modificar | Stats de candidatos pendentes |
| `src/App.tsx` | Modificar | Rota `/knowledge/curation` |

---

## Valores e Regras de Negócio

| Regra | Valor | Justificativa |
|-------|-------|---------------|
| CSAT mínimo para aprendizado | 4 | Evita aprender de atendimentos ruins |
| Confidence mínimo para candidato | 70 | Abaixo disso, descarta |
| Auto-aprovação | Nunca | Sempre curadoria humana |
| Versões mantidas | Todas | Auditoria completa |

---

## Critérios de Aceitação

| Teste | Resultado Esperado |
|-------|-------------------|
| Conversa CSAT 3 | ❌ Não gera candidato |
| Conversa CSAT 5 | ✅ Gera candidato com status pending |
| Aprovação de candidato | ✅ Move para KB com embedding |
| Rejeição de candidato | ✅ Status rejected, motivo salvo |
| Edição na aprovação | ✅ KB reflete edições |
| Filtro ?filter=draft | ✅ Mostra apenas não-publicados |

---

## Garantias de Segurança

- ✅ CSAT >= 4 obrigatório para aprendizado
- ✅ Nada entra na KB sem aprovação humana
- ✅ Histórico de versões mantido
- ✅ Auditoria de quem aprovou/rejeitou
- ✅ Link para conversa original preservado

---

## Ordem de Implementação

1. **Migração SQL**: Criar tabelas `knowledge_candidates` e `knowledge_versions`
2. **Backend**: Atualizar `ai-auto-trainer` com prompt estruturado e salvamento em candidates
3. **Backend**: Atualizar `passive-learning-cron` com validação CSAT
4. **Frontend**: Criar `useKnowledgeCandidates` e mutations
5. **Frontend**: Criar página `KnowledgeCuration.tsx`
6. **Frontend**: Atualizar `Knowledge.tsx` com filtros
7. **Frontend**: Atualizar rota em `App.tsx`
8. **Deploy**: Publicar edge functions

