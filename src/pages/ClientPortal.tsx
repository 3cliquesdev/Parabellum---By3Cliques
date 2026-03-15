import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, LogOut, User, Loader2, RotateCcw, Plus, BookOpen, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { usePublicTicketPortalConfig } from "@/hooks/usePublicTicketPortal";
import { ReturnsList } from "@/components/client-portal/ReturnsList";
import { NewReturnDialog } from "@/components/client-portal/NewReturnDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { displayInitials } from "@/lib/displayName";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "info", label: "Conta", icon: User },
  { key: "returns", label: "Devoluções", icon: RotateCcw },
  { key: "onboarding", label: "Meu Onboarding", icon: BookOpen },
  { key: "tickets", label: "Tickets", icon: Ticket },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function ClientPortal() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { data: portalConfig, isLoading: portalLoading } = usePublicTicketPortalConfig();
  const [showNewReturn, setShowNewReturn] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("info");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const whatsappNumber = portalConfig?.whatsapp_number;

  const fullName = profile?.full_name || user?.email?.split("@")[0] || "Cliente";
  const nameParts = fullName.split(" ");
  const initials = displayInitials(nameParts[0], nameParts[nameParts.length - 1]);

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Header com gradiente */}
      <div className="w-full bg-gradient-to-r from-primary to-purple-600 px-4 py-8">
        <div className="mx-auto max-w-2xl flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-white/30 shadow-lg">
            <AvatarFallback className="bg-white/20 text-white text-xl font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-white truncate">{fullName}</h1>
              <Badge className="bg-green-500/90 text-white border-green-400/30 text-[11px] shrink-0">
                Cliente Ativo
              </Badge>
            </div>
            <p className="text-sm text-white/70 truncate mt-0.5">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="mx-auto max-w-2xl px-4 -mt-4">
        {/* Navegação por abas */}
        <div className="bg-card rounded-xl shadow-sm border border-border/50 mb-4 overflow-hidden">
          <div className="flex">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-3 px-2 text-sm transition-all border-b-2",
                    isActive
                      ? "border-primary text-primary font-semibold"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Conteúdo da aba */}
        <div className="bg-card rounded-xl shadow-sm border border-border/50 p-5 mb-4">
          {activeTab === "info" && (
            <div className="space-y-5">
              <div className="text-center py-2">
                <p className="text-muted-foreground text-sm">Sua conta está ativa e em dia.</p>
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-center">
                  Atendimento
                </p>

                {portalLoading ? (
                  <div className="flex justify-center py-2">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : whatsappNumber ? (
                  <Button variant="outline" className="w-full" asChild>
                    <a
                      href={`https://wa.me/${whatsappNumber.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Falar com Suporte via WhatsApp
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          )}

          {activeTab === "returns" && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-foreground">Minhas Devoluções</h2>
                <Button size="sm" onClick={() => setShowNewReturn(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Nova Devolução
                </Button>
              </div>
              <ReturnsList onRequestNew={() => setShowNewReturn(true)} />
            </div>
          )}

          {activeTab === "onboarding" && (
            <div className="text-center py-8">
              <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Em breve disponível.</p>
            </div>
          )}

          {activeTab === "tickets" && (
            <div className="text-center py-8">
              <Ticket className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Em breve disponível.</p>
            </div>
          )}
        </div>

        {/* Rodapé discreto */}
        <div className="text-center pb-8">
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair da conta
          </button>
        </div>
      </div>

      <NewReturnDialog open={showNewReturn} onOpenChange={setShowNewReturn} />
    </div>
  );
}
