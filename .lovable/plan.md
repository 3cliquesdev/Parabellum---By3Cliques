
Analisei o projeto atual e sigo as regras da base de conhecimento.

1) Diagnóstico confirmado (#EBD7F562)
- Conversa `ebd7f562-b8cc-4b21-bd9a-98c2e31d5376` ainda está com `chat_flow_states.status = active` no nó `ia_entrada`.
- Nó `ia_entrada` está com `forbid_financial: true`, mas a trava não acionou para frases como “retirar valor que tenho em caixa”.
- `ai-autopilot-chat` entrou em modo restritivo (`forbidFinancial: true`), porém ainda executou `create_ticket` e abriu ticket financeiro `770f5f1d-eccd-4ad8-b2f9-35da418c8089`.

2) Implementação (upgrade sem regressão)
- Arquivo: `supabase/functions/process-chat-flow/index.ts`
  - Expandir `financialIntentPattern` do nó `ai_response` para cobrir variações reais: `retirar`, `retirada`, `caixa`, `carteira`, `pix`, `transferir saldo`, `tirar dinheiro`, etc.
  - Manter comportamento atual ao detectar financeiro: limpar `__ai` e avançar para próximo nó (transfer/end/menu), sem ficar preso.
- Arquivo: `supabase/functions/ai-autopilot-chat/index.ts`
  - Expandir também o regex de interceptação de entrada (mesmo conjunto do `process-chat-flow`) para consistência.
  - Adicionar guarda hard no handler de tool-call `create_ticket`: se `flow_context.forbidFinancial === true` e `issue_type` for financeiro/saque/reembolso/devolução/cobrança, bloquear criação de ticket e retornar caminho semântico de transferência (`waiting_human` + resposta fixa + log).
  - Adicionar log estruturado específico de bloqueio por tool (`ai_blocked_financial_tool_call`) em `ai_events`.
- Arquivo: `supabase/functions/meta-whatsapp-webhook/index.ts`
  - Após resposta do `ai-autopilot-chat`, tratar `financialBlocked === true` para garantir envio imediato da mensagem de handoff ao cliente (sem depender de geração posterior) e evitar qualquer continuidade automática da IA.

3) Correção imediata de dados (caso atual)
- Encerrar estado órfão da conversa `#EBD7F562`:
  - `chat_flow_states.id = 3063b03e-c6f0-4735-829e-1fe0896b2e40` → `status='transferred'`, `completed_at=now()`.
- Validar se `conversations.ai_mode` deve permanecer `autopilot` ou ir para `waiting_human` conforme regra operacional da trava financeira (proponho `waiting_human` para coerência).

4) Testes obrigatórios (antes de entrega)
- E2E WhatsApp com nó `ai_response` + `forbid_financial=true`:
  - frases: “quero sacar”, “retirar valor da carteira”, “como tirar meu dinheiro do caixa”, “reembolso”.
  - esperado: não criar ticket automático, não responder fluxo financeiro, sair do nó IA, encaminhar humano.
- Regressão:
  - `ask_options`, `condition`, `transfer`, `end` continuam iguais.
  - fluxos não financeiros continuam permitindo resposta da IA normalmente.
- Logs:
  - confirmar novos eventos: `ai_blocked_financial` e `ai_blocked_financial_tool_call`.
- Banco:
  - sem novos tickets financeiros automáticos quando `forbidFinancial=true`.
  - estado de fluxo não fica órfão em `active`.

5) Impacto, mitigação e rollback rápido
- Impacto: apenas cenários com `forbidFinancial=true` ficam mais restritos e seguros.
- Mitigação: regex compartilhado e guarda no tool-call evitam falso negativo por variação linguística.
- Rollback rápido: reverter 3 blocos pontuais (regex expandido, guarda no `create_ticket`, tratamento `financialBlocked` no webhook) sem mexer na arquitetura do fluxo.
