import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Globe, 
  Loader2, 
  RefreshCw, 
  Check, 
  Clock, 
  X, 
  ChevronDown, 
  ChevronRight,
  Trash2,
  Shield,
  Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DnsRecordsTable } from "./DnsRecordsTable";
import { AddDomainDialog } from "./AddDomainDialog";

interface ResendDomain {
  id: string;
  name: string;
  status: string;
  created_at: string;
  region: string;
  records?: any[];
}

export function ResendDomainManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>({});

  // Fetch primary domain from system_configurations
  const { data: primaryDomain } = useQuery({
    queryKey: ["primary-domain"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_configurations")
        .select("value")
        .eq("key", "email_verified_domain")
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data?.value || null;
    },
  });

  // Fetch all domains
  const { data: domainsData, isLoading, refetch } = useQuery({
    queryKey: ["resend-domains"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("resend-domain-manager", {
        body: { action: "list" },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data.domains as ResendDomain[];
    },
  });

  // Set primary domain mutation
  const setPrimaryMutation = useMutation({
    mutationFn: async (domainName: string) => {
      const { error } = await supabase
        .from("system_configurations")
        .update({ value: domainName })
        .eq("key", "email_verified_domain");
      if (error) throw error;
    },
    onSuccess: (_, domainName) => {
      queryClient.invalidateQueries({ queryKey: ["primary-domain"] });
      queryClient.invalidateQueries({ queryKey: ["email-configs"] });
      toast({
        title: "✅ Domínio principal atualizado",
        description: `${domainName} agora é o domínio principal para envio de emails`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao definir domínio principal",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Get domain details with DNS records
  const getDomainDetails = async (domainId: string) => {
    const { data, error } = await supabase.functions.invoke("resend-domain-manager", {
      body: { action: "get", domainId },
    });
    if (error) throw error;
    if (data.error) throw new Error(data.error);
    return data.domain;
  };

  // Verify domain mutation
  const verifyMutation = useMutation({
    mutationFn: async (domainId: string) => {
      const { data, error } = await supabase.functions.invoke("resend-domain-manager", {
        body: { action: "verify", domainId },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resend-domains"] });
      toast({
        title: "Verificação iniciada",
        description: "A verificação DNS foi solicitada. Atualize em alguns segundos.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro na verificação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete domain mutation
  const deleteMutation = useMutation({
    mutationFn: async (domainId: string) => {
      const { data, error } = await supabase.functions.invoke("resend-domain-manager", {
        body: { action: "delete", domainId },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resend-domains"] });
      toast({
        title: "Domínio removido",
        description: "O domínio foi removido com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fetch domain details query (for expanded domains)
  const { data: domainDetails } = useQuery({
    queryKey: ["resend-domain-details", Object.keys(expandedDomains).filter(k => expandedDomains[k])],
    queryFn: async () => {
      const expandedIds = Object.keys(expandedDomains).filter(k => expandedDomains[k]);
      const details: Record<string, any> = {};
      for (const id of expandedIds) {
        details[id] = await getDomainDetails(id);
      }
      return details;
    },
    enabled: Object.values(expandedDomains).some(v => v),
  });

  const toggleExpand = (domainId: string) => {
    setExpandedDomains(prev => ({
      ...prev,
      [domainId]: !prev[domainId],
    }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "verified":
        return <Check className="h-4 w-4 text-green-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "failed":
      case "not_started":
      default:
        return <X className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-green-500">Verificado</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500 text-black">Pendente</Badge>;
      case "failed":
        return <Badge variant="destructive">Falhou</Badge>;
      case "not_started":
      default:
        return <Badge variant="outline">Não iniciado</Badge>;
    }
  };

  // Transform DNS records from domain details
  const transformRecords = (domain: any) => {
    if (!domain?.records) return [];
    return domain.records.map((r: any) => ({
      record: r.record,
      name: r.name,
      type: r.type,
      ttl: r.ttl || "Auto",
      status: r.status,
      value: r.value,
      priority: r.priority,
    }));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              Domínios de Email
            </CardTitle>
            <CardDescription>
              Gerencie seus domínios verificados para envio de emails
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <AddDomainDialog onDomainAdded={() => refetch()} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !domainsData || domainsData.length === 0 ? (
          <div className="text-center py-8 border rounded-lg bg-muted/20">
            <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum domínio configurado</h3>
            <p className="text-muted-foreground mb-4">
              Adicione um domínio para começar a enviar emails personalizados
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {domainsData.map((domain) => (
              <Collapsible
                key={domain.id}
                open={expandedDomains[domain.id]}
                onOpenChange={() => toggleExpand(domain.id)}
              >
                <div className="border rounded-lg">
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        {expandedDomains[domain.id] ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        {getStatusIcon(domain.status)}
                        <span className="font-medium">{domain.name}</span>
                        {getStatusBadge(domain.status)}
                        {domain.status === "verified" && primaryDomain === domain.name && (
                          <Badge className="bg-amber-500 text-black gap-1">
                            <Star className="h-3 w-3 fill-current" />
                            Principal
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {domain.status === "verified" && primaryDomain !== domain.name && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPrimaryMutation.mutate(domain.name)}
                            disabled={setPrimaryMutation.isPending}
                            className="text-amber-600 border-amber-300 hover:bg-amber-50 hover:text-amber-700"
                          >
                            {setPrimaryMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Star className="h-4 w-4 mr-1" />
                                Definir Principal
                              </>
                            )}
                          </Button>
                        )}
                        {domain.status !== "verified" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => verifyMutation.mutate(domain.id)}
                            disabled={verifyMutation.isPending}
                          >
                            {verifyMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Shield className="h-4 w-4 mr-1" />
                                Verificar
                              </>
                            )}
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover Domínio</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja remover o domínio <strong>{domain.name}</strong>? 
                                Esta ação não pode ser desfeita e você precisará configurar o domínio novamente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => deleteMutation.mutate(domain.id)}
                              >
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 space-y-4">
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Região:</span> {domain.region || "us-east-1"} • 
                        <span className="font-medium ml-2">ID:</span> {domain.id}
                      </div>
                      
                      {domainDetails?.[domain.id] ? (
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">Registros DNS</h4>
                          <DnsRecordsTable records={transformRecords(domainDetails[domain.id])} />
                        </div>
                      ) : (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
