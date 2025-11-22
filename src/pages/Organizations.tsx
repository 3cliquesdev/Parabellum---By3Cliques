import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Plus, Users, TrendingUp } from "lucide-react";

const mockOrganizations = [
  {
    id: "1",
    name: "Acme Corp",
    domain: "acme.com",
    contacts: 5,
    deals: 3,
    revenue: "R$ 75.000",
  },
  {
    id: "2",
    name: "TechStart",
    domain: "techstart.io",
    contacts: 3,
    deals: 2,
    revenue: "R$ 42.000",
  },
  {
    id: "3",
    name: "Innovate Inc",
    domain: "innovate.com",
    contacts: 7,
    deals: 4,
    revenue: "R$ 125.000",
  },
];

export default function Organizations() {
  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Organizações</h2>
          <p className="text-muted-foreground">Gerencie relacionamentos empresariais</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar Organização
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {mockOrganizations.map((org) => (
          <Card key={org.id} className="hover:border-primary transition-colors cursor-pointer">
            <CardHeader>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl">{org.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{org.domain}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span className="text-sm">Contatos</span>
                  </div>
                  <span className="font-semibold text-foreground">{org.contacts}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm">Negócios Ativos</span>
                  </div>
                  <span className="font-semibold text-foreground">{org.deals}</span>
                </div>
                <div className="pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Receita Total</span>
                    <span className="font-bold text-success">{org.revenue}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}