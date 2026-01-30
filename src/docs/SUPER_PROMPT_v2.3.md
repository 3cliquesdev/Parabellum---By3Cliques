# 🧠 SUPER PROMPT OFICIAL — SISTEMA DE ATENDIMENTO (v2.3)

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

## 13. Contrato de `ask_options` (Validação Estrita)

### Regras obrigatórias
Nós do tipo `ask_options` exigem validação estrita de resposta.

### Entradas válidas
✅ Número correspondente à posição (1, 2, 3...)
✅ Texto exato do label da opção (case-insensitive)
✅ Texto exato do value da opção (case-insensitive)

### Entradas inválidas
❌ Texto parcial ou fuzzy (ex: "Ped" para "Pedidos")
❌ Números fora do range (ex: "5" quando só há 4 opções)
❌ Qualquer outra resposta

### Comportamento para entrada inválida
1. Fluxo **NÃO avança**
2. Fluxo **NÃO transfere**
3. Fluxo **NÃO chama IA**
4. Sistema reenvia a pergunta com orientação clara:

```
❗ Não entendi sua resposta.

Por favor, responda com o *número* ou *nome* de uma das opções:
1️⃣ Pedidos
2️⃣ Sistema
3️⃣ Acesso
4️⃣ Outros
```

### Exemplo de comportamento

| Entrada | Resultado |
|---------|-----------|
| `1` | ✅ Avança para opção 1 |
| `Pedidos` | ✅ Avança para opção "Pedidos" |
| `pedidos` | ✅ Avança (case-insensitive) |
| `Fff` | ❌ Repete opções |
| `5` (se só há 4 opções) | ❌ Repete opções |
| `Ped` | ❌ Repete opções (sem fuzzy) |

---

## 14. Contrato de Proteção de Modo (`ai_mode`)

### Regras obrigatórias
O motor de fluxos DEVE verificar o `ai_mode` da conversa ANTES de qualquer processamento.

### Comportamento por modo

| ai_mode | Processar Fluxo | Chamar IA | Enviar Resposta |
|---------|-----------------|-----------|-----------------|
| `autopilot` | ✅ Sim | ✅ Se AIResponseNode | ✅ Sim |
| `waiting_human` | ❌ Não | ❌ Não | ❌ Não |
| `copilot` | ❌ Não | ❌ Não | ❌ Não |
| `disabled` | ❌ Não | ❌ Não | ❌ Não |

### Justificativa
- `waiting_human`: Cliente está na fila aguardando humano. Fluxo e IA devem ficar silenciosos.
- `copilot`: Humano está atendendo. IA pode sugerir internamente, mas NÃO enviar.
- `disabled`: Atendimento 100% manual. Nenhuma automação.

### Comportamento esperado
- Mensagens do cliente são **salvas normalmente** no histórico
- Fluxo **NÃO reinicia** quando cliente está na fila
- IA **NÃO responde** automaticamente
- Humano vê todas as mensagens no painel

---

## ✅ Status de Alinhamento

- ✔️ Alinhado com 100% do código atual
- ✔️ Compatível com distribuição enterprise
- ✔️ Seguro para escala
- ✔️ Pronto para auditoria

---

*Versão: 2.3 | Última atualização: 2026-01-30*
