import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useConsultants } from "@/hooks/useConsultants";
import { useConsultantPerformance } from "@/hooks/useConsultantPerformance";
import { Users, Search, Briefcase, Ban } from "lucide-react";
import { ConsultantClientsSheet } from "@/components/contacts/ConsultantClientsSheet";

export default function Consultants() {
  const { data: consultants, isLoading } = useConsultants(true); // includeBlocked = true
  const { data: performance } = useConsultantPerformance();
  const [search, setSearch] = useState("");
  const [selectedConsultant, setSelectedConsultant] = useState<{ id: string; name: string } | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Filter consultants by search
  const filteredConsultants = consultants?.filter(c => 
    c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.job_title?.toLowerCase().includes(search.toLowerCase())
  );

  // Get performance data for a consultant
  const getPerformance = (consultantId: string) => {
    return performance?.find(p => p.id === consultantId);
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Consultores</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie sua equipe de Customer Success
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Users className="h-3 w-3" />
            {consultants?.length || 0} consultores
          </Badge>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar consultor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Consultants Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : filteredConsultants && filteredConsultants.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredConsultants.map(consultant => {
            const perf = getPerformance(consultant.id);
            const isBlocked = consultant.is_blocked;
            
            return (
              <Card 
                key={consultant.id}
                className={`p-4 cursor-pointer transition-all hover:shadow-md hover:border-primary/50 ${
                  isBlocked ? "opacity-60 bg-muted/50" : ""
                }`}
                onClick={() => setSelectedConsultant({ 
                  id: consultant.id, 
                  name: consultant.full_name || "Consultor" 
                })}
              >
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={consultant.avatar_url || undefined} />
                    <AvatarFallback>
                      {consultant.full_name?.[0] || "?"}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground truncate">
                        {consultant.full_name}
                      </h3>
                      {isBlocked && (
                        <Badge variant="destructive" className="text-xs gap-1">
                          <Ban className="h-3 w-3" />
                          Bloqueado
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {consultant.job_title || "Consultor de CS"}
                    </p>
                  </div>
                </div>
                
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground font-medium">
                      {perf?.portfolio_count || 0}
                    </span>
                    <span className="text-muted-foreground">clientes</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground font-medium">
                      {formatCurrency(perf?.portfolio_value || 0)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 text-xs text-muted-foreground">
                  Clique para ver clientes e transferir
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-foreground">Nenhum consultor encontrado</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {search ? "Tente ajustar sua busca" : "Cadastre consultores no painel de usuários"}
          </p>
        </Card>
      )}

      {/* Sheet para ver clientes do consultor */}
      {selectedConsultant && (
        <ConsultantClientsSheet
          consultantId={selectedConsultant.id}
          consultantName={selectedConsultant.name}
          open={!!selectedConsultant}
          onOpenChange={(open) => !open && setSelectedConsultant(null)}
        />
      )}
    </div>
  );
}
