import React, { useEffect } from "react";
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
import PublicForm from "./pages/PublicForm";
import Auth from "./pages/Auth";
import Setup from "./pages/Setup";
import Automations from "./pages/Automations";
import Analytics from "./pages/Analytics";
import TVMode from "./pages/TVMode";
import Goals from "./pages/Goals";
import ImportClients from "./pages/ImportClients";
import Support from "./pages/Support";
import PublicTicketForm from "./pages/PublicTicketForm";
import AIStudio from "./pages/AIStudio";
import NotFound from "./pages/NotFound";

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
        <div className="min-h-screen flex items-center justify-center bg-black p-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-2">
              Algo deu errado
            </h1>
            <p className="text-[#999999] mb-4">
              Por favor, recarregue a página
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#4ADE80] text-black rounded-md hover:bg-[#22C55E]"
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
  // FORÇA DARK MODE - NUNCA DEIXA SAIR
  useEffect(() => {
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
  }, []);

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
            <Route path="/open-ticket" element={<PublicTicketForm />} />
            <Route path="/tv" element={<TVMode />} />
            <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
            <Route path="/inbox" element={<ProtectedRoute><Layout><Inbox /></Layout></ProtectedRoute>} />
            <Route path="/contacts" element={<ProtectedRoute><Layout><Contacts /></Layout></ProtectedRoute>} />
            <Route path="/contacts/:id" element={<ProtectedRoute><Layout><ContactDetails /></Layout></ProtectedRoute>} />
            <Route path="/organizations" element={<ProtectedRoute><Layout><Organizations /></Layout></ProtectedRoute>} />
            <Route path="/deals" element={<ProtectedRoute><Layout><Deals /></Layout></ProtectedRoute>} />
            <Route path="/forms" element={<ProtectedRoute><Layout><Forms /></Layout></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><Layout><Users /></Layout></ProtectedRoute>} />
            <Route path="/automations" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><Layout><Automations /></Layout></ProtectedRoute>} />
            <Route path="/email-templates" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><Layout><EmailTemplates /></Layout></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><Layout><Analytics /></Layout></ProtectedRoute>} />
            <Route path="/goals" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><Layout><Goals /></Layout></ProtectedRoute>} />
            <Route path="/support" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><Layout><Support /></Layout></ProtectedRoute>} />
            <Route path="/ai-studio/personas" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><Layout><AIStudio /></Layout></ProtectedRoute>} />
            <Route path="/import-clients" element={<ProtectedRoute allowedRoles={["admin"]}><Layout><ImportClients /></Layout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute allowedRoles={["admin"]}><Layout><Settings /></Layout></ProtectedRoute>} />
            <Route path="/settings/email-templates" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><EmailTemplates /></ProtectedRoute>} />
            <Route path="/settings/products" element={<ProtectedRoute allowedRoles={["admin"]}><Layout><Products /></Layout></ProtectedRoute>} />
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
