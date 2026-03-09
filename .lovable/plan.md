

## Plano: Seção "IA Governante" no ProfileEditDialog

### O que será feito

Adicionar uma seção condicional (apenas para admins) no `ProfileEditDialog` com:

1. **Campo WhatsApp** — input para `profiles.whatsapp_number`
2. **Switch "Receber relatório diário"** — toggle para `profiles.notify_ai_governor`
3. **Botão "Enviar relatório agora"** — invoca `ai-governor` com `{ force_today: true }`

### Detalhes técnicos

**Arquivo: `src/components/ProfileEditDialog.tsx`**

- Importar `Switch` de `@/components/ui/switch`, `useUserRole` de `@/hooks/useUserRole`, e `Separator` de `@/components/ui/separator`
- Adicionar dois campos de estado local: `whatsappNumber` e `notifyGovernor` (inicializados do `profile`)
- Adicionar estado `sendingReport` para o botão de envio
- No `useEffect` que faz reset, também setar `whatsappNumber` e `notifyGovernor` do profile
- No `onSubmit`, incluir `whatsapp_number` e `notify_ai_governor` no update do Supabase
- Após o campo de cargo, renderizar condicionalmente (se `role === 'admin'`):
  - `<Separator />` visual
  - Título "IA Governante" com ícone
  - Input de telefone WhatsApp (placeholder `5511999999999`)
  - Switch com label "Receber relatório diário da IA"
  - Botão "Enviar relatório agora" que faz `supabase.functions.invoke('ai-governor', { body: { force_today: true } })` e mostra toast

### Banco de dados

Nenhuma migration necessária — `whatsapp_number` e `notify_ai_governor` já existem na tabela `profiles`.

### Visibilidade

A seção só aparece para usuários com `role === 'admin'`, usando o hook `useUserRole()` já existente.

