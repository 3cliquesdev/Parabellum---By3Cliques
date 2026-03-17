

# Correção de Encoding (Mojibake) — ai-autopilot-chat/index.ts

## Diagnóstico

- **4.504 ocorrências** de mojibake em 9.824 linhas
- Afeta apenas **comentários e console.log** — lógica intacta
- Padrões: `Ã§→ç`, `Ã£→ã`, `Ãµ→õ`, `Ã¡→á`, `Ã©→é`, `ðŸ†•→🆕`, `âœ…→✅`, `âš ï¸→⚠️`, `âŒ→❌`, etc.

## Abordagem Segura

Dado o volume (4.500+ matches em 9.824 linhas), fazer `line_replace` em cada ocorrência individual seria centenas de edições — arriscado e lento.

**Proposta**: Corrigir em **blocos de seção** — os headers `// ====` e comentários de bloco mais visíveis (~30-40 edições cirúrgicas nas seções-chave). Console.logs com mojibake ficam como estão (são internos, não afetam UX nem lógica).

### Seções prioritárias para correção:
1. Headers de seção (`// 🆕 INTERFACE DE CONFIGURAÇÃO RAG DINÂMICA`, etc.)
2. Comentários de função (`// Helper: Buscar TODAS as configurações...`)
3. Docstrings de fases (`// FASE 1:`, `// FASE 2:`, etc.)

### Mapeamento de substituição:
| Mojibake | Correto |
|----------|---------|
| `CONFIGURAÃ‡ÃƒO` | `CONFIGURAÇÃO` |
| `DINÃ‚MICA` | `DINÂMICA` |
| `configuraÃ§Ãµes` | `configurações` |
| `ConfiguraÃ§Ã£o` | `Configuração` |
| `nÃºmero` | `número` |
| `nÃ£o Ã©` | `não é` |
| `vÃ¡lido` | `válido` |
| `numÃ©ricos` | `numéricos` |
| `dÃ­gitos` | `dígitos` |
| `invÃ¡lido` | `inválido` |
| `apÃ³s` | `após` |
| `variÃ¡veis` | `variáveis` |
| `FunÃ§Ã£o` | `Função` |
| `pontuaÃ§Ã£o` | `pontuação` |
| `mÃ¡ximo` | `máximo` |
| `pÃ³s-processamento` | `pós-processamento` |
| `violaÃ§Ã£o` | `violação` |
| `correÃ§Ãµes` | `correções` |
| `opÃ§Ãµes` | `opções` |
| `mÃºltipla` | `múltipla` |
| `ðŸ†•` | `🆕` |
| `ðŸ"§` | `🔧` |
| `ðŸ"¢` | `🔢` |
| `ðŸ›¡ï¸` | `🛡️` |
| `âœ…` | `✅` |
| `âš ï¸` | `⚠️` |
| `âŒ` | `❌` |
| `âœ‚ï¸` | `✂️` |
| `â†'` | `→` |

### Execução:
- ~30-40 edições `line_replace` focadas nas primeiras ~350 linhas (helpers e headers)
- Cada edição cobre 1-5 linhas contíguas
- Nenhuma alteração em lógica de código

### Risco:
- **Baixo** — apenas texto em comentários
- Sem risco de sobrescrever o arquivo (usa `line_replace`, não `write`)

