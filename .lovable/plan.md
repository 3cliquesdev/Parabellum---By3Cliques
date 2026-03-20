

# Branding Dinâmico do CRM — Logo via Upload PNG/JPEG

## Contexto

A tela de Branding de Email (`EmailBrandingCard.tsx`) **já usa `ImageUploader`** para upload de PNG/JPEG — o arquivo vai para o Supabase Storage e a URL pública é salva no banco. Isso não muda. O plano é apenas **consumir** esse branding em toda a interface do CRM.

## O que será feito

### 1. Novo hook `useCRMBranding.ts`
Busca o registro `is_default_employee=true` da tabela `email_branding`. Retorna `name`, `logo_url` (que já é a URL do PNG/JPEG enviado via ImageUploader), cores, etc. Fallback: "CRM" se não existir registro.

### 2. Componentes que passam a usar branding dinâmico

| Componente | Hoje (hardcoded) | Depois (dinâmico) |
|---|---|---|
| `AppSidebar.tsx` | Import estático de `logo-parabellum-light.png` + texto "PARABELLUM" | `branding.logo_url` (PNG/JPEG do upload) + `branding.name` |
| `Auth.tsx` | Logo estática + "PARABELLUM" | `branding.logo_url` + `branding.name` |
| `SetupPassword.tsx` | Logo estática | `branding.logo_url` |
| `OnboardingHeader.tsx` | "Parabellum CRM" hardcoded | `branding.name` |

### 3. Acesso público (Auth page)
Verificar/criar policy de SELECT para `anon` na tabela `email_branding` — necessário para a tela de login carregar o logo antes de ter sessão.

### 4. Aceitar apenas PNG/JPEG no ImageUploader de branding
O `ImageUploader` no `EmailBrandingCard.tsx` já aceita `image/jpeg,image/png,image/webp,image/gif`. Vou restringir para **apenas `image/png,image/jpeg`** conforme solicitado, e adicionar validação visual ("Apenas PNG ou JPEG").

## Onde o admin configura
**Configurações > Email > Branding** → registro "Default Funcionário". Faz upload do PNG/JPEG da logo e edita o nome. Toda a interface do CRM reflete automaticamente.

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/hooks/useCRMBranding.ts` | **Novo** |
| `src/components/AppSidebar.tsx` | Logo + nome dinâmicos |
| `src/pages/Auth.tsx` | Logo + nome dinâmicos |
| `src/pages/SetupPassword.tsx` | Logo dinâmica |
| `src/components/admin-onboarding/OnboardingHeader.tsx` | Nome dinâmico |
| `src/components/settings/EmailBrandingCard.tsx` | Restringir accept para PNG/JPEG |
| Migration SQL | Policy SELECT anon em `email_branding` |

