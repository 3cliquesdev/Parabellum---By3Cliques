

# Deploy de 2 Edge Functions — Cache-bust + Fallback + Anti-loop

## Plano

Deploy das funções corrigidas no último commit:

1. `ai-autopilot-chat` — cache-bust timestamp, novas entradas no FALLBACK_PHRASES
2. `dispatch-conversations` — anti-loop para conversas órfãs fora do horário

## Critério de Sucesso
- Ambas deployadas sem erros

