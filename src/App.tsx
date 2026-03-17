// App v2 - cleaned version check system
import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import { PortalGuard } from "./components/auth/PortalGuard";
import RealtimeNotifications from "./components/RealtimeNotifications";
import { WhatsAppDisconnectMonitor } from "./components/WhatsAppDisconnectMonitor";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { UpdateAvailableBanner } from "./components/UpdateAvailableBanner";
import { ErrorTrackerInit } from "./components/ErrorTrackerInit";
import { TourProvider } from "./components/tour/TourProvider";

import { PageLoadingSkeleton } from "./components/PageLoadingSkeleton";

// Lazy loaded pages - reduces initial bundle significantly
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Inbox = lazy(() => import("./pages/Inbox"));
const Contacts = lazy(() => import("./pages/Contacts"));
const ContactDetails = lazy(() => import("./pages/ContactDetails"));
const Organizations = lazy(() => import("./pages/Organizations"));
const Deals = lazy(() => import("./pages/Deals"));
const Quotes = lazy(() => import("./pages/Quotes"));
const PublicQuote = lazy(() => import("./pages/PublicQuote"));
const QuoteBuilder = lazy(() => import("./pages/QuoteBuilder"));
const Forms = lazy(() => import("./pages/Forms"));
const Users = lazy(() => import("./pages/Users"));
const Settings = lazy(() => import("./pages/Settings"));
const EmailTemplates = lazy(() => import("./pages/EmailTemplates"));
const EmailSettingsPage = lazy(() => import("./pages/EmailSettingsPage"));
const EmailBuilderPage = lazy(() => import("./pages/EmailBuilderPage"));
const EmailBuilderV2Page = lazy(() => import("./pages/EmailBuilderV2Page"));
const Products = lazy(() => import("./pages/Products"));
const Departments = lazy(() => import("./pages/Departments"));
const PublicForm = lazy(() => import("./pages/PublicForm"));
const PublicFormV2 = lazy(() => import("./pages/PublicFormV2"));
const FormBuilderPage = lazy(() => import("./pages/FormBuilderPage"));
const PublicChat = lazy(() => import("./pages/PublicChat"));
const PublicChatWindow = lazy(() => import("./pages/PublicChatWindow"));
const ChatLinksSettings = lazy(() => import("./pages/ChatLinksSettings"));
const WidgetBuilder = lazy(() => import("./pages/WidgetBuilder"));
const Auth = lazy(() => import("./pages/Auth"));
const ClientLogin = lazy(() => import("./pages/ClientLogin"));
const Automations = lazy(() => import("./pages/Automations"));
// Analytics removed — now inline redirect
const Subscriptions = lazy(() => import("./pages/Subscriptions"));
const TVMode = lazy(() => import("./pages/TVMode"));
const SetupPassword = lazy(() => import("./pages/SetupPassword"));
const Goals = lazy(() => import("./pages/Goals"));
const GoalsManagement = lazy(() => import("./pages/GoalsManagement"));
const ImportClients = lazy(() => import("./pages/ImportClients"));
const ImportDeals = lazy(() => import("./pages/ImportDeals"));
const Support = lazy(() => import("./pages/Support"));
const TicketDetail = lazy(() => import("./pages/TicketDetail"));
const Knowledge = lazy(() => import("./pages/Knowledge"));
const KnowledgeCuration = lazy(() => import("./pages/KnowledgeCuration"));
const KBGapsDashboard = lazy(() => import("./pages/KBGapsDashboard"));
const PublicTicketForm = lazy(() => import("./pages/PublicTicketForm"));
const MyTickets = lazy(() => import("./pages/MyTickets"));
const AIStudio = lazy(() => import("./pages/AIStudio"));
const MyPortfolio = lazy(() => import("./pages/MyPortfolio"));
const FraudDetection = lazy(() => import("./pages/reports/FraudDetection"));
// CSManagement and SalesManagement removed — now inline redirects
const AgentQualityDashboard = lazy(() => import("./pages/AgentQualityDashboard"));
const CopilotImpactDashboard = lazy(() => import("./pages/CopilotImpactDashboard"));
const SalesRepDetail = lazy(() => import("./pages/SalesRepDetail"));
const OnboardingBuilder = lazy(() => import("./pages/OnboardingBuilder"));
const ReturnsManagement = lazy(() => import("./components/support/ReturnsManagement"));
const PlaybookExecutions = lazy(() => import("./pages/PlaybookExecutions"));
const KnowledgeImport = lazy(() => import("./pages/KnowledgeImport"));
const DeliveryGroups = lazy(() => import("./pages/DeliveryGroups"));
const Cadences = lazy(() => import("./pages/Cadences"));
const CadenceEditorPage = lazy(() => import("./pages/CadenceEditorPage"));
const SalesTasks = lazy(() => import("./pages/SalesTasks"));
const Macros = lazy(() => import("./pages/Macros"));
const Teams = lazy(() => import("./pages/Teams"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const PermissionsAudit = lazy(() => import("./pages/PermissionsAudit"));
const SkillsSettings = lazy(() => import("./pages/SkillsSettings"));
const SalesChannelsSettings = lazy(() => import("./pages/SalesChannelsSettingsPage"));
const WhatsAppSettings = lazy(() => import("./pages/WhatsAppSettings"));
const WebhooksSettings = lazy(() => import("./pages/WebhooksSettings"));
const Reports = lazy(() => import("./pages/Reports"));
const IntegrationsSettings = lazy(() => import("./pages/IntegrationsSettings"));
const Tags = lazy(() => import("./pages/Tags"));
const AITrainer = lazy(() => import("./pages/AITrainer"));
const SalesRecovery = lazy(() => import("./pages/SalesRecovery"));
const AdminOnboarding = lazy(() => import("./pages/AdminOnboarding"));
const InstagramDashboard = lazy(() => import("./pages/InstagramDashboard"));
const ConsultantDetail = lazy(() => import("./pages/ConsultantDetail"));
const Consultants = lazy(() => import("./pages/Consultants"));
const ConsultantDistribution = lazy(() => import("./pages/reports/ConsultantDistribution"));
const FiscalExport = lazy(() => import("./pages/reports/FiscalExport"));
const SalesRepDistribution = lazy(() => import("./pages/reports/SalesRepDistribution"));
const DebugRoutes = lazy(() => import("./pages/DebugRoutes"));
const AIMessagesSettings = lazy(() => import("./pages/AIMessagesSettings"));
const TicketNotificationRulesSettings = lazy(() => import("./pages/TicketNotificationRulesSettings"));
const PublicOnboarding = lazy(() => import("./pages/PublicOnboarding"));
const PublicOnboardingForm = lazy(() => import("./pages/PublicOnboardingForm"));
const SLASettings = lazy(() => import("./pages/SLASettings"));
const ReturnReasonsSettings = lazy(() => import("./components/support/ReturnReasonsSettings"));
const ReturnsConfigSettings = lazy(() => import("./pages/ReturnsConfigSettings"));
const ScoringSettings = lazy(() => import("./pages/ScoringSettings"));
const TicketStatusSettings = lazy(() => import("./pages/TicketStatusSettings"));
const TicketCategoriesSettings = lazy(() => import("./pages/TicketCategoriesSettings"));
const CustomerFiscalData = lazy(() => import("./pages/CustomerFiscalData"));
const ClientPortal = lazy(() => import("./pages/ClientPortal"));
const SuperAdminPanel = lazy(() => import("./pages/SuperAdminPanel"));
const InternalRequests = lazy(() => import("./pages/InternalRequests"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage"));
const ProjectBoardPage = lazy(() => import("./pages/ProjectBoardPage"));
const FormBoardIntegrationsPage = lazy(() => import("./pages/FormBoardIntegrationsPage"));
const ProductBoardMappingsPage = lazy(() => import("./pages/ProductBoardMappingsPage"));
const AISettingsPage = lazy(() => import("./pages/AISettingsPage"));
const AIAuditPage = lazy(() => import("./pages/AIAuditPage"));
const InstagramSettings = lazy(() => import("./pages/InstagramSettings"));
const KiwifySettingsPage = lazy(() => import("./pages/KiwifySettingsPage"));
const SecuritySettingsPage = lazy(() => import("./pages/SecuritySettingsPage"));
const DatabaseSettingsPage = lazy(() => import("./pages/DatabaseSettingsPage"));
const IntegrationsCentralPage = lazy(() => import("./pages/IntegrationsCentralPage"));
const ChatFlows = lazy(() => import("./pages/ChatFlows"));
const ChatFlowEditorPage = lazy(() => import("./pages/ChatFlowEditorPage"));
const WhatsAppMetaSettings = lazy(() => import("./pages/WhatsAppMetaSettings"));
// SupportDashboard removed — now inline redirect
const CommercialConversationsReport = lazy(() => import("./pages/CommercialConversationsReport"));
const TicketsExportReport = lazy(() => import("./pages/TicketsExportReport"));
const ConversationsReport = lazy(() => import("./pages/ConversationsReport"));
const PlaybookEmailSequenceReport = lazy(() => import("./pages/PlaybookEmailSequenceReport"));
const FormLeadsConversionReport = lazy(() => import("./pages/FormLeadsConversionReport"));
const ReportBuilder = lazy(() => import("./pages/ReportBuilder"));
// AnalyticsPremium removed — now inline redirect
const DashboardsList = lazy(() => import("./pages/DashboardsList"));
const InboxTimeReport = lazy(() => import("./pages/InboxTimeReport"));
const DashboardView = lazy(() => import("./pages/DashboardView"));
// AITelemetry moved into Dashboard as tab — redirect handled inline
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
          <TourProvider>
            <>
              <UpdateAvailableBanner />
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <RealtimeNotifications />
                <WhatsAppDisconnectMonitor />
                <ErrorTrackerInit />
                <Suspense fallback={<PageLoadingSkeleton />}>
            <Routes>
              {/* Public routes - no auth required */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/portal" element={<ClientLogin />} />
              <Route path="/setup-password" element={<SetupPassword />} />
              <Route path="/public/form/:formId" element={<PublicFormV2 />} />
              <Route path="/public-chat" element={<PublicChat />} />
              <Route path="/public-chat/:conversationId" element={<PublicChatWindow />} />
              <Route path="/open-ticket" element={<PublicTicketForm />} />
              <Route path="/my-tickets" element={<MyTickets />} />
              <Route path="/tv" element={<TVMode />} />
              <Route path="/public-quote/:token" element={<PublicQuote />} />
              <Route path="/f/:formId" element={<PublicFormV2 />} />
              <Route path="/public-onboarding/:executionId" element={<PublicOnboarding />} />
              <Route path="/public-onboarding/playbook/:playbookId" element={<PublicOnboarding />} />
              <Route path="/meu-cadastro" element={<CustomerFiscalData />} />
              <Route path="/onboarding-form" element={<PublicOnboardingForm />} />
              
              {/* Client portal - protected by PortalGuard (only role 'user') */}
              <Route path="/client-portal" element={<PortalGuard><ClientPortal /></PortalGuard>} />

              {/* Debug routes - dev only */}
              <Route path="/debug/routes" element={<DebugRoutes />} />

              {/* Protected routes - using requiredPermission for unified access control */}
              <Route path="/" element={<ProtectedRoute requiredPermission="dashboard.view"><Layout><Dashboard /></Layout></ProtectedRoute>} />
              <Route path="/inbox" element={<ProtectedRoute requiredPermission="inbox.access"><Layout><Inbox /></Layout></ProtectedRoute>} />
              <Route path="/my-portfolio" element={<ProtectedRoute requiredPermission="cs.view_own_portfolio"><Layout><MyPortfolio /></Layout></ProtectedRoute>} />
              <Route path="/cs-management" element={<Navigate to="/?tab=overview" replace />} />
              <Route path="/cs-management/consultant/:id" element={<ProtectedRoute requiredPermission="cs.view_management"><Layout><ConsultantDetail /></Layout></ProtectedRoute>} />
              <Route path="/consultants" element={<ProtectedRoute requiredPermission="cadastros.view_consultants"><Layout><Consultants /></Layout></ProtectedRoute>} />
              <Route path="/sales-management" element={<Navigate to="/?tab=sales" replace />} />
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
              <Route path="/analytics" element={<Navigate to="/" replace />} />
              <Route path="/analytics/premium" element={<Navigate to="/?tab=overview" replace />} />
               <Route path="/dashboards" element={<ProtectedRoute requiredPermission="analytics.view_dashboards"><Layout><DashboardsList /></Layout></ProtectedRoute>} />
              <Route path="/dashboard/:id" element={<ProtectedRoute requiredPermission="analytics.view_dashboards"><Layout><DashboardView /></Layout></ProtectedRoute>} />
              <Route path="/subscriptions" element={<ProtectedRoute requiredPermission="analytics.view_subscriptions"><Layout><Subscriptions /></Layout></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute requiredPermission="analytics.export"><Layout><Reports /></Layout></ProtectedRoute>} />
              <Route path="/report-builder" element={<ProtectedRoute requiredPermission="analytics.view_report_builder"><Layout><ReportBuilder /></Layout></ProtectedRoute>} />
              <Route path="/reports/consultant-distribution" element={<ProtectedRoute requiredPermission="reports.distribution"><Layout><ConsultantDistribution /></Layout></ProtectedRoute>} />
              <Route path="/reports/fiscal-export" element={<ProtectedRoute requiredPermission="reports.fiscal_export"><Layout><FiscalExport /></Layout></ProtectedRoute>} />
              <Route path="/reports/fraud-detection" element={<ProtectedRoute requiredPermission="reports.fraud_detection"><Layout><FraudDetection /></Layout></ProtectedRoute>} />
              <Route path="/reports/sales-distribution" element={<ProtectedRoute requiredPermission="reports.lead_distribution"><Layout><SalesRepDistribution /></Layout></ProtectedRoute>} />
              <Route path="/reports/quality" element={<ProtectedRoute requiredPermission="analytics.view"><AgentQualityDashboard /></ProtectedRoute>} />
              <Route path="/reports/impact" element={<ProtectedRoute requiredPermission="analytics.view"><CopilotImpactDashboard /></ProtectedRoute>} />
              <Route path="/reports/commercial-conversations" element={<ProtectedRoute requiredPermission="analytics.view"><Layout><CommercialConversationsReport /></Layout></ProtectedRoute>} />
              <Route path="/reports/tickets-export" element={<ProtectedRoute requiredPermission="analytics.view"><Layout><TicketsExportReport /></Layout></ProtectedRoute>} />
              <Route path="/reports/conversations" element={<ProtectedRoute requiredPermission="analytics.view"><Layout><ConversationsReport /></Layout></ProtectedRoute>} />
              <Route path="/reports/playbook-email-sequence" element={<ProtectedRoute requiredPermission="analytics.view"><Layout><PlaybookEmailSequenceReport /></Layout></ProtectedRoute>} />
              <Route path="/reports/form-leads-conversion" element={<ProtectedRoute requiredPermission="analytics.view"><Layout><FormLeadsConversionReport /></Layout></ProtectedRoute>} />
              <Route path="/reports/inbox-time" element={<ProtectedRoute requiredPermission="analytics.view"><Layout><InboxTimeReport /></Layout></ProtectedRoute>} />
              <Route path="/goals" element={<ProtectedRoute requiredPermission="goals.view_own"><Layout><Goals /></Layout></ProtectedRoute>} />
              <Route path="/goals-management" element={<ProtectedRoute requiredPermission="goals.set"><Layout><GoalsManagement /></Layout></ProtectedRoute>} />
              <Route path="/internal-requests" element={<ProtectedRoute requiredPermission="tickets.view_internal"><Layout><InternalRequests /></Layout></ProtectedRoute>} />
              <Route path="/cadences" element={<ProtectedRoute requiredPermission="cadences.manage"><Layout><Cadences /></Layout></ProtectedRoute>} />
              <Route path="/cadences/:id/edit" element={<ProtectedRoute requiredPermission="cadences.manage"><CadenceEditorPage /></ProtectedRoute>} />
              <Route path="/sales-tasks" element={<ProtectedRoute requiredPermission="sales.view_workzone"><Layout><SalesTasks /></Layout></ProtectedRoute>} />
              <Route path="/support" element={<ProtectedRoute requiredPermission="tickets.view"><Layout><Support /></Layout></ProtectedRoute>} />
              <Route path="/support/:ticketId" element={<ProtectedRoute requiredPermission="tickets.view"><Layout><TicketDetail /></Layout></ProtectedRoute>} />
              <Route path="/returns" element={<ProtectedRoute requiredPermission="cadastros.view_returns"><Layout><ReturnsManagement /></Layout></ProtectedRoute>} />
              <Route path="/support-dashboard" element={<Navigate to="/?tab=support" replace />} />
              <Route path="/knowledge" element={<ProtectedRoute requiredPermission="inbox.view_knowledge"><Layout><Knowledge /></Layout></ProtectedRoute>} />
              <Route path="/knowledge/curation" element={<ProtectedRoute requiredPermission="knowledge.manage_articles"><Layout><KnowledgeCuration /></Layout></ProtectedRoute>} />
              <Route path="/knowledge/gaps" element={<ProtectedRoute requiredPermission="knowledge.manage_articles"><Layout><KBGapsDashboard /></Layout></ProtectedRoute>} />
              <Route path="/ai-studio/personas" element={<ProtectedRoute requiredPermission="ai.manage_personas"><Layout><AIStudio /></Layout></ProtectedRoute>} />
              <Route path="/ai-telemetry" element={<Navigate to="/?tab=ai-telemetry" replace />} />
              <Route path="/import-clients" element={<ProtectedRoute requiredPermission="contacts.import"><Layout><ImportClients /></Layout></ProtectedRoute>} />
              <Route path="/import-deals" element={<ProtectedRoute requiredPermission="deals.create"><Layout><ImportDeals /></Layout></ProtectedRoute>} />
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
              <Route path="/whatsapp-instances" element={<ProtectedRoute requiredPermission="settings.whatsapp"><Layout><WhatsAppSettings /></Layout></ProtectedRoute>} />
              <Route path="/settings/whatsapp-meta" element={<ProtectedRoute requiredPermission="settings.whatsapp"><Layout><WhatsAppMetaSettings /></Layout></ProtectedRoute>} />
              <Route path="/settings/webhooks" element={<ProtectedRoute requiredPermission="settings.webhooks"><Layout><WebhooksSettings /></Layout></ProtectedRoute>} />
              <Route path="/settings/macros" element={<ProtectedRoute requiredPermission="inbox.access"><Layout><Macros /></Layout></ProtectedRoute>} />
              <Route path="/settings/teams" element={<ProtectedRoute requiredPermission="settings.teams"><Layout><Teams /></Layout></ProtectedRoute>} />
              <Route path="/settings/tags" element={<ProtectedRoute requiredPermission="cadastros.view_tags"><Layout><Tags /></Layout></ProtectedRoute>} />
              <Route path="/settings/recovery" element={<ProtectedRoute requiredPermission="settings.recovery"><Layout><SalesRecovery /></Layout></ProtectedRoute>} />
              <Route path="/settings/ai-messages" element={<ProtectedRoute requiredPermission="ai.manage_messages"><Layout><AIMessagesSettings /></Layout></ProtectedRoute>} />
              <Route path="/settings/ticket-notifications" element={<ProtectedRoute requiredPermission="email.manage_templates"><Layout><TicketNotificationRulesSettings /></Layout></ProtectedRoute>} />
              <Route path="/settings/sla" element={<ProtectedRoute requiredPermission="settings.view"><Layout><SLASettings /></Layout></ProtectedRoute>} />
              <Route path="/settings/return-reasons" element={<Navigate to="/settings/returns-config" replace />} />
              <Route path="/settings/returns-config" element={<ProtectedRoute requiredPermission="settings.view_returns_config"><Layout><ReturnsConfigSettings /></Layout></ProtectedRoute>} />
              <Route path="/settings/scoring" element={<ProtectedRoute requiredPermission="settings.view"><Layout><ScoringSettings /></Layout></ProtectedRoute>} />
              <Route path="/settings/sales-channels" element={<ProtectedRoute requiredPermission="sales.manage_pipelines"><Layout><SalesChannelsSettings /></Layout></ProtectedRoute>} />
              <Route path="/settings/ticket-statuses" element={<ProtectedRoute requiredPermission="settings.view"><Layout><TicketStatusSettings /></Layout></ProtectedRoute>} />
              <Route path="/settings/ticket-categories" element={<ProtectedRoute requiredPermission="settings.view"><Layout><TicketCategoriesSettings /></Layout></ProtectedRoute>} />
              <Route path="/admin-onboarding" element={<ProtectedRoute requiredPermission="settings.view"><AdminOnboarding /></ProtectedRoute>} />
              <Route path="/super-admin" element={<ProtectedRoute requiredPermission="super_admin.access"><Layout><SuperAdminPanel /></Layout></ProtectedRoute>} />
              <Route path="/admin/permissions-audit" element={<ProtectedRoute requiredPermission="users.manage"><Layout><PermissionsAudit /></Layout></ProtectedRoute>} />
              
              {/* Projects / Kanban */}
              <Route path="/projects" element={<ProtectedRoute requiredPermission="projects.view"><Layout><ProjectsPage /></Layout></ProtectedRoute>} />
              <Route path="/projects/:boardId" element={<ProtectedRoute requiredPermission="projects.view"><Layout><ProjectBoardPage /></Layout></ProtectedRoute>} />
              <Route path="/form-integrations" element={<ProtectedRoute requiredPermission="forms.view"><Layout><FormBoardIntegrationsPage /></Layout></ProtectedRoute>} />
              <Route path="/product-board-mappings" element={<ProtectedRoute requiredPermission="settings.view"><Layout><ProductBoardMappingsPage /></Layout></ProtectedRoute>} />
              
              {/* Instagram Integration */}
              <Route path="/instagram" element={<ProtectedRoute requiredPermission="inbox.access"><Layout><InstagramDashboard /></Layout></ProtectedRoute>} />
              <Route path="/settings/instagram" element={<ProtectedRoute requiredPermission="settings.integrations"><Layout><InstagramSettings /></Layout></ProtectedRoute>} />
              <Route path="/settings/ai" element={<ProtectedRoute requiredPermission="settings.view"><Layout><AISettingsPage /></Layout></ProtectedRoute>} />
              <Route path="/settings/ai-audit" element={<ProtectedRoute requiredPermission="ai.manage_personas"><Layout><AIAuditPage /></Layout></ProtectedRoute>} />
              <Route path="/settings/kiwify" element={<ProtectedRoute requiredPermission="settings.integrations"><Layout><KiwifySettingsPage /></Layout></ProtectedRoute>} />
              <Route path="/settings/security" element={<ProtectedRoute requiredPermission="settings.view"><Layout><SecuritySettingsPage /></Layout></ProtectedRoute>} />
              <Route path="/settings/database" element={<ProtectedRoute requiredPermission="settings.view"><Layout><DatabaseSettingsPage /></Layout></ProtectedRoute>} />
              <Route path="/settings/integrations-central" element={<ProtectedRoute requiredPermission="settings.integrations"><Layout><IntegrationsCentralPage /></Layout></ProtectedRoute>} />
              <Route path="/settings/chat-flows" element={<ProtectedRoute requiredPermission="settings.chat_flows"><Layout><ChatFlows /></Layout></ProtectedRoute>} />
              <Route path="/settings/chat-flows/:id/edit" element={<ProtectedRoute requiredPermission="settings.chat_flows"><ChatFlowEditorPage /></ProtectedRoute>} />
              
              {/* Catch-all route - must be last */}
              <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </BrowserRouter>
            </>
          </TourProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
};

export default App;
