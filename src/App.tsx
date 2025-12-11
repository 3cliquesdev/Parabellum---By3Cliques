import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import RealtimeNotifications from "./components/RealtimeNotifications";
import Dashboard from "./pages/Dashboard";
import Inbox from "./pages/Inbox";
import Contacts from "./pages/Contacts";
import ContactDetails from "./pages/ContactDetails";
import Organizations from "./pages/Organizations";
import Deals from "./pages/Deals";
import Quotes from "@/pages/Quotes";
import PublicQuote from "@/pages/PublicQuote";
import QuoteBuilder from "@/pages/QuoteBuilder";
import Forms from "./pages/Forms";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import EmailTemplates from "./pages/EmailTemplates";
import EmailSettingsPage from "./pages/EmailSettingsPage";
import EmailBuilderPage from "./pages/EmailBuilderPage";
import EmailBuilderV2Page from "./pages/EmailBuilderV2Page";
import Products from "./pages/Products";
import Departments from "./pages/Departments";
import PublicForm from "./pages/PublicForm";
import PublicFormV2 from "./pages/PublicFormV2";
import FormBuilderPage from "./pages/FormBuilderPage";
import PublicChat from "./pages/PublicChat";
import PublicChatWindow from "./pages/PublicChatWindow";
import ChatLinksSettings from "./pages/ChatLinksSettings";
import WidgetBuilder from "./pages/WidgetBuilder";
import Auth from "./pages/Auth";
import Automations from "./pages/Automations";
import Analytics from "./pages/Analytics";
import TVMode from "./pages/TVMode";
import SetupPassword from "./pages/SetupPassword";
import Goals from "./pages/Goals";
import GoalsManagement from "./pages/GoalsManagement";
import ImportClients from "./pages/ImportClients";
import Support from "./pages/Support";
import Knowledge from "./pages/Knowledge";
import PublicTicketForm from "./pages/PublicTicketForm";
import AIStudio from "./pages/AIStudio";
import MyPortfolio from "./pages/MyPortfolio";
import CSManagement from "./pages/CSManagement";
import SalesManagement from "./pages/SalesManagement";
import SalesRepDetail from "./pages/SalesRepDetail";
import OnboardingBuilder from "./pages/OnboardingBuilder";
import PlaybookExecutions from "./pages/PlaybookExecutions";
import KnowledgeImport from "./pages/KnowledgeImport";
import DeliveryGroups from "./pages/DeliveryGroups";
import Cadences from "./pages/Cadences";
import SalesTasks from "./pages/SalesTasks";
import Macros from "./pages/Macros";
import Teams from "./pages/Teams";
import NotFound from "./pages/NotFound";
import AuditLogs from "./pages/AuditLogs";
import SkillsSettings from "./pages/SkillsSettings";
import WhatsAppSettings from "./pages/WhatsAppSettings";
import WebhooksSettings from "./pages/WebhooksSettings";
import Reports from "./pages/Reports";
import IntegrationsSettings from "./pages/IntegrationsSettings";
import Tags from "./pages/Tags";
import AITrainer from "./pages/AITrainer";
import SalesRecovery from "./pages/SalesRecovery";
import AdminOnboarding from "./pages/AdminOnboarding";

import ConsultantDetail from "./pages/ConsultantDetail";
import Consultants from "./pages/Consultants";

const queryClient = new QueryClient();

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("🔴 App crashed:", error);
    console.error("🔴 Error stack:", error.stack);
    console.error("🔴 Component stack:", errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Algo deu errado
            </h1>
            <p className="text-muted-foreground mb-4">
              Por favor, recarregue a página
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const App = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <RealtimeNotifications />
          <Routes>
            {/* Public routes - no auth required */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/setup-password" element={<SetupPassword />} />
            <Route path="/public/form/:formId" element={<PublicForm />} />
            <Route path="/public-chat" element={<PublicChat />} />
            <Route path="/public-chat/:conversationId" element={<PublicChatWindow />} />
            <Route path="/open-ticket" element={<PublicTicketForm />} />
            <Route path="/tv" element={<TVMode />} />
            <Route path="/public-quote/:token" element={<PublicQuote />} />
            <Route path="/f/:formId" element={<PublicFormV2 />} />

            {/* Protected routes - using requiredPermission for unified access control */}
            <Route path="/" element={<ProtectedRoute requiredPermission="dashboard.access"><Layout><Dashboard /></Layout></ProtectedRoute>} />
            <Route path="/inbox" element={<ProtectedRoute requiredPermission="inbox.access"><Layout><Inbox /></Layout></ProtectedRoute>} />
            <Route path="/my-portfolio" element={<ProtectedRoute requiredPermission="cs.view_own_portfolio"><Layout><MyPortfolio /></Layout></ProtectedRoute>} />
            <Route path="/cs-management" element={<ProtectedRoute requiredPermission="cs.view_dashboard"><Layout><CSManagement /></Layout></ProtectedRoute>} />
            <Route path="/cs-management/consultant/:id" element={<ProtectedRoute requiredPermission="cs.view_dashboard"><Layout><ConsultantDetail /></Layout></ProtectedRoute>} />
            <Route path="/consultants" element={<ProtectedRoute requiredPermission="cs.view_dashboard"><Layout><Consultants /></Layout></ProtectedRoute>} />
            <Route path="/sales-management" element={<ProtectedRoute requiredPermission="sales.view_dashboard"><Layout><SalesManagement /></Layout></ProtectedRoute>} />
            <Route path="/sales-management/rep/:id" element={<ProtectedRoute requiredPermission="sales.view_dashboard"><Layout><SalesRepDetail /></Layout></ProtectedRoute>} />
            <Route path="/contacts" element={<ProtectedRoute requiredPermission="contacts.view"><Layout><Contacts /></Layout></ProtectedRoute>} />
            <Route path="/contacts/:id" element={<ProtectedRoute requiredPermission="contacts.view"><Layout><ContactDetails /></Layout></ProtectedRoute>} />
            <Route path="/organizations" element={<ProtectedRoute requiredPermission="contacts.view"><Layout><Organizations /></Layout></ProtectedRoute>} />
            <Route path="/deals" element={<ProtectedRoute requiredPermission="sales.view_deals"><Layout><Deals /></Layout></ProtectedRoute>} />
            <Route path="/quotes" element={<ProtectedRoute requiredPermission="quotes.view"><Layout><Quotes /></Layout></ProtectedRoute>} />
            <Route path="/quotes/new" element={<ProtectedRoute requiredPermission="quotes.create"><Layout><QuoteBuilder /></Layout></ProtectedRoute>} />
            <Route path="/forms" element={<ProtectedRoute requiredPermission="forms.view"><Layout><Forms /></Layout></ProtectedRoute>} />
            <Route path="/forms/builder" element={<ProtectedRoute requiredPermission="forms.create"><FormBuilderPage /></ProtectedRoute>} />
            <Route path="/forms/builder/:formId" element={<ProtectedRoute requiredPermission="forms.edit"><FormBuilderPage /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute requiredPermission="settings.manage_users"><Layout><Users /></Layout></ProtectedRoute>} />
            <Route path="/automations" element={<ProtectedRoute requiredPermission="automations.view"><Layout><Automations /></Layout></ProtectedRoute>} />
            <Route path="/email-templates" element={<ProtectedRoute requiredPermission="email.manage_templates"><Layout><EmailTemplates /></Layout></ProtectedRoute>} />
            <Route path="/email-templates/builder" element={<ProtectedRoute requiredPermission="email.manage_templates"><EmailBuilderPage /></ProtectedRoute>} />
            <Route path="/email-templates/builder/:templateId" element={<ProtectedRoute requiredPermission="email.manage_templates"><EmailBuilderPage /></ProtectedRoute>} />
            <Route path="/email-templates/v2/builder/:id" element={<ProtectedRoute requiredPermission="email.manage_templates"><EmailBuilderV2Page /></ProtectedRoute>} />
            <Route path="/onboarding-builder" element={<ProtectedRoute requiredPermission="playbooks.view"><Layout><OnboardingBuilder /></Layout></ProtectedRoute>} />
            <Route path="/playbook-executions" element={<ProtectedRoute requiredPermission="playbooks.view_executions"><Layout><PlaybookExecutions /></Layout></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute requiredPermission="analytics.view"><Layout><Analytics /></Layout></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute requiredPermission="analytics.view"><Layout><Reports /></Layout></ProtectedRoute>} />
            <Route path="/goals" element={<ProtectedRoute requiredPermission="goals.view_own"><Layout><Goals /></Layout></ProtectedRoute>} />
            <Route path="/goals-management" element={<ProtectedRoute requiredPermission="goals.manage"><Layout><GoalsManagement /></Layout></ProtectedRoute>} />
            <Route path="/cadences" element={<ProtectedRoute requiredPermission="sales.manage_cadences"><Layout><Cadences /></Layout></ProtectedRoute>} />
            <Route path="/sales-tasks" element={<ProtectedRoute requiredPermission="sales.view_deals"><Layout><SalesTasks /></Layout></ProtectedRoute>} />
            <Route path="/support" element={<ProtectedRoute requiredPermission="tickets.view"><Layout><Support /></Layout></ProtectedRoute>} />
            <Route path="/knowledge" element={<ProtectedRoute requiredPermission="ai.manage_knowledge"><Layout><Knowledge /></Layout></ProtectedRoute>} />
            <Route path="/ai-studio/personas" element={<ProtectedRoute requiredPermission="ai.manage_personas"><Layout><AIStudio /></Layout></ProtectedRoute>} />
            <Route path="/import-clients" element={<ProtectedRoute requiredPermission="contacts.import"><Layout><ImportClients /></Layout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute requiredPermission="settings.view"><Layout><Settings /></Layout></ProtectedRoute>} />
            <Route path="/settings/integrations" element={<ProtectedRoute requiredPermission="settings.manage_integrations"><Layout><IntegrationsSettings /></Layout></ProtectedRoute>} />
            <Route path="/settings/email" element={<ProtectedRoute requiredPermission="email.manage_templates"><EmailSettingsPage /></ProtectedRoute>} />
            <Route path="/settings/ai-trainer" element={<ProtectedRoute requiredPermission="ai.manage_personas"><Layout><AITrainer /></Layout></ProtectedRoute>} />
            <Route path="/settings/email-templates" element={<ProtectedRoute requiredPermission="email.manage_templates"><EmailTemplates /></ProtectedRoute>} />
            <Route path="/settings/products" element={<ProtectedRoute requiredPermission="cadastros.view_products"><Layout><Products /></Layout></ProtectedRoute>} />
            <Route path="/settings/delivery-groups" element={<ProtectedRoute requiredPermission="playbooks.view"><Layout><DeliveryGroups /></Layout></ProtectedRoute>} />
            <Route path="/settings/departments" element={<ProtectedRoute requiredPermission="cadastros.view_departments"><Layout><Departments /></Layout></ProtectedRoute>} />
            <Route path="/settings/chat-links" element={<ProtectedRoute requiredPermission="settings.manage_integrations"><Layout><ChatLinksSettings /></Layout></ProtectedRoute>} />
            <Route path="/settings/widget-builder" element={<ProtectedRoute requiredPermission="settings.manage_integrations"><Layout><WidgetBuilder /></Layout></ProtectedRoute>} />
            <Route path="/settings/knowledge-import" element={<ProtectedRoute requiredPermission="ai.manage_knowledge"><Layout><KnowledgeImport /></Layout></ProtectedRoute>} />
            <Route path="/settings/audit-logs" element={<ProtectedRoute requiredPermission="audit.view_logs"><Layout><AuditLogs /></Layout></ProtectedRoute>} />
            <Route path="/settings/skills" element={<ProtectedRoute requiredPermission="settings.view"><Layout><SkillsSettings /></Layout></ProtectedRoute>} />
            <Route path="/settings/whatsapp" element={<ProtectedRoute requiredPermission="settings.manage_integrations"><Layout><WhatsAppSettings /></Layout></ProtectedRoute>} />
            <Route path="/settings/webhooks" element={<ProtectedRoute requiredPermission="settings.manage_integrations"><Layout><WebhooksSettings /></Layout></ProtectedRoute>} />
            <Route path="/settings/macros" element={<ProtectedRoute requiredPermission="inbox.access"><Layout><Macros /></Layout></ProtectedRoute>} />
            <Route path="/settings/teams" element={<ProtectedRoute requiredPermission="settings.manage_users"><Layout><Teams /></Layout></ProtectedRoute>} />
            <Route path="/settings/tags" element={<ProtectedRoute requiredPermission="cadastros.view_tags"><Layout><Tags /></Layout></ProtectedRoute>} />
            <Route path="/settings/recovery" element={<ProtectedRoute requiredPermission="playbooks.trigger_manual"><Layout><SalesRecovery /></Layout></ProtectedRoute>} />
            <Route path="/admin-onboarding" element={<ProtectedRoute requiredPermission="settings.view"><AdminOnboarding /></ProtectedRoute>} />
            
            {/* Catch-all route - must be last */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;
