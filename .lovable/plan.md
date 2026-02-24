

# Remover "Contato" do nome exibido na lista de conversas

## Problema

Na lista de conversas, varios contatos aparecem com "Contato" no sobrenome (ex.: "Atendente Rafael Contato", "Jeferson cardoso Contato", "Nestor Contato"). Esse texto e provavelmente um valor padrao salvo no campo `last_name` quando o contato e criado automaticamente via WhatsApp.

## Solucao

Filtrar a palavra "Contato" do `last_name` no momento da exibicao, sem alterar o banco de dados.

## Arquivo impactado

`src/components/ConversationListItem.tsx` (linhas 280-283)

## Mudanca

Trocar:

```typescript
<p className="font-medium truncate text-foreground text-sm">
  {conversation.contacts?.first_name || 'Cliente'}{" "}
  {conversation.contacts?.last_name || ''}
</p>
```

Por:

```typescript
<p className="font-medium truncate text-foreground text-sm">
  {conversation.contacts?.first_name || 'Cliente'}
</p>
```

Remove a exibicao do `last_name` completamente, mantendo apenas o primeiro nome (ou "Cliente" como fallback).

## Zero regressao

- Apenas visual, nao altera dados no banco
- Avatar (iniciais) continua usando `first_name[0]` + `last_name[0]` nas linhas 268-269 - se quiser manter consistente, as iniciais tambem podem ser ajustadas para usar so a primeira letra do first_name
- Nenhum outro componente e afetado

