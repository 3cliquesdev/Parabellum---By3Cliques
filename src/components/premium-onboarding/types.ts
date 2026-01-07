export interface OnboardingFormData {
  // Step 1 - Dados pessoais
  name: string;
  email: string;
  whatsapp: string;
  
  // Step 2 - Conhecimento
  knowledge_it: number;
  knowledge_internet: number;
  
  // Step 3 - Dispositivos
  main_device: string;
  social_networks: string[];
  
  // Step 4 - Experiência
  has_online_store: boolean | null;
  dropshipping_experience: string;
  platform_used?: string;
  
  // Step 5 - Formalização
  formalization: string;
  investment_budget: string;
}

export interface StepProps {
  data: OnboardingFormData;
  onChange: (field: keyof OnboardingFormData, value: any) => void;
  errors: Partial<Record<keyof OnboardingFormData, string>>;
}

export const INVESTMENT_OPTIONS = [
  { value: "ate_500", label: "Até R$ 500" },
  { value: "500_1000", label: "R$ 500 - R$ 1.000" },
  { value: "1000_3000", label: "R$ 1.000 - R$ 3.000" },
  { value: "3000_5000", label: "R$ 3.000 - R$ 5.000" },
  { value: "acima_5000", label: "Acima de R$ 5.000" },
];

export const FORMALIZATION_OPTIONS = [
  { value: "cnpj", label: "Sim, tenho CNPJ" },
  { value: "mei", label: "Sim, tenho MEI" },
  { value: "nao_tenho", label: "Não tenho" },
  { value: "pretendo_abrir", label: "Pretendo abrir" },
];

export const DROPSHIPPING_OPTIONS = [
  { value: "sim_vendi", label: "Sim, já vendi" },
  { value: "sim_nunca_vendi", label: "Sim, mas nunca vendi" },
  { value: "nao_conheco", label: "Não conheço" },
];

export const DEVICE_OPTIONS = [
  { value: "celular", label: "Celular" },
  { value: "computador", label: "Computador" },
  { value: "tablet", label: "Tablet" },
  { value: "todos", label: "Todos" },
];

export const SOCIAL_NETWORKS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "facebook", label: "Facebook" },
  { value: "youtube", label: "YouTube" },
  { value: "nenhuma", label: "Nenhuma" },
];
