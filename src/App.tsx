import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import RealtimeNotifications from "./components/RealtimeNotifications";
import { WhatsAppDisconnectMonitor } from "./components/WhatsAppDisconnectMonitor";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { UpdatePrompt } from "./components/UpdatePrompt";

// Pages
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
import FraudDetection from "./pages/reports/FraudDetection";
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
import ConsultantDistribution from "./pages/reports/ConsultantDistribution";
import FiscalExport from "./pages/reports/FiscalExport";
import SalesRepDistribution from "./pages/reports/SalesRepDistribution";
import DebugRoutes from "./pages/DebugRoutes";
import AIMessagesSettings from "./pages/AIMessagesSettings";
import TicketNotificationRulesSettings from "./pages/TicketNotificationRulesSettings";
import PublicOnboarding from "./pages/PublicOnboarding";
import SLASettings from "./pages/SLASettings";
import CustomerFiscalData from "./pages/CustomerFiscalData";
import SuperAdminPanel from "./pages/SuperAdminPanel";
import InternalRequests from "./pages/InternalRequests";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds - reduces refetches
      gcTime: 5 * 60 * 1000, // 5 minutes - garbage collection time
      retry: 1, // Only retry once on failure
      refetchOnWindowFocus: false, // Reduce unnecessary refetches
    },
  },
});

const App = () => {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <UpdatePrompt />
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <RealtimeNotifications />
          <WhatsAppDisconnectMonitor />
          <Routes>
            {/* Public routes - no auth required */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/setup-password" element={<SetupPassword />} />
            <Route path="/public/form/:formId" element={<PublicFormV2 />} />
            <Route path="/public-chat" element={<PublicChat />} />
            <Route path="/public-chat/:conversationId" element={<PublicChatWindow />} />
            <Route path="/open-ticket" element={<PublicTicketForm />} />
            <Route path="/tv" element={<TVMode />} />
            <Route path="/public-quote/:token" element={<PublicQuote />} />
            <Route path="/f/:formId" element={<PublicFormV2 />} />
            <Route path="/public-onboarding/:executionId" element={<PublicOnboarding />} />
            <Route path="/public-onboarding/playbook/:playbookId" element={<PublicOnboarding />} />
            <Route path="/meu-cadastro" element={<CustomerFiscalData />} />

            {/* Debug routes - dev only */}
            <Route path="/debug/routes" element={<DebugRoutes />} />

            {/* Protected routes - using requiredPermission for unified access control */}
            <Route path="/" element={<ProtectedRoute requiredPermission="dashboard.view"><Layout><Dashboard /></Layout></ProtectedRoute>} />
            <Route path="/inbox" element={<ProtectedRoute requiredPermission="inbox.access"><Layout><Inbox /></Layout></ProtectedRoute>} />
            <Route path="/my-portfolio" element={<ProtectedRoute requiredPermission="cs.view_own_portfolio"><Layout><MyPortfolio /></Layout></ProtectedRoute>} />
            <Route path="/cs-management" element={<ProtectedRoute requiredPermission="cs.view_management"><Layout><CSManagement /></Layout></ProtectedRoute>} />
            <Route path="/cs-management/consultant/:id" element={<ProtectedRoute requiredPermission="cs.view_management"><Layout><ConsultantDetail /></Layout></ProtectedRoute>} />
            <Route path="/consultants" element={<ProtectedRoute requiredPermission="cadastros.view_consultants"><Layout><Consultants /></Layout></ProtectedRoute>} />
            <Route path="/sales-management" element={<ProtectedRoute requiredPermission="sales.view_management"><Layout><SalesManagement /></Layout></ProtectedRoute>} />
            <Route path="/sales-management/rep/:id" element={<ProtectedRoute requiredPermission="sales.view_management"><Layout><SalesRepDetail /></Layout></ProtectedRoute>} />
            
            <Route path="/contacts" element={<ProtectedRoute requiredPermission="contacts.view"><Layout><Contacts /></Layout></ProtectedRoute>} />
            <Route path="/contacts/:id" element={<ProtectedRoute requiredPermission="contacts.view"><Layout><ContactDetails /></Layout></ProtectedRoute>} />
            <Route path="/organizations" element={<ProtectedRoute requiredPermission="contacts.view_organizations"><Layout><Organizations /></Layout></ProtectedRoute>} />
            <Route path="/deals" element={<ProtectedRoute requiredPermission="deals.view"><Layout><Deals /></Layout></ProtectedRoute>} />
            <Route path="/quotes" element={<ProtectedRoute requiredPermission="quotes.view"><Layout><Quotes /></Layout></ProtectedRoute>} />
            <Route path="/quotes/new" element={<ProtectedRoute requiredPermission="quotes.create"><Layout><QuoteBuilder /></Layout></ProtectedRoute>} />
            <Route path="/forms" element={<ProtectedRoute requiredPermission="forms.view"><Layout><Forms /></Layout></ProtectedRoute>} />
            <Route path="/forms/builder" element={<ProtectedRoute requiredPermission="forms.create"><FormBuilderPage /></ProtectedRoute>} />
            <Route path="/forms/builder/:formId" element={<ProtectedRoute requiredPermission="forms.edit"><FormBuilderPage /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute requiredPermission="settings.manage_users"><Layout><Users /></Layout></ProtectedRoute>} />
            <Route path="/automations" element={<ProtectedRoute requiredPermission="automations.view"><Layout><Automations /></Layout></ProtectedRoute>} />
            <Route path="/email-templates" element={<ProtectedRoute requiredPermission="email.view_templates"><Layout><EmailTemplates /></Layout></ProtectedRoute>} />
            <Route path="/email-templates/builder" element={<ProtectedRoute requiredPermission="email.manage_templates"><EmailBuilderPage /></ProtectedRoute>} />
            <Route path="/email-templates/builder/:templateId" element={<ProtectedRoute requiredPermission="email.manage_templates"><EmailBuilderPage /></ProtectedRoute>} />
            <Route path="/email-templates/v2/builder/:id" element={<ProtectedRoute requiredPermission="email.manage_templates"><EmailBuilderV2Page /></ProtectedRoute>} />
            <Route path="/onboarding-builder" element={<ProtectedRoute requiredPermission="playbooks.view"><Layout><OnboardingBuilder /></Layout></ProtectedRoute>} />
            <Route path="/playbook-executions" element={<ProtectedRoute requiredPermission="playbooks.view_executions"><Layout><PlaybookExecutions /></Layout></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute requiredPermission="analytics.view"><Layout><Analytics /></Layout></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute requiredPermission="reports.access"><Layout><Reports /></Layout></ProtectedRoute>} />
            <Route path="/reports/consultant-distribution" element={<ProtectedRoute requiredPermission="analytics.view"><Layout><ConsultantDistribution /></Layout></ProtectedRoute>} />
            <Route path="/reports/fiscal-export" element={<ProtectedRoute requiredPermission="reports.access"><Layout><FiscalExport /></Layout></ProtectedRoute>} />
            <Route path="/reports/fraud-detection" element={<ProtectedRoute requiredPermission="analytics.view"><Layout><FraudDetection /></Layout></ProtectedRoute>} />
            <Route path="/reports/sales-distribution" element={<ProtectedRoute requiredPermission="reports.lead_distribution"><Layout><SalesRepDistribution /></Layout></ProtectedRoute>} />
            <Route path="/goals" element={<ProtectedRoute requiredPermission="goals.view_own"><Layout><Goals /></Layout></ProtectedRoute>} />
            <Route path="/goals-management" element={<ProtectedRoute requiredPermission="goals.set"><Layout><GoalsManagement /></Layout></ProtectedRoute>} />
            <Route path="/internal-requests" element={<ProtectedRoute requiredPermission="tickets.view"><Layout><InternalRequests /></Layout></ProtectedRoute>} />
            <Route path="/cadences" element={<ProtectedRoute requiredPermission="cadences.manage"><Layout><Cadences /></Layout></ProtectedRoute>} />
            <Route path="/sales-tasks" element={<ProtectedRoute requiredPermission="sales.view_workzone"><Layout><SalesTasks /></Layout></ProtectedRoute>} />
            <Route path="/support" element={<ProtectedRoute requiredPermission="tickets.view"><Layout><Support /></Layout></ProtectedRoute>} />
            <Route path="/knowledge" element={<ProtectedRoute requiredPermission="knowledge.manage_articles"><Layout><Knowledge /></Layout></ProtectedRoute>} />
            <Route path="/ai-studio/personas" element={<ProtectedRoute requiredPermission="ai.manage_personas"><Layout><AIStudio /></Layout></ProtectedRoute>} />
            <Route path="/import-clients" element={<ProtectedRoute requiredPermission="contacts.import"><Layout><ImportClients /></Layout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute requiredPermission="settings.view"><Layout><Settings /></Layout></ProtectedRoute>} />
            <Route path="/settings/integrations" element={<ProtectedRoute requiredPermission="settings.integrations"><Layout><IntegrationsSettings /></Layout></ProtectedRoute>} />
            <Route path="/settings/email" element={<ProtectedRoute requiredPermission="email.manage_templates"><EmailSettingsPage /></ProtectedRoute>} />
            <Route path="/settings/ai-trainer" element={<ProtectedRoute requiredPermission="ai.train"><Layout><AITrainer /></Layout></ProtectedRoute>} />
            <Route path="/settings/email-templates" element={<ProtectedRoute requiredPermission="email.view_templates"><EmailTemplates /></ProtectedRoute>} />
            <Route path="/settings/products" element={<ProtectedRoute requiredPermission="cadastros.view_products"><Layout><Products /></Layout></ProtectedRoute>} />
            <Route path="/settings/delivery-groups" element={<ProtectedRoute requiredPermission="playbooks.view"><Layout><DeliveryGroups /></Layout></ProtectedRoute>} />
            <Route path="/settings/departments" element={<ProtectedRoute requiredPermission="cadastros.view_departments"><Layout><Departments /></Layout></ProtectedRoute>} />
            <Route path="/settings/chat-links" element={<ProtectedRoute requiredPermission="settings.integrations"><Layout><ChatLinksSettings /></Layout></ProtectedRoute>} />
            <Route path="/settings/widget-builder" element={<ProtectedRoute requiredPermission="settings.integrations"><Layout><WidgetBuilder /></Layout></ProtectedRoute>} />
            <Route path="/settings/knowledge-import" element={<ProtectedRoute requiredPermission="knowledge.manage_articles"><Layout><KnowledgeImport /></Layout></ProtectedRoute>} />
            <Route path="/settings/audit-logs" element={<ProtectedRoute requiredPermission="audit.view_logs"><Layout><AuditLogs /></Layout></ProtectedRoute>} />
            <Route path="/settings/skills" element={<ProtectedRoute requiredPermission="settings.view"><Layout><SkillsSettings /></Layout></ProtectedRoute>} />
            <Route path="/settings/whatsapp" element={<ProtectedRoute requiredPermission="settings.whatsapp"><Layout><WhatsAppSettings /></Layout></ProtectedRoute>} />
            <Route path="/settings/webhooks" element={<ProtectedRoute requiredPermission="settings.webhooks"><Layout><WebhooksSettings /></Layout></ProtectedRoute>} />
            <Route path="/settings/macros" element={<ProtectedRoute requiredPermission="inbox.access"><Layout><Macros /></Layout></ProtectedRoute>} />
            <Route path="/settings/teams" element={<ProtectedRoute requiredPermission="settings.teams"><Layout><Teams /></Layout></ProtectedRoute>} />
            <Route path="/settings/tags" element={<ProtectedRoute requiredPermission="cadastros.view_tags"><Layout><Tags /></Layout></ProtectedRoute>} />
            <Route path="/settings/recovery" element={<ProtectedRoute requiredPermission="settings.recovery"><Layout><SalesRecovery /></Layout></ProtectedRoute>} />
            <Route path="/settings/ai-messages" element={<ProtectedRoute requiredPermission="ai.manage_personas"><Layout><AIMessagesSettings /></Layout></ProtectedRoute>} />
            <Route path="/settings/ticket-notifications" element={<ProtectedRoute requiredPermission="email.manage_templates"><Layout><TicketNotificationRulesSettings /></Layout></ProtectedRoute>} />
            <Route path="/settings/sla" element={<ProtectedRoute requiredPermission="settings.view"><Layout><SLASettings /></Layout></ProtectedRoute>} />
            <Route path="/admin-onboarding" element={<ProtectedRoute requiredPermission="settings.view"><AdminOnboarding /></ProtectedRoute>} />
            <Route path="/super-admin" element={<ProtectedRoute allowedRoles={["admin"]}><Layout><SuperAdminPanel /></Layout></ProtectedRoute>} />
            
            {/* Catch-all route - must be last */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </AppErrorBoundary>
  );
};

export default App;
