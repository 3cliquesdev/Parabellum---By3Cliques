

# Fix: IA ignora resultado da validação silenciosa de cliente

## Problema
O nó "Validar Cliente" roda silenciosamente (toggle "Automaticamente" ativo) e salva `customer_validated = true` no `collectedData`. Porém, na linha 6694 do `ai-autopilot-chat`, o campo `customer_validated` é **explicitamente excluído** do bloco `📋 CONTEXTO DO FLUXO` injetado no prompt. Resultado: a IA não sabe que o cliente já foi validado e pergunta "Você já é nosso cliente?".

## Correção

### 1. Injetar status de validação no prompt (`ai-autopilot-chat/index.ts`)
No bloco `flowCollectedDataBlock` (linha 6683-6701):
- Adicionar linha explícita quando `customer_validated === true`:
  ```
  - ✅ CLIENTE JÁ VALIDADO: Este contato foi verificado automaticamente como cliente. NÃO pergunte se ele é cliente. Trate-o como cliente confirmado.
  ```
- Quando `customer_validated === false`:
  ```
  - ❌ CONTATO NÃO É CLIENTE: Este contato NÃO foi encontrado na base de clientes.
  ```
- Manter a exclusão de `customer_validated` do loop genérico (evitar duplicação)

### 2. Adicionar instrução anti-pergunta no prompt contextualizado
Após o bloco de contexto do fluxo, adicionar regra explícita:
```
Se o cliente já foi VALIDADO AUTOMATICAMENTE (indicado acima), você NUNCA deve:
- Perguntar se ele é cliente
- Perguntar email, CPF ou telefone para identificação
- Sugerir "se for nosso cliente" / "se não for"
Vá direto ao atendimento usando o nome dele.
```

### Impacto
- A IA saberá imediatamente se o contato é ou não cliente
- Zero perguntas redundantes após validação silenciosa
- Modo Jarvis funciona de forma fluida: valida → saúda pelo nome → pergunta como ajudar

