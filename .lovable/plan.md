

# Upgrade do Prompt da IA Governante — Prioridade Inbox

## O que muda

Substituir o prompt atual (linhas 272-296) pelo novo prompt com:
- **Prioridade máxima para Inbox/IA** antes de vendas
- **Thresholds de saúde** (✅/⚠️/🚨) para resolução IA, escalação e tempo médio
- **Instrução explícita**: se IA < 30% → DEVE ser o [ATENCAO] principal
- **Formato reforçado**: máximo 3 frases por tag, números reais obrigatórios
- Calcular `aiRate` e `escRate` antes do prompt

## Arquivo afetado

`supabase/functions/ai-governor/index.ts` — linhas 271-296 (função `generateAIAnalysis`)

## Detalhes técnicos

1. Adicionar cálculo de `aiRate` e `escRate` no início da função
2. Substituir o corpo do prompt pelo texto completo fornecido pelo usuário
3. Manter a chamada OpenAI (`gpt-4o-mini`, `max_tokens: 1200`) inalterada
4. Nenhuma mudança em tabelas, RLS ou outros arquivos

## Impacto

- Upgrade puro: mesmo fluxo, mesmo parser, apenas prompt melhor
- Próximo relatório vai diagnosticar corretamente o 0,4% de resolução IA como 🚨 CRÍTICO

