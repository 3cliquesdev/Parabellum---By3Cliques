import { z } from "npm:zod";

// ========================================================================
// 🛠️ ENGINE NATIVO DE FERRAMENTAS (Native Tool Calling)
// ========================================================================
//
// PROBLEMA ANTERIOR:
// A IA cuspia um texto em markdown "```json ...```" que o backend
// tentava consertar usando o `safeParseToolArgs()`. Falhava frequentemente.
//
// SOLUÇÃO NOVA:
// Usamos as Functions (Tools) Nativas da OpenAI. O backend fornece 
// esquemas JSON rigorosos (declarados via Zod), e o framework do LLM
// se encarrega de garantir os tipos antes da chamada.
// ========================================================================

/**
 * 1. schemas: A tipagem de todos os argumentos esperados de cada ferramenta
 * Isso garante que a IA não pode enviar "amount: 'muito dinheiro'", e sim um número real.
 */
export const HandoffSchema = z.object({
  reason: z.string().describe("Motivo claro pelo qual o humano está sendo chamado"),
  urgency: z.enum(["low", "medium", "high"]).default("medium")
});

export const RefundSchema = z.object({
  transaction_id: z.string().describe("ID da transação (ex: Kiwify, Stripe) que deve ser reembolsada"),
  amount: z.number().positive().describe("Valor monetário exato a ser reembolsado"),
  reason: z.string().describe("Motivo do reembolso (ex: 'Cliente desistiu no prazo de 7 dias')")
});

export const WithdrawalSchema = z.object({
  amount: z.number().positive().describe("Valor exato que o cliente deseja sacar de sua carteira"),
  pix_key: z.string().describe("Chave PIX do cliente para transferência"),
  pix_type: z.enum(["cpf", "email", "phone", "random"]).describe("Tipo da chave PIX informada")
});

export const CancellationSchema = z.object({
  subscription_id: z.string().describe("ID da assinatura a ser cancelada"),
  feedback: z.string().optional().describe("Feedback do cliente sobre o motivo do cancelamento")
});

/**
 * 2. OpenAI Tool Definitions
 * Traduz os Schemas (Zod) para o formato exato que a API da OpenAI exige
 * na propriedade `tools`.
 */
export const parabellumNativeTools = [
  {
    type: "function",
    function: {
      name: "transfer_to_human",
      description: "Aciona um atendente humano imediatamente. Use quando o usuário pedir expressamente por um humano ou quando a IA não tiver permissão para resolver a questão.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Motivo pelo qual o humano está sendo chamado" },
          urgency: { type: "string", enum: ["low", "medium", "high"] }
        },
        required: ["reason"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "process_refund",
      description: "Inicia um processo de reembolso. Exclusivo para Triage: 'refund_request'.",
      parameters: {
        type: "object",
        properties: {
          transaction_id: { type: "string" },
          amount: { type: "number" },
          reason: { type: "string" }
        },
        required: ["transaction_id", "amount", "reason"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "process_withdrawal",
      description: "Inicia o processo de saque de comissões/fundos da carteira via PIX. Exclusivo para Triage: 'financial_action'.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number" },
          pix_key: { type: "string" },
          pix_type: { type: "string", enum: ["cpf", "email", "phone", "random"] }
        },
        required: ["amount", "pix_key", "pix_type"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "cancel_subscription",
      description: "Cancela a assinatura recorrente do usuário. Exclusivo para Triage: 'cancellation'.",
      parameters: {
        type: "object",
        properties: {
          subscription_id: { type: "string" },
          feedback: { type: "string" }
        },
        required: ["subscription_id"]
      }
    }
  }
];

/**
 * 3. Tool Execution Handler
 * Uma vez que a OpenAI determina que deve chamar uma ferramenta, e ela preenche o Schema
 * de forma estrita, nós executamos a lógica real da ferramenta dentro do Supabase.
 */
export class ActionExecutionAgent {
  
  static async executeToolCall(
    toolName: string, 
    toolArgumentsRaw: string, 
    context: any
  ): Promise<any> {
    
    // As APIs modernas enviam em String JSON limpo (graças ao schema strito). 
    // ZERO gambiarras: basta parsear.
    let args: any;
    try {
      args = JSON.parse(toolArgumentsRaw);
    } catch (err) {
      throw new Error(`[ActionExecutionAgent] Falha nativa do LLM ao enviar JSON válido para a tool ${toolName}`);
    }

    console.log(`[ActionExecutionAgent] Executando Tool: ${toolName}`, args);

    // Validação estrita por Schema (Zod) e execução da lógica isolada
    switch (toolName) {
      case 'transfer_to_human': {
        const payload = HandoffSchema.parse(args);
        // Exemplo: Injeta lógica de atualização do status 'ai_mode' do banco (migrado do index.ts antigo)
        console.log(`[Tool] Movendo para humano por: ${payload.reason} (Urgencia: ${payload.urgency})`);
        return { success: true, message: "Conversa foi passada para o humano com sucesso." };
      }

      case 'process_refund': {
        const payload = RefundSchema.parse(args);
        console.log(`[Tool] Processando reembolso de $${payload.amount} para transação ${payload.transaction_id}`);
        // Logica para chamar API bancária ou Kiwify
        return { success: true, status: "pending_approval", amount: payload.amount };
      }

      case 'process_withdrawal': {
        const payload = WithdrawalSchema.parse(args);
        console.log(`[Tool] Solicitando saque PIX de $${payload.amount} para ${payload.pix_key}`);
        // Lógica de verificação de saldo e criação do Request no Supabase
        return { success: true, OTP_REQUIRED: true, tracking_id: "WTH-9821389" };
      }

      case 'cancel_subscription': {
        const payload = CancellationSchema.parse(args);
        console.log(`[Tool] Cancelando assinatura ${payload.subscription_id}. Feedback: ${payload.feedback}`);
        // Lógica de desativação na Pagarme/Stripe/Kiwify
        return { success: true, active_until: "2026-03-30", canceled: true };
      }

      default:
        throw new Error(`[ActionExecutionAgent] Tool desconhecida: ${toolName}`);
    }
  }
}
