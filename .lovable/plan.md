

# Reagrupar colunas de tempo nos exports V1 e V2

## Alterações

### V2 (`useExportConversationsCSV.tsx`) — linhas 78-105
Reordenar o objeto para agrupar tempos juntos:

```
Protocolo, ID Conversa, Status, Nome, Email, Telefone,
Data Entrada, Hora Entrada, Data Encerramento, Hora Encerramento,
Data Handoff, Hora Handoff,
Tempo Espera, Tempo Espera pós Atribuição, Tempo 1ª Resposta Humana,
Duração, Tempo Resolução Humana,
Responsável, Participantes, Grupo Responsável,
Total Interações, Origem, CSAT, Ticket, Tags, Primeira Mensagem
```

### V1 (`useExportCommercialConversationsCSV.tsx`) — linhas 177-218
Reordenar headers e dados da aba "Detalhado":

```
ID Curto, ID Conversa, Status, Nome Contato, Email, Telefone, Organização,
Criado em, Fechado em, Handoff,
Tempo de Espera, Tempo Espera pós Atribuição, Tempo 1ª Resposta Humana,
Duração, Tempo Resolução Humana,
Agente Responsável, Participantes, Departamento,
Total Interações, Origem, CSAT, Comentário CSAT,
Ticket ID, Modo IA, Tags, Última Tag Conversa, Primeira Mensagem
```

Nenhuma mudança SQL — apenas reordenação de colunas nos dois arquivos.

