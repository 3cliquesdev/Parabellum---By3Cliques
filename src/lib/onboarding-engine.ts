import { supabase } from "@/integrations/supabase/client";
import { 
  MessageCircle, 
  Users, 
  Workflow, 
  BookOpen, 
  Bot, 
  Ticket,
  LucideIcon
} from "lucide-react";

export interface OnboardingStep {
  id: string;
  key: string;
  title: string;
  description: string;
  type: 'action' | 'validation' | 'tour';
  route: string;
  icon: LucideIcon;
  dependencies: string[];
  aiPrompt: string;
}

export type OnboardingStepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface OnboardingStepProgress {
  step_key: string;
  status: OnboardingStepStatus;
  completed_at: string | null;
  validated_by: 'auto' | 'manual' | 'ai' | null;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: '1',
    key: 'connect_channels',
    title: 'Conectar Canais de Comunicação',
    description: 'Configure WhatsApp ou Web Chat para começar a atender seus clientes.',
    type: 'action',
    route: '/settings/whatsapp',
    icon: MessageCircle,
    dependencies: [],
    aiPrompt: 'Explique como conectar canais de comunicação como WhatsApp e Web Chat no CRM.',
  },
  {
    id: '2',
    key: 'import_contacts',
    title: 'Importar Base de Contatos',
    description: 'Adicione sua base de clientes via importação ou criação manual.',
    type: 'action',
    route: '/import-clients',
    icon: Users,
    dependencies: [],
    aiPrompt: 'Explique como importar contatos via Excel ou criar manualmente.',
  },
  {
    id: '3',
    key: 'create_pipeline',
    title: 'Criar Pipeline de Vendas',
    description: 'Configure seu funil de vendas com etapas personalizadas.',
    type: 'action',
    route: '/deals',
    icon: Workflow,
    dependencies: [],
    aiPrompt: 'Explique como criar e configurar um pipeline de vendas no CRM.',
  },
  {
    id: '4',
    key: 'create_playbook',
    title: 'Criar Playbook de Onboarding',
    description: 'Monte uma jornada automatizada para seus clientes.',
    type: 'action',
    route: '/onboarding-builder',
    icon: BookOpen,
    dependencies: [],
    aiPrompt: 'Explique como criar um playbook de onboarding com etapas automatizadas.',
  },
  {
    id: '5',
    key: 'activate_ai',
    title: 'Ativar Assistente de IA',
    description: 'Configure uma persona de IA para atendimento automatizado.',
    type: 'action',
    route: '/ai-studio/personas',
    icon: Bot,
    dependencies: [],
    aiPrompt: 'Explique como configurar uma persona de IA para atendimento automatizado.',
  },
  {
    id: '6',
    key: 'create_ticket',
    title: 'Criar Primeiro Ticket',
    description: 'Experimente o sistema de tickets criando um chamado de teste.',
    type: 'action',
    route: '/support',
    icon: Ticket,
    dependencies: [],
    aiPrompt: 'Explique como criar e gerenciar tickets de suporte no CRM.',
  },
];

// Funções de validação para cada etapa
export async function validateStep(stepKey: string): Promise<boolean> {
  try {
    switch (stepKey) {
      case 'connect_channels': {
        const { count } = await supabase
          .from('whatsapp_instances')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'connected') as { count: number | null };
        return (count || 0) > 0;
      }
      
      case 'import_contacts': {
        const { count } = await supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true }) as { count: number | null };
        return (count || 0) > 0;
      }
      
      case 'create_pipeline': {
        const { count } = await supabase
          .from('pipelines')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true) as { count: number | null };
        return (count || 0) > 0;
      }
      
      case 'create_playbook': {
        const { count } = await supabase
          .from('onboarding_playbooks')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true) as { count: number | null };
        return (count || 0) > 0;
      }
      
      case 'activate_ai': {
        const { count } = await supabase
          .from('ai_personas')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true) as { count: number | null };
        return (count || 0) > 0;
      }
      
      case 'create_ticket': {
        const { count } = await supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true }) as { count: number | null };
        return (count || 0) > 0;
      }
      
      default:
        return false;
    }
  } catch (error) {
    console.error(`Error validating step ${stepKey}:`, error);
    return false;
  }
}

export function getStepByKey(key: string): OnboardingStep | undefined {
  return ONBOARDING_STEPS.find(step => step.key === key);
}

export function calculateProgress(completedSteps: number): number {
  return Math.round((completedSteps / ONBOARDING_STEPS.length) * 100);
}
