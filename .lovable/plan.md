

# Ajustes Finos: business_messages_config

## O que já está OK
- **RLS**: já usa `is_manager_or_admin(auth.uid())` ✅
- **Edge Functions**: já buscam template com `maybeSingle()` e fallback hardcoded ✅
- **Substituição**: já usa `.replace(/\{schedule\}/g, ...)` ✅

## O que falta (2 itens)

### 1. Migration: Trigger `updated_at`

A tabela `business_messages_config` não tem trigger para atualizar `updated_at` automaticamente. O projeto já possui `public.update_updated_at_column()` usada em 30+ tabelas.

**Nova migration SQL:**
```sql
DROP TRIGGER IF EXISTS update_business_messages_config_updated_at 
  ON public.business_messages_config;

CREATE TRIGGER update_business_messages_config_updated_at
  BEFORE UPDATE ON public.business_messages_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

### 2. UI: Validação + Restaurar Padrão

No componente `BusinessMessagesSection` (SLASettings.tsx, linhas 556-636):

- **Impedir salvar template vazio** — botão desabilitado se `drafts[id]?.trim()` for vazio
- **Warning** se `after_hours_handoff` não contiver `{schedule}` ou `{next_open}` (alerta visual, não bloqueia)
- **Botão "Restaurar Padrão"** — reseta o draft para o valor default hardcoded

Defaults conhecidos:
- `after_hours_handoff`: `"Nosso atendimento humano funciona {schedule}. {next_open} um atendente poderá te ajudar. Enquanto isso, posso continuar tentando por aqui! 😊"`
- `business_hours_reopened`: `"☀️ Horário comercial iniciado. Um atendente será designado para continuar seu atendimento."`

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| Nova migration SQL | Trigger `updated_at` |
| `src/pages/SLASettings.tsx` | Validação empty + warning placeholders + botão restaurar padrão |

Nenhum impacto em features existentes.

