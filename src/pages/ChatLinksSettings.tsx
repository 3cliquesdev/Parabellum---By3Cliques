import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useDepartments } from "@/hooks/useDepartments";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink } from "lucide-react";

export default function ChatLinksSettings() {
  const { data: departments } = useDepartments();
  const { toast } = useToast();

  const activeDepartments = departments?.filter((d) => d.is_active) || [];
  const baseUrl = window.location.origin;

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({
      title: "Link copiado!",
      description: "O link foi copiado para a área de transferência",
    });
  };

  const openPortal = (link: string) => {
    window.open(link, "_blank");
  };

  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Links de Chat Público</h1>
        <p className="text-muted-foreground">
          Gere links diretos para seus departamentos e incorpore-os no seu site
        </p>
      </div>

      <div className="space-y-4">
        {/* Link Genérico */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🏢 Link Genérico (Menu de Seleção)
            </CardTitle>
            <CardDescription>
              O cliente escolhe o departamento após acessar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 bg-muted rounded text-sm">
                {baseUrl}/public-chat
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyLink(`${baseUrl}/public-chat`)}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openPortal(`${baseUrl}/public-chat`)}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Links por Departamento */}
        {activeDepartments.map((dept) => {
          const deptLink = `${baseUrl}/public-chat?dept=${dept.name.toLowerCase()}`;
          
          return (
            <Card key={dept.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: dept.color || "#3B82F6" }}
                  />
                  {dept.name}
                </CardTitle>
                <CardDescription>
                  Link direto - cai automaticamente neste departamento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-3 bg-muted rounded text-sm break-all">
                    {deptLink}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyLink(deptLink)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openPortal(deptLink)}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {activeDepartments.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Nenhum departamento ativo encontrado. Crie departamentos em Configurações.
            </CardContent>
          </Card>
        )}
      </div>

      <div className="mt-8 p-4 bg-muted/50 rounded-lg">
        <h3 className="font-semibold mb-2">💡 Como usar:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
          <li>Cole o link genérico no botão "Fale Conosco" do seu site</li>
          <li>Use links específicos em páginas de produto (ex: botão "Comprar" → link de Vendas)</li>
          <li>Coloque o link de Suporte na página de ajuda do seu site</li>
          <li>Compartilhe links diretos em redes sociais para triagem automática</li>
        </ul>
      </div>

      {/* Widget Embarcável */}
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🎨 Widget Embarcável (Menu Híbrido)
            </CardTitle>
            <CardDescription>
              Adicione um botão flutuante no seu site com menu WhatsApp + Chat + Ticket
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900 font-medium mb-2">✨ Novidade: Menu Inteligente</p>
              <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                <li>Prioriza WhatsApp no mobile, Chat no desktop</li>
                <li>Botão flutuante fixo no canto inferior direito</li>
                <li>Menu com 3 opções: WhatsApp, Chat ao Vivo, Abrir Ticket</li>
              </ul>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="mb-2 block">
                  1. Copie o código abaixo e cole antes do {"</body>"} do seu site:
                </Label>
                <div className="relative">
                  <code className="block p-4 bg-muted rounded text-xs overflow-x-auto">
{`<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${baseUrl}/public-chat-widget.js';
    document.head.appendChild(script);
  })();
</script>`}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `<script>\n  (function() {\n    var script = document.createElement('script');\n    script.src = '${baseUrl}/public-chat-widget.js';\n    document.head.appendChild(script);\n  })();\n</script>`
                      );
                      toast({
                        title: "Código copiado!",
                        description: "Cole no seu site antes do </body>",
                      });
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                <p className="text-xs text-amber-900">
                  <strong>💡 Dica:</strong> Para vincular o widget a um departamento específico (ex: mostrar WhatsApp do Suporte), 
                  adicione <code className="bg-amber-100 px-1 rounded">script.dataset.department = 'suporte';</code> antes do appendChild.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button variant="outline" onClick={() => window.open(`${baseUrl}/public-chat`, "_blank")}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Preview do Widget
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
