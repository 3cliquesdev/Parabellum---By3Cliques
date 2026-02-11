

# Relatorio de Tickets com Export Excel

## O que sera criado

Uma nova pagina de relatorio dedicada a Tickets, acessivel pelo menu Relatorios na aba "Atendimento", com filtros, tabela de preview e botao para exportar Excel (.xlsx).

## Colunas do Excel

| Coluna | Descricao |
|--------|-----------|
| Protocolo | ticket_number |
| Assunto | subject |
| Status | status traduzido |
| Prioridade | priority |
| Categoria | category |
| Solicitante (Nome) | contact first_name + last_name |
| Solicitante (Email) | contact email |
| Solicitante (Telefone) | contact phone |
| Responsavel | profiles.full_name (assigned_to) |
| Dept. Solicitante | requesting_department name |
| Dept. Responsavel | department name |
| Operacao | ticket_operations name |
| Origem | ticket_origins name |
| Canal | channel |
| Data Criacao | data separada (dd/MM/yyyy) |
| Hora Criacao | hora separada (HH:mm) |
| Data Resolucao | data separada |
| Hora Resolucao | hora separada |
| Tempo Primeira Resposta (min) | first_response_at - created_at |
| SLA Meta Resposta | sla_policies response_time |
| SLA Meta Resolucao | sla_policies resolution_time |
| SLA Status | within/breached |
| Due Date | due_date |

## Implementacao Tecnica

### 1. Nova RPC: `get_tickets_export_report`
- JOINs: contacts, profiles, departments (x2), ticket_operations, ticket_origins, sla_policies
- Calcula FRT e tempo de resolucao em minutos
- Filtros: periodo, departamento, agente, status, prioridade, busca texto
- Paginacao server-side

### 2. Nova pagina: `src/pages/TicketsExportReport.tsx`
- Filtros com DateRangePicker, selects de departamento/agente/status/prioridade
- Tabela preview com paginacao (50/pagina)
- Botao "Exportar Excel" usando lib `xlsx`

### 3. Novo hook: `src/hooks/useTicketsExportReport.tsx`
- Chama RPC com filtros e paginacao

### 4. Novo utilitario: `src/hooks/useExportTicketsExcel.tsx`
- Gera .xlsx com data/hora em colunas separadas
- Formata tempos de SLA

### 5. Rota e menu
- Rota `/reports/tickets-export` no App.tsx
- Card na aba Atendimento do Reports.tsx

### Impacto
- Zero regressao: apenas adicoes de arquivos novos
- Relatorio CSV existente permanece intacto

