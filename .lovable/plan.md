

# Ajustar tag e mensagem de inatividade no auto-close

## Situação atual
- Etapas 2 e 3 do `auto-close-conversations` usam tag **9.04 Desistência da conversa** para todos os fechamentos por inatividade
- A tag **9.98 Falta de Interação** já existe no banco (`3eb75d67-c027-4c41-bdc6-8ebc414e2eb1`) mas não é usada
- A mensagem de encerramento da IA não informa o horário de atendimento

## Alterações

### Arquivo: `supabase/functions/auto-close-conversations/index.ts`

1. **Trocar tag para 9.98 nas Etapas 2 e 3**
   - Adicionar constante `FALTA_INTERACAO_TAG_ID = '3eb75d67-c027-4c41-bdc6-8ebc414e2eb1'`
   - Substituir `DESISTENCIA_TAG_ID` por `FALTA_INTERACAO_TAG_ID` nos upserts de tag das etapas 2 (inatividade departamento) e 3 (inatividade IA)
   - Manter `DESISTENCIA_TAG_ID` disponível para outros usos futuros

2. **Atualizar mensagem de encerramento IA (Etapa 3) com horário de atendimento**
   - Importar helper `getBusinessHoursInfo` do `_shared/business-hours.ts`
   - Buscar horário comercial e incluir na mensagem de encerramento:
   ```
   Não recebi sua resposta, então estou encerrando este atendimento.
   
   Nosso suporte funciona de [horário]. Se precisar de ajuda, 
   entre em contato dentro desse período e teremos prazer em atendê-lo! 😊
   ```

3. **Atualizar mensagem da Etapa 2 (inatividade geral) com mesma lógica**
   - `INACTIVITY_CLOSE_MESSAGE` passa a ser dinâmica, incluindo horário de atendimento

### Etapas 3b e 4 (sem departamento e flow inactivity)
- Também trocar para tag 9.98

