

## Plano: Resolver Problema de Envio/Recebimento de Mensagens WhatsApp

### Diagnostico do Problema

Apos analise completa dos logs e banco de dados, identifiquei a causa raiz:

| Camada | Status | Detalhes |
|--------|--------|----------|
| Webhook de Recebimento | SEM LOGS | Nenhum log do `meta-whatsapp-webhook` detectado - mensagens NAO estao chegando |
| Envio de Mensagens | ERRO | `API access blocked` (OAuthException code 200) |
| Token de Acesso | EXPIRADO/INVALIDO | O `access_token` na tabela `whatsapp_meta_instances` foi bloqueado |
| Banco de Dados | OK | Mensagens estao sendo salvas localmente |

**Erro exato do log (21:19:11 UTC):**
```json
{"error":{"message":"API access blocked.","type":"OAuthException","code":200}}
```

---

### Causa Raiz: Token Meta Invalido

O erro `API access blocked` com `OAuthException` significa que:

1. **Token expirado**: Tokens temporarios do Meta expiram em 60 dias
2. **Token revogado**: O app pode ter sido desativado ou o token removido
3. **Permissoes insuficientes**: O token nao tem a permissao `whatsapp_business_messaging`
4. **App em Sandbox**: O app esta em modo de desenvolvimento e nao foi aprovado para producao

O token atual armazenado comeca com `EAAVqGZAS4CxYBQ...` e foi registrado em 26/01/2026.

---

### Solucao Necessaria (Acao Manual do Usuario)

O problema **nao pode ser resolvido por codigo** - requer acao manual no Meta Business Suite:

#### Passo 1: Gerar Novo Token Permanente

1. Acesse [Meta Business Suite](https://business.facebook.com/settings/system-users)
2. Selecione o **System User** vinculado ao app WhatsApp
3. Clique em **Generate new token**
4. Selecione o app e marque as permissoes:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
5. Defina expiracao como **Never** (permanente)
6. Copie o novo token

#### Passo 2: Atualizar no Banco de Dados

O novo token precisa ser atualizado na tabela `whatsapp_meta_instances`:

```sql
UPDATE whatsapp_meta_instances 
SET access_token = 'NOVO_TOKEN_AQUI',
    updated_at = now()
WHERE id = 'd9fafe12-2cfa-4876-9d1a-c46d2c8fe25e';
```

---

### Melhorias de Codigo (Implementacao Proposta)

Para evitar que isso aconteca novamente sem aviso, vou implementar:

#### 1. Criar Tela de Gerenciamento de Instancias Meta

Arquivo novo: `src/pages/WhatsAppMetaSettings.tsx`

- Listar instancias Meta ativas
- Permitir atualizar `access_token` via UI
- Mostrar status de conexao (testando a API)
- Exibir data de expiracao do token (se disponivel)

#### 2. Adicionar Rota no App

Arquivo: `src/App.tsx`

```typescript
<Route path="/settings/whatsapp-meta" element={
  <ProtectedRoute requiredPermission="settings.view">
    <WhatsAppMetaSettings />
  </ProtectedRoute>
} />
```

#### 3. Criar Funcao de Diagnostico Rapido

Arquivo: `supabase/functions/diagnose-meta-whatsapp/index.ts` (ja existe)

Adicionar endpoint que testa o token e retorna:
- Token valido/invalido
- Permissoes disponiveis
- Data de expiracao
- Status do numero

#### 4. Adicionar Link no Menu de Configuracoes

Arquivo: `src/components/settings/SettingsSidebar.tsx`

Adicionar item "WhatsApp Meta API" no menu lateral.

---

### Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/pages/WhatsAppMetaSettings.tsx` | Criar | Tela de gerenciamento de instancias Meta |
| `src/App.tsx` | Modificar | Adicionar rota `/settings/whatsapp-meta` |
| `src/components/settings/SettingsSidebar.tsx` | Modificar | Adicionar link no menu |
| `src/hooks/useWhatsAppMetaInstances.tsx` | Criar | Hook para CRUD de instancias |

---

### Componente WhatsAppMetaSettings (Preview)

```typescript
// Principais funcionalidades:
- Lista de instancias Meta cadastradas
- Botao "Testar Conexao" que chama diagnose-meta-whatsapp
- Campo para atualizar access_token (com mascara de seguranca)
- Indicador visual: Verde (OK) / Vermelho (Token Invalido)
- Instrucoes de como gerar novo token
```

---

### Fluxo Apos Implementacao

```text
1. Admin acessa /settings/whatsapp-meta
         |
2. Ve status VERMELHO (token invalido)
         |
3. Clica "Atualizar Token"
         |
4. Cola novo token do Meta Business Suite
         |
5. Sistema testa automaticamente
         |
6. Status muda para VERDE
         |
7. Mensagens voltam a funcionar
```

---

### Acao Imediata Necessaria

**IMPORTANTE**: Antes de eu implementar a interface, voce precisa:

1. Acessar o Meta Business Suite
2. Gerar um novo **System User Access Token** permanente
3. Me informar o novo token para eu atualizar no banco

Ou, se preferir atualizar voce mesmo via SQL, use:

```sql
UPDATE whatsapp_meta_instances 
SET access_token = 'SEU_NOVO_TOKEN_AQUI',
    updated_at = now()
WHERE name = 'Nexxo AI - Meta Oficial';
```

---

### Resultado Esperado

| Metrica | Antes | Depois |
|---------|-------|--------|
| Envio de mensagens | FALHA (API blocked) | OK |
| Recebimento de mensagens | Sem logs | OK |
| Gestao de tokens | Apenas via SQL | Via interface UI |
| Alerta de token expirado | Nenhum | Indicador visual |

