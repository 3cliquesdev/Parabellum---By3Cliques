

# Plano Ajustado: Fallback Inteligente Fora do Horário (sem "falso SLA")

## Resumo das Mudanças

O plano inverte a lógica atual: em vez de redistribuir conversas fora do horário, o cron `redistribute-after-hours` passa a redistribuir conversas **quando o horário comercial abre** (tag `pendente_retorno`). A IA mantém `autopilot` fora do horário e nunca chama `route-conversation` — apenas registra pendência.

---

## 1. Reescrever `redistribute-after-hours/index.ts`

**Lógica atual (será substituída):** Fora do horário → desassocia agentes → manda mensagem de sistema.

**Nova lógica:**
- Checa `getBusinessHoursInfo()`
- Se `within_hours = false` → nada a fazer (log e sai)
- Se `within_hours = true`:
  - Busca conversas abertas com tag `pendente_retorno` na tabela `conversation_tags`
  - Para cada conversa encontrada:
    - Lê `customer_metadata.pending_department_id` (se existir) para passar ao roteador
    - Invoca `route-conversation` com `{ conversationId, departmentId? }`
    - Muda `ai_mode` para `waiting_human`
    - Remove tag `pendente_retorno` da `conversation_tags`
    - Insere mensagem de sistema: *"☀️ Horário comercial iniciado. Um atendente será designado para continuar seu atendimento."*
    - Registra log/contagem

**Cron:** Já está configurado em `config.toml` como `* * * * *`. Mantém.

---

## 2. Injetar consciência de horário no `ai-autopilot-chat/index.ts`

**Onde:** Antes de montar o `contextualizedSystemPrompt` (linha ~5764).

**O que fazer:**
- Importar `getBusinessHoursInfo` de `../_shared/business-hours.ts`
- Chamar no início do handler (junto com as outras queries paralelas)
- Adicionar ao system prompt um bloco condicional:

```
Se within_hours=true:
  "HORÁRIO COMERCIAL: Aberto agora até {today_close}."

Se within_hours=false:
  "HORÁRIO COMERCIAL: Fora do expediente. Próxima abertura: {next_open_text}. Horário: {schedule_summary}.
   REGRA: Tente resolver sozinha. Se não conseguir, use request_human_agent — o sistema cuidará do restante."
```

Isso dá contexto à IA sem mudar ferramentas ou tools.

---

## 3. Modificar `request_human_agent` no `ai-autopilot-chat/index.ts`

**Onde:** Bloco na linha ~7327-7417.

**Lógica condicional após validação de email (linha ~7347):**

```
SE businessHoursInfo.within_hours === true:
  ✅ Comportamento atual intacto:
    - ai_mode → copilot
    - Invocar route-conversation
    - Registrar nota interna
    - Mensagem ao cliente: "Estou transferindo..."

SE businessHoursInfo.within_hours === false:
  ✅ Novo comportamento (sem falso SLA):
    1. NÃO chamar route-conversation
    2. NÃO mudar ai_mode (mantém autopilot)
    3. Enviar mensagem ao cliente:
       "Nosso atendimento humano funciona {schedule_summary}. 
        {next_open_text} um atendente poderá te ajudar. 
        Enquanto isso, posso continuar tentando por aqui!"
    4. Adicionar tag "pendente_retorno" na conversation_tags
       (precisa buscar/criar tag_id para "pendente_retorno" na tabela tags)
    5. Salvar metadata na conversa (customer_metadata):
       - after_hours_handoff_requested_at: timestamp
       - after_hours_next_open_text: string
       - pending_department_id: conversation.department (se existir)
       - handoff_reason: args.reason
    6. Registrar nota interna com contexto
    7. assistantMessage = mensagem acima
```

---

## 4. Criação da tag `pendente_retorno`

**Migration SQL:** Inserir na tabela `tags` um registro com nome `pendente_retorno` (se não existir), para que possa ser referenciado em `conversation_tags`.

```sql
INSERT INTO tags (name, color)
VALUES ('pendente_retorno', '#F59E0B')
ON CONFLICT (name) DO NOTHING;
```

---

## 5. Encerramento gracioso (comportamento pós-handoff fora do horário)

A IA **continua em autopilot** após enviar a mensagem de fora do horário. Isso significa:
- Se o cliente fizer mais perguntas, a IA tenta resolver normalmente
- Se o cliente parar de responder, o `auto-close-conversations` cron cuidará do timeout padrão
- Quando o horário comercial abrir, o cron `redistribute-after-hours` redistribui automaticamente

**Não há encerramento forçado** — a conversa fica aberta com `pendente_retorno` até ser redistribuída ou auto-fechada por inatividade.

---

## Arquivos Alterados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `supabase/functions/redistribute-after-hours/index.ts` | Reescrita completa (lógica invertida: age dentro do horário) |
| `supabase/functions/ai-autopilot-chat/index.ts` | Import business-hours + contexto no prompt + condicional no request_human_agent |
| SQL Migration | Criar tag `pendente_retorno` |

## Garantias de Regressão Zero

- **Dentro do horário:** zero mudança no fluxo de handoff
- **Kill Switch:** verificado antes de tudo (não afetado)
- **Shadow Mode:** respeitado (não afetado)
- **Fluxos (flow_context):** soberania mantida — o bloco já tem guard `if (!flow_context)`
- **SLA:** nenhum `route-conversation` é chamado fora do horário → zero "handoff fantasma"
- **Cron existente:** mantém schedule `* * * * *` do config.toml

