

# Limpeza Completa de Mojibake — Análise de Viabilidade e Plano

## Estado Atual
- **2.805 ocorrências** de caracteres corrompidos em `ai-autopilot-chat/index.ts` (9.897 linhas)
- Corrupção é **apenas em strings de texto** (comentários, logs, prompts) — **não na lógica do código**
- Exemplos: `configuraÃ§Ãµes` → `configurações`, `âœ…` → `✅`, `nÃºmero` → `número`

## Risco Real: **Baixo, mas com ressalva importante**

A operação é segura porque:
1. **Nenhuma lógica muda** — apenas texto dentro de strings, comentários e console.logs
2. **O código JavaScript/TypeScript não usa acentos** em variáveis ou funções
3. A corrupção é um padrão previsível (UTF-8 lido como Latin-1)

**A ressalva**: O arquivo tem 9.897 linhas. Para fazer a limpeza completa, preciso reescrever o arquivo inteiro com `code--write`. Pela limitação de tamanho da ferramenta, terei que usar `// ... keep existing code` para preservar seções grandes inalteradas e focar apenas nos blocos que contêm mojibake. Isso requer **múltiplas operações** em seções menores para não perder código.

## Plano Seguro (em etapas)

### Etapa 1: Limpeza por blocos
Em vez de reescrever o arquivo inteiro de uma vez, farei **edições cirúrgicas por faixas de linhas** usando `line_replace`, focando nos blocos mais críticos primeiro:
1. **Prompts injetados na LLM** (maior impacto — a IA lê texto corrompido)
2. **Handlers de reembolso/cancelamento/saque** (afetam atendimento financeiro)
3. **Console.logs e comentários** (menor prioridade, mas importante para auditoria)

Cada bloco será editado individualmente com 2-3 linhas de contexto para matching seguro.

### Etapa 2: Deploy + teste
Deploy da edge function e teste com `curl_edge_functions` para confirmar que responde normalmente.

### Etapa 3: Monitorar logs
Verificar logs pós-deploy para garantir zero erros.

## Alternativa mais segura (se preferir)
Posso começar **apenas pelos prompts críticos** (os textos que a LLM lê) e deixar comentários/logs para depois. Isso reduz o escopo da mudança e o risco.

**Resumo**: Sim, consigo fazer sem quebrar. A limpeza é puramente textual — nenhuma variável, função ou lógica é alterada. Vou trabalhar em blocos pequenos para garantir que cada edição é verificável.

