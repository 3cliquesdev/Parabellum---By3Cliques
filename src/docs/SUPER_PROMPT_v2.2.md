# 🧠 SUPER PROMPT OFICIAL — SISTEMA DE ATENDIMENTO (v2.2)

## 0. Princípio Supremo

Este sistema prioriza **previsibilidade, controle humano e segurança operacional**.
Nenhuma automação pode surpreender o usuário, o agente ou o gestor.

---

## 1. Contrato de Status do Agente

### Status válidos (`availability_status`)
- `online` — disponível para receber novas conversas
- `busy` — ocupado, não recebe novas conversas, mantém conversas atuais
- `away` — temporariamente indisponível, não recebe novas conversas, mantém conversas atuais
- `offline` — desconectado, não recebe novas conversas

### Regras obrigatórias
- ✅ Apenas agentes `online` recebem novas conversas
- ❌ `busy`, `away` e `offline` NÃO recebem novas conversas
- ✅ Mudar status **NUNCA** encerra conversas
- ✅ Mudar status **NUNCA** remove `assigned_to`
- ✅ Conversas atuais permanecem atribuídas até ação explícita

---

## 2. Contrato de Status da Conversa

### Status válidos (`status`)
- `open`
- `closed`

### Regras
Conversas só são encerradas por:
- ação humana explícita
- auto-close por inatividade (se habilitado no departamento)

❌ Nenhuma conversa é encerrada automaticamente por:
- mudança de status do agente
- indisponibilidade de agentes
- redistribuição
- IA

---

## 3. Contrato de Modo da Conversa (`ai_mode`)

### Modos válidos
- `autopilot`
- `copilot`
- `waiting_human`
- `disabled`

### Regras
- `waiting_human` significa:
  - IA não responde
  - Fluxos não enviam mensagens
  - Conversa aguarda humano

- `copilot`:
  - humano responde
  - IA pode sugerir internamente

- `autopilot`:
  - IA responde somente se `ai_global_enabled = true`

---

## 4. Kill Switch Global (`ai_global_enabled`)

Quando `ai_global_enabled = false`:
- ❌ IA não responde
- ❌ Fluxos não enviam mensagens
- ❌ Fallbacks não são enviados
- ✅ Conversas vão para `waiting_human`
- ✅ Apenas humanos podem responder

⚠️ Modo Teste (`is_test_mode = true`) ignora o Kill Switch

---

## 5. Contrato de Distribuição Humana

Uma conversa é elegível para distribuição se:
```sql
ai_mode = 'waiting_human'
AND assigned_to IS NULL
AND department IS NOT NULL
AND status = 'open'
```

### Elegibilidade do agente
- `availability_status = online`
- Mesmo departamento da conversa
- `active_chats < max_concurrent_chats`
- Não bloqueado / não em férias

### Regras
- ❌ NÃO existe fallback entre departamentos
- ❌ IA nunca substitui humano por ausência
- ✅ Distribuição é least-loaded + round-robin
- ✅ Lock atômico garante atribuição única
- ✅ Se não houver agente disponível:
  - conversa permanece `open`
  - job fica `pending` ou `escalated`
  - nenhuma ação automática ocorre

---

## 6. Contrato de Capacidade

Capacidade considera todas as conversas abertas atribuídas:
- `waiting_human`
- `copilot`
- `disabled`

Se `active_chats >= max_concurrent_chats`:
- agente não recebe novas conversas

---

## 7. Contrato de Redistribuição

❌ Conversas **não são redistribuídas automaticamente**

Redistribuição ocorre apenas por:
- ação manual (supervisor)
- remoção explícita de `assigned_to`

---

## 8. Contrato de CSAT (Pesquisa de Satisfação)

CSAT só é enviado quando:
- conversa é encerrada explicitamente
- `awaiting_rating = true`

Resposta do cliente:
- é anexada à conversa fechada
- NÃO reabre conversa
- NÃO cria nova conversa
- NÃO chama IA

---

## 9. Contrato de Shadow Mode (`ai_shadow_mode`)

IA pode:
- aprender
- sugerir
- gerar drafts

❌ IA NUNCA aplica mudanças
❌ IA NUNCA responde ao cliente

Todo output é `suggested_only`

---

## 10. Auto-Close por Inatividade (Exceção Controlada)

Permitido somente se habilitado no departamento

Condições:
- cliente inativo
- última mensagem foi do sistema

Sempre:
- envia aviso
- registra `closed_reason = 'inactivity'`

---

## 11. Contrato de UI / UX (Obrigatório)

A UI DEVE refletir exatamente o comportamento real

É **proibido** exibir mensagens como:
- ❌ "Suas conversas serão encerradas ao ficar offline"
- ❌ "A IA assumirá se não houver atendentes"
- ❌ "Conversas serão redistribuídas automaticamente"

**Texto correto ao ficar offline:**
> Você deixará de receber novas conversas.
> Suas conversas atuais permanecerão abertas e atribuídas.

---

## 12. Princípio Final (Inquebrável)

> Nenhuma automação pode surpreender.
> Nenhuma IA pode substituir um humano silenciosamente.
> Nenhuma conversa é encerrada sem intenção clara.

---

## ✅ Status de Alinhamento

- ✔️ Alinhado com 100% do código atual
- ✔️ Compatível com distribuição enterprise
- ✔️ Seguro para escala
- ✔️ Pronto para auditoria

---

*Versão: 2.2 | Última atualização: 2026-01-30*
