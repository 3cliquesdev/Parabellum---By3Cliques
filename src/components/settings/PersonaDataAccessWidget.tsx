import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, BookOpen, User, Package, DollarSign, Check, X } from "lucide-react";
import { usePersonas } from "@/hooks/usePersonas";
import { Skeleton } from "@/components/ui/skeleton";

interface DataAccess {
  customer_data?: boolean;
  knowledge_base?: boolean;
  order_history?: boolean;
  financial_data?: boolean;
}

const ACCESS_LABELS = [
  { key: "knowledge_base", label: "Base de Conhecimento", icon: BookOpen, color: "text-blue-500" },
  { key: "customer_data", label: "Dados de Clientes", icon: User, color: "text-green-500" },
  { key: "order_history", label: "Histórico de Pedidos", icon: Package, color: "text-purple-500" },
  { key: "financial_data", label: "Dados Financeiros", icon: DollarSign, color: "text-amber-500" },
];

export function PersonaDataAccessWidget() {
  const { data: personas, isLoading } = usePersonas();

  const activePersonas = personas?.filter((p) => p.is_active) || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle>Acesso por Persona</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 border rounded-lg">
                <Skeleton className="h-5 w-32 mb-2" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle>Acesso por Persona</CardTitle>
        </div>
        <CardDescription>
          Quais dados cada agente de IA pode acessar
        </CardDescription>
      </CardHeader>
      <CardContent>
        {activePersonas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma persona ativa encontrada
          </p>
        ) : (
          <div className="space-y-3">
            {activePersonas.map((persona) => {
              const dataAccess = (persona.data_access as DataAccess) || {};

              return (
                <div
                  key={persona.id}
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-foreground">{persona.name}</h4>
                      <p className="text-xs text-muted-foreground">{persona.role}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      Ativo
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ACCESS_LABELS.map(({ key, label, icon: Icon, color }) => {
                      const hasAccess = dataAccess[key as keyof DataAccess];

                      return (
                        <Badge
                          key={key}
                          variant={hasAccess ? "default" : "outline"}
                          className={`text-xs ${hasAccess ? "" : "opacity-50"}`}
                        >
                          {hasAccess ? (
                            <Check className={`h-3 w-3 mr-1 ${color}`} />
                          ) : (
                            <X className="h-3 w-3 mr-1 text-muted-foreground" />
                          )}
                          {label}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
