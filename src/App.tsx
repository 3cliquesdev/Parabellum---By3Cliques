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
import Forms from "./pages/Forms";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import EmailTemplates from "./pages/EmailTemplates";
import Products from "./pages/Products";
import Departments from "./pages/Departments";
import PublicForm from "./pages/PublicForm";
import PublicChat from "./pages/PublicChat";
import PublicChatWindow from "./pages/PublicChatWindow";
import ChatLinksSettings from "./pages/ChatLinksSettings";
import Auth from "./pages/Auth";
import Setup from "./pages/Setup";
import Automations from "./pages/Automations";
import Analytics from "./pages/Analytics";
import TVMode from "./pages/TVMode";
import Goals from "./pages/Goals";
import ImportClients from "./pages/ImportClients";
import Support from "./pages/Support";
import Knowledge from "./pages/Knowledge";
import PublicTicketForm from "./pages/PublicTicketForm";
import AIStudio from "./pages/AIStudio";
import MyPortfolio from "./pages/MyPortfolio";
import OnboardingBuilder from "./pages/OnboardingBuilder";
import PlaybookExecutions from "./pages/PlaybookExecutions";
import KnowledgeImport from "./pages/KnowledgeImport";
import NotFound from "./pages/NotFound";
import AuditLogs from "./pages/AuditLogs";
import WhatsAppSettings from "./pages/WhatsAppSettings";

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
            <Route path="/auth" element={<Auth />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/public/form/:formId" element={<PublicForm />} />
          <Route path="/public-chat" element={<PublicChat />} />
          <Route path="/public-chat/:conversationId" element={<PublicChatWindow />} />
            <Route path="/open-ticket" element={<PublicTicketForm />} />
            <Route path="/tv" element={<TVMode />} />
            <Route path="/" element={<ProtectedRoute allowedRoles={["sales_rep", "admin", "manager"]}><Layout><Dashboard /></Layout></ProtectedRoute>} />
            <Route path="/inbox" element={<ProtectedRoute allowedRoles={["support_agent", "consultant", "sales_rep", "admin", "manager"]}><Layout><Inbox /></Layout></ProtectedRoute>} />
            <Route path="/my-portfolio" element={<ProtectedRoute allowedRoles={["consultant", "sales_rep", "manager", "admin"]}><Layout><MyPortfolio /></Layout></ProtectedRoute>} />
            <Route path="/contacts" element={<ProtectedRoute allowedRoles={["sales_rep", "consultant", "support_agent", "admin", "manager"]}><Layout><Contacts /></Layout></ProtectedRoute>} />
            <Route path="/contacts/:id" element={<ProtectedRoute allowedRoles={["sales_rep", "consultant", "support_agent", "admin", "manager"]}><Layout><ContactDetails /></Layout></ProtectedRoute>} />
            <Route path="/organizations" element={<ProtectedRoute allowedRoles={["sales_rep", "consultant", "admin", "manager"]}><Layout><Organizations /></Layout></ProtectedRoute>} />
            <Route path="/deals" element={<ProtectedRoute allowedRoles={["sales_rep", "admin", "manager"]}><Layout><Deals /></Layout></ProtectedRoute>} />
            <Route path="/forms" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><Layout><Forms /></Layout></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><Layout><Users /></Layout></ProtectedRoute>} />
            <Route path="/automations" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><Layout><Automations /></Layout></ProtectedRoute>} />
            <Route path="/email-templates" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><Layout><EmailTemplates /></Layout></ProtectedRoute>} />
            <Route path="/onboarding-builder" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><Layout><OnboardingBuilder /></Layout></ProtectedRoute>} />
            <Route path="/playbook-executions" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><Layout><PlaybookExecutions /></Layout></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><Layout><Analytics /></Layout></ProtectedRoute>} />
            <Route path="/goals" element={<ProtectedRoute allowedRoles={["sales_rep", "admin", "manager"]}><Layout><Goals /></Layout></ProtectedRoute>} />
            <Route path="/support" element={<ProtectedRoute allowedRoles={["support_agent", "consultant", "admin", "manager"]}><Layout><Support /></Layout></ProtectedRoute>} />
            <Route path="/knowledge" element={<ProtectedRoute allowedRoles={["support_agent", "admin", "manager"]}><Layout><Knowledge /></Layout></ProtectedRoute>} />
            <Route path="/ai-studio/personas" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><Layout><AIStudio /></Layout></ProtectedRoute>} />
            <Route path="/import-clients" element={<ProtectedRoute allowedRoles={["admin"]}><Layout><ImportClients /></Layout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute allowedRoles={["admin"]}><Layout><Settings /></Layout></ProtectedRoute>} />
            <Route path="/settings/email-templates" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><EmailTemplates /></ProtectedRoute>} />
            <Route path="/settings/products" element={<ProtectedRoute allowedRoles={["admin"]}><Layout><Products /></Layout></ProtectedRoute>} />
            <Route path="/settings/departments" element={<ProtectedRoute allowedRoles={["admin"]}><Layout><Departments /></Layout></ProtectedRoute>} />
            <Route path="/settings/chat-links" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><Layout><ChatLinksSettings /></Layout></ProtectedRoute>} />
            <Route path="/settings/knowledge-import" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><Layout><KnowledgeImport /></Layout></ProtectedRoute>} />
            <Route path="/settings/audit-logs" element={<ProtectedRoute allowedRoles={["admin"]}><Layout><AuditLogs /></Layout></ProtectedRoute>} />
            <Route path="/settings/whatsapp" element={<ProtectedRoute allowedRoles={["admin", "consultant"]}><WhatsAppSettings /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;
