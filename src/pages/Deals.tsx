import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const stages = [
  { name: "Qualificação", color: "bg-info" },
  { name: "Proposta", color: "bg-warning" },
  { name: "Negociação", color: "bg-primary" },
  { name: "Fechado/Ganho", color: "bg-success" },
];

const deals = [
  {
    id: 1,
    title: "Licença Enterprise - Acme Corp",
    value: "R$ 25.000",
    contact: "João Silva",
    stage: "Negociação",
  },
  {
    id: 2,
    title: "Assinatura Anual - TechStart",
    value: "R$ 12.000",
    contact: "Maria Santos",
    stage: "Proposta",
  },
  {
    id: 3,
    title: "Serviços de Consultoria - Innovate Inc",
    value: "R$ 8.500",
    contact: "Pedro Costa",
    stage: "Qualificação",
  },
];

export default function Deals() {
  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Funil de Negócios</h2>
          <p className="text-muted-foreground">Acompanhe seus negócios pelo funil de vendas</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar Negócio
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {stages.map((stage) => (
          <div key={stage.name}>
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`h-2 w-2 rounded-full ${stage.color}`} />
                <h3 className="font-semibold text-foreground">{stage.name}</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {deals.filter(d => d.stage === stage.name).length} negócios
              </p>
            </div>
            
            <div className="space-y-3">
              {deals
                .filter((deal) => deal.stage === stage.name)
                .map((deal) => (
                  <Card key={deal.id} className="p-4 cursor-pointer hover:border-primary transition-colors">
                    <h4 className="font-medium text-foreground mb-2">{deal.title}</h4>
                    <p className="text-2xl font-bold text-success mb-3">{deal.value}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {deal.contact.split(" ").map(n => n[0]).join("")}
                      </div>
                      <span className="text-sm text-muted-foreground">{deal.contact}</span>
                    </div>
                  </Card>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}