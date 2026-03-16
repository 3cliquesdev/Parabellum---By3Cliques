

# Distribuição em Massa de Conversas Arquivadas (Expiradas pela Janela 24h)

## Problema

As 118 conversas que expiraram pela janela de 24h do WhatsApp estão **fechadas/arquivadas**. Não é possível simplesmente redistribuí-las porque:

1. A janela do WhatsApp expirou — qualquer mensagem enviada será rejeitada pela Meta
2. Para reabrir o contato, é obrigatório enviar um **Template HSM** aprovado
3. Só depois do template enviado a conversa pode ser reaberta e atribuída a um agente

## Solução: Botão "Reengajar e Distribuir" na view Arquivadas

### Componentes

1. **Botão na `InboxBulkDistributeBar`** — Quando o filtro ativo for `archived`, substituir o botão "Distribuir" por "Reengajar e Distribuir"

2. **`BulkReengageDialog`** (novo componente):
   - Seletor de template HSM aprovado (reutilizando a lógica do `ReengageTemplateDialog`)
   - Preenchimento de variáveis do template (ex: `{{1}}` = nome do cliente)
   - Opção de destino: auto-distribuir, agente específico ou departamento
   - Preview do template antes de enviar
   - Barra de progresso durante o envio em lote

3. **Edge Function `bulk-reengage`** (nova):
   - Recebe: `conversationIds[]`, `templateId`, `variables`, `destinationType`, `targetAgentId/DepartmentId`
   - Para cada conversa:
     - Envia template HSM via API Meta (reusa lógica do `send-whatsapp-template`)
     - Reabre a conversa (`status: open`, `ai_mode: waiting_human`)
     - Atribui ao agente/departamento conforme destino escolhido
   - Retorna contagem de sucesso/erro

### Fluxo do Usuário

```text
Inbox (Arquivadas) → Selecionar conversas → "Reengajar e Distribuir"
   → Escolher template HSM
   → Preencher variáveis
   → Escolher destino (auto/agente/departamento)
   → Confirmar envio
   → Progresso: 45/118 enviados...
   → Concluído: 112 reengajados, 6 erros
```

### Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/inbox/BulkReengageDialog.tsx` | Criar — Dialog com seletor de template + destino |
| `supabase/functions/bulk-reengage/index.ts` | Criar — Envio em lote de templates + reabertura |
| `src/pages/Inbox.tsx` | Modificar — Adicionar estado e handler para o novo dialog |
| `src/components/inbox/InboxBulkDistributeBar.tsx` | Modificar — Mostrar botão "Reengajar" quando em view arquivada |

### Considerações

- Rate limit da Meta: envio throttled (máx ~80 msgs/segundo para evitar bloqueio)
- Conversas sem telefone ou sem instância WhatsApp serão ignoradas com log
- O template precisa estar aprovado na Meta (status `APPROVED`)

