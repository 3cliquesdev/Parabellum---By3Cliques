/**
 * Sprint 3: Tools Estruturadas para IA
 * JSON Schema para todas as tools disponíveis
 */

export const AI_TOOLS_SCHEMA = {
  tools: [
    {
      name: "search_knowledge",
      description: "Busca artigos relevantes na base de conhecimento. Use antes de responder qualquer pergunta.",
      input_schema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Pergunta ou termos de busca"
          },
          filters: {
            type: "object",
            properties: {
              department: {
                type: "string",
                description: "Filtrar por departamento específico"
              },
              recency_days: {
                type: "number",
                description: "Limitar a artigos dos últimos N dias"
              },
              category: {
                type: "string",
                description: "Categoria do artigo (FAQ, Política, Procedimento)"
              }
            }
          }
        },
        required: ["query"]
      }
    },
    {
      name: "fetch_customer",
      description: "Busca dados completos do cliente atual (cadastro, histórico, pedidos)",
      input_schema: {
        type: "object",
        properties: {
          customer_id: {
            type: "string",
            description: "ID do cliente (UUID)"
          },
          include: {
            type: "array",
            items: { type: "string" },
            description: "Campos adicionais: orders, interactions, tags, journey"
          }
        },
        required: ["customer_id"]
      }
    },
    {
      name: "fetch_order",
      description: "Busca detalhes de um pedido específico",
      input_schema: {
        type: "object",
        properties: {
          order_id: {
            type: "string",
            description: "ID ou número do pedido"
          },
          by: {
            type: "string",
            enum: ["id", "number", "kiwify_ref"],
            description: "Tipo de identificador"
          }
        },
        required: ["order_id"]
      }
    },
    {
      name: "create_ticket",
      description: "Cria um ticket de suporte para acompanhamento humano",
      input_schema: {
        type: "object",
        properties: {
          department: {
            type: "string",
            enum: ["financeiro", "tecnico", "comercial", "logistica", "suporte_n1"],
            description: "Departamento responsável"
          },
          subject: {
            type: "string",
            description: "Assunto do ticket (máx 100 chars)"
          },
          summary: {
            type: "string",
            description: "Resumo do problema/solicitação"
          },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "critical"],
            description: "Prioridade do ticket"
          },
          metadata: {
            type: "object",
            description: "Dados adicionais (order_id, error_code, etc)"
          },
          pix_key_type: {
            type: "string",
            enum: ["cpf", "email", "telefone", "chave_aleatoria"],
            description: "Tipo da chave PIX informada pelo cliente (apenas para tickets de saque)"
          }
        },
        required: ["department", "subject", "summary"]
      }
    },
    {
      name: "transfer_to_department",
      description: "Transfere a conversa para um agente humano de um departamento específico",
      input_schema: {
        type: "object",
        properties: {
          department: {
            type: "string",
            enum: ["financeiro", "tecnico", "comercial", "logistica", "suporte_n1"],
            description: "Departamento de destino"
          },
          reason: {
            type: "string",
            description: "Motivo da transferência (para registro)"
          },
          priority: {
            type: "string",
            enum: ["normal", "urgent"],
            description: "Urgência da transferência"
          }
        },
        required: ["department", "reason"]
      }
    },
    {
      name: "summarize_for_handoff",
      description: "Gera um resumo estruturado da conversa para o agente humano",
      input_schema: {
        type: "object",
        properties: {
          conversation_id: {
            type: "string",
            description: "ID da conversa"
          },
          include_sentiment: {
            type: "boolean",
            description: "Incluir análise de sentimento"
          }
        },
        required: ["conversation_id"]
      }
    },
    {
      name: "check_customer_eligibility",
      description: "Verifica elegibilidade do cliente para ação específica (reembolso, upgrade, etc)",
      input_schema: {
        type: "object",
        properties: {
          customer_id: {
            type: "string",
            description: "ID do cliente"
          },
          action: {
            type: "string",
            enum: ["refund", "chargeback", "upgrade", "cancellation", "withdrawal"],
            description: "Tipo de ação a verificar"
          }
        },
        required: ["customer_id", "action"]
      }
    },
    {
      name: "schedule_callback",
      description: "Agenda retorno de ligação ou contato",
      input_schema: {
        type: "object",
        properties: {
          customer_id: {
            type: "string",
            description: "ID do cliente"
          },
          datetime: {
            type: "string",
            format: "date-time",
            description: "Data/hora desejada (ISO 8601)"
          },
          channel: {
            type: "string",
            enum: ["phone", "whatsapp", "email"],
            description: "Canal de contato preferido"
          },
          notes: {
            type: "string",
            description: "Observações para o agente"
          }
        },
        required: ["customer_id", "datetime", "channel"]
      }
    },
    {
      name: "close_conversation",
      description: "Encerra a conversa após confirmação do cliente. Usar em 2 etapas: primeiro perguntar, depois executar com customer_confirmed=true.",
      input_schema: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description: "Motivo do encerramento (ex: assunto_resolvido, cliente_agradeceu)"
          },
          customer_confirmed: {
            type: "boolean",
            description: "true SOMENTE após cliente confirmar explicitamente"
          }
        },
        required: ["reason", "customer_confirmed"]
      }
    },
    {
      name: "classify_and_resolve_ticket",
      description: "Classifica e registra resolução após encerramento confirmado. Use APÓS close_conversation com customer_confirmed=true.",
      input_schema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["financeiro", "tecnico", "bug", "outro", "devolucao", "reclamacao", "saque"],
            description: "Categoria do atendimento"
          },
          summary: {
            type: "string",
            description: "Resumo curto da resolução (máx 200 chars)"
          },
          resolution_notes: {
            type: "string",
            description: "Detalhes de como foi resolvido"
          },
          severity: {
            type: "string",
            enum: ["low", "medium", "high"],
            description: "Gravidade do problema"
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Tags descritivas"
          }
        },
        required: ["category", "summary", "resolution_notes"]
      }
    }
  ]
};

// Tipos TypeScript derivados do schema
export type ToolName = 
  | 'search_knowledge'
  | 'fetch_customer'
  | 'fetch_order'
  | 'create_ticket'
  | 'transfer_to_department'
  | 'summarize_for_handoff'
  | 'check_customer_eligibility'
  | 'schedule_callback'
  | 'close_conversation'
  | 'classify_and_resolve_ticket';

export interface ToolCall {
  name: ToolName;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  tool_name: ToolName;
  success: boolean;
  result?: unknown;
  error?: string;
}

// Mapeamento de departamentos para IDs reais
export const DEPARTMENT_MAPPING: Record<string, string> = {
  financeiro: 'Financeiro',
  tecnico: 'Suporte Técnico',
  comercial: 'Comercial',
  logistica: 'Logística',
  suporte_n1: 'Suporte'
};

// Helper para validar tool call
export function validateToolCall(call: ToolCall): { valid: boolean; error?: string } {
  const tool = AI_TOOLS_SCHEMA.tools.find(t => t.name === call.name);
  
  if (!tool) {
    return { valid: false, error: `Tool desconhecida: ${call.name}` };
  }

  const schema = tool.input_schema;
  const args = call.arguments;

  // Verificar campos obrigatórios
  for (const required of schema.required || []) {
    if (!(required in args)) {
      return { valid: false, error: `Campo obrigatório ausente: ${required}` };
    }
  }

  return { valid: true };
}
