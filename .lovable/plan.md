

# Auditoria 100% — Tornar ChatFlow Soberano no `ai-autopilot-chat`

## Status Atual (o que JÁ funciona)
- ✅ `persona.system_prompt` injetado (L7174)
- ✅ `buildCollectionMessage` é fonte única de templates de coleta
- ✅ "Cérebro financeiro" removido, delegado ao fluxo/KB
- ✅ Menu A/B hardcoded eliminado
- ✅ SLA parametrizado via `sla_text`/`team_name` no system prompt
- ✅ `TRANSFER_LABELS` busca departamento do banco com fallback estático
- ✅ Cancelamento no `identityWallNote` genérico (sem Kiwify)

---

## Problemas AINDA Encontrados (181 referências "Kiwify" + vendor-specific)

### 🔴 P1 — Email subject hardcoded "Seu Armazém Drop" (L10467)
```
subject: `Re: ${conversation.subject || 'Seu Armazém Drop - Resposta do Suporte'}`
```
**Impacto:** Todo email enviado sem subject mostra nome de outro cliente. Deve usar `persona.name` ou nome da organização.

### 🔴 P2 — Comentários e logs referenciam "Kiwify" como vendor fixo (30+ locais)
- L1117: `// Devolução de pedido Kiwify`
- L1131: `// Kiwify`
- L2929: `// Sempre validar pela base Kiwify`
- L2932: `validando phone+email+CPF contra base Kiwify`
- L3036: `Nenhuma compra Kiwify encontrada`
- L3045: `kiwify_validated=true`
- L3048: `BUSCAR PRODUTOS KIWIFY DO CONTATO`
- L6033: `CANCELAMENTO DE ASSINATURA - Sem OTP (processo Kiwify)`
- L6053: `Cancelamento - Sem OTP, processo Kiwify`
- L6667: `Cancelamento Kiwify -> Sem OTP`
**Impacto:** Confusão em debugging. Devem ser neutros ("validação de compra", "provedor de eventos").

### 🔴 P3 — Internal note do ticket com regras de negócio fixas (L8784-8792)
```
**REGRAS (conforme SLA configurado):**
- Destino: APENAS conta do titular (CPF do cliente)
- PIX de terceiros: CANCELAR solicitação
**CHECKLIST FINANCEIRO:**
- [ ] Verificar saldo disponível
- [ ] Confirmar titularidade da chave PIX
```
**Impacto:** Regras de PIX/titular são específicas do negócio. Devem vir do `ticketConfig.description_template` (já implementado em L8829-8831, mas o fallback L8773-8792 ainda injeta regras fixas).

### 🟡 P4 — `kiwify_events` table queries infraestruturais (L2929-3100)
~170 linhas que consultam `kiwify_events` para validação de compra. Isso é **infraestrutura de CRM** (a tabela existe no banco), não é prompt. Os dados são legítimos, mas os **comentários** devem ser neutros.

### 🟡 P5 — `allowed_sources` inclui `'kiwify'` como tipo (L291, L301, L1282)
O tipo literal `'kiwify'` está na interface `FlowContext.allowed_sources`. Funcional (a tabela existe), mas o nome acopla ao vendor.

---

## Plano de Correção (4 correções)

### Correção 1 — Email subject dinâmico (L10467)
Substituir `'Seu Armazém Drop - Resposta do Suporte'` por:
```typescript
subject: `Re: ${conversation.subject || `${persona?.name || 'Suporte'} - Resposta`}`
```

### Correção 2 — Neutralizar comentários/logs vendor-specific (~30 locais)
Substituir todos os comentários que referenciam "Kiwify" por termos genéricos:
- `// Validar pela base Kiwify` → `// Validar compra via eventos de pagamento`
- `// processo Kiwify` → `// processo de cancelamento (via KB)`
- `Nenhuma compra Kiwify encontrada` → `Nenhum evento de compra encontrado`
- Manter os nomes das tabelas (`kiwify_events`, `kiwify_validated`) intactos — são schema real.

### Correção 3 — Internal note do ticket: delegar ao template (L8773-8792)
O bloco de "enriquecimento específico para SAQUE" injeta regras fixas de PIX. Deve respeitar o `description_template` do nó:
- Se `ticketConfig.description_template` existe → usar apenas ele (já implementado em L8829)
- Se não existe → manter o fallback genérico MAS sem regras de negócio fixas (remover "APENAS conta do titular", "PIX de terceiros: CANCELAR", checklist)

### Correção 4 — Fallback do saque note simplificado
Substituir L8784-8792 por:
```
**DADOS DO SAQUE:**
- Valor: R$ ${args.withdrawal_amount}
- Chave PIX: ${args.pix_key || 'Não informada'} (${args.pix_key_type || 'tipo não especificado'})
- Confirmação: ${args.customer_confirmation ? 'Sim' : 'Pendente'}
```
Sem regras de negócio — essas devem estar no template do dashboard ou na KB.

---

## Arquivos Afetados

| Arquivo | Linhas | Alteração |
|---------|--------|-----------|
| `ai-autopilot-chat/index.ts` | L10467 | Email subject dinâmico |
| | L1117, L1131, L2929-3045, L6033, L6053, L6667 | Neutralizar ~30 comentários/logs |
| | L8773-8792 | Simplificar internal note (remover regras fixas) |

**Estimativa:** ~40 linhas alteradas (maioria comentários), 0 funcionalidade removida

## O que NÃO alterar
- Queries a `kiwify_events` — são infraestrutura real do banco
- Campos `kiwify_validated` — são colunas reais do schema
- `allowed_sources: 'kiwify'` — tipo legítimo da interface (renomear quebraria contratos)

