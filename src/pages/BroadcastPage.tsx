import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlaybooks, useBulkTriggerPlaybook } from "@/hooks/usePlaybooks";
import { useProducts } from "@/hooks/useProducts";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, Search, Rocket, Users, Calendar, Package } from "lucide-react";
import { format } from "date-fns";

interface CustomerResult {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  purchase_date: string;
  product_name: string | null;
  status: string;
}

export default function BroadcastPage() {
  const [productId, setProductId] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("won");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string>("");
  const [skipExisting, setSkipExisting] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const { data: products } = useProducts();
  const { data: playbooks } = usePlaybooks();
  const bulkTrigger = useBulkTriggerPlaybook();

  // Search query
  const { data: customers, isLoading, refetch } = useQuery({
    queryKey: ["broadcast-search", productId, startDate, endDate, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("deals")
        .select(`
          contact_id,
          created_at,
          status,
          contacts!inner(id, first_name, last_name, email, status),
          products(name)
        `)
        .not("contact_id", "is", null);

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

      // Deduplicate by contact_id
      const seen = new Set<string>();
      const results: CustomerResult[] = [];

      for (const deal of data || []) {
        const contact = deal.contacts as any;
        if (!contact || seen.has(contact.id)) continue;
        seen.add(contact.id);

        results.push({
          id: contact.id,
          first_name: contact.first_name,
          last_name: contact.last_name,
          email: contact.email,
          purchase_date: deal.created_at,
          product_name: (deal.products as any)?.name || "N/A",
          status: contact.status,
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
    if (!selectedPlaybookId || selectedIds.size === 0) return;

    try {
      await bulkTrigger.mutateAsync({
        contactIds: Array.from(selectedIds),
        playbookId: selectedPlaybookId,
        skipExisting,
      });
      setShowConfirmDialog(false);
      setSelectedIds(new Set());
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Disparador em Massa</h1>
          <p className="text-muted-foreground">
            Selecione clientes baseados em histórico de compras e inicie playbooks
          </p>
        </div>

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

            <Button onClick={handleSearch} className="mt-4" disabled={isLoading}>
              {isLoading ? (
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
              {isLoading ? (
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
                            <Badge variant={customer.status === "customer" ? "default" : "secondary"}>
                              {customer.status}
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
      </div>
    </Layout>
  );
}
