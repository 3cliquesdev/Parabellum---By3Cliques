import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Copy, Webhook, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const WebhooksSettings = () => {
  const { toast } = useToast();

  const copyToClipboard = (url: string, name: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: "URL copiada!",
      description: `Webhook ${name} copiado para área de transferência`,
    });
  };

  const webhooks = [
    {
      name: "Kiwify - Pagamentos",
      description: "Recebe notificações de pagamentos, reembolsos e carrinhos abandonados",
      url: "https://zaeozfdjhrmblfaxsyuu.supabase.co/functions/v1/kiwify-webhook",
      events: ["paid", "refused", "cart_abandoned", "refunded", "chargedback"],
      instructions: [
        "Acesse o painel da Kiwify",
        "Vá em Configurações → Webhooks",
        "Cole a URL acima no campo de webhook",
        "Selecione os eventos: paid, refused, cart_abandoned, refunded, chargedback",
        "Salve as configurações"
      ]
    },
    {
      name: "WhatsApp - Evolution API",
      description: "Recebe mensagens e atualizações de status das instâncias WhatsApp",
      url: "https://zaeozfdjhrmblfaxsyuu.supabase.co/functions/v1/handle-whatsapp-event",
      events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
      instructions: [
        "Acesse o painel da Evolution API",
        "Vá em Settings → Webhook",
        "Cole a URL acima no campo Webhook URL",
        "Marque os eventos: MESSAGES_UPSERT e CONNECTION_UPDATE",
        "Salve as configurações"
      ]
    },
    {
      name: "Email - Resend",
      description: "Recebe eventos de emails enviados (entregues, abertos, clicados)",
      url: "https://zaeozfdjhrmblfaxsyuu.supabase.co/functions/v1/email-webhook",
      events: ["email.sent", "email.delivered", "email.opened", "email.clicked"],
      instructions: [
        "Acesse o painel do Resend",
        "Vá em Webhooks → Create Webhook",
        "Cole a URL acima",
        "Selecione os eventos de email",
        "Salve a configuração"
      ]
    }
  ];

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-foreground">Webhooks</h1>
        <p className="text-muted-foreground">
          Configure os webhooks para integrar o CRM com serviços externos
        </p>
      </div>

      <div className="grid gap-6">
        {webhooks.map((webhook) => (
          <Card key={webhook.name}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Webhook className="h-6 w-6 text-primary" />
                  <div>
                    <CardTitle>{webhook.name}</CardTitle>
                    <CardDescription>{webhook.description}</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* URL Section */}
              <div>
                <Label className="mb-2 block">URL do Webhook</Label>
                <div className="flex gap-2">
                  <code className="flex-1 bg-muted px-3 py-2 rounded-md text-sm font-mono break-all">
                    {webhook.url}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(webhook.url, webhook.name)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Events Section */}
              <div>
                <Label className="mb-2 block">Eventos Suportados</Label>
                <div className="flex flex-wrap gap-2">
                  {webhook.events.map((event) => (
                    <Badge key={event} variant="secondary">
                      {event}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Instructions Section */}
              <div>
                <Label className="mb-2 block">Como Configurar</Label>
                <ol className="space-y-2">
                  {webhook.instructions.map((instruction, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                      <span>{instruction}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default WebhooksSettings;
