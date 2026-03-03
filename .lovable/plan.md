

# Diagnóstico: Base de Conhecimento não está sendo usada pela IA

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Problema Identificado

A IA **está** recebendo os artigos com embeddings corretos (40/40 artigos indexados), mas o **filtro de categorias do Chat Flow** está bloqueando a maioria deles.

### Evidência nos logs:

```text
📂 KB Categories:
  flow_categories: ["Cancelamento", "Importado", "Manual da 3 Cliques", "Produto"]
  category_source: "Chat Flow (4 categorias)"

🔒 Filtro de categoria: 0 → 0 artigos   ← TUDO FILTRADO!
⚠️ Nenhum artigo relevante após filtros
🎯 CONFIDENCE SCORE: score: "0%", reason: "Nenhum documento relevante encontrado na KB"
```

### Categorias no banco vs. categorias permitidas pelo flow:

```text
Categorias existentes:        Permitidas no flow:
├── Cancelamento       ✅     ├── Cancelamento     ✅
├── Importado          ✅     ├── Importado        ✅
├── Manual da 3 Cliques ✅    ├── Manual da 3 Cliques ✅
├── Produto            ✅     ├── Produto          ✅
├── Suporte            ❌     │
└── Treinamento IA     ❌     │
```

Artigos nas categorias "Suporte" e "Treinamento IA" **nunca chegam à IA** porque o nó `ai_response` no Chat Flow só permite 4 categorias.

## Causa Raiz

O nó `ai_response` (`ia_entrada`) no Master Flow tem as categorias RAG configuradas manualmente com apenas 4 categorias. Artigos novos criados em "Suporte" ou "Treinamento IA" são invisíveis para a IA.

## Solução

Há duas opções:

### Opção A: Adicionar as categorias faltantes no Chat Flow Editor (sem código)
Abrir o Master Flow → selecionar o nó `ia_entrada` → na seção "Fontes de Dados RAG" → adicionar "Suporte" e "Treinamento IA" às categorias permitidas.

### Opção B: Tornar a busca mais resiliente no código (upgrade)
Quando o nó `ai_response` não define categorias específicas OU quando a persona tem `knowledge_base_paths: null` (acesso global), ignorar o filtro de categorias do flow e buscar em TODAS as categorias. Isso evita que artigos novos em categorias novas fiquem invisíveis.

**Mudança no `ai-autopilot-chat/index.ts`**: na seção de filtro de categorias (~linha 3710-3720), quando `persona.knowledge_base_paths` é null E as categorias vêm do flow, fazer um merge que inclua todas as categorias existentes em vez de filtrar restritivamente.

## Recomendação

Opção A resolve imediato (basta editar o flow no canvas). Opção B é um upgrade de resiliência para evitar que isso aconteça novamente com categorias futuras.

Ambas podem ser feitas em paralelo.

