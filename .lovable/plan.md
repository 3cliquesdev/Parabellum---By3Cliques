

# Auditoria Completa: Hardcoded Remanescente no `ai-autopilot-chat`

## Status Atual

A refatoração anterior foi **parcialmente bem-sucedida**:
- ✅ `persona.system_prompt` é injetado (L7173) 
- ✅ `buildCollectionMessage` é a fonte única de template (1 mapa `fieldLabels` centralizado)
- ✅ Bypass hardcoded de cancelamento foi removido (L6082-6084 agora só loga)
- ✅ SLA parametrizado via `sla_text`/`team_name` (L6275-6277, L7881-7883)
- ✅ Menu A/B hardcoded pós-OTP foi eliminado
- ✅ "Cérebro financeiro" de 170 linhas foi substituído por instrução genérica (L7200-7225)

## Problemas AINDA Encontrados

### P1 — Cancelamento Kiwify hardcoded no identityWallNote (L6890-6898)
```
identityWallNote += `\n\n**=== CANCELAMENTO DE ASSINATURA (SEM OTP) ===**
O cliente quer cancelar a assinatura Kiwify.
**PROCESSO:**
- Oriente o cliente sobre como cancelar na plataforma Kiwify
```
**Impacto:** Referência direta a "Kiwify" injetada no prompt. Deve delegar à KB.

### P2 — Triagem silenciosa Kiwify hardcoded (L2929-3101)
~170 linhas que consultam diretamente `kiwify_events` para validar clientes. Isso é funcionalidade legítima de CRM (validação de compra), mas os **comentários e logs** referenciam "Kiwify" como se fosse o único provedor.

**Impacto:** Funcional, mas acoplado a um vendor. Isso é infraestrutura — não é prompt. Marcar como P3 (baixa prioridade).

### P3 — "7 dias úteis" hardcoded em 2 locais residuais
- **L1191:** Fallback de template de saque: `Prazo: até 7 dias úteis`
- **L8783:** Nota interna do ticket: `REGRAS (até 7 dias úteis)`

**L1191** é fallback de último recurso (só usado se não houver template). **L8783** é nota interna (não visível ao cliente). Baixa prioridade.

### P4 — `TRANSFER_LABELS` hardcoded (L9846-9851)
Mapa fixo de labels de equipe para transferências. Deveria vir do departamento no banco.

**Impacto:** Se um cliente renomear departamentos, as mensagens de transferência não refletem.

## Plano de Correção

### Correção 1 — Eliminar referência Kiwify no cancelamento (L6890-6898)
Substituir o bloco hardcoded por instrução genérica que delega à KB:
```
identityWallNote += `\n\n**=== CANCELAMENTO DE ASSINATURA (SEM OTP) ===**
O cliente quer cancelar sua assinatura/curso.

**PROCESSO:**
- Consulte a base de conhecimento para instruções de cancelamento
- NÃO precisa de OTP para cancelamento
- Se não encontrar instruções na KB, ofereça transferir para humano
- NÃO invente procedimentos ou links`;
```

### Correção 2 — Parametrizar SLA no fallback de saque (L1191)
Substituir `até 7 dias úteis` por leitura do flow_context (já disponível na função):
- Como `buildWithdrawalSuccessMessage` não recebe `flow_context`, manter como fallback genérico mas trocar texto para `"conforme prazo informado"` (neutro).

### Correção 3 — Tornar TRANSFER_LABELS dinâmico (L9846-9851)
Buscar o nome do departamento de destino diretamente do banco quando disponível, com fallback ao mapa estático.

### Correção 4 — Nota interna "7 dias úteis" (L8783)
Substituir por texto genérico: `REGRAS (conforme SLA configurado):`

## Arquivos Afetados

| Arquivo | Linhas | Alteração |
|---------|--------|-----------|
| `ai-autopilot-chat/index.ts` | L6890-6898 | Remover "Kiwify" do prompt de cancelamento |
| | L1191 | Neutralizar SLA hardcoded no fallback |
| | L8783 | Neutralizar SLA em nota interna |
| | L9846-9851 | Buscar nome do departamento do banco |

**Estimativa:** ~30 linhas alteradas, 0 removidas

