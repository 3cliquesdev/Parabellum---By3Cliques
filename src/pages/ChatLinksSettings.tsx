import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Copy, ExternalLink, MessageSquare, Phone } from "lucide-react";

export default function ChatLinksSettings() {
  const { toast } = useToast();

  const baseUrl = window.location.origin;

  // Buscar todas as instâncias WhatsApp conectadas
  const { data: whatsappInstances } = useQuery({
    queryKey: ['whatsapp-instances-public'],
    queryFn: async () => {
      const { data } = await supabase
        .from('whatsapp_instances')
        .select('phone_number, name')
        .eq('status', 'connected')
        .order('name');
      return data;
    }
  });

  const chatLink = `${baseUrl}/public-chat?dept=comercial`;
  const whatsappMessage = encodeURIComponent(
    "Olá, vim pelo site e gostaria de atendimento"
  );

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace('@s.whatsapp.net', '');
    return cleaned.replace(/(\d{2})(\d{2})(\d{4,5})(\d{4})/, '+$1 ($2) $3-$4');
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({
      title: "Link copiado!",
      description: "O link foi copiado para a área de transferência.",
    });
  };

  const openPortal = (url: string) => {
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Links Públicos</h1>
        <p className="text-muted-foreground">
          Links para compartilhar com clientes e leads
        </p>
      </div>

      {/* Card Chat */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            Chat ao Vivo
          </CardTitle>
          <CardDescription>Link direto para o chat online</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-3 bg-muted rounded text-sm break-all">
              {chatLink}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyLink(chatLink)}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openPortal(chatLink)}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Seção WhatsApp - Múltiplas instâncias */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Phone className="h-5 w-5 text-green-600" />
          WhatsApp
        </h2>
        
        {whatsappInstances && whatsappInstances.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {whatsappInstances.map((instance) => {
              const number = instance.phone_number?.replace('@s.whatsapp.net', '') || '';
              const link = `https://wa.me/${number}?text=${whatsappMessage}`;
              
              return (
                <Card key={instance.name}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{instance.name}</CardTitle>
                    <CardDescription>
                      {instance.phone_number ? formatPhoneNumber(instance.phone_number) : 'Sem número'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2 bg-muted rounded text-xs break-all">
                        {link}
                      </code>
                      <Button size="sm" variant="outline" onClick={() => copyLink(link)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openPortal(link)}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                Nenhuma instância WhatsApp conectada. Configure em Configurações → WhatsApp.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
