import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    </div>
  );
}
