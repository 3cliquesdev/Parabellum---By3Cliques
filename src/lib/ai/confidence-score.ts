/**
 * Sprint 5: Sistema Anti-Alucinação com SCORE (Atualizado)
 * 
 * Fórmula: SCORE = 0.6 * conf_retrieval + 0.4 * coverage - 0.25 * conflicts
 * 
 * Limiares ATUALIZADOS (mais conservadores):
 * - SCORE >= 0.90: Resposta direta (alta certeza)
 * - 0.80 <= SCORE < 0.90: Resposta cautelosa
 * - SCORE < 0.80: Handoff automático
 */

export interface RetrievedDocument {
  id: string;
  title: string;
  content: string;
  similarity: number;
  updated_at?: string;
}

export interface ConfidenceResult {
  score: number;
  conf_retrieval: number;
  coverage: number;
  conflicts: boolean;
  action: 'direct' | 'cautious' | 'handoff';
  reason: string;
  retrieved_docs: string[];
  recommended_dept?: string;
}

export interface ConfidenceInput {
  query: string;
  documents: RetrievedDocument[];
  intent?: string;
}

// Palavras-chave para detecção de conflitos
const CONFLICT_INDICATORS = [
  'porém', 'entretanto', 'contudo', 'no entanto',
  'diferentemente', 'ao contrário', 'exceto quando',
  'a menos que', 'não mais', 'foi alterado para',
  'nova política', 'atualização', 'mudança'
];

// Gatilhos de handoff imediato
const IMMEDIATE_HANDOFF_TRIGGERS = {
  financeiro: [
    'reembolso', 'estorno', 'pix', 'boleto', 'comissão',
    'cancelar compra', 'dinheiro', 'cobrança indevida',
    'pagamento', 'fatura', 'saque', 'transferência'
  ],
  juridico: [
    'processo', 'advogado', 'justiça', 'procon', 'reclameaqui',
    'denúncia', 'fraude', 'golpe', 'lei', 'direito'
  ],
  sentimento_critico: [
    'raiva', 'furioso', 'absurdo', 'vergonha', 'pior empresa',
    'nunca mais', 'péssimo', 'lixo', 'incompetente'
  ]
};

/**
 * Calcula a cobertura da query pelos documentos
 */
function calculateCoverage(query: string, documents: RetrievedDocument[]): number {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (queryWords.length === 0) return 0;

  const docText = documents.map(d => d.content.toLowerCase()).join(' ');
  const coveredWords = queryWords.filter(word => docText.includes(word));
  
  return coveredWords.length / queryWords.length;
}

/**
 * Detecta conflitos entre documentos
 */
function detectConflicts(documents: RetrievedDocument[]): boolean {
  if (documents.length < 2) return false;

  // Verificar se há documentos recentes que podem conflitar com antigos
  const sortedByDate = [...documents].sort((a, b) => {
    const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    return dateB - dateA;
  });

  // Se o documento mais recente tem mais de 30 dias de diferença do mais antigo
  if (sortedByDate.length >= 2) {
    const newest = sortedByDate[0].updated_at ? new Date(sortedByDate[0].updated_at) : null;
    const oldest = sortedByDate[sortedByDate.length - 1].updated_at 
      ? new Date(sortedByDate[sortedByDate.length - 1].updated_at) 
      : null;
    
    if (newest && oldest) {
      const daysDiff = (newest.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 30) {
        // Verificar se há indicadores de conflito no texto
        const allText = documents.map(d => d.content.toLowerCase()).join(' ');
        return CONFLICT_INDICATORS.some(indicator => allText.includes(indicator));
      }
    }
  }

  return false;
}

/**
 * Verifica gatilhos de handoff imediato
 */
export function checkImmediateHandoff(query: string): { triggered: boolean; dept?: string; reason?: string } {
  const queryLower = query.toLowerCase();

  for (const [dept, keywords] of Object.entries(IMMEDIATE_HANDOFF_TRIGGERS)) {
    const matched = keywords.find(kw => queryLower.includes(kw));
    if (matched) {
      return {
        triggered: true,
        dept: dept === 'sentimento_critico' ? 'suporte_n1' : dept,
        reason: `Gatilho imediato: ${matched} (${dept})`
      };
    }
  }

  return { triggered: false };
}

/**
 * Calcula o SCORE de confiança
 */
export function calculateConfidenceScore(input: ConfidenceInput): ConfidenceResult {
  const { query, documents } = input;

  // Verificar gatilhos de handoff imediato
  const immediateCheck = checkImmediateHandoff(query);
  if (immediateCheck.triggered) {
    return {
      score: 0,
      conf_retrieval: 0,
      coverage: 0,
      conflicts: false,
      action: 'handoff',
      reason: immediateCheck.reason || 'Gatilho de handoff imediato',
      retrieved_docs: [],
      recommended_dept: immediateCheck.dept
    };
  }

  // Se não há documentos, handoff
  if (documents.length === 0) {
    return {
      score: 0,
      conf_retrieval: 0,
      coverage: 0,
      conflicts: false,
      action: 'handoff',
      reason: 'Nenhum documento relevante encontrado na KB',
      retrieved_docs: [],
      recommended_dept: 'suporte_n1'
    };
  }

  // Calcular métricas
  const conf_retrieval = Math.max(...documents.map(d => d.similarity));
  const coverage = calculateCoverage(query, documents);
  const conflicts = detectConflicts(documents);

  // Fórmula: SCORE = 0.6 * conf_retrieval + 0.4 * coverage - 0.25 * conflicts
  const conflictPenalty = conflicts ? 0.25 : 0;
  const score = Math.max(0, Math.min(1, 
    0.6 * conf_retrieval + 0.4 * coverage - conflictPenalty
  ));

  // Determinar ação - FASE 5: Thresholds mais conservadores
  let action: 'direct' | 'cautious' | 'handoff';
  let reason: string;

  // SCORE_DIRECT = 0.90, SCORE_CAUTIOUS = 0.80
  if (score >= 0.90) {
    action = 'direct';
    reason = `Alta confiança (${(score * 100).toFixed(0)}%) - resposta direta`;
  } else if (score >= 0.80) {
    action = 'cautious';
    reason = `Confiança média (${(score * 100).toFixed(0)}%) - resposta cautelosa`;
  } else {
    action = 'handoff';
    reason = `Baixa confiança (${(score * 100).toFixed(0)}%) - transferência recomendada`;
  }

  if (conflicts) {
    reason += ' (conflitos detectados)';
    // Se há conflitos e score baixo, força handoff
    if (score < 0.80) {
      action = 'handoff';
      reason = 'Documentos conflitantes detectados - transferência necessária';
    }
  }

  return {
    score,
    conf_retrieval,
    coverage,
    conflicts,
    action,
    reason,
    retrieved_docs: documents.map(d => d.id),
    recommended_dept: action === 'handoff' ? pickDepartment(query) : undefined
  };
}

/**
 * Sprint 4: Routing de departamentos baseado em palavras-chave
 */
export function pickDepartment(question: string): string {
  const keywords: Record<string, string[]> = {
    financeiro: ['pix', 'reembolso', 'estorno', 'comissão', 'boleto', 'fatura', 'saque', 'pagamento'],
    tecnico: ['erro', 'bug', 'login', 'acesso', 'integração', 'api', 'token', 'senha', 'não funciona'],
    comercial: ['preço', 'proposta', 'plano', 'upgrade', 'desconto', 'promoção', 'comprar'],
    logistica: ['envio', 'prazo', 'entrega', 'coleta', 'rastreio', 'correios', 'transportadora']
  };

  const questionLower = question.toLowerCase();
  
  for (const [dept, words] of Object.entries(keywords)) {
    if (words.some(w => questionLower.includes(w))) {
      return dept;
    }
  }
  
  return 'suporte_n1';
}

/**
 * Gera resposta baseada no nível de confiança
 */
export function generateResponsePrefix(result: ConfidenceResult): string {
  switch (result.action) {
    case 'direct':
      return '';
    case 'cautious':
      return '⚠️ Baseado nas informações disponíveis: ';
    case 'handoff':
      return '';
    default:
      return '';
  }
}

/**
 * Log estruturado para métricas
 */
export interface ConfidenceLog {
  conversation_id: string;
  timestamp: string;
  score: number;
  conf_retrieval: number;
  coverage: number;
  conflicts: boolean;
  action: string;
  reason: string;
  retrieved_docs: string[];
  dept?: string;
  query_preview: string;
}

export function createConfidenceLog(
  conversationId: string,
  query: string,
  result: ConfidenceResult
): ConfidenceLog {
  return {
    conversation_id: conversationId,
    timestamp: new Date().toISOString(),
    score: result.score,
    conf_retrieval: result.conf_retrieval,
    coverage: result.coverage,
    conflicts: result.conflicts,
    action: result.action,
    reason: result.reason,
    retrieved_docs: result.retrieved_docs,
    dept: result.recommended_dept,
    query_preview: query.substring(0, 100)
  };
}
