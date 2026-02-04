
Analisei o projeto atual e sigo as regras da base de conhecimento.

## 1) Diagnóstico (por que “ninguém acha conversa” e quando “só aparece encerrada”)

### 1.1 Busca no Inbox hoje (fluxo real)
- O campo “Buscar por nome, email, telefone, ID...” (InboxFilterPopover) alimenta `filters.search`.
- Quando `filters.search.trim().length >= 2`, a tela `/inbox` usa **`useInboxSearch(filters.search)`** como fonte de verdade (não usa o array do inbox carregado).
- `useInboxSearch` consulta `public.inbox_view` com `.limit(100)` e ordena:

```ts
.order("status", { ascending: true })
.order("last_message_at", { ascending: false })
```

### 1.2 Bug principal: ordenação por status está invertida na prática
O comentário do código assume que `status ASC` coloca “open” antes de “closed”, mas alfabeticamente:
- `"closed"` vem antes de `"open"`

Então, com `limit(100)`, se houver muitas fechadas, a busca devolve **majoritariamente fechadas**, dando a impressão de que “só aparece encerrada” e “não acha as ativas”.

### 1.3 Gap funcional: busca por ID não está implementada no banco
`useInboxSearch` atualmente busca apenas por:
- `contact_name`, `contact_email`, `contact_phone`

Mas a UI promete buscar por “ID…”, e a regra do negócio pede localizar por:
- **UUID da conversa** (`conversation_id` na view)
- **UUID do contato** (`contact_id` na view)

Isso explica “nenhum jeito funciona” quando tentam buscar por ID.

### 1.4 Robustez: números/telefones com formatação
Os usuários costumam digitar telefone com `+55`, espaços, parênteses, hífen etc. A busca atual não normaliza o termo, então pode falhar mesmo quando existe a conversa.

## 2) Objetivo da correção definitiva (upgrade, sem regressão)
1) Garantir que a busca encontre conversas **ativas** com prioridade.
2) Suportar busca por **UUID de conversa/contato** (sem usar ILIKE em UUID para não quebrar).
3) Tornar busca por telefone **tolerante** a formatação.
4) Manter a segurança: busca respeita as políticas RLS já implementadas (admin/manager vê tudo; agentes veem o que podem ver).

## 3) Mudanças propostas (frontend) — sem alterar comportamento existente fora da busca

### 3.1 Ajustar `src/hooks/useInboxSearch.tsx`
Implementar uma busca “inteligente” por tipo de termo:

**(A) Detectar UUID**
- Se o termo bater com regex de UUID, fazer match por igualdade:
  - `conversation_id.eq.<uuid>` OR `contact_id.eq.<uuid>`
- Em paralelo, ainda permitir nome/email/telefone (opcional), mas o essencial é `eq`.

**(B) Detectar email**
- Se contiver `@`, priorizar `contact_email.ilike.%term%`.

**(C) Detectar número/telefone**
- Normalizar: remover tudo que não é dígito.
- Buscar por `contact_phone.ilike.%<digits>%`.
- (Opcional) tentar variações removendo prefixo país (ex.: se começa com `55`, também buscar sem `55`) para tolerância.

**(D) Ordenação correta (corrigindo o bug do status)**
- Remover a ordenação por `status` no banco (pois é lexical e enganosa).
- Ordenar no banco por `last_message_at DESC` (mais recente primeiro).
- Depois **reordenar no client** com prioridade:
  1. status `open`
  2. status `pending` (ou equivalentes abertos do seu enum)
  3. status `closed`
- Dentro de cada grupo, manter `last_message_at DESC`.

**(E) Ajustar `limit`**
- Subir `limit` de 100 para 300 (ou 200) para reduzir “falso negativo” quando há muitas fechadas.
- Como a busca já é debounced e `enabled` só com >=2 chars, isso é um upgrade de usabilidade. (Se performance ficar sensível, retornamos a 100.)

**(F) Logs de diagnóstico opcionais**
- Logar no console apenas em DEV (ou com flag localStorage, como já existe no inbox realtime) o “modo” da busca (uuid/email/phone/text) e quantidade retornada.

### 3.2 Pequeno ajuste de UX (Inbox.tsx)
Hoje, quando há busca ativa e `searchResults` ainda não carregou, o código retorna `[]` (linha ~276-279), causando sensação de “sumiu tudo”.
Upgrade sem regressão:
- Exibir estado de loading (passar `isLoading={searchLoading}` para `ConversationList`) quando busca ativa.
- Manter lista vazia, mas com skeleton/loading para deixar claro que está buscando.

## 4) Checagem de backend/políticas (somente validação, sem mudanças)
Como `useInboxSearch` consulta `inbox_view`, a visibilidade depende de:
- `policy optimized_inbox_select` em `public.inbox_view` (já está usando `has_any_role(...)` SECURITY DEFINER)
- Isso deve permitir Admin/Manager ver tudo e agentes verem suas regras.

Vamos apenas validar com leitura:
- Para Admin: `select count(*) from inbox_view` e testar uma query com `conversation_id.eq.<uuid>` via API (observando no Network tab).

## 5) Testes obrigatórios (antes de entregar)
1) **Console sem erros** ao buscar por:
   - nome
   - email
   - telefone com formatação (`+55 (61) 9....`)
   - UUID completo de conversa
   - UUID completo de contato
2) **Preview e Published**: repetir os testes acima nos dois ambientes.
3) **Regressão**:
   - Filtros “Minhas”, “Não respondidas”, “SLA Excedido”, “Fila IA/Humana” continuam funcionando.
   - Realtime não “pisca” nem remove conversas indevidamente.
4) **Performance**:
   - Busca não travar; debounce mantendo fluidez.
5) **Edge cases**:
   - Termos curtos (<2) não disparam busca.
   - Sem internet: UI não quebra (exibe erro/estado vazio apropriado).
   - Permissões: agente comum não consegue achar conversa fora da visibilidade dele.

## 6) Rollback rápido
- Reverter `useInboxSearch` para a versão anterior (mantendo o arquivo antigo como referência via git history do Lovable).
- Reverter o comportamento de loading no `Inbox.tsx` (voltar a render vazio durante carregamento).

## 7) Arquivos que serão alterados
- `src/hooks/useInboxSearch.tsx` (principal: lógica + ordenação + suporte a UUID/telefone)
- `src/pages/Inbox.tsx` (ajuste de loading quando busca ativa)
- (Opcional) `src/components/ConversationList.tsx` apenas se precisarmos melhorar mensagem/skeleton em busca ativa (preferência: reutilizar `isLoading` já existente)

## 8) Critérios de aceite (“correção definitiva”)
- Admin consegue localizar conversa ativa por: telefone, email, nome e UUID.
- A busca não fica “presa” mostrando só encerradas quando existem abertas.
- “156 em todas” passa a ter correspondência visível ao buscar (quando o termo existe).
- Sem regressões nas regras críticas já existentes (kill switch, shadow mode, distribuição, CSAT guard, cache/realtime).
