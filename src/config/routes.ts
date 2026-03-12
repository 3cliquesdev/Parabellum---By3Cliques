import {
  Activity,
  LayoutDashboard, 
  Inbox,
  Users, 
  Building2, 
  TrendingUp, 
  FileText,
  Settings,
  UserCog,
  Zap,
  Mail,
  BarChart3,
  Target,
  Upload,
  Brain,
  Package,
  Briefcase,
  Book,
  Ticket,
  MessageCircle,
  DollarSign,
  CheckSquare,
  Workflow,
  Receipt,
  RefreshCw,
  CheckCircle2,
  
  AlertTriangle,
  Crown,
  ClipboardList,
  Kanban,
  Instagram,
  LucideIcon
} from "lucide-react";

// ========== TIPOS ==========
export interface MenuItem {
  title: string;
  href: string;
  icon: LucideIcon;
  permission: string;
}

export interface MenuGroup {
  label: string;
  items: MenuItem[];
}

// ========== MENU UNIVERSAL 100% DINÂMICO ==========
// Todos os itens de menu possíveis organizados por grupo
// A visibilidade é controlada EXCLUSIVAMENTE por hasPermission()
export const universalMenuGroups: MenuGroup[] = [
  {
    label: "Visão Geral",
    items: [
      { title: "Dashboard", href: "/", icon: LayoutDashboard, permission: "dashboard.view" },
      { title: "Gestão de Vendas", href: "/sales-management", icon: TrendingUp, permission: "sales.view_management" },
      { title: "Dashboard CS", href: "/cs-management", icon: BarChart3, permission: "cs.view_management" },
      { title: "Analytics", href: "/analytics", icon: BarChart3, permission: "analytics.view" },
      { title: "Dashboards", href: "/dashboards", icon: LayoutDashboard, permission: "analytics.view" },
      { title: "Assinaturas", href: "/subscriptions", icon: RefreshCw, permission: "analytics.view" },
    ]
  },
  {
    label: "Inbox & Suporte",
    items: [
      { title: "Inbox", href: "/inbox", icon: MessageCircle, permission: "inbox.access" },
      { title: "Instagram", href: "/instagram", icon: Instagram, permission: "inbox.access" },
      { title: "Fila de Tickets", href: "/support", icon: Ticket, permission: "tickets.view" },
      { title: "Dashboard Suporte", href: "/support-dashboard", icon: BarChart3, permission: "analytics.view" },
      { title: "Base de Conhecimento", href: "/knowledge", icon: Book, permission: "inbox.view_knowledge" },
    ]
  },
  {
    label: "Vendas",
    items: [
      { title: "Negócios", href: "/deals", icon: DollarSign, permission: "deals.view" },
      { title: "Propostas", href: "/quotes", icon: Receipt, permission: "quotes.view" },
      { title: "Workzone", href: "/sales-tasks", icon: CheckCircle2, permission: "sales.view_workzone" },
      { title: "Cadências", href: "/cadences", icon: RefreshCw, permission: "cadences.manage" },
    ]
  },
  {
    label: "Customer Success",
    items: [
      { title: "Minha Carteira", href: "/my-portfolio", icon: Briefcase, permission: "cs.view_own_portfolio" },
      { title: "Minhas Metas", href: "/goals", icon: Target, permission: "goals.view_own" },
    ]
  },
  {
    label: "CRM",
    items: [
      { title: "Contatos", href: "/contacts", icon: Users, permission: "contacts.view" },
      { title: "Organizações", href: "/organizations", icon: Building2, permission: "contacts.view_organizations" },
    ]
  },
  {
    label: "Automação & AI",
    items: [
      { title: "Automações", href: "/automations", icon: Zap, permission: "automations.view" },
      { title: "AI Studio", href: "/ai-studio/personas", icon: Brain, permission: "ai.manage_personas" },
      { title: "AI Messages", href: "/settings/ai-messages", icon: MessageCircle, permission: "ai.manage_personas" },
      { title: "AI Trainer", href: "/settings/ai-trainer", icon: Brain, permission: "ai.train" },
      { title: "AI Telemetria", href: "/ai-telemetry", icon: Activity, permission: "ai.manage_personas" },
      { title: "Templates de Email", href: "/email-templates", icon: Mail, permission: "email.view_templates" },
      { title: "Formulários", href: "/forms", icon: FileText, permission: "forms.view" },
    ]
  },
  {
    label: "Playbooks",
    items: [
      { title: "Playbooks de Onboarding", href: "/onboarding-builder", icon: Workflow, permission: "playbooks.view" },
      { title: "Execuções de Playbooks", href: "/playbook-executions", icon: CheckSquare, permission: "playbooks.view_executions" },
    ]
  },
  {
    label: "Gestão",
    items: [
      { title: "Projetos", href: "/projects", icon: Kanban, permission: "projects.view" },
      { title: "Definir Metas", href: "/goals-management", icon: Target, permission: "goals.set" },
      { title: "Solicitações Internas", href: "/internal-requests", icon: ClipboardList, permission: "tickets.view" },
      { title: "Relatórios", href: "/reports", icon: FileText, permission: "analytics.export" },
      { title: "Report Builder", href: "/report-builder", icon: FileText, permission: "analytics.view" },
      { title: "Distribuição CS", href: "/reports/consultant-distribution", icon: BarChart3, permission: "reports.distribution" },
      { title: "Distribuição Vendas", href: "/reports/sales-distribution", icon: BarChart3, permission: "reports.lead_distribution" },
      { title: "Detecção de Fraude", href: "/reports/fraud-detection", icon: AlertTriangle, permission: "reports.fraud_detection" },
      { title: "Exportar para NF", href: "/reports/fiscal-export", icon: Receipt, permission: "reports.fiscal_export" },
    ]
  },
  {
    label: "Cadastros",
    items: [
      { title: "Consultores", href: "/consultants", icon: Users, permission: "cadastros.view_consultants" },
      
      { title: "Produtos", href: "/settings/products", icon: Package, permission: "cadastros.view_products" },
      { title: "Depart. & Operações", href: "/settings/departments", icon: Building2, permission: "cadastros.view_departments" },
    ]
  },
  {
    label: "Sistema",
    items: [
      { title: "Usuários", href: "/users", icon: UserCog, permission: "settings.manage_users" },
      { title: "Importar Clientes", href: "/import-clients", icon: Upload, permission: "contacts.import" },
      { title: "Configurações", href: "/settings", icon: Settings, permission: "settings.view" },
    ]
  },
  {
    label: "SUPER ADMIN",
    items: [
      { title: "Painel Admin", href: "/super-admin", icon: Crown, permission: "super_admin.access" },
    ]
  }
];

// ========== HELPERS ==========

/**
 * Busca um item de menu pelo path
 */
export const getRouteByPath = (path: string): MenuItem | undefined => {
  for (const group of universalMenuGroups) {
    const found = group.items.find(item => item.href === path);
    if (found) return found;
  }
  return undefined;
};

/**
 * Busca um item de menu pela permission key
 */
export const getRouteByPermission = (permission: string): MenuItem | undefined => {
  for (const group of universalMenuGroups) {
    const found = group.items.find(item => item.permission === permission);
    if (found) return found;
  }
  return undefined;
};
