

## Ajuste da Mensagem do Keep-Alive - Tom Humano e Acolhedor

### O que muda

A mensagem enviada automaticamente pelo Window Keeper precisa soar natural, sem mencionar "janela de 24h" ou termos tecnicos. O tom deve ser: "nao esquecemos de voce, estamos cuidando do seu caso".

---

### Mudancas no arquivo `supabase/functions/whatsapp-window-keeper/index.ts`

#### 1. Mensagem segura padrao (linha 11)

**Atual:**
> "Oi! Ainda estamos verificando sua solicitacao. Precisa de algo mais? Estamos aqui para ajudar."

**Nova:**
> "Oi! Passando aqui para avisar que nao esquecemos de voce. Assim que nosso time retomar o atendimento, voce ja esta na fila de prioridade. Se precisar de algo, e so nos chamar!"

#### 2. Prompt da IA (linhas 296-302)

Ajustar o system prompt para que a IA gere mensagens no mesmo tom humano e acolhedor:

**Atual:**
> "Gere uma mensagem curta... perguntando se o cliente ainda precisa de ajuda. NAO mencione a janela de 24h..."

**Novo:**
> "Voce e um assistente de atendimento ao cliente. Gere uma mensagem curta (maximo 2 frases), acolhedora e natural, passando a ideia de que a empresa NAO esqueceu do cliente e que o atendimento vai continuar em breve. NAO pergunte se o cliente precisa de ajuda (ele ja pediu). NAO mencione janela de 24h, termos tecnicos ou que a mensagem e automatica. Use o contexto da conversa para personalizar. O tom deve ser caloroso, como se um atendente humano estivesse passando para dar um retorno rapido. Responda APENAS com o texto da mensagem, sem aspas nem prefixos."

#### 3. Fallback da IA (linha 320)

Se a IA falhar, o fallback tambem usara a nova mensagem segura (ja usa a constante `SAFE_MESSAGE`, entao muda automaticamente).

---

### Resumo tecnico

| Item | Arquivo | Linhas |
|------|---------|--------|
| Constante `SAFE_MESSAGE` | `whatsapp-window-keeper/index.ts` | 11 |
| System prompt da IA | `whatsapp-window-keeper/index.ts` | 296-302 |

Apenas 2 trechos alterados, zero impacto em logica ou governanca existente.

