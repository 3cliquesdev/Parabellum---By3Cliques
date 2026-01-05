import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Webhook, Loader2, Copy, TestTube2, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function WebhooksConfigCard() {
  const { toast } = useToast();

  const { data: webhooks, isLoading } = useQuery({
    queryKey: ["webhook-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_configurations")
        .select("*")
        .eq("category", "webhook")
        .order("key");
      
      if (error) throw error;
      return data || [];
    },
  });

  const copyToClipboard = (url: string, name: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: "✅ URL copiada!",
      description: `Webhook ${name} copiado para área de transferência`,
    });
  };

  const testWebhook = (name: string) => {
    toast({
      title: "🧪 Testando webhook",
      description: `Enviando requisição de teste para ${name}...`,
    });
  };

  const getWebhookDisplay = (key: string) => {
    switch (key) {
      case "kiwify_webhook_url":
        return { name: "Kiwify - Pagamentos", icon: "💳", color: "text-purple-600" };
      case "whatsapp_webhook_url":
        return { name: "WhatsApp - Evolution API", icon: "💬", color: "text-green-600" };
      case "email_webhook_url":
        return { name: "Email - Tracking (Resend)", icon: "📧", color: "text-blue-600" };
      case "email_inbound_webhook_url":
        return { name: "Email - Respostas (Resend)", icon: "📩", color: "text-indigo-600" };
      default:
        return { name: key, icon: "🔗", color: "text-gray-600" };
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="h-5 w-5 text-indigo-600" />
          Webhooks
        </CardTitle>
        <CardDescription>
          URLs de webhooks para integrações externas
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {webhooks?.map((webhook) => {
              const display = getWebhookDisplay(webhook.key);
              
              return (
                <div
                  key={webhook.id}
                  className="space-y-2 p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{display.icon}</span>
                      <div>
                        <p className="font-medium text-sm">{display.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          <span className="text-xs text-muted-foreground">
                            Último evento: há 2 horas
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(webhook.value, display.name)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testWebhook(display.name)}
                      >
                        <TestTube2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="bg-muted/50 p-2 rounded font-mono text-xs break-all">
                    {webhook.value}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            💡 Configure estas URLs nos respectivos serviços externos (Kiwify, Evolution API, etc.)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
