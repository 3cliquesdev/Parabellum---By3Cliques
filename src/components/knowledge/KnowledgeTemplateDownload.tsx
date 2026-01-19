import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileSpreadsheet, CheckCircle2 } from "lucide-react";

const TEMPLATE_CSV = `pergunta,resposta,categoria,tags
"Como faço um saque?","Para fazer um saque, acesse sua conta > Menu > Saques > Solicitar. O prazo é de 3-5 dias úteis.","Financeiro","saque,dinheiro,pagamento"
"Qual o prazo de entrega?","O prazo de entrega varia de 5 a 15 dias úteis, dependendo da sua região.","Pedidos","entrega,prazo,envio"
"Como rastrear meu pedido?","Acesse Meus Pedidos > Clique no pedido > Ver Rastreamento. Você receberá atualizações por email.","Pedidos","rastreio,pedido,acompanhar"
"Como alterar minha senha?","Acesse Configurações > Segurança > Alterar Senha. Digite a senha atual e a nova.","Conta","senha,segurança,login"`;

const CATEGORIES = [
  { name: "Financeiro", description: "Saques, comissões, reembolsos, pagamentos" },
  { name: "Pedidos", description: "Status, rastreio, problemas de entrega" },
  { name: "Produtos", description: "Catálogo, preços, disponibilidade" },
  { name: "Conta", description: "Login, configurações, perfil" },
  { name: "Técnico", description: "Bugs, integrações, API" },
  { name: "Comercial", description: "Planos, parcerias, upgrades" },
];

export function KnowledgeTemplateDownload() {
  const handleDownload = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "template_conhecimento.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          Template de Importação
        </CardTitle>
        <CardDescription>
          Use nosso template CSV otimizado para importar conhecimento de forma eficiente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Colunas do Template:</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span><strong>pergunta</strong> - A pergunta do cliente (obrigatório)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span><strong>resposta</strong> - Resposta completa (min. 50 caracteres)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span><strong>categoria</strong> - Categoria do artigo</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span><strong>tags</strong> - Tags separadas por vírgula</span>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-sm">Categorias Sugeridas:</h4>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {CATEGORIES.map((cat) => (
                <li key={cat.name} className="flex items-start gap-2">
                  <span className="font-medium text-foreground">{cat.name}:</span>
                  <span>{cat.description}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h4 className="font-medium text-sm">💡 Dicas para Qualidade:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Respostas devem ter pelo menos 50 caracteres</li>
            <li>• Evite perguntas duplicadas</li>
            <li>• Use categorias consistentes</li>
            <li>• Mínimo recomendado: 100 artigos para boa cobertura</li>
          </ul>
        </div>

        <Button onClick={handleDownload} className="w-full">
          <Download className="h-4 w-4 mr-2" />
          Baixar Template CSV
        </Button>
      </CardContent>
    </Card>
  );
}
