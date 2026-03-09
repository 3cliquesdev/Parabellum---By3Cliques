

# Relatório de Envios por Template — Download direto

## Conceito

Sem página dedicada. Adicionar um card "Envios de E-mail por Template" na Central de Relatórios (aba Onboarding ou criar aba 📧 E-mail). Ao clicar, abre o **dialog de export já existente** (`EmailSendsExportDialog`) que permite filtrar por período e template e baixar o Excel.

## O que já existe

O `EmailSendsExportDialog` + `useExportEmailSendsReport` já fazem exatamente isso: filtram por período e template, buscam `email_sends` com join em `contacts`, e exportam Excel com colunas: Template, Contato, Email, Assunto, Data/Hora Envio, Status, Clicado, Aberto, Bounce.

## Mudanças (1 arquivo)

### `src/pages/Reports.tsx`

1. Importar `EmailSendsExportDialog`
2. Adicionar state `emailSendsExportOpen`
3. Adicionar card no array de relatórios (na categoria Onboarding ou nova categoria E-mail):
   - id: `email_sends_export`
   - name: "Envios de E-mail por Template"
   - description: "Exportação com status de envio, abertura, clique e bounce por período"
   - icon: `FileSpreadsheet`
4. No `onClick` do card, setar `emailSendsExportOpen = true` (em vez de navegar para rota)
5. Renderizar `<EmailSendsExportDialog>` no final do componente

## Zero arquivos novos, zero migrações

Reutiliza 100% do dialog e hook existentes. Apenas conecta o card ao dialog.

