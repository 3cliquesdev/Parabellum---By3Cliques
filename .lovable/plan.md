

# Plano: Sistema de Previsibilidade de Bugs

## Diagnóstico Atual

O projeto já tem:
- `AppErrorBoundary` para crashes de renderização
- Handlers globais para chunk errors e unhandled rejections
- `useRealtimeHealth` para monitorar conexão realtime
- Retry automático em envio de mensagens e close-conversation
- Build version tracking com auto-heal

**O que falta:** Não existe nenhum sistema centralizado de **rastreamento, alerta e previsibilidade** de erros. Os erros acontecem silenciosamente no console e só descobrem quando um atendente reclama.

---

## Proposta: Error Tracking Dashboard + Alertas Proativos

### 1. Tabela `client_error_logs` (banco de dados)

Persistir erros do frontend automaticamente para análise:

```text
client_error_logs
├── id (uuid)
├── user_id (uuid, nullable)
├── error_type (enum: 'runtime', 'network', 'edge_function', 'chunk', 'unhandled_rejection')
├── message (text)
├── stack (text, nullable)
├── metadata (jsonb) — URL, user agent, build_id, conversation_id etc.
├── created_at (timestamptz)
```

### 2. Hook `useErrorTracker` — Captura Centralizada

Um hook global (no App.tsx) que:
- Intercepta `window.onerror`, `unhandledrejection`
- Intercepta falhas de Edge Functions (wrapper no supabase client)
- Persiste na tabela `client_error_logs` com debounce (máx 1 erro/5s por tipo)
- Agrupa erros repetidos para não poluir o banco

### 3. Edge Function `error-digest` — Resumo Diário

Cron job diário que:
- Consulta `client_error_logs` das últimas 24h
- Agrupa por `error_type` + `message` (top 10 mais frequentes)
- Salva resumo em `error_digests` para consulta no dashboard
- Opcionalmente envia alerta via webhook/email quando erros ultrapassam threshold

### 4. Widget "Saúde do Sistema" no Dashboard Admin

Um card no dashboard operacional mostrando:
- **Erros nas últimas 24h** (total + por tipo)
- **Edge Functions com falha** (quais e quantas vezes)
- **Taxa de sucesso de envio** (mensagens enviadas vs falhadas)
- **Status Realtime** (já existe via `useRealtimeHealth`)
- Indicador semáforo: Verde (< 5 erros/h), Amarelo (5-20), Vermelho (> 20)

### 5. Toast Proativo para Admins

Quando o sistema detectar pico de erros (ex: > 10 erros em 5 minutos), mostrar toast apenas para admins:
> "⚠️ Instabilidade detectada: X falhas de envio nos últimos 5 min"

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| Migration SQL | Criar tabelas `client_error_logs` e `error_digests` |
| `src/hooks/useErrorTracker.ts` | **Criar** — captura e persiste erros |
| `src/App.tsx` | Adicionar `useErrorTracker` no nível do app |
| `src/components/widgets/SystemHealthWidget.tsx` | **Criar** — widget de saúde |
| `src/pages/Dashboard.tsx` | Adicionar widget ao dashboard admin |
| `supabase/functions/error-digest/index.ts` | **Criar** — cron de resumo diário |

## Resultado Esperado

Em vez de descobrir bugs quando atendentes reclamam, o admin verá em tempo real:
- Quantos erros estão acontecendo
- Quais Edge Functions estão instáveis
- Taxa de sucesso de envio de mensagens
- Alertas proativos antes que o problema escale

