

# Auditoria Total do Sistema Parabellum/Nexxo AI

## Resumo Executivo

Foram identificados **4 problemas ativos** e **2 categorias de alertas de segurança** no linter do banco de dados.

---

## 1. BUG ATIVO: Email Webhook falhando (PRIORIDADE ALTA)

**Sintoma:** Logs mostram `Customer ID not found in email tags` repetidamente.

**Causa raiz:** Os emails são enviados com a tag `contact_id`, mas o `email-webhook` busca pela tag `customer_id`:
```
// Enviado: tags: { contact_id: "2b46d3a4-...", ... }
// Webhook procura: emailData.tags?.find(tag => tag.name === 'customer_id')
```

**Correção:** Alterar a linha 147 de `email-webhook/index.ts` para buscar `contact_id` em vez de `customer_id`, ou aceitar ambos com fallback.

---

## 2. BUG VISUAL: React Flow warnings no editor de fluxos (PRIORIDADE MEDIA)

**Sintoma:** Console mostra `Couldn't create edge for source handle id: "undefined"` para edges `e_20_30` a `e_27_30`.

**Causa raiz:** No Master Flow V4, existem 8 edges saindo de nós `TransferNode` para `node_30_encerramento`. Porém `TransferNode` usa `showSourceHandle={false}` e não define handles customizados. Edges sem `sourceHandle` em nós sem handle default geram o warning.

**Correção:** Remover essas 8 edges do `flow_definition` do V4 (nós de transferencia sao terminais, nao precisam de edges de saida), OU adicionar um source handle ao TransferNode.

---

## 3. GUARD APLICADO: Resposta vazia da IA (CORRIGIDO)

Os 2 guards de resposta vazia foram implementados com sucesso:
- Guard 1 no `callStrictRAG` (linha 4243-4247) -- forca handoff
- Guard 2 no bloco strict response (linha 4940-4968) -- fallback greeting

**Status: OPERACIONAL**

---

## 4. BASE DE CONHECIMENTO: Migracão confirmada

15 categorias padronizadas com **211 artigos** total:
- "Sobre a Empresa e Servicos": 17 artigos (migrado com sucesso)
- Maior categoria: "Logistica e Pedidos" com 42 artigos

**Status: OK**

---

## 5. ALERTAS DO LINTER DE SEGURANCA

### 5.1 Tabela sem RLS policies: `message_buffer`
- RLS esta **habilitado** mas **sem policies** definidas
- Usada pelo webhook de WhatsApp para batching de mensagens
- **Acao:** Criar policies (service_role ALL + authenticated SELECT)

### 5.2 Policies "USING (true)" em operacoes de escrita (~28 tabelas)
Tabelas com policies permissivas demais em INSERT/UPDATE/DELETE:
- `contact_tags` (DELETE com true para authenticated)
- `conversation_dispatch_jobs` (ALL com true para **public**)
- `conversation_tags` (ALL com true para authenticated)
- `form_board_integrations` (DELETE/INSERT/UPDATE com true para **public**)
- `organization_phones` (ALL com true para authenticated)
- Varias outras...

**Risco critico:** `conversation_dispatch_jobs` e `form_board_integrations` com policies `true` para `public` (nao autenticado) permitem que qualquer pessoa manipule dados.

### 5.3 Functions sem search_path (~40 funcoes)
Funcoes SQL sem `SET search_path = public` podem ser vulneraveis a search_path injection.

### 5.4 Security Definer View (1 ocorrencia)
Uma view com SECURITY DEFINER executa com privilegios do criador.

---

## 6. EDGE FUNCTIONS: Status operacional

| Funcao | Status |
|---|---|
| `process-buffered-messages` | OK - sem pendencias |
| `dispatch-conversations` | OK - agentes offline (normal fora do horario) |
| `email-webhook` | BUG - tag `customer_id` vs `contact_id` |
| `process-pending-deal-closures` | OK |
| `process-playbook-queue` | OK |

---

## Plano de Correcao (por prioridade)

### Sprint 1: Bugs ativos
1. **Fix email-webhook**: Alterar busca de tag para `contact_id` (ou fallback `customer_id` -> `contact_id`)
2. **Fix React Flow edges**: Remover 8 edges orfas do V4 (transfer -> encerramento)

### Sprint 2: Seguranca
3. **Fix `message_buffer`**: Adicionar RLS policies
4. **Fix policies publicas**: Restringir `conversation_dispatch_jobs` e `form_board_integrations` de `public` para `service_role`/`authenticated`

### Sprint 3: Hardening
5. **Fix search_path** em funcoes SQL criticas
6. **Revisar Security Definer view**

