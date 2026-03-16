import { z } from "npm:zod";

// ========================================================================
// 🎭 ENGINE DO ORQUESTRADOR DE TRIAGEM (Triage Agent)
// ========================================================================
//
// PROBLEMA ANTERIOR:
// A intenção do usuário era mapeada por expressões regulares engessadas
// como `/saque|sacar|carteira/` que falhavam se a pessoa dissesse: 
// "quero enviar dinheiro pro banco".
//
// SOLUÇÃO NOVA:
// Usamos LLM puramente para roteamento de intenção com Structured Outputs.
// Zero lógica de negócio, apenas classificação robusta baseada em semântica.
// ========================================================================

/**
 * TriageIntentSchema
 * Força a API do OpenAI a responder EXATAMENTE um objeto com os
 * seguintes campos. Nunca haverá falha de parse ou texto solto.
 */
export const TriageIntentSchema = z.object({
  classification: z.enum([
    'financial_action',  // Saques, transferências de carteira
    'refund_request',    // Pedido de reembolso/devolução
    'cancellation',      // Deseja cancelar assinatura
    'tracking',          // Onde está o pedido
    'technical_support', // Bug, erro, não loga
    'billing_issue',     // Problema no cartão, fatura
    'general_question',  // Dúvida operacional/comum
    'human_handoff_requested' // Pessoa pediu expressamente por humano
  ]),
  confidence: z.number().min(0).max(1).describe("Nível de certeza sobre essa classificação (0 = palpite, 1 = certeza absoluta)"),
  reasoning: z.string().describe("Breve justificativa, em 1 frase, de como tomou essa decisão")
});

export type TriageIntentResult = z.infer<typeof TriageIntentSchema>;

/**
 * class TriageRouterAgent
 * Função base para invocar o LLM especificamente formatado para Triagem.
 */
export class TriageRouterAgent {
  
  static async analyzeIntent(
    userMessage: string, 
    model: string, 
    openAiApiKey: string
  ): Promise<TriageIntentResult> {
    
    // System prompt estrito focado APENAS em classificação NLU (Natural Language Understanding)
    const systemPrompt = `Você é um Analista de Roteamento Semântico de Atendimento.
Sua FUNÇÃO ÚNICA é ler a mensagem do cliente e classificar em uma das categorias disponíveis.
Regras:
- "financial_action" = Ex: "quero enviar meu saldo pro banco", "sacar comissão"
- "refund_request" = Ex: "quero estornar", "devolver produto", "receber grana de volta da compra"
- "cancellation" = Ex: "desativar renovação", "cancelar plano"
- "general_question" = Qualquer dúvida sobre o produto, horários, como usar.
Responda APENAS de forma estruturada.`;

    try {
      // Faz a requisição nativa usando Function Calling (Structured Outputs do GPT-4o-mini/GPT-4o)
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openAiApiKey}`
        },
        body: JSON.stringify({
          model: model, // ideal: "gpt-4o-mini"
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Mensagem: "${userMessage}"` }
          ],
          response_format: {
            "type": "json_schema",
            "json_schema": {
              "name": "triage_classification",
              "strict": true, // <--- Isso evita alucinação no retorno, a API bloqueia respostas fora do Schema
              "schema": {
                "type": "object",
                "properties": {
                  "classification": {
                    "type": "string",
                    "enum": [
                      "financial_action", "refund_request", "cancellation", "tracking",
                      "technical_support", "billing_issue", "general_question", "human_handoff_requested"
                    ]
                  },
                  "confidence": { "type": "number" },
                  "reasoning": { "type": "string" }
                },
                "required": ["classification", "confidence", "reasoning"],
                "additionalProperties": false
              }
            }
          },
          // temperature: 0 // ❌ REMOVIDO: Reasoning models (o1, o3, gpt-5) não suportam temperature no payload
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI Triage API error: ${response.status}`);
      }

      const rawJson = await response.json();
      const content = rawJson.choices[0]?.message?.content;
      
      // Valida o retorno estritamente pelo esquema Zod
      const parsedData = TriageIntentSchema.parse(JSON.parse(content));
      
      console.log("[TriageRouterAgent] Decisão tomada:", parsedData);
      return parsedData;

    } catch (err) {
      console.error("[TriageRouterAgent] Falha na classificação:", err);
      // Fallback seguro caso a API caia
      return {
        classification: 'general_question',
        confidence: 0,
        reasoning: "Fallback triggered due to error."
      };
    }
  }
}
