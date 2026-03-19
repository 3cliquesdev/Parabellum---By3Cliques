

# Diagnóstico e Padronização dos Artigos da Base de Conhecimento

## O Problema

Seus dados estão **inconsistentes** — e isso afeta diretamente a qualidade da IA:

| Situação | Qtd artigos |
|----------|------------|
| Sem `problem` e sem `solution`, com "Pergunta/Resposta" dentro do `content` | **206** |
| Sem `problem` e sem `solution`, sem formato P/R no content | **21** |
| Com `problem` e `solution` preenchidos | **3** (apenas os de `passive_learning`) |

### Por que acontece?
- Os **206 artigos importados manualmente** têm o formato "Pergunta: ... Resposta: ..." embutido no campo `content`, mas os campos `problem` e `solution` estão **vazios**.
- Apenas **3 artigos** (gerados por aprendizado passivo) preencheram `problem` e `solution` corretamente.

### É eficaz?
**Parcialmente.** A IA hoje usa **apenas `title` + `content`** para montar o contexto RAG (linha 5869 do autopilot). Os campos `problem`, `solution` e `when_to_use` são **completamente ignorados**. Então o formato "Pergunta/Resposta" dentro do content funciona, mas é desorganizado e impede filtragem/auditoria.

## Solução Proposta

### 1. Migração automática dos 206 artigos
Criar um script (edge function ou migration) que:
- Detecta artigos com padrão "Pergunta: X Resposta: Y" no `content`
- Extrai e popula `problem` com a pergunta e `solution` com a resposta
- Mantém o `content` original intacto (para não quebrar RAG)

### 2. Enriquecer o contexto RAG
Atualizar a linha 5869 do `ai-autopilot-chat/index.ts` para incluir os campos estruturados:

```text
Antes:  **{title}**\n{content}
Depois: **{title}**\n{content}\n\nQuando usar: {when_to_use}\nSolução: {solution}
```

Isso dá mais contexto à IA sem quebrar nada.

### 3. Atualizar o `AuditArticleEditDialog` 
Garantir que o dialog de edição rápida sempre mostre e permita editar `problem`, `solution` e `when_to_use` — para que novos artigos sejam criados no formato correto.

### Arquivos a alterar
- `supabase/functions/ai-autopilot-chat/index.ts` — enriquecer contexto RAG (1 linha)
- Nova migration SQL — extrair Pergunta/Resposta → `problem`/`solution`
- `src/components/knowledge/AuditArticleEditDialog.tsx` — garantir campos visíveis

### Resultado esperado
- 100% dos artigos terão `problem` e `solution` preenchidos
- IA terá contexto mais rico e estruturado
- Auditoria e filtragem facilitadas

