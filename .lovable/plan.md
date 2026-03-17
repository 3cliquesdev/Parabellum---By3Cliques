
Diagnóstico da conversa `#F865982D`

O pedido de email ainda existe, mas nesta conversa ele não veio do menu nem de um webhook antigo. Ele veio da própria `ai-autopilot-chat`.

O que confirmei:
- A mensagem problemática foi gerada pela IA às `15:43:35`.
- O log dessa execução mostra:
  - `willAskForEmail: false`
  - `willProcessNormally: true`
  - `contactHasEmail: true`
- Não houve evidência de chamada da tool de rastreio nessa execução.
- A resposta saiu com `used_articles` da base de conhecimento, então foi uma resposta livre da IA, influenciada por contexto/prompt, não um texto fixo do fluxo.
- O contato dessa conversa já tem email cadastrado (`fabiosou1542@gmail.com`), então pedir “email mascarado” é claramente comportamento indevido.

Causa raiz provável
1. A regra global “não pedir email para pedidos/rastreio” foi corrigida, mas ainda não está forte o suficiente para impedir a IA de improvisar isso em respostas livres.
2. Ainda existe código legado que reforça email como caminho válido:
   - branch `check_order_status` ainda existe e consulta por `customer_email`
   - `check_tracking` ainda lê `args.customer_email` no runtime, mesmo sem esse campo na definição da tool
3. Para mensagens como “quero saber se meus pedidos foram enviados”, a IA está respondendo por interpretação sem uma guarda determinística específica.

Plano de correção
1. Endurecer a resposta para consulta de envio/pedido
- Criar uma guarda explícita no backend para intents como:
  - “meus pedidos foram enviados”
  - “foi enviado”
  - “status do pedido”
  - “rastreio”
- Quando não houver número do pedido nem código de rastreio na mensagem, responder de forma determinística:
  - pedir apenas número do pedido ou código de rastreio
  - proibir qualquer menção a email/CPF/telefone

2. Remover caminhos legados que ainda sugerem email
- Remover a branch `check_order_status`
- Remover toda leitura de `customer_email` dentro de `check_tracking`
- Revisar instruções operacionais de pedidos para deixar “email” como proibido também no bloco de fallback operacional

3. Adicionar um pós-filtro de segurança
- Antes de salvar/enviar a resposta da IA, se o tema for pedido/rastreio e a mensagem mencionar “email”, “cpf” ou “telefone”, reescrever para a resposta segura padrão
- Isso cria uma proteção final mesmo se o modelo escapar do prompt

4. Validar com casos reais
- “Quero saber se meus pedidos foram enviados”
- “Meu pedido já saiu?”
- “Rastreio”
- “Pedido 16315521”
- “BR123456789BR”

Arquivos que eu alteraria
- `supabase/functions/ai-autopilot-chat/index.ts`

Impacto esperado
- Elimina o pedido indevido de email em consultas de envio/rastreio
- Faz a IA aceitar somente:
  - número do pedido
  - código de rastreio
- Reduz recaídas mesmo quando a resposta vier por geração livre com base em artigos
