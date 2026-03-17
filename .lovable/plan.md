

# Adicionar Guia/Instrução na "Ação ao Sair" do Nó IA

## O que fazer

Adicionar um texto explicativo abaixo do select "Ação ao Sair" para orientar o usuário sobre quando e por que ativar essa função.

## Alteração

**Arquivo:** `src/components/chat-flows/AIResponsePropertiesPanel.tsx`

1. Adicionar um tooltip no título "AÇÃO AO SAIR" com explicação completa
2. Adicionar um parágrafo descritivo abaixo do select explicando:
   - **Quando usar**: "Ative quando a IA precisar formalizar a solicitação do cliente em um ticket antes de encerrar o atendimento (ex: saque, reembolso, devolução)"
   - **Como funciona**: "O ticket será criado automaticamente com os dados coletados pela IA quando ela finalizar o atendimento neste nó"
3. Quando "Criar Ticket" é selecionado, adicionar uma nota guia no topo da seção expandida: "Configure abaixo os dados do ticket. Departamento define para qual equipe o ticket será direcionado. O responsável é opcional — se não selecionado, o ticket vai para o pool do departamento."

Alteração única em `AIResponsePropertiesPanel.tsx`, ~10 linhas adicionadas.

