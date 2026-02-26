import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useConsultants } from "@/hooks/useConsultants";
import { useConsultantPerformance } from "@/hooks/useConsultantPerformance";
import { Users, Search, Briefcase, Ban, Mail, UserCheck, AlertCircle } from "lucide-react";
import { ConsultantClientsSheet } from "@/components/contacts/ConsultantClientsSheet";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface EmailSearchResult {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  consultant_id: string | null;
}

export default function Consultants() {
  const { data: consultants, isLoading } = useConsultants(true);
  const { data: performance } = useConsultantPerformance();
  const [search, setSearch] = useState("");
  const [selectedConsultant, setSelectedConsultant] = useState<{ id: string; name: string } | null>(null);
  const [emailResults, setEmailResults] = useState<EmailSearchResult[]>([]);
  const [emailSearching, setEmailSearching] = useState(false);
  const [emailSearchDone, setEmailSearchDone] = useState(false);

  const isEmailSearch = search.includes("@");

  // Debounced email search
  useEffect(() => {
    if (!isEmailSearch || search.length < 3) {
      setEmailResults([]);
      setEmailSearchDone(false);
      return;
    }

    const timer = setTimeout(async () => {
      setEmailSearching(true);
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email, consultant_id")
        .ilike("email", `%${search}%`)
        .limit(5);

      if (!error && data) {
        setEmailResults(data);
      } else {
        setEmailResults([]);
      }
      setEmailSearchDone(true);
      setEmailSearching(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [search, isEmailSearch]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const filteredConsultants = consultants?.filter(c =>
    c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.job_title?.toLowerCase().includes(search.toLowerCase())
  );

  const getPerformance = (consultantId: string) => {
    return performance?.find(p => p.id === consultantId);
  };

  const getConsultantName = (consultantId: string | null) => {
    if (!consultantId || !consultants) return null;
    const c = consultants.find(c => c.id === consultantId);
    return c?.full_name || null;
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
          placeholder="Buscar por nome do consultor ou email do cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
        {isEmailSearch && (
          <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
        )}
      </div>

      {/* Email Search Results */}
      {isEmailSearch && emailSearchDone && !emailSearching && (
        <div className="space-y-2">
          {emailResults.length > 0 ? (
            emailResults.map(contact => {
              const consultantName = getConsultantName(contact.consultant_id);
              return (
                <Card key={contact.id} className="p-4 border-primary/30 bg-primary/5">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium text-foreground">
                          {contact.first_name} {contact.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">{contact.email}</p>
                      </div>
                    </div>
                    {contact.consultant_id && consultantName ? (
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-foreground font-medium">{consultantName}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedConsultant({
                            id: contact.consultant_id!,
                            name: consultantName,
                          })}
                        >
                          Ver clientes
                        </Button>
                      </div>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-muted-foreground">
                        <AlertCircle className="h-3 w-3" />
                        Sem consultor atribuído
                      </Badge>
                    )}
                  </div>
                </Card>
              );
            })
          ) : (
            <Card className="p-4 border-destructive/30 bg-destructive/5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                Nenhum cliente encontrado com este email
              </div>
            </Card>
          )}
        </div>
      )}

      {isEmailSearch && emailSearching && (
        <Skeleton className="h-16 rounded-lg max-w-md" />
      )}

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
