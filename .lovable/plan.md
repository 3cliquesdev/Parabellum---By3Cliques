

# Plano: Corrigir regressão — fluxo teste preso em ask_options

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Diagnóstico

Os logs mostram claramente o problema:

```text
[process-chat-flow] Active flow found: 3ea0d227
[process-chat-flow] ❌ Invalid option response: Boa noite | Options: SIm, Não
```

A conversa tem um estado ativo no nó `ask_options` (Sim/Não) do "Fluxo Principal". Quando o usuário envia "Boa noite" pelo WhatsApp, o engine rejeita como opção inválida.

### Causa raiz: ordem de execução no `process-chat-flow`

O fluxo de execução atual é:
1. **Linha 930**: Buscar estado ativo → encontra o estado no `ask_options`
2. **Linha 960**: Processar estado ativo → rejeita "Boa noite" como opção inválida
3. **Linha 1430**: Bloquear auto-triggers em test mode → **NUNCA CHEGA AQUI** porque o passo 2 já retornou

O check de test mode na linha 1430 está **depois** do processamento de estados ativos. Quando existe um estado ativo antigo (de antes do test mode ser ativado), ele é processado normalmente, ignorando o test mode.

Isso é uma **race condition**: o estado do "Fluxo Principal" foi criado antes do test mode ser ativado, e quando o manual trigger roda, ou ele não deleta corretamente (timing), ou a mensagem do WhatsApp chega entre a ativação e a limpeza.

## Solução (2 mudanças)

### Mudança 1: Validar test mode ANTES de processar estados ativos (linhas 927-960)

Se `isTestMode=true` e `manualTrigger=false`, verificar se o estado ativo pertence a um fluxo que foi iniciado manualmente (em test mode). Se não pertence, cancelar o estado e retornar `skipAutoResponse`.

```typescript
// Após encontrar activeState (linha 939), ANTES de processar (linha 960):
if (activeState && isTestMode && !manualTrigger) {
  // Em test mode, apenas estados de fluxos iniciados manualmente devem rodar
  // Cancelar estados residuais de fluxos automáticos
  console.log('[process-chat-flow] 🧪 TEST MODE: Cancelando estado ativo residual de fluxo automático:', activeState.flow_id);
  await supabaseClient
    .from('chat_flow_states')
    .update({ status: 'cancelled' })
    .eq('id', activeState.id);
  
  return new Response(JSON.stringify({
    useAI: false,
    skipAutoResponse: true,
    reason: 'test_mode_manual_only',
    message: 'Modo teste ativo - estado residual cancelado'
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
```

**Problema**: isso cancelaria TAMBÉM o estado do fluxo de teste legítimo. Precisamos distinguir estados manuais de automáticos.

**Solução refinada**: Marcar estados criados por manual trigger com um flag `is_manual_test: true` no `collected_data`, e no check de test mode, permitir APENAS estados com esse flag.

### Mudança 2: Marcar estados manuais no collected_data (linha 676)

No manual trigger, adicionar flag ao collected_data:

```typescript
// Linha 676 - insert do estado manual
collected_data: { ...manualCollectedData, __manual_test: true },
```

E no check antes do processamento:

```typescript
// Após activeState ser encontrado (linha 939)
if (activeState && isTestMode && !manualTrigger) {
  const isManualTestState = activeState.collected_data?.__manual_test === true;
  if (!isManualTestState) {
    // Estado não é de teste manual — cancelar
    console.log('[process-chat-flow] 🧪 TEST MODE: Cancelando estado residual:', activeState.flow_id);
    await supabaseClient
      .from('chat_flow_states')
      .update({ status: 'cancelled' })
      .eq('id', activeState.id);
    
    return new Response(JSON.stringify({
      useAI: false, skipAutoResponse: true,
      reason: 'test_mode_residual_cancelled',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}
```

## Arquivo e linhas

| Arquivo | Linhas | Mudança |
|---|---|---|
| `process-chat-flow/index.ts` | 676 | Adicionar `__manual_test: true` ao collected_data do manual trigger |
| `process-chat-flow/index.ts` | 939-958 | Adicionar check de test mode ANTES do processamento de estados ativos |

## Impacto

| Regra | Status |
|---|---|
| Regressão zero | Sim — fora de test mode, nenhuma mudança |
| Upgrade | Sim — test mode agora cancela estados residuais automáticos |
| Kill Switch | Não afetado |
| Fluxo nunca mudo | Sim — mensagem de retry não é enviada para estados cancelados |

