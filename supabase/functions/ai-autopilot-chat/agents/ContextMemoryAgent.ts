import { z } from "npm:zod";

// ========================================================================
// 🧠 SCRIPT DO "ESCRIBA" (Context Memory Agent / Context Compression)
// ========================================================================
//
// PROBLEMA ANTERIOR:
// O histórico inteiro de mensagens era injetado dentro da requisição.
// Isso causava: 1) Custo altíssimo de tokens; 2) Alucinação;
// 3) Efeito "Lost in the Middle" (IA esquece partes do prompt original).
//
// SOLUÇÃO NOVA: (Inspirada no `muratcankoylan/context-compression`)
// Implementamos uma técnica de janela deslizante (Sliding Window):
// - As últimas `N` mensagens são passadas explicitamente.
// - Mensagens mais antigas (histórico profundo) são passadas por um Agente
//   Secundário (Escriba) que sumariza tudo em apenas 3 linhas compactas
//   como uma "Long-Term Memory". O prompt fica sempre minúsculo e focado.
// ========================================================================

/**
 * Interface que representa a mensagem de um banco de dados
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export const CompressedMemorySchema = z.object({
  executive_summary: z.string().describe("Resumo hipercomprimido (máx 3 frases) do que foi tratado até agora na conversa."),
  current_goal: z.string().describe("Qual é o desejo não resolvido do usuário no exato momento"),
  extracted_entities: z.array(z.string()).describe("Lista de entidades vitais encontradas (ex: emails, números de protocolo, chave PIX)")
});

export type CompressedMemory = z.infer<typeof CompressedMemorySchema>;

export class ContextMemoryAgent {
  /**
   * Limite de quantas mensagens manter intocáveis no histórico de curto-prazo.
   * O Padrão Enterprise diz que 4~6 mensagens cobrem 99% do contexto de turno-a-turno atual.
   */
  private static readonly SHORT_TERM_WINDOW = 5;

  /**
   * Analisa a linha do tempo, divide a janela, e se necessário, condensa o histórico.
   */
  static async buildCompressedContext(
    allMessages: ChatMessage[],
    model: string,
    openAiApiKey: string,
    existingSummary?: string | null
  ): Promise<{ 
    shortTermMessages: ChatMessage[], 
    longTermSummary: string | null 
  }> {
    
    // Se a conversa é curta: Não gastamos requisições de RAG/Summarization. É inútil.
    if (allMessages.length <= this.SHORT_TERM_WINDOW) {
      return { 
        shortTermMessages: allMessages, 
        longTermSummary: null 
      };
    }

    // Fatia a conversa: 
    // - Curto-prazo = últimas N
    // - Histórico Profundo = Todas as anteriores
    const shortTermMessages = allMessages.slice(-this.SHORT_TERM_WINDOW);
    const deepHistory = allMessages.slice(0, allMessages.length - this.SHORT_TERM_WINDOW);

    // Condensar Histórico Profundo (Deep History)
    // Se não quisermos usar API Extra, apenas montamos as transcrições cruas com um limitador.
    const longTermSummary = await this.compressDeepHistory(
      deepHistory, 
      model, 
      openAiApiKey, 
      existingSummary
    );

    return { shortTermMessages, longTermSummary };
  }

  /**
   * "Escriba Interno": Envia as mensagens velhas para a API estruturada
   * afim de resumi-las e extrair chaves de dados críticos, retornando um JSON estrito.
   */
  // Modelos que NÃO suportam temperature e exigem max_completion_tokens
  private static readonly REASONING_MODELS = new Set([
    'o3', 'o3-mini', 'o4-mini', 'o4',
    'gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5.2',
  ]);

  // Modelo fixo para compressão — tarefa background que não precisa do modelo principal
  private static readonly COMPRESSION_MODEL = 'gpt-4o-mini';

  private static async compressDeepHistory(
    messagesToCompress: ChatMessage[],
    _model: string, // ignorado — usamos modelo fixo para compressão
    openAiApiKey: string,
    previousSummary?: string | null
  ): Promise<string> {
    
    // Converte o histórico velho numa tripa crua simples
    const rawTranscript = messagesToCompress
      .map(m => `[${m.role.toUpperCase()}] ${m.content}`)
      .join('\n');

    const systemPrompt = `Você é um Analista de Compressão de Contexto (Escriba).
Sua missão é ler um histórico longo e denso de WhatsApp e resumi-lo de forma cirúrgica para que o próximo Agente entenda rapidamente sem ler tudo.
Não tente responder o usuário. Leia as mensagens antigas e gere um JSON estrito validando tudo.`;

    const userPayload = `
Resumo Prévio Existente: ${previousSummary || 'NENHUM'}
Transcrições Velhas Novas Para Compactar:
${rawTranscript}`;

    // Sempre usar gpt-4o-mini para compressão — barato, rápido e sem restrições de parâmetros
    const compressionModel = this.COMPRESSION_MODEL;
    const isReasoningModel = this.REASONING_MODELS.has(compressionModel);

    const requestBody: any = {
      model: compressionModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPayload }
      ],
      response_format: {
        "type": "json_schema",
        "json_schema": {
          "name": "compressed_memory",
          "strict": true,
          "schema": {
            "type": "object",
            "properties": {
              "executive_summary": { "type": "string" },
              "current_goal": { "type": "string" },
              "extracted_entities": { 
                "type": "array", 
                "items": { "type": "string" }
              }
            },
            "required": ["executive_summary", "current_goal", "extracted_entities"],
            "additionalProperties": false
          }
        }
      },
    };

    // Normalizar parâmetros conforme o modelo
    if (isReasoningModel) {
      requestBody.max_completion_tokens = 500;
      // NÃO adicionar temperature — modelos reasoning não suportam
    } else {
      requestBody.temperature = 0.1;
    }

    console.log(`[ContextMemoryAgent] Comprimindo com modelo: ${compressionModel}`);

    try {
       const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openAiApiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`OpenAI Compression API error: ${response.status}`);
      }

      const rawJson = await response.json();
      const content = rawJson.choices[0]?.message?.content;
      
      const parsedData = CompressedMemorySchema.parse(JSON.parse(content));
      
      console.log("[ContextMemoryAgent] Compressão Concluída com Sucesso", parsedData.extracted_entities);

      // Compila o Json em um Texto Injectable para o System Prompt do Agente Principal
      return `[RESUMO DE CONVERSAÇÃO ANTIGA]\nResumo: ${parsedData.executive_summary}\nObjetivo Não Resolvido do Cliente: ${parsedData.current_goal}\nDados Extras Mencionados (PIX/Emails): ${parsedData.extracted_entities.join(', ')}`;
      
    } catch (err) {
      console.warn("[ContextMemoryAgent] Falha na compressão do histórico. Retornando fallback resumido localmente.", err);
      // Fallback seguro pra não travar se a API tiver timeout num chat bizonho
      return `[RESUMO DE CONTEXTO ANTIGO COM FALHA]\nO usuário conversou ativamente com a IA. As transcrições antigas foram descartadas e mantiveram apenas as mais recentes na memória.`;
    }
  }
}
