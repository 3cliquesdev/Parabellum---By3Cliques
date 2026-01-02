import { useState } from "react";
import { useInternalRequests, useUpdateInternalRequestStatus, type InternalRequest } from "@/hooks/useInternalRequests";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Loader2, Clock, CheckCircle2, AlertCircle, User, Building2, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pendente", color: "bg-yellow-500" },
  { value: "in_progress", label: "Em Andamento", color: "bg-blue-500" },
  { value: "completed", label: "Concluído", color: "bg-green-500" },
  { value: "cancelled", label: "Cancelado", color: "bg-destructive" },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-500",
  medium: "bg-yellow-500",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};

function RequestCard({ request, onStatusChange }: { request: InternalRequest; onStatusChange: (id: string, status: string) => void }) {
  const statusInfo = STATUS_OPTIONS.find(s => s.value === request.status) || STATUS_OPTIONS[0];
  const priorityColor = PRIORITY_COLORS[request.priority] || PRIORITY_COLORS.medium;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold line-clamp-2">
              {request.title}
            </CardTitle>
            {request.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {request.description}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1 items-end shrink-0">
            <Badge className={priorityColor}>
              {request.priority}
            </Badge>
            <Badge variant="outline" className={`${statusInfo.color} text-white border-0`}>
              {statusInfo.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
          {request.department && (
            <div className="flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" />
              <span>{request.department.name}</span>
            </div>
          )}
          {request.assignee && (
            <div className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              <span>{request.assignee.full_name}</span>
            </div>
          )}
          {request.contact && (
            <div className="flex items-center gap-1">
              <User className="h-3.5 w-3.5 text-primary" />
              <span>{request.contact.first_name} {request.contact.last_name}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>{format(new Date(request.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
          </div>
        </div>

        {request.status !== "completed" && request.status !== "cancelled" && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Alterar status:</span>
            <Select 
              value={request.status} 
              onValueChange={(value) => onStatusChange(request.id, value)}
            >
              <SelectTrigger className="w-40 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function InternalRequests() {
  const { data: requests, isLoading } = useInternalRequests();
  const updateStatus = useUpdateInternalRequestStatus();
  const [activeTab, setActiveTab] = useState("all");

  const handleStatusChange = (id: string, status: string) => {
    updateStatus.mutate({ id, status });
  };

  const filteredRequests = requests?.filter(r => {
    if (activeTab === "all") return true;
    return r.status === activeTab;
  }) || [];

  const counts = {
    all: requests?.length || 0,
    pending: requests?.filter(r => r.status === "pending").length || 0,
    in_progress: requests?.filter(r => r.status === "in_progress").length || 0,
    completed: requests?.filter(r => r.status === "completed").length || 0,
  };

  if (isLoading) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <ClipboardList className="h-8 w-8 text-primary" />
          Solicitações Internas
        </h1>
        <p className="text-muted-foreground mt-2">
          Gerencie solicitações internas originadas de formulários e outras fontes
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="all" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Todas ({counts.all})
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Pendentes ({counts.pending})
          </TabsTrigger>
          <TabsTrigger value="in_progress" className="gap-2">
            <AlertCircle className="h-4 w-4" />
            Em Andamento ({counts.in_progress})
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Concluídas ({counts.completed})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {filteredRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ClipboardList className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Nenhuma solicitação encontrada
                </h3>
                <p className="text-muted-foreground">
                  {activeTab === "all" 
                    ? "Solicitações internas aparecerão aqui quando forem criadas via formulários."
                    : `Não há solicitações com status "${STATUS_OPTIONS.find(s => s.value === activeTab)?.label}".`
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredRequests.map(request => (
                <RequestCard 
                  key={request.id} 
                  request={request} 
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
