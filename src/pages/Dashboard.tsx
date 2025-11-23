import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, TrendingUp, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

const stats = [
  {
    name: "Receita Total",
    value: "R$ 45.231",
    change: "+20,1%",
    icon: DollarSign,
    color: "text-success",
  },
  {
    name: "Negócios Ativos",
    value: "12",
    change: "+3",
    icon: TrendingUp,
    color: "text-primary",
  },
  {
    name: "Total de Contatos",
    value: "2.345",
    change: "+180",
    icon: Users,
    color: "text-info",
  },
  {
    name: "Mensagens Não Lidas",
    value: "8",
    change: "-2",
    icon: Inbox,
    color: "text-warning",
  },
];

export default function Dashboard() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-foreground">Painel</h2>
        <p className="text-muted-foreground">Bem-vindo de volta! Veja o que está acontecendo com seu negócio.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.name}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.name}
                </CardTitle>
                <Icon className={cn("h-5 w-5", stat.color)} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  <span className={cn("font-medium", stat.change.startsWith("+") ? "text-success" : "text-muted-foreground")}>
                    {stat.change}
                  </span>{" "}
                  desde o mês passado
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Negócios Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Licença Enterprise - Acme Corp</p>
                  <p className="text-sm text-muted-foreground">Atualizado há 2 horas</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-success">R$ 25.000</p>
                  <p className="text-xs text-muted-foreground">Negociação</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Assinatura Anual - TechStart</p>
                  <p className="text-sm text-muted-foreground">Atualizado há 5 horas</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-success">R$ 12.000</p>
                  <p className="text-xs text-muted-foreground">Proposta</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conversas Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                  JS
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">João Silva</p>
                  <p className="text-sm text-muted-foreground">Podemos agendar uma demo?</p>
                </div>
                <span className="text-xs text-muted-foreground">há 5m</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-info/10 text-info font-semibold">
                  MS
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Maria Santos</p>
                  <p className="text-sm text-muted-foreground">Obrigada pela proposta!</p>
                </div>
                <span className="text-xs text-muted-foreground">há 1h</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}