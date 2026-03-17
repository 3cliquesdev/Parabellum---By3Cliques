

# Fase 3 — Correção Massiva de Encoding no Código-Fonte

## Escopo
O arquivo `supabase/functions/ai-autopilot-chat/index.ts` tem **10.070 linhas** com **3.492 ocorrências** de strings UTF-8 corrompidas (mojibake). Todas são em **comentários, logs e strings literais** — zero alteração de lógica.

## Mapa de substituições
| Corrompido | Correto |
|---|---|
| `ðŸ†•` | `🆕` |
| `ðŸ"§` | `🔧` |
| `ðŸ›¡ï¸` | `🛡️` |
| `ðŸ"¢` | `🔢` |
| `ðŸ"` | `📝` |
| `âœ…` | `✅` |
| `âš ï¸` | `⚠️` |
| `âŒ` | `❌` |
| `Ã§Ã£o` | `ção` |
| `Ã£o` | `ão` |
| `Ã©` | `é` |
| `Ãª` | `ê` |
| `Ã­` | `í` |
| `Ãº` | `ú` |
| `Ã³` | `ó` |
| `Ã¡` | `á` |
| `Ã‚` | `Â` |
| `nÃ£o` | `não` |
| `ConfiguraÃ§Ã£o` | `Configuração` |
| `FunÃ§Ã£o` | `Função` |
| `IntenÃ§Ã£o` | `Intenção` |
| `pontuaÃ§Ã£o` | `pontuação` |
| `violaÃ§Ã£o` | `violação` |
| `opÃ§Ãµes` | `opções` |
| `mÃºltipla` | `múltipla` |
| `nÃºmero` | `número` |
| `invÃ¡lido` | `inválido` |
| `vÃ¡lido` | `válido` |
| `apÃ³s` | `após` |
| `dÃ­gitos` | `dígitos` |
| `tÃ©cnico` | `técnico` |
| `genÃ©rica` | `genérica` |
| + todas as demais variações do mesmo padrão UTF-8 |

## Estratégia de execução

Devido ao tamanho (10k linhas), o arquivo será reescrito em **blocos sequenciais** (~2000 linhas cada), aplicando todas as substituições de encoding. Cada bloco mantém a lógica idêntica — apenas strings corrigidas.

**5 blocos:**
1. Linhas 1–2000
2. Linhas 2001–4000
3. Linhas 4001–6000
4. Linhas 6001–8000
5. Linhas 8001–10070

## Risco
- **Lógica**: Zero — nenhuma linha de código funcional muda
- **Deploy**: Moderado apenas pelo volume — será feito deploy e verificação de logs após
- **Rollback**: Instantâneo via histórico de versão

## Validação pós-deploy
- Deploy da edge function `ai-autopilot-chat`
- Verificar logs para confirmar que o serviço inicia sem erros
- Buscar por mojibake residual no código

