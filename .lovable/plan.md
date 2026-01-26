

## Plano: Diagnostico e Correcao do WABA ID

### Problema Identificado

O webhook esta recebendo eventos do `phone_number_id: 123456123` (numero de teste) em vez do `phone_number_id: 874402319099270` (producao).

A causa raiz: o **Access Token armazenado nao tem permissao** para o WABA ID `197667164287951` que esta no banco. Isso indica que:
- O WABA ID esta incorreto, OU
- O token foi gerado para outro App/WABA

### Arquitetura do Meta (3 Camadas)

```text
+-------------------------------------------+
|  CAMADA 3: Meta App                       |
|  (Configuracao do Webhook URL)            |
|  "Para onde enviar os webhooks?"          |
+-------------------------------------------+
           ^
           | Precisa SUBSCRIPTION via API
           |
+-------------------------------------------+
|  CAMADA 2: WABA (WhatsApp Business Acc)   |
|  (Container dos numeros de telefone)      |
|  "Qual App deve receber os eventos?"      |
+-------------------------------------------+
           ^
           |
+-------------------------------------------+
|  CAMADA 1: Phone Number                   |
|  (Onde as mensagens chegam)               |
|  ID: 874402319099270                      |
+-------------------------------------------+
```

### Solucao Proposta

1. **Criar Edge Function de Diagnostico** (`diagnose-meta-whatsapp`)
   - Consulta `GET /v21.0/{phone_number_id}?fields=whatsapp_business_account` para descobrir o WABA correto
   - Verifica permissoes do token
   - Lista Apps subscritos ao WABA
   - Retorna diagnostico completo

2. **Atualizar o WABA ID no Banco** (se necessario)
   - Se o WABA retornado pela API for diferente do armazenado, atualizar a tabela `whatsapp_meta_instances`

3. **Chamar subscription correta**
   - Apos corrigir o WABA ID, chamar `subscribe-meta-whatsapp-app` novamente

### Detalhes Tecnicos

**Nova Edge Function: `diagnose-meta-whatsapp/index.ts`**

```typescript
// Endpoints a serem consultados:
// 1. GET /v21.0/{phone_number_id}?fields=whatsapp_business_account,display_phone_number,verified_name
// 2. GET /v21.0/{waba_id}/subscribed_apps
// 3. GET /v21.0/{waba_id}/phone_numbers

// Retorno esperado:
{
  phone_number: {
    id: "874402319099270",
    display: "+55 11 93771-2061",
    verified_name: "Nexxo AI"
  },
  waba: {
    id: "WABA_ID_CORRETO",  // Pode ser diferente de 197667164287951
    name: "3Cliques" 
  },
  subscribed_apps: [...],
  issues: [
    "WABA ID no banco (197667164287951) diferente do retornado pela API (XXX)"
  ],
  fix_needed: true,
  correct_waba_id: "XXX"
}
```

**Atualizacao no Banco (se necessario)**
- Query: `UPDATE whatsapp_meta_instances SET business_account_id = 'WABA_CORRETO' WHERE id = 'd9fafe12-...'`

**Re-subscription**
- Chamar `subscribe-meta-whatsapp-app` com o WABA ID correto

### Sequencia de Implementacao

1. Criar e deployar `diagnose-meta-whatsapp`
2. Executar diagnostico para descobrir WABA correto
3. Corrigir `business_account_id` no banco se necessario
4. Chamar `subscribe-meta-whatsapp-app`
5. Testar recebimento de mensagens

### Beneficios

- Descoberta automatica do WABA correto via API (sem depender do dashboard)
- Diagnostico completo para troubleshooting futuro
- Correcao sem necessidade de acesso manual ao Meta Dashboard

