# Plano: Central de Integrações com Criptografia

## Status: Em Progresso

## Passos Concluídos ✅

1. **Add INTEGRATIONS_MASTER_KEY secret** ✅
   - Secret adicionado com sucesso

2. **Create workspace_integrations migration** ✅
   - Tabela já existia
   - Adicionados `instagram` e `active` aos constraints

3. **Create crypto module and edge functions** ✅
   - `integration-encrypt`: Encripta e salva credenciais
   - `integration-decrypt`: Decripta credenciais (uso interno)
   - `integration-status`: Retorna status sem expor secrets

4. **Refactor Instagram OAuth + webhook** ✅
   - `instagram-start-oauth`: Tenta buscar do encrypted storage, fallback para env
   - `instagram-oauth-callback`: Idem
   - `instagram-webhook`: Idem para verify token

5. **Create InstagramCredentialsCard UI** ✅
   - Formulário para App ID, App Secret, Webhook Verify Token
   - Salva via `integration-encrypt`
   - Mostra status configurado/não configurado

## Próximos Passos

6. **Testar fluxo completo**
   - Ir para /settings/instagram
   - Preencher credenciais
   - Verificar se são salvas corretamente
   - Testar OAuth do Instagram

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend UI                          │
│  InstagramCredentialsCard → integration-encrypt         │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              workspace_integrations table               │
│  - provider: 'instagram'                                │
│  - encrypted_secrets: AES-GCM encrypted JSON            │
│  - public_config: { configured_at: ... }                │
│  - status: 'active'                                     │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│           Edge Functions (instagram-*)                  │
│  1. Tenta buscar secrets do encrypted storage           │
│  2. Fallback para env vars (FACEBOOK_APP_ID, etc)       │
└─────────────────────────────────────────────────────────┘
```

## Benefícios

- **Segurança**: Credenciais encriptadas com AES-GCM
- **Rotação fácil**: Admin pode atualizar pela UI
- **Auditoria**: public_config.configured_at rastreia mudanças
- **Fallback**: Continua funcionando com env vars existentes
