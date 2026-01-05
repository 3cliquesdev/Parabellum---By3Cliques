import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, FileSpreadsheet, AlertTriangle, CheckCircle2, Search, Filter } from "lucide-react";
import { formatDocument, formatCEP } from "@/lib/validators";
import { DateRangePicker } from "@/components/DateRangePicker";
import { DateRange } from "react-day-picker";
import { startOfMonth, endOfMonth } from "date-fns";

interface FiscalContact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  customer_type: string | null;
  zip_code: string | null;
  address: string | null;
  address_number: string | null;
  address_complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  state_registration: string | null;
  status: string | null;
  created_at: string;
}

function isDataComplete(contact: FiscalContact): boolean {
  return !!(
    contact.document &&
    contact.zip_code &&
    contact.address &&
    contact.address_number &&
    contact.city &&
    contact.state
  );
}

function formatAddress(contact: FiscalContact): string {
  const parts = [
    contact.address,
    contact.address_number,
    contact.address_complement,
    contact.neighborhood,
    contact.city,
    contact.state,
    contact.zip_code ? formatCEP(contact.zip_code) : null,
  ].filter(Boolean);
  return parts.join(", ");
}

export default function FiscalExport() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [onlyComplete, setOnlyComplete] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  // Query para buscar contatos com paginação
  const { data: contacts, isLoading } = useQuery({
    queryKey: ["fiscal-contacts", statusFilter, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      const allContacts: FiscalContact[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from("contacts")
          .select("id, first_name, last_name, email, phone, document, customer_type, zip_code, address, address_number, address_complement, neighborhood, city, state, state_registration, status, created_at")
          .order("created_at", { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1) as any;

        if (statusFilter !== "all") {
          query = query.eq("status", statusFilter);
        }

        // Filtro de período
        if (dateRange?.from) {
          query = query.gte("created_at", dateRange.from.toISOString());
        }
        if (dateRange?.to) {
          const endOfDay = new Date(dateRange.to);
          endOfDay.setHours(23, 59, 59, 999);
          query = query.lte("created_at", endOfDay.toISOString());
        }

        const { data, error } = await query;
        if (error) throw error;

        allContacts.push(...(data || []));
        hasMore = (data?.length || 0) === pageSize;
        page++;
      }

      return allContacts;
    },
  });

  // Query para buscar último valor pago do Kiwify por email com paginação
  const { data: kiwifyValues } = useQuery({
    queryKey: ["kiwify-last-values"],
    queryFn: async () => {
      const allEvents: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("kiwify_events")
          .select("customer_email, payload, created_at")
          .in("event_type", ["paid", "order_approved"])
          .order("created_at", { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        allEvents.push(...(data || []));
        hasMore = (data?.length || 0) === pageSize;
        page++;
      }

      return allEvents;
    },
  });

  // Criar mapa de email -> { value, productName } - normalizado para lowercase
  const productMap = new Map<string, { value: number; productName: string }>();
  if (kiwifyValues) {
    for (const event of kiwifyValues) {
      const emailKey = event.customer_email?.toLowerCase();
      if (emailKey && !productMap.has(emailKey)) {
        const payload = event.payload as any;
        const chargeAmount = payload?.Commissions?.charge_amount;
        const productName = payload?.Product?.product_name || "Venda curso";
        if (chargeAmount) {
          productMap.set(emailKey, {
            value: Number(chargeAmount) / 100,
            productName,
          });
        }
      }
    }
  }

  const filteredContacts = (contacts || []).filter((contact) => {
    // Filtro de busca
    const searchLower = search.toLowerCase();
    const matchesSearch =
      !search ||
      `${contact.first_name} ${contact.last_name}`.toLowerCase().includes(searchLower) ||
      contact.email?.toLowerCase().includes(searchLower) ||
      contact.document?.includes(search);

    // Filtro de dados completos
    const matchesComplete = !onlyComplete || isDataComplete(contact);

    return matchesSearch && matchesComplete;
  });

  const completeCount = filteredContacts.filter(isDataComplete).length;
  const incompleteCount = filteredContacts.length - completeCount;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = filteredContacts.map((c) => c.id);
      setSelectedIds(new Set(allIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  // Download empty template
  const handleDownloadTemplate = () => {
    const headers = [
      "Valor do Serviço",
      "CPF/CNPJ",
      "Razão Social/Nome",
      "Endereço",
      "Número",
      "Complemento",
      "Bairro",
      "Cidade",
      "UF",
      "CEP",
      "E-mail",
      "Nome do produto",
      "Calcular valor líquido?",
      "Código do Serviço",
      "Tem retenção?",
      "IRRF",
      "PIS/PASEP",
      "COFINS",
      "CSLL",
    ];

    const csvContent = headers.join(";");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo_notas_emissao.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    const contactsToExport = filteredContacts.filter(
      (c) => selectedIds.size === 0 || selectedIds.has(c.id)
    );

    // CSV no formato exato do modelo NF-e
    const headers = [
      "Valor do Serviço",
      "CPF/CNPJ",
      "Razão Social/Nome",
      "Endereço",
      "Número",
      "Complemento",
      "Bairro",
      "Cidade",
      "UF",
      "CEP",
      "E-mail",
      "Nome do produto",
      "Calcular valor líquido?",
      "Código do Serviço",
      "Tem retenção?",
      "IRRF",
      "PIS/PASEP",
      "COFINS",
      "CSLL",
    ];

    const rows = contactsToExport.map((c) => {
      const productData = c.email ? productMap.get(c.email.toLowerCase()) : undefined;
      return [
        productData?.value ? productData.value.toFixed(2).replace('.', ',') : "",
        c.document ? formatDocument(c.document) : "",
        `${c.first_name} ${c.last_name}`.trim(),
        c.address || "",
        c.address_number || "",
        c.address_complement || "",
        c.neighborhood || "",
        c.city || "",
        c.state || "",
        c.zip_code ? formatCEP(c.zip_code) : "",
        c.email || "",
        productData?.productName || "Venda curso", // Nome real do produto
        "Não", // Calcular valor líquido
        "", // Código do Serviço
        "Não", // Tem retenção
        "", // IRRF
        "", // PIS/PASEP
        "", // COFINS
        "", // CSLL
      ];
    });

    const csvContent = [
      headers.join(";"),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(";")),
    ].join("\n");

    // Download
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `notas_emissao_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Exportar para Nota Fiscal</h1>
        <p className="text-muted-foreground">
          Exporte contatos com dados fiscais completos para emissão de NF
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <FileSpreadsheet className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{filteredContacts.length}</p>
                <p className="text-sm text-muted-foreground">Total Filtrado</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completeCount}</p>
                <p className="text-sm text-muted-foreground">Dados Completos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{incompleteCount}</p>
                <p className="text-sm text-muted-foreground">Dados Incompletos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome, email ou documento..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="w-[180px]">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="customer">Clientes</SelectItem>
                  <SelectItem value="lead">Leads</SelectItem>
                  <SelectItem value="churned">Churned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[220px]">
              <Label>Período de Cadastro</Label>
              <DateRangePicker value={dateRange} onChange={setDateRange} />
            </div>

            <div className="flex items-end">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="only-complete"
                  checked={onlyComplete}
                  onCheckedChange={(checked) => setOnlyComplete(!!checked)}
                />
                <Label htmlFor="only-complete" className="cursor-pointer">
                  Apenas dados completos
                </Label>
              </div>
            </div>

            <div className="flex items-end ml-auto gap-2">
              <Button variant="outline" onClick={handleDownloadTemplate}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Baixar Modelo
              </Button>
              <Button onClick={handleExport} disabled={filteredContacts.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Exportar {selectedIds.size > 0 ? `(${selectedIds.size})` : `(${filteredContacts.length})`}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={selectedIds.size === filteredContacts.length && filteredContacts.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredContacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum contato encontrado
                  </TableCell>
                </TableRow>
              ) : (
              filteredContacts.map((contact) => {
                  const complete = isDataComplete(contact);
                  const productData = contact.email ? productMap.get(contact.email.toLowerCase()) : undefined;
                  return (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(contact.id)}
                          onCheckedChange={(checked) => handleSelectOne(contact.id, !!checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">
                            {contact.first_name} {contact.last_name}
                          </span>
                          {contact.email && (
                            <p className="text-sm text-muted-foreground">{contact.email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {productData?.value ? (
                          <span className="font-mono text-sm font-medium text-green-600">
                            R$ {productData.value.toFixed(2).replace('.', ',')}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        {productData?.productName ? (
                          <span className="text-sm truncate block" title={productData.productName}>
                            {productData.productName}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {contact.document ? (
                          <span className="font-mono text-sm">
                            {formatDocument(contact.document)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">Não informado</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {contact.address ? (
                          <span className="text-sm truncate block">
                            {contact.address}, {contact.address_number}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">Não informado</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {contact.city && contact.state ? (
                          <span className="text-sm">
                            {contact.city}/{contact.state}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {complete ? (
                          <Badge variant="default" className="bg-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Completo
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Incompleto
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
