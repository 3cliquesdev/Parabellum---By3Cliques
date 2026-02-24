

# Ajustar Formato das Colunas no Relatorio de Sequencia de E-mails

## Formato Atual (por template)
- `{Template} - Data` (apenas data)
- `{Template} - Hora` (apenas hora)
- `{Template} - Status` (texto)

## Formato Desejado (por template)
- `{Template}` -- data e hora do envio juntos (ex: "23/02/2026 19:58")
- `{Template} - Status` -- texto do status (Enviado, Aberto, Clicado, Bounce)
- `{Template} - Status data e hora` -- data e hora do evento de status (opened_at para Aberto, clicked_at para Clicado, bounced_at para Bounce, sent_at para Enviado)

Este padrao se repete para cada template na sequencia do fluxo.

## Logica da "data e hora do status"

Cada status tem um timestamp diferente:
- Bounce: `email_bounced_at`
- Clicado: `email_clicked_at`
- Aberto: `email_opened_at`
- Enviado: `email_sent_at`
- Erro/Pendente: vazio

## Alteracoes

### 1. `src/hooks/useExportPlaybookEmailSequence.tsx`

Adicionar funcao `fmtDateTime` que combina data e hora num unico valor (ex: "23/02/2026 20:37").

Adicionar funcao `getStatusDateTime` que retorna o timestamp do evento de status correspondente.

Alterar a geracao das colunas por template de:
```text
{label} - Data
{label} - Hora
{label} - Status
```
Para:
```text
{label}                        -> fmtDateTime(email_sent_at)
{label} - Status               -> getEmailStatus(email)
{label} - Status data e hora   -> fmtDateTime(getStatusDateTime(email))
```

### 2. `src/pages/PlaybookEmailSequenceReport.tsx`

Alterar o preview da tabela para exibir o mesmo formato:
- Na celula de cada template, mostrar: data/hora envio, status, e data/hora do status
- Ou expandir as colunas do preview para refletir o mesmo layout do Excel (3 sub-colunas por template)

## Impacto
- Apenas mudanca visual no Excel e no preview
- Dados continuam os mesmos
- Zero impacto em logica de negocio
- Compativel com multiplos templates no fluxo (repete o padrao para cada posicao)
