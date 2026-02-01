
# Plano: Unificar Configurações de Credenciais (Super Admin vs Usuários)

## Diagnóstico do Problema

A página `/settings/instagram` exibe o `InstagramCredentialsCard` para **todos os usuários** com permissão `settings.integrations`, quando deveria ser restrito apenas a **Super Admins**. Credenciais de API (Meta App ID, Secret, Webhook Token) são configurações sensíveis de infraestrutura.

**Situação Atual:**
```text
/settings/instagram (InstagramSettings.tsx)
   ├── InstagramCredentialsCard  ← VISÍVEL PARA TODOS (PROBLEMA)
   ├── Conectar Conta Instagram
   ├── Sincronização
   └── Notificações

/settings/integrations (IntegrationsSettings.tsx)
   ├── InstagramSecretsCard ← Já tem verificação isAdmin
   ├── AIModelConfigCard
   ├── KiwifyIntegrationCard
   └── ... outros cards
```

## Solucao Proposta

### 1. Remover `InstagramCredentialsCard` da Pagina de Usuario

**Arquivo:** `src/pages/InstagramSettings.tsx`

- Remover a importacao do `InstagramCredentialsCard`
- Remover a renderizacao do card
- Manter apenas: Conectar Conta, Sincronizacao e Notificacoes
- Adicionar um banner informativo para Super Admins dizendo onde configurar as credenciais

### 2. Consolidar Credenciais no `InstagramSecretsCard` (Super Admin)

**Arquivo:** `src/pages/IntegrationsSettings.tsx` (ja esta correto)

O `InstagramSecretsCard` ja tem a verificacao `if (!isAdmin) return null` e ja esta na Central de Integracoes que requer `settings.integrations`.

### 3. Adicionar Banner de Status na Pagina de Usuario

**Arquivo:** `src/pages/InstagramSettings.tsx`

Adicionar um componente que mostra se as credenciais estao configuradas (sem mostrar os valores):
- Se configuradas: Badge verde "Sistema configurado"
- Se nao configuradas: Mensagem "Entre em contato com o Super Admin para configurar as credenciais do Instagram"

### 4. (Opcional) Remover `InstagramCredentialsCard.tsx`

**Arquivo:** `src/components/settings/InstagramCredentialsCard.tsx`

Este arquivo pode ser removido pois:
- A funcionalidade ja existe no `InstagramSecretsCard.tsx`
- Nao esta sendo usado em outro lugar

## Estrutura Apos a Mudanca

```text
SUPER ADMIN (/super-admin ou /settings/integrations):
   └── InstagramSecretsCard (configuracao de App ID, Secret, Token)

USUARIOS (/settings/instagram):
   ├── [Banner de Status] ← NOVO
   ├── Conectar Conta Instagram
   ├── Sincronização
   └── Notificações
```

## Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| `src/pages/InstagramSettings.tsx` | Remover InstagramCredentialsCard, adicionar banner de status |
| `src/components/settings/InstagramCredentialsCard.tsx` | Deletar arquivo (duplicado) |

## Impacto

- **Zero regressao**: Funcionalidade de conexao de conta continua normal
- **Seguranca**: Credenciais sensiveis ficam restritas a Super Admin
- **UX**: Usuarios verao apenas o que precisam; Super Admins terao caminho claro para configurar

## Detalhes Tecnicos

### Banner de Status (novo componente inline)

```tsx
// Em InstagramSettings.tsx
const { data: integrationStatus } = useQuery({
  queryKey: ["integration-status", "instagram"],
  queryFn: async () => {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/integration-status?provider=instagram`,
      { headers: { Authorization: `Bearer ${session?.access_token}` } }
    );
    return response.json();
  }
});

// No JSX:
{!integrationStatus?.is_configured && (
  <Alert variant="warning">
    <AlertTriangle className="h-4 w-4" />
    <AlertDescription>
      As credenciais do Instagram nao estao configuradas. 
      Entre em contato com o administrador do sistema.
    </AlertDescription>
  </Alert>
)}
```

### Verificacao de Permissao Existente

O `InstagramSecretsCard` ja usa:
```tsx
const { isAdmin } = useUserRole();
if (!isAdmin) return null;
```

Esta abordagem sera mantida para garantir que apenas Super Admins vejam configuracoes sensiveis.
