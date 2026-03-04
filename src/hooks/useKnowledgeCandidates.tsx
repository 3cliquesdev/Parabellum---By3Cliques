import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CandidateStatus = 'pending' | 'approved' | 'rejected' | 'all';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface EvidenceSnippet {
  role: string;
  content: string;
}

export interface KnowledgeCandidate {
  id: string;
  problem: string;
  solution: string;
  when_to_use: string | null;
  when_not_to_use: string | null;
  category: string | null;
  tags: string[];
  department_id: string | null;
  source_conversation_id: string | null;
  confidence_score: number | null;
  extracted_by: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  // 🆕 Safety & quality fields
  contains_pii: boolean;
  risk_level: RiskLevel;
  duplicate_of: string | null;
  clarity_score: number | null;
  completeness_score: number | null;
  evidence_snippets: EvidenceSnippet[];
  sanitized_solution: string | null;
  // Joined data
  conversations?: {
    id: string;
    contact: {
      first_name: string;
      last_name: string;
    } | null;
    closed_at: string | null;
  } | null;
  departments?: {
    name: string;
  } | null;
  duplicate_article?: {
    id: string;
    title: string;
  } | null;
}

export interface CandidateFilters {
  riskLevel?: RiskLevel;
  containsPii?: boolean;
  category?: string;
}

export function useKnowledgeCandidates(status: CandidateStatus = 'pending', filters?: CandidateFilters) {
  return useQuery({
    queryKey: ['knowledge-candidates', status, filters],
    queryFn: async (): Promise<KnowledgeCandidate[]> => {
      let query = supabase
        .from('knowledge_candidates')
        .select(`
          *,
          conversations:source_conversation_id (
            id,
            contact:contact_id (first_name, last_name),
            closed_at
          ),
          departments:department_id (name),
          duplicate_article:duplicate_of (id, title)
        `)
        .order('created_at', { ascending: false });

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      if (filters?.riskLevel) {
        query = query.eq('risk_level', filters.riskLevel);
      }
      if (filters?.containsPii !== undefined) {
        query = query.eq('contains_pii', filters.containsPii);
      }
      if (filters?.category) {
        query = query.eq('category', filters.category);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching knowledge candidates:', error);
        throw error;
      }
      
      return (data || []) as unknown as KnowledgeCandidate[];
    },
  });
}

export function useKnowledgeCandidateStats() {
  return useQuery({
    queryKey: ['knowledge-candidates-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('knowledge_candidates')
        .select('status, contains_pii, risk_level');

      if (error) throw error;

      const counts = {
        pending: 0,
        approved: 0,
        rejected: 0,
        total: data?.length || 0,
        pii_flagged: 0,
        high_risk: 0,
      };

      data?.forEach((item: any) => {
        if (item.status === 'pending') counts.pending++;
        else if (item.status === 'approved') counts.approved++;
        else if (item.status === 'rejected') counts.rejected++;
        if (item.contains_pii) counts.pii_flagged++;
        if (item.risk_level === 'high') counts.high_risk++;
      });

      return counts;
    },
  });
}
