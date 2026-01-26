

## Plano: Atualizar Token e Corrigir WABA ID

### Problema Identificado

O WABA ID armazenado no banco (`197667164287951`) esta incorreto - falta o digito "3" no final. O ID correto visivel na screenshot e `1976671642879513`.

### Acoes a Executar

1. **Atualizar Token no Banco**
   - Salvar o novo token fornecido na tabela `whatsapp_meta_instances`
   - Instancia: `d9fafe12-2cfa-4876-9d1a-c46d2c8fe25e`

2. **Corrigir WABA ID**
   - Alterar `business_account_id` de `197667164287951` para `1976671642879513`

3. **Executar Diagnostico**
   - Chamar `diagnose-meta-whatsapp` para verificar:
     - Token tem `whatsapp_business_messaging` 
     - Token tem acesso ao WABA correto
     - granular_scopes contem target_ids

4. **Subscrever App ao WABA**
   - Se diagnostico OK, chamar `subscribe-meta-whatsapp-app`
   - Isso registrara o webhook URL no WABA de producao

### Detalhes Tecnicos

**SQL de Atualizacao:**
```sql
UPDATE whatsapp_meta_instances 
SET 
  access_token = 'NOVO_TOKEN',
  business_account_id = '1976671642879513',
  updated_at = now()
WHERE id = 'd9fafe12-2cfa-4876-9d1a-c46d2c8fe25e';
```

**Verificacao Esperada do Diagnostico:**
```json
{
  "token_valid": true,
  "permissions": ["whatsapp_business_management", "whatsapp_business_messaging"],
  "granular_scopes": [
    {
      "scope": "whatsapp_business_messaging",
      "target_ids": ["1976671642879513"]
    }
  ],
  "waba": {
    "id": "1976671642879513",
    "name": "3Cliques"
  },
  "fix_needed": false
}
```

### Sequencia de Execucao

1. Executar UPDATE com token + WABA ID corrigido
2. Chamar `diagnose-meta-whatsapp` para validar
3. Se OK, chamar `subscribe-meta-whatsapp-app`
4. Testar envio/recebimento de mensagem

### Resultado Esperado

- Webhook passara a receber eventos do phone_number_id `874402319099270` (producao)
- Mensagens enviadas e recebidas funcionarao corretamente
- Sistema totalmente integrado com a API oficial do Meta

