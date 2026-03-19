

# Auditoria Completa — Status e Problemas Pendentes

## Resumo do Estado Atual

| Métrica | Valor | Status |
|---------|-------|--------|
| Total de artigos | **230** | — |
| Com `problem` + `solution` | **209** (91%) | ✅ |
| Sem `problem` + `solution` | **21** (9%) | ⚠️ |
| Com embedding | **228** (99%) | ✅ |
| Sem embedding | **2** | ⚠️ |
| Sem `product_tags` | **201** (87%) | ⚠️ |
| Categorias órfãs | **0** reais | ✅ (personas sem filtro = acesso global) |
| RAG enriquecido (problem/solution/when_to_use) | Implementado | ✅ |
| OTP fallback fix (linha 7766) | Implementado | ✅ |
| OTP prompt sync (linhas 6729/6747) | Implementado | ✅ |

---

## Problemas Pendentes (3)

### 1. 21 artigos sem `problem` e `solution`
- **13 manuais**: Artigos longos estilo "manual" (ex: "Abrangência e Uso do Padrão de Atendimento", "Pós-Venda: Defeito, Envio Errado...") — não seguem formato Pergunta/Resposta, por isso a migration não os capturou
- **8 sandbox_training**: Artigos duplicados de treinamento (ex: "Boa noite", "Agora quero saber sobre loja propria") — duplicatas que provavelmente deveriam ser removidas ou consolidadas
- **Impacto**: Baixo. O `content` desses artigos já é rico e usado pelo RAG. Os campos `problem`/`solution` são um plus.

**Fix proposto**: Migration SQL que:
- Para os 13 manuais: extrai o título como `problem` e gera um `solution` resumido do conteúdo (primeiros 300 chars)
- Para os 8 sandbox_training duplicados: avaliar remoção (são duplicatas de conteúdo idêntico)

### 2. 2 artigos sem embedding
- `Cliente não consegue ver o pedido devido à mensalidade vencida`
- `Cliente precisa de informações sobre planos de assinatura`
- **Impacto**: Esses artigos só aparecem via busca por keyword, nunca por similaridade semântica.
- São artigos do `passive_learning` com conteúdo curto.

**Fix proposto**: Regenerar embeddings chamando a edge function que processa embeddings, ou marcar `embedding_generated = false` para que o próximo ciclo os capture.

### 3. 201 artigos sem `product_tags`
- **87% dos artigos** não têm product_tags
- **Impacto**: Quando um fluxo tem filtro por produto ativo, a query RAG inclui `product_tags.eq.{}` como fallback, então artigos sem tags AINDA aparecem. Não é um bloqueio, mas reduz a precisão da filtragem.

**Fix proposto**: Migration que atribui tags baseadas na `category` do artigo (mapeamento category → product_tag). Isso requer um mapeamento definido por vocês. Alternativamente, manter como está (sem impacto funcional imediato).

---

## O que JÁ está funcionando (validado no código)

1. ✅ RAG enriquecido com `problem`, `solution`, `when_to_use` (linha 5870-5878)
2. ✅ RPC `match_knowledge_articles` retorna os 3 novos campos
3. ✅ Keyword fallback query busca `problem, solution, when_to_use` (linha 4675)
4. ✅ OTP fallback com guard `hasRecentOTPVerification` (linha 7766-7776)
5. ✅ `otpVerifiedInstruction` reconhece OTP transversal (linha 6747)
6. ✅ `financialGuardInstruction` desativa com OTP verificado (linha 6729)
7. ✅ Personas com acesso global (sem restrição por categoria)

---

## Plano de Ação

### Prioridade 1: Fix dos 21 artigos sem problem/solution
- Migration SQL para popular `problem` = título e `solution` = primeiros 300 chars do content nos 13 manuais
- Avaliar remoção dos 8 sandbox_training duplicados

### Prioridade 2: Regenerar embeddings dos 2 artigos
- UPDATE para marcar `embedding_generated = false` nos 2 artigos, permitindo que o próximo ciclo os processe

### Prioridade 3 (opcional): product_tags
- Depende de um mapeamento category→product definido pelo time
- Sem impacto funcional imediato (fallback já cobre)

**Arquivos a alterar**: Apenas migrations SQL (sem alterações em código).

