import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, LogOut, User, Loader2, RotateCcw, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { usePublicTicketPortalConfig } from "@/hooks/usePublicTicketPortal";
import { ReturnsList } from "@/components/client-portal/ReturnsList";
import { NewReturnDialog } from "@/components/client-portal/NewReturnDialog";

export default function ClientPortal() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: portalConfig, isLoading: portalLoading } = usePublicTicketPortalConfig();
  const [showNewReturn, setShowNewReturn] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const whatsappNumber = portalConfig?.whatsapp_number;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Bem-vindo(a)!</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{user?.email}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1">Conta</TabsTrigger>
              <TabsTrigger value="returns" className="flex-1">
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Devoluções
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4 mt-4">
              <div className="text-center space-y-2">
                <p className="text-muted-foreground">Sua conta está ativa.</p>
              </div>

              <div className="pt-4 border-t border-border space-y-3">
                <p className="text-sm text-muted-foreground text-center">
                  Para atendimento, entre em contato conosco:
                </p>

                {portalLoading ? (
                  <div className="flex justify-center py-2">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : whatsappNumber ? (
                  <Button variant="outline" className="w-full" asChild>
                    <a href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Falar com Suporte via WhatsApp
                    </a>
                  </Button>
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="returns" className="mt-4">
              <div className="flex justify-end mb-4">
                <Button size="sm" onClick={() => setShowNewReturn(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Nova Devolução
                </Button>
              </div>
              <ReturnsList />
            </TabsContent>
          </Tabs>

          <Button variant="ghost" onClick={handleLogout} className="w-full text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4 mr-2" />
            Sair da conta
          </Button>
        </CardContent>
      </Card>

      <NewReturnDialog open={showNewReturn} onOpenChange={setShowNewReturn} />
    </div>
  );
}
