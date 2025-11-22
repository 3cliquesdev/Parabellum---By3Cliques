import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const stages = [
  { name: "Qualification", color: "bg-info" },
  { name: "Proposal", color: "bg-warning" },
  { name: "Negotiation", color: "bg-primary" },
  { name: "Closed Won", color: "bg-success" },
];

const deals = [
  {
    id: 1,
    title: "Enterprise License - Acme Corp",
    value: "$25,000",
    contact: "John Doe",
    stage: "Negotiation",
  },
  {
    id: 2,
    title: "Annual Subscription - TechStart",
    value: "$12,000",
    contact: "Sarah Miller",
    stage: "Proposal",
  },
  {
    id: 3,
    title: "Consulting Services - Innovate Inc",
    value: "$8,500",
    contact: "Mike Johnson",
    stage: "Qualification",
  },
];

export default function Deals() {
  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Deals Pipeline</h2>
          <p className="text-muted-foreground">Track your deals through the sales pipeline</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Deal
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
                {deals.filter(d => d.stage === stage.name).length} deals
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