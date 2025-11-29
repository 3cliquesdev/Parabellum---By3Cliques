import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDeals } from "@/hooks/useDeals";
import { useContacts } from "@/hooks/useContacts";
import { CheckCircle2, Clock, DollarSign } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function RecentActionsWidget() {
  const { data: deals } = useDeals();
  const { data: contacts } = useContacts();

  // Combinar últimas ações de deals e contatos
  const recentActions = [
    ...(deals?.slice(0, 3).map((deal) => ({
      type: "deal" as const,
      id: deal.id,
      title: deal.title,
      description: deal.status === "won" ? "Negócio ganho" : "Negócio em andamento",
      timestamp: new Date(deal.updated_at),
      icon: deal.status === "won" ? CheckCircle2 : DollarSign,
      iconColor: deal.status === "won" ? "text-success" : "text-warning",
    })) || []),
    ...(contacts?.slice(0, 2).map((contact) => ({
      type: "contact" as const,
      id: contact.id,
      title: `${contact.first_name} ${contact.last_name}`,
      description: "Novo contato confirmado",
      timestamp: new Date(contact.created_at),
      icon: CheckCircle2,
      iconColor: "text-primary",
    })) || []),
  ]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-400" />
          Últimas Ações
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {recentActions.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-xs">
              Nenhuma ação recente
            </p>
          ) : (
            recentActions.map((action) => {
              const Icon = action.icon;
              return (
                <div key={action.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div
                      className={`flex items-center justify-center w-8 h-8 rounded bg-secondary ${action.iconColor}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{action.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{action.description}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(action.timestamp, { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
