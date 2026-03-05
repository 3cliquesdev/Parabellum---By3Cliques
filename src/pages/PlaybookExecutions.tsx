import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Activity, CheckCircle, XCircle, Clock, AlertCircle, Eye, Play, BarChart3, ListChecks, Rocket, Search, Users, Calendar, Package, Loader2, UserCog } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePlaybookExecutions } from "@/hooks/usePlaybookExecutions";
import { useExecutionQueue } from "@/hooks/useExecutionQueue";
import { useProcessPlaybookQueue } from "@/hooks/useProcessPlaybookQueue";
import { usePlaybooks, useBulkTriggerPlaybook } from "@/hooks/usePlaybooks";
import { useProducts } from "@/hooks/useProducts";
import { useConsultants } from "@/hooks/useConsultants";
import { PlaybookMetricsDashboard } from "@/components/playbooks/PlaybookMetricsDashboard";
import { ExecutionOriginBadge } from "@/components/playbooks/ExecutionOriginBadge";
import { ChangeConsultantDialog } from "@/components/playbooks/ChangeConsultantDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CustomerResult {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  purchase_date: string;
  product_name: string | null;
  status: string;
  is_lead: boolean;
  deal_id: string;
  deal_status: string;
}

// Helper para determinar status de exibição baseado no deal.status
const getDisplayStatus = (dealStatus: string): string => {
  if (dealStatus === 'won') return 'customer';
  if (dealStatus === 'open') return 'lead';
  return 'churned';
};

export default function PlaybookExecutions() {
  const { data: executions, isLoading } = usePlaybookExecutions();
  const [selectedExecution, setSelectedExecution] = useState<any>(null);
  const { data: queueItems } = useExecutionQueue(selectedExecution?.id);
  const processQueue = useProcessPlaybookQueue();
  const { data: consultants } = useConsultants();
  const { toast } = useToast();

  // Change consultant dialog state
  const [changeConsultantData, setChangeConsultantData] = useState<{
    contactId: string;
    contactName: string;
    currentConsultantId: string | null;
  } | null>(null);

  // Broadcast state
  const [productId, setProductId] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("won");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string>("");
  const [skipExisting, setSkipExisting] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Helper to get consultant name
  const getConsultantName = (consultantId: string | null) => {
    if (!consultantId) return null;
    const consultant = consultants?.find((c) => c.id === consultantId);
    return consultant?.full_name || null;
  };

  const { data: products } = useProducts();
  const { data: playbooks } = usePlaybooks();
  const bulkTrigger = useBulkTriggerPlaybook();

  // Search query for broadcast - includes both contacts AND leads (deals without contact_id)
  const { data: customers, isLoading: isSearching, refetch } = useQuery({
    queryKey: ["broadcast-search", productId, startDate, endDate, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("deals")
        .select(`
          id,
          contact_id,
          created_at,
          status,
          title,
          lead_email,
          lead_phone,
          contacts!deals_contact_id_fkey(id, first_name, last_name, email, status),
          products(name)
        `);

      if (productId !== "all") {
        query = query.eq("product_id", productId);
      }
      if (startDate) {
        query = query.gte("created_at", startDate);
      }
      if (endDate) {
        query = query.lte("created_at", `${endDate}T23:59:59`);
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as "won" | "open" | "lost");
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;

      const seen = new Set<string>();
      const results: CustomerResult[] = [];

      for (const deal of data || []) {
        const contact = deal.contacts as any;
        const isLead = !contact;
        
        // Use contact.id for customers, deal.id for leads
        const uniqueId = contact?.id || deal.id;
        if (seen.has(uniqueId)) continue;
        seen.add(uniqueId);

        // Extract name from deal title for leads (format: "Lead - Name" or "Product - Name")
        const leadName = deal.title?.split(' - ').slice(1).join(' - ') || deal.title || 'Lead';
        const nameParts = leadName.split(' ');

        results.push({
          id: contact?.id || deal.id,
          deal_id: deal.id,
          first_name: contact?.first_name || nameParts[0] || 'Lead',
          last_name: contact?.last_name || nameParts.slice(1).join(' ') || '',
          email: contact?.email || deal.lead_email,
          purchase_date: deal.created_at,
          product_name: (deal.products as any)?.name || "N/A",
          status: getDisplayStatus(deal.status),
          is_lead: !deal.products, // Sem produto vinculado = Lead Manual, Com produto = Kiwify
          deal_status: deal.status,
        });
      }

      return results;
    },
    enabled: false,
  });

  const handleSearch = () => {
    setHasSearched(true);
    setSelectedIds(new Set());
    refetch();
  };

  const toggleSelectAll = () => {
    if (!customers) return;
    if (selectedIds.size === customers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(customers.map(c => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleTrigger = async () => {
    if (!selectedPlaybookId || selectedIds.size === 0 || !customers) return;

    // Separate leads (deal IDs) from contacts (contact IDs)
    const selectedCustomers = customers.filter(c => selectedIds.has(c.id));
    const contactIds = selectedCustomers.filter(c => !c.is_lead).map(c => c.id);
    const dealIds = selectedCustomers.filter(c => c.is_lead).map(c => c.deal_id);

    try {
      await bulkTrigger.mutateAsync({
        contactIds,
        dealIds,
        playbookId: selectedPlaybookId,
        skipExisting,
      });
      setShowConfirmDialog(false);
      setSelectedIds(new Set());
    } catch (error) {
      // Error handled by mutation
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "completed_via_goal":
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "running":
        return <Activity className="h-4 w-4 text-blue-600 animate-pulse" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      completed: "default",
      completed_via_goal: "secondary",
      failed: "destructive",
      running: "outline",
    };

    const labels: Record<string, string> = {
      completed: "Completo",
      completed_via_goal: "Completo (Meta)",
      failed: "Falhou",
      running: "Executando",
    };

    return (
      <Badge variant={variants[status] || "outline"} className="gap-1">
        {getStatusIcon(status)}
        {labels[status] || status}
      </Badge>
    );
  };

  const getNodeStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      completed: "default",
      failed: "destructive",
      pending: "secondary",
      processing: "outline",
    };

    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-foreground">
            <Activity className="h-8 w-8" />
            Monitoramento de Playbooks
          </h1>
          <p className="text-muted-foreground mt-1">
            Dashboard de métricas, histórico de execuções e disparo em massa
          </p>
        </div>
        <Button
          onClick={() => processQueue.mutate()}
          disabled={processQueue.isPending}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Play className="h-4 w-4" />
          {processQueue.isPending ? "Processando..." : "Processar Fila"}
        </Button>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="executions" className="gap-2">
            <ListChecks className="h-4 w-4" />
            Execuções
          </TabsTrigger>
          <TabsTrigger value="broadcast" className="gap-2">
            <Rocket className="h-4 w-4" />
            Disparador em Massa
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <PlaybookMetricsDashboard />
        </TabsContent>

        <TabsContent value="executions" className="space-y-6">
          {/* Métricas Resumidas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Execuções
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{executions?.length || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Em Execução
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {executions?.filter((e) => e.status === "running").length || 0}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Completas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {executions?.filter((e) => e.status.includes("completed")).length || 0}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Falhas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {executions?.filter((e) => e.status === "failed").length || 0}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabela de Execuções */}
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Execuções</CardTitle>
              <CardDescription>
                Lista completa de todas as execuções de playbooks
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : executions?.length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">Nenhuma execução registrada ainda</p>
                </div>
              ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Playbook</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Disparado por</TableHead>
                      <TableHead>Consultor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Iniciado</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {executions?.map((execution) => {
                      const consultantName = getConsultantName(execution.contact?.consultant_id);
                      return (
                        <TableRow key={execution.id}>
                          <TableCell className="font-medium">
                            {execution.contact?.first_name} {execution.contact?.last_name}
                            <div className="text-xs text-muted-foreground">
                              {execution.contact?.email}
                            </div>
                          </TableCell>
                          <TableCell>{execution.playbook?.name}</TableCell>
                          <TableCell>
                            <ExecutionOriginBadge triggeredBy={execution.triggered_by} />
                          </TableCell>
                          <TableCell className="text-sm">
                            {execution.triggered_by_user?.full_name || "-"}
                          </TableCell>
                          <TableCell>
                            {consultantName ? (
                              <Badge variant="outline" className="gap-1">
                                <UserCog className="h-3 w-3" />
                                {consultantName}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Aguardando</span>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(execution.status)}</TableCell>
                          <TableCell>
                            {execution.started_at
                              ? format(new Date(execution.started_at), "dd/MM HH:mm", {
                                  locale: ptBR,
                                })
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {execution.contact && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    setChangeConsultantData({
                                      contactId: execution.contact_id,
                                      contactName: `${execution.contact.first_name} ${execution.contact.last_name}`,
                                      currentConsultantId: execution.contact.consultant_id,
                                    })
                                  }
                                  title="Alterar consultor"
                                >
                                  <UserCog className="h-3 w-3" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedExecution(execution)}
                                className="gap-2"
                              >
                                <Eye className="h-3 w-3" />
                                Detalhes
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="broadcast" className="space-y-6">
          {/* Filters Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Filtros de Segmentação
              </CardTitle>
              <CardDescription>Defina os critérios para encontrar clientes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Produto
                  </Label>
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os produtos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os produtos</SelectItem>
                      {products?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Data Inicial
                  </Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Data Final
                  </Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Status do Deal</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="won">Ganhos (Pagos)</SelectItem>
                      <SelectItem value="open">Em Aberto</SelectItem>
                      <SelectItem value="lost">Perdidos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={handleSearch} className="mt-4" disabled={isSearching}>
                {isSearching ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Buscar Clientes
              </Button>
            </CardContent>
          </Card>

          {/* Results Card */}
          {hasSearched && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Resultados
                    </CardTitle>
                    <CardDescription>
                      {customers?.length || 0} clientes encontrados • {selectedIds.size} selecionados
                    </CardDescription>
                  </div>
                  {customers && customers.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedIds.size === customers.length}
                        onCheckedChange={toggleSelectAll}
                      />
                      <span className="text-sm text-muted-foreground">Selecionar todos</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isSearching ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : customers && customers.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead>Data Compra</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Origem</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customers.map((customer) => (
                          <TableRow key={customer.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.has(customer.id)}
                                onCheckedChange={() => toggleSelect(customer.id)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              {customer.first_name} {customer.last_name}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {customer.email || "-"}
                            </TableCell>
                            <TableCell>{customer.product_name}</TableCell>
                            <TableCell>
                              {format(new Date(customer.purchase_date), "dd/MM/yyyy")}
                            </TableCell>
                            <TableCell>
                              <Badge variant={customer.status === "customer" ? "success" : customer.status === "lead" ? "outline" : "destructive"}>
                                {customer.status === "customer" ? "✅ Cliente" : customer.status === "lead" ? "📋 Lead" : "❌ Churned"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {customer.is_lead ? "🏷️ Lead Manual" : "🛒 Kiwify"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum cliente encontrado com os filtros selecionados
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Action Card */}
          {selectedIds.size > 0 && (
            <Card className="border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="h-5 w-5 text-primary" />
                  Disparo em Massa
                </CardTitle>
                <CardDescription>
                  Configure e inicie o playbook para {selectedIds.size} cliente(s)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-1 space-y-2">
                    <Label>Playbook</Label>
                    <Select value={selectedPlaybookId} onValueChange={setSelectedPlaybookId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha um playbook" />
                      </SelectTrigger>
                      <SelectContent>
                        {playbooks?.filter(p => p.is_active).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="skip-existing"
                      checked={skipExisting}
                      onCheckedChange={(checked) => setSkipExisting(!!checked)}
                    />
                    <Label htmlFor="skip-existing" className="text-sm">
                      Ignorar quem já passou por este playbook
                    </Label>
                  </div>

                  <Button
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={!selectedPlaybookId || bulkTrigger.isPending}
                    className="shrink-0"
                  >
                    {bulkTrigger.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Rocket className="h-4 w-4 mr-2" />
                    )}
                    Iniciar Disparo
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Disparo em Massa</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem certeza que deseja iniciar o playbook{" "}
              <strong>"{playbooks?.find(p => p.id === selectedPlaybookId)?.name}"</strong>{" "}
              para <strong>{selectedIds.size} pessoa(s)</strong>?
              {skipExisting && (
                <span className="block mt-2 text-xs">
                  Clientes que já passaram por este playbook serão ignorados.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleTrigger}>
              <Rocket className="h-4 w-4 mr-2" />
              Confirmar Disparo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Detalhes */}
      <Dialog
        open={!!selectedExecution}
        onOpenChange={() => setSelectedExecution(null)}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Execução</DialogTitle>
            <DialogDescription>
              {selectedExecution?.playbook?.name} -{" "}
              {selectedExecution?.contact?.first_name}{" "}
              {selectedExecution?.contact?.last_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Informações Gerais */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Informações Gerais</CardTitle>
                {selectedExecution?.contact && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setChangeConsultantData({
                        contactId: selectedExecution.contact_id,
                        contactName: `${selectedExecution.contact.first_name} ${selectedExecution.contact.last_name}`,
                        currentConsultantId: selectedExecution.contact.consultant_id,
                      })
                    }
                    className="gap-2"
                  >
                    <UserCog className="h-4 w-4" />
                    Alterar Consultor
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  {selectedExecution && getStatusBadge(selectedExecution.status)}
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Origem:</span>
                  <ExecutionOriginBadge triggeredBy={selectedExecution?.triggered_by} />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Disparado por:</span>
                  <span>{selectedExecution?.triggered_by_user?.full_name || "Sistema"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Consultor:</span>
                  <span>
                    {getConsultantName(selectedExecution?.contact?.consultant_id) || (
                      <span className="text-muted-foreground">Aguardando distribuição</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Iniciado:</span>
                  <span>
                    {selectedExecution?.started_at
                      ? format(new Date(selectedExecution.started_at), "dd/MM/yyyy HH:mm", {
                          locale: ptBR,
                        })
                      : "-"}
                  </span>
                </div>
                {selectedExecution?.completed_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Completado:</span>
                    <span>
                      {format(new Date(selectedExecution.completed_at), "dd/MM/yyyy HH:mm", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                )}
                {selectedExecution?.current_node_id && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nó Atual:</span>
                    <span className="font-mono text-xs">
                      {selectedExecution.current_node_id}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Timeline de Nós Executados */}
            {selectedExecution?.nodes_executed &&
              Array.isArray(selectedExecution.nodes_executed) &&
              selectedExecution.nodes_executed.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Nós Executados</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedExecution.nodes_executed.map((node: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                        >
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                          <div className="flex-1">
                            <div className="font-medium text-sm">{node.node_type}</div>
                            <div className="text-xs text-muted-foreground">
                              {node.executed_at &&
                                format(new Date(node.executed_at), "dd/MM HH:mm", {
                                  locale: ptBR,
                                })}
                            </div>
                            {node.result && (
                              <div className="text-xs mt-1 text-muted-foreground">
                                {JSON.stringify(node.result)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

            {/* Fila de Execução */}
            {queueItems && queueItems.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Fila de Execução</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {queueItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 p-3 rounded-lg border"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{item.node_type}</span>
                            {getNodeStatusBadge(item.status)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Agendado para:{" "}
                            {format(new Date(item.scheduled_for), "dd/MM HH:mm", {
                              locale: ptBR,
                            })}
                          </div>
                          {item.retry_count > 0 && (
                            <div className="text-xs text-amber-600 mt-1">
                              <AlertCircle className="h-3 w-3 inline mr-1" />
                              Tentativas: {item.retry_count}/{item.max_retries}
                            </div>
                          )}
                          {item.last_error && (
                            <div className="text-xs text-red-600 mt-1 p-2 bg-red-50 rounded">
                              {item.last_error}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Erros */}
            {selectedExecution?.errors &&
              Array.isArray(selectedExecution.errors) &&
              selectedExecution.errors.length > 0 && (
                <Card className="border-red-200">
                  <CardHeader>
                    <CardTitle className="text-sm text-red-600">Erros</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedExecution.errors.map((error: any, idx: number) => (
                        <div key={idx} className="p-3 bg-red-50 rounded-lg text-sm">
                          {typeof error === "string" ? error : JSON.stringify(error)}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Consultant Dialog */}
      <ChangeConsultantDialog
        open={!!changeConsultantData}
        onOpenChange={(open) => !open && setChangeConsultantData(null)}
        contactId={changeConsultantData?.contactId || ""}
        contactName={changeConsultantData?.contactName || ""}
        currentConsultantId={changeConsultantData?.currentConsultantId}
      />
    </div>
  );
}
