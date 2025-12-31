import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plug, MessageSquare, Mail, ShoppingBag, Settings, CheckCircle2, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function IntegrationStatusCard() {
  const navigate = useNavigate();

  const { data: integrations, isLoading } = useQuery({
    queryKey: ["super-admin-integrations"],
    queryFn: async () => {
      // Check WhatsApp instances
      const { data: whatsappInstances } = await supabase
        .from("whatsapp_instances")
        .select("id, status, instance_name")
        .limit(10);

      // Check email senders
      const { data: emailSenders } = await supabase
        .from("email_senders")
        .select("id, name, is_default")
        .limit(5);

      // For Kiwify, we'll check if there's an integration configured
      // Note: system_settings may not exist, so we'll assume Kiwify is available via edge function
      const kiwifyEnabled = false; // Would need to check actual integration status
      const kiwifyLastSync = null as string | null;

      return {
        whatsapp: {
          connected: whatsappInstances?.filter(i => i.status === "connected").length || 0,
          total: whatsappInstances?.length || 0,
        },
        email: {
          configured: (emailSenders?.length || 0) > 0,
          count: emailSenders?.length || 0,
        },
        kiwify: {
          enabled: kiwifyEnabled,
          lastSync: kiwifyLastSync,
        },
      };
    },
    staleTime: 60 * 1000,
  });

  const IntegrationItem = ({ 
    icon: Icon, 
    name, 
    status, 
    statusText, 
    href 
  }: { 
    icon: any; 
    name: string; 
    status: boolean; 
    statusText: string;
    href: string;
  }) => (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground">{statusText}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {status ? (
          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Ativo
          </Badge>
        ) : (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
            <XCircle className="h-3 w-3 mr-1" />
            Inativo
          </Badge>
        )}
        <Button size="icon" variant="ghost" onClick={() => navigate(href)}>
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Plug className="h-5 w-5 text-primary" />
          Status das Integrações
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-4">Carregando...</div>
        ) : (
          <>
            <IntegrationItem
              icon={MessageSquare}
              name="WhatsApp"
              status={(integrations?.whatsapp.connected || 0) > 0}
              statusText={`${integrations?.whatsapp.connected || 0}/${integrations?.whatsapp.total || 0} instâncias conectadas`}
              href="/settings/whatsapp"
            />
            <IntegrationItem
              icon={Mail}
              name="Email (Resend)"
              status={integrations?.email.configured || false}
              statusText={`${integrations?.email.count || 0} remetentes configurados`}
              href="/settings/email"
            />
            <IntegrationItem
              icon={ShoppingBag}
              name="Kiwify"
              status={integrations?.kiwify.enabled || false}
              statusText={integrations?.kiwify.lastSync ? `Última sync: ${new Date(integrations.kiwify.lastSync).toLocaleDateString('pt-BR')}` : "Não sincronizado"}
              href="/settings/integrations"
            />
          </>
        )}

        <Button variant="outline" className="w-full mt-2" onClick={() => navigate("/settings/integrations")}>
          <Plug className="h-4 w-4 mr-2" />
          Gerenciar Integrações
        </Button>
      </CardContent>
    </Card>
  );
}
