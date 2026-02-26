

# Plano: Bloquear Master Flow / Auto-Triggers em Modo Teste

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Causa Raiz

Quando `is_test_mode = true`, a flag so serve para:
1. Bypassar o Kill Switch (linha 339)
2. Permitir execucao de drafts (linha 478)

Mas **nao bloqueia** o Master Flow nem os trigger keywords de rodarem automaticamente. Resultado: se o draft flow completa, ou se a conversa nao tem estado ativo, o Master Flow entra e "contamina" o teste.

## Evidencia nos Logs

```
01:30:24 Manual trigger → draft flow 20a05c59 starts (correct)
01:30:47 User "Oi" → invalidOption from draft flow (correct)
```

Mas se o draft completar e o usuario enviar nova mensagem, o fluxo cairia em:
- Linha 1326: busca `chat_flows` ativos
- Linha 1477-1510: sem trigger match → inicia Master Flow
- Resultado: Master Flow roda na conversa de teste

## Solucao

### Mudanca unica: `process-chat-flow/index.ts`

Apos o bloco de processamento de estado ativo (linha ~1316) e antes da verificacao de triggers (linha ~1318), adicionar guard:

```typescript
// 🧪 MODO TESTE: Bloquear triggers e Master Flow automaticos
// Em modo teste, APENAS fluxos iniciados manualmente devem rodar
if (isTestMode && !manualTrigger) {
  console.log('[process-chat-flow] 🧪 TEST MODE: Bloqueando auto-triggers e Master Flow');
  return new Response(JSON.stringify({
    useAI: false,
    aiNodeActive: false,
    skipAutoResponse: true,
    reason: 'test_mode_manual_only',
    message: 'Modo teste ativo - apenas fluxos manuais permitidos'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
```

**Posicao**: Inserir na linha 1317, DEPOIS do `}` que fecha o bloco `if (activeState)` e ANTES do `if (!userMessage)`.

Isso garante que:
- Se existe estado ativo (draft flow em andamento), ele e processado normalmente (linhas 943-1316)
- Se NAO existe estado ativo e a conversa esta em modo teste, NADA automatico roda
- Manual trigger continua funcionando (ja retorna antes na linha 447-907)

### O que NAO muda

- Draft flow em andamento continua sendo processado (invalidOption, avancos, etc.)
- Manual trigger continua funcionando
- Kill Switch bypass em modo teste continua funcionando
- Conversas normais (nao-teste) nao sao afetadas

## Impacto

| Regra | Status |
|---|---|
| Regressao zero | Sim - so adiciona guard, nao altera logica existente |
| Upgrade | Sim - isola testes de fluxos automaticos |
| Kill Switch | Nao afetado |
| Fluxo nunca mudo | Nao afetado - draft continua respondendo quando ativo |

