import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileSpreadsheet, CheckCircle2, ArrowRight } from "lucide-react";

const TEMPLATE_CSV = `\uFEFF"pergunta";"resposta";"categoria";"tags"
"Como faço um saque?";"Para fazer um saque, acesse sua conta > Menu > Saques > Solicitar. O prazo é de 3-5 dias úteis.";"Financeiro";"saque, dinheiro, pagamento"
"Qual o prazo de entrega?";"O prazo de entrega varia de 5 a 15 dias úteis, dependendo da sua região.";"Pedidos";"entrega, prazo, envio"
"Como rastrear meu pedido?";"Acesse Meus Pedidos > Clique no pedido > Ver Rastreamento. Você receberá atualizações por email.";"Pedidos";"rastreio, pedido, acompanhar"
"Como alterar minha senha?";"Acesse Configurações > Segurança > Alterar Senha. Digite a senha atual e a nova.";"Conta";"senha, segurança, login"`;

const CATEGORIES = [
  { name: "Financeiro", description: "Saques, comissões, reembolsos" },
  { name: "Pedidos", description: "Status, rastreio, entrega" },
  { name: "Produtos", description: "Catálogo, preços" },
  { name: "Conta", description: "Login, configurações" },
  { name: "Técnico", description: "Bugs, integrações" },
  { name: "Comercial", description: "Planos, parcerias" },
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
          Template CSV compatível com Excel (separado por ponto-e-vírgula)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Colunas principais */}
        <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 space-y-3">
          <h4 className="font-semibold text-sm text-primary">📋 Colunas Principais (obrigatórias)</h4>
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-md bg-background p-3 border">
              <p className="font-medium text-sm">pergunta</p>
              <p className="text-xs text-muted-foreground">A dúvida do cliente</p>
            </div>
            <ArrowRight className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 rounded-md bg-background p-3 border">
              <p className="font-medium text-sm">resposta</p>
              <p className="text-xs text-muted-foreground">Resposta completa (min. 50 caracteres)</p>
            </div>
          </div>
        </div>

        {/* Colunas opcionais */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground">Colunas Opcionais:</h4>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span><strong className="text-foreground">categoria</strong> — Agrupamento do artigo</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span><strong className="text-foreground">tags</strong> — Palavras-chave (separadas por vírgula)</span>
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground">Categorias Sugeridas:</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {CATEGORIES.map((cat) => (
                <li key={cat.name}>
                  <span className="font-medium text-foreground">{cat.name}</span>: {cat.description}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
          <h4 className="font-medium text-sm">💡 Dicas:</h4>
          <ul className="text-sm text-muted-foreground space-y-0.5">
            <li>• Separador: <strong>ponto-e-vírgula (;)</strong> — compatível com Excel BR</li>
            <li>• Respostas com pelo menos 50 caracteres</li>
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