import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useConsultants, useActiveConsultants } from "@/hooks/useConsultants";
import { useConsultantPerformance } from "@/hooks/useConsultantPerformance";
import { Users, Search, Briefcase, Ban, Mail, UserCheck, AlertCircle, UserMinus, Loader2, UserPlus, Copy } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { ConsultantClientsSheet } from "@/components/contacts/ConsultantClientsSheet";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";
import { hasFullAccess } from "@/config/roles";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [unlinkContactId, setUnlinkContactId] = useState<string | null>(null);
  const [unlinkContactName, setUnlinkContactName] = useState("");
  const { role } = useUserRole();
  const canManage = hasFullAccess(role);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: activeConsultants } = useActiveConsultants();
  const { user } = useAuth();

  const unlinkMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      // 1. Setar consultant_id = null e flag de remoção manual
      const { error } = await supabase
        .from("contacts")
        .update({ consultant_id: null, consultant_manually_removed: true } as any)
        .eq("id", contactId);

      if (error) throw error;

      // 2. Resetar conversas abertas para autopilot (libera Master Flow)
      const { data: openConvos } = await supabase
        .from("conversations")
        .select("id")
        .eq("contact_id", contactId)
        .in("status", ["open"])
        .in("ai_mode", ["waiting_human", "copilot"]);

      if (openConvos && openConvos.length > 0) {
        const convIds = openConvos.map(c => c.id);
        await supabase
          .from("conversations")
          .update({ ai_mode: "autopilot" as any, assigned_to: null })
          .in("id", convIds);
        console.log("[Consultants] Reset ai_mode→autopilot para", convIds.length, "conversas");
      }

      await supabase.from("interactions").insert({
        customer_id: contactId,
        type: "note" as const,
        channel: "other" as const,
        content: `Consultor removido do cliente por admin/gerente`,
        created_by: authUser?.id,
        metadata: { action: "consultant_removed", removed_by: authUser?.id },
      });
    },
    onSuccess: () => {
      toast({ title: "Consultor removido", description: `Cliente ${unlinkContactName} desvinculado com sucesso.` });
      setUnlinkContactId(null);
      setEmailResults(prev => prev.map(c => c.id === unlinkContactId ? { ...c, consultant_id: null } : c));
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao remover consultor", description: error.message, variant: "destructive" });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ contactId, consultantId }: { contactId: string; consultantId: string }) => {
      const { error } = await supabase
        .from("contacts")
        .update({ consultant_id: consultantId })
        .eq("id", contactId);

      if (error) throw error;

      const consultantName = activeConsultants?.find(c => c.id === consultantId)?.full_name || "Desconhecido";
      await supabase.from("interactions").insert({
        customer_id: contactId,
        type: "note" as const,
        channel: "other" as const,
        content: `Consultor ${consultantName} atribuído ao cliente`,
        created_by: user?.id,
        metadata: { action: "consultant_assigned", consultant_id: consultantId, assigned_by: user?.id },
      });
    },
    onSuccess: (_, variables) => {
      toast({ title: "Consultor atribuído", description: "Cliente vinculado ao consultor com sucesso." });
      setEmailResults(prev => prev.map(c => c.id === variables.contactId ? { ...c, consultant_id: variables.consultantId } : c));
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atribuir consultor", description: error.message, variant: "destructive" });
    },
  });



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
                        <UserCheck className="h-4 w-4 text-success" />
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
                        {canManage && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setUnlinkContactId(contact.id);
                              setUnlinkContactName(`${contact.first_name} ${contact.last_name}`);
                            }}
                          >
                            <UserMinus className="h-3 w-3 mr-1" />
                            Remover
                          </Button>
                        )}
                      </div>
                    ) : canManage ? (
                      <div className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                        <Select
                          onValueChange={(value) => assignMutation.mutate({ contactId: contact.id, consultantId: value })}
                        >
                          <SelectTrigger className="w-[200px] h-8 text-sm">
                            <SelectValue placeholder="Atribuir consultor..." />
                          </SelectTrigger>
                          <SelectContent>
                            {activeConsultants?.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {assignMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
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
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs text-muted-foreground font-mono">
                        ID: {consultant.id.substring(0, 8)}...
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(consultant.id);
                          sonnerToast.success("ID copiado!", { description: consultant.id });
                        }}
                        className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        title="Copiar ID completo"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
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

      {/* Unlink Confirmation Dialog */}
      <AlertDialog open={!!unlinkContactId} onOpenChange={(open) => !open && setUnlinkContactId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover consultor do cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o consultor de <strong>{unlinkContactName}</strong>?
              O cliente ficará sem consultor atribuído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => unlinkContactId && unlinkMutation.mutate(unlinkContactId)}
            >
              {unlinkMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <UserMinus className="h-4 w-4 mr-2" />
              )}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
