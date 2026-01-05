import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Layers, ShoppingCart, XCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, FileSpreadsheet, AlertTriangle, CheckCircle2, Search, Filter } from "lucide-react";
import { formatDocument, formatCEP } from "@/lib/validators";
import { DateRangePicker } from "@/components/DateRangePicker";
import { DateRange } from "react-day-picker";
import { startOfMonth, endOfMonth } from "date-fns";

interface CustomerPurchase {
  email: string;
  totalValue: number;
  products: string[];
  purchaseDate: string;
}

interface ContactData {
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
}

interface FiscalCustomer {
  email: string;
  totalValue: number;
  products: string[];
  purchaseDate: string;
  contact: ContactData | null;
}

function isDataComplete(customer: FiscalCustomer): boolean {
  return !!(
    customer.contact?.document &&
    customer.contact?.zip_code &&
    customer.contact?.address &&
    customer.contact?.address_number &&
    customer.contact?.city &&
    customer.contact?.state
  );
}

function getMissingFields(customer: FiscalCustomer): string[] {
  const missing: string[] = [];
  if (!customer.contact?.document) missing.push("Doc");
  if (!customer.contact?.zip_code) missing.push("CEP");
  if (!customer.contact?.address) missing.push("End");
  if (!customer.contact?.address_number) missing.push("Nº");
  if (!customer.contact?.city) missing.push("Cidade");
  if (!customer.contact?.state) missing.push("UF");
  return missing;
}

export default function FiscalExport() {
  const [search, setSearch] = useState("");
  const [onlyComplete, setOnlyComplete] = useState(false);
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  // Query para buscar order_ids reembolsados/chargebacks
  const { data: cancelledOrderIds } = useQuery({
    queryKey: ["cancelled-order-ids"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kiwify_events")
        .select("payload")
        .in("event_type", ["refunded", "chargedback"]);

      if (error) throw error;

      const orderIds = new Set<string>();
      for (const event of data || []) {
        const orderId = (event.payload as any)?.order_id;
        if (orderId) orderIds.add(orderId);
      }
      return orderIds;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Query principal: buscar TODOS eventos pagos e filtrar por approved_date no frontend
  const { data: paidEvents, isLoading: loadingEvents } = useQuery({
    queryKey: ["fiscal-paid-events", dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      const allEvents: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      // Buscar todos os eventos pagos (sem filtro de data no banco - filtraremos por approved_date)
      while (hasMore) {
        const { data, error } = await supabase
          .from("kiwify_events")
          .select("customer_email, payload, created_at, event_type")
          .in("event_type", ["paid", "order_approved"])
          .order("created_at", { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;
        allEvents.push(...(data || []));
        hasMore = (data?.length || 0) === pageSize;
        page++;
      }

      // Filtrar por approved_date do payload (data real de aprovação na Kiwify)
      return allEvents.filter(event => {
        const approvedDate = (event.payload as any)?.approved_date;
        if (!approvedDate) return false;

        const eventDate = new Date(approvedDate);
        if (dateRange?.from && eventDate < dateRange.from) return false;
        if (dateRange?.to) {
          const endOfDay = new Date(dateRange.to);
          endOfDay.setHours(23, 59, 59, 999);
          if (eventDate > endOfDay) return false;
        }
        return true;
      });
    },
  });

  // Consolidar compras por email (excluindo duplicatas e reembolsos/chargebacks)
  const customerPurchases = useMemo(() => {
    const purchaseMap = new Map<string, CustomerPurchase>();
    const processedOrderIds = new Set<string>(); // Evitar duplicatas por order_id

    if (!paidEvents || !cancelledOrderIds) return purchaseMap;

    let excludedCount = 0;
    let uniqueSalesCount = 0;

    for (const event of paidEvents) {
      const payload = event.payload as any;
      const orderId = payload?.order_id;

      // Pular se já processou este order_id (duplicata)
      if (orderId && processedOrderIds.has(orderId)) continue;
      if (orderId) processedOrderIds.add(orderId);

      // Pular se este pedido foi reembolsado ou chargeback
      if (orderId && cancelledOrderIds.has(orderId)) {
        excludedCount++;
        continue;
      }

      uniqueSalesCount++;

      const email = event.customer_email?.toLowerCase();
      if (!email) continue;

      const chargeAmount = payload?.Commissions?.charge_amount;
      const productName = payload?.Product?.product_name || "Venda curso";
      const approvedDate = payload?.approved_date || event.created_at;

      if (chargeAmount) {
        const value = Number(chargeAmount) / 100;

        if (purchaseMap.has(email)) {
          const existing = purchaseMap.get(email)!;
          existing.totalValue += value;
          if (!existing.products.includes(productName)) {
            existing.products.push(productName);
          }
        } else {
          purchaseMap.set(email, {
            email,
            totalValue: value,
            products: [productName],
            purchaseDate: approvedDate,
          });
        }
      }
    }

    // Armazenar contagens para exibição
    (purchaseMap as any)._excludedCount = excludedCount;
    (purchaseMap as any)._uniqueSalesCount = uniqueSalesCount;

    return purchaseMap;
  }, [paidEvents, cancelledOrderIds]);

  // Buscar dados fiscais dos emails que compraram
  const customerEmails = useMemo(() => Array.from(customerPurchases.keys()), [customerPurchases]);

  const { data: contactsData, isLoading: loadingContacts } = useQuery({
    queryKey: ["fiscal-contacts-by-email", customerEmails],
    queryFn: async () => {
      if (customerEmails.length === 0) return [];

      const allContacts: ContactData[] = [];
      const batchSize = 100;

      for (let i = 0; i < customerEmails.length; i += batchSize) {
        const batch = customerEmails.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from("contacts")
          .select("id, first_name, last_name, email, phone, document, customer_type, zip_code, address, address_number, address_complement, neighborhood, city, state, state_registration")
          .in("email", batch);

        if (error) throw error;
        allContacts.push(...(data || []));
      }

      return allContacts;
    },
    enabled: customerEmails.length > 0,
  });

  // Criar mapa de contatos
  const contactsMap = useMemo(() => {
    const map = new Map<string, ContactData>();
    if (contactsData) {
      for (const contact of contactsData) {
        if (contact.email) {
          map.set(contact.email.toLowerCase(), contact);
        }
      }
    }
    return map;
  }, [contactsData]);

  // Combinar compras + dados fiscais
  const fiscalCustomers = useMemo<FiscalCustomer[]>(() => {
    return Array.from(customerPurchases.values()).map((purchase) => ({
      ...purchase,
      contact: contactsMap.get(purchase.email) || null,
    }));
  }, [customerPurchases, contactsMap]);

  // Filtrar
  const filteredCustomers = useMemo(() => {
    return fiscalCustomers.filter((customer) => {
      const searchLower = search.toLowerCase();
      const name = customer.contact
        ? `${customer.contact.first_name} ${customer.contact.last_name}`
        : "";
      const matchesSearch =
        !search ||
        name.toLowerCase().includes(searchLower) ||
        customer.email.toLowerCase().includes(searchLower) ||
        customer.contact?.document?.includes(search);

      const complete = isDataComplete(customer);
      const matchesComplete = onlyIncomplete ? !complete : (!onlyComplete || complete);

      return matchesSearch && matchesComplete;
    });
  }, [fiscalCustomers, search, onlyComplete, onlyIncomplete]);

  const isLoading = loadingEvents || loadingContacts;
  const completeCount = filteredCustomers.filter(isDataComplete).length;
  const incompleteCount = filteredCustomers.length - completeCount;
  const excludedCount = (customerPurchases as any)._excludedCount || 0;
  const uniqueSalesCount = (customerPurchases as any)._uniqueSalesCount || 0;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allEmails = filteredCustomers.map((c) => c.email);
      setSelectedEmails(new Set(allEmails));
    } else {
      setSelectedEmails(new Set());
    }
  };

  const handleSelectOne = (email: string, checked: boolean) => {
    const newSet = new Set(selectedEmails);
    if (checked) {
      newSet.add(email);
    } else {
      newSet.delete(email);
    }
    setSelectedEmails(newSet);
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
    const customersToExport = filteredCustomers.filter(
      (c) => selectedEmails.size === 0 || selectedEmails.has(c.email)
    );

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

    const rows = customersToExport.map((c) => {
      const contact = c.contact;
      const name = contact ? `${contact.first_name} ${contact.last_name}`.trim() : c.email;
      const productsDisplay = c.products.join(" + ");
      return [
        c.totalValue.toFixed(2).replace('.', ','),
        contact?.document ? formatDocument(contact.document) : "",
        name,
        contact?.address || "",
        contact?.address_number || "",
        contact?.address_complement || "",
        contact?.neighborhood || "",
        contact?.city || "",
        contact?.state || "",
        contact?.zip_code ? formatCEP(contact.zip_code) : "",
        c.email,
        productsDisplay,
        "Não",
        "",
        "Não",
        "",
        "",
        "",
        "",
      ];
    });

    const csvContent = [
      headers.join(";"),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(";")),
    ].join("\n");

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

  const handleExportIncomplete = () => {
    const incompleteCustomers = fiscalCustomers.filter(c => !isDataComplete(c));

    const headers = [
      "Nome",
      "E-mail",
      "Telefone",
      "Valor Total",
      "Produtos",
      "Campos Faltantes",
    ];

    const rows = incompleteCustomers.map((c) => {
      const contact = c.contact;
      const name = contact ? `${contact.first_name} ${contact.last_name}`.trim() : c.email;
      const productsDisplay = c.products.join(" | ");
      const missingFields = getMissingFields(c).join(", ");
      return [
        name,
        c.email,
        contact?.phone || "",
        `R$ ${c.totalValue.toFixed(2).replace('.', ',')}`,
        productsDisplay,
        missingFields,
      ];
    });

    const csvContent = [
      headers.join(";"),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(";")),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `clientes_incompletos_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleIncompleteCardClick = () => {
    setOnlyIncomplete(true);
    setOnlyComplete(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Exportar para Nota Fiscal</h1>
        <p className="text-muted-foreground">
          Apenas clientes com compras reais no Kiwify no período selecionado
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <Layers className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{uniqueSalesCount}</p>
                <p className="text-sm text-muted-foreground">Vendas Únicas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <ShoppingCart className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{filteredCustomers.length}</p>
                <p className="text-sm text-muted-foreground">Clientes com Compras</p>
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

        <Card 
          className={`cursor-pointer transition-all hover:ring-2 hover:ring-amber-500 ${onlyIncomplete ? 'ring-2 ring-amber-500' : ''}`}
          onClick={handleIncompleteCardClick}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{incompleteCount}</p>
                <p className="text-sm text-muted-foreground">Dados Incompletos</p>
                <p className="text-xs text-amber-600 mt-1">Clique para filtrar</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{excludedCount}</p>
                <p className="text-sm text-muted-foreground">Reembolsos/Chargebacks</p>
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

            <div className="min-w-[220px]">
              <Label>Período de Compra</Label>
              <DateRangePicker value={dateRange} onChange={setDateRange} />
            </div>

            <div className="flex items-end gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="only-complete"
                  checked={onlyComplete}
                  onCheckedChange={(checked) => {
                    setOnlyComplete(!!checked);
                    if (checked) setOnlyIncomplete(false);
                  }}
                />
                <Label htmlFor="only-complete" className="cursor-pointer">
                  Apenas completos
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="only-incomplete"
                  checked={onlyIncomplete}
                  onCheckedChange={(checked) => {
                    setOnlyIncomplete(!!checked);
                    if (checked) setOnlyComplete(false);
                  }}
                />
                <Label htmlFor="only-incomplete" className="cursor-pointer text-amber-600">
                  Apenas incompletos
                </Label>
              </div>
            </div>

            <div className="flex items-end ml-auto gap-2">
              <Button variant="outline" onClick={handleDownloadTemplate}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Baixar Modelo
              </Button>
              <Button 
                variant="outline" 
                onClick={handleExportIncomplete}
                className="border-amber-500 text-amber-600 hover:bg-amber-50"
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar Incompletos ({incompleteCount})
              </Button>
              <Button onClick={handleExport} disabled={filteredCustomers.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Exportar {selectedEmails.size > 0 ? `(${selectedEmails.size})` : `(${filteredCustomers.length})`}
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
                    checked={selectedEmails.size === filteredCustomers.length && filteredCustomers.length > 0}
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
                {onlyIncomplete && <TableHead>Pendências</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={onlyIncomplete ? 9 : 8} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={onlyIncomplete ? 9 : 8} className="text-center py-8 text-muted-foreground">
                    Nenhuma compra encontrada no período
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => {
                  const complete = isDataComplete(customer);
                  const contact = customer.contact;
                  const name = contact
                    ? `${contact.first_name} ${contact.last_name}`
                    : customer.email;
                  return (
                    <TableRow key={customer.email}>
                      <TableCell>
                        <Checkbox
                          checked={selectedEmails.has(customer.email)}
                          onCheckedChange={(checked) => handleSelectOne(customer.email, !!checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{name}</span>
                          <p className="text-sm text-muted-foreground">{customer.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="font-mono text-sm font-medium text-green-600">
                            R$ {customer.totalValue.toFixed(2).replace('.', ',')}
                          </span>
                          {customer.products.length > 1 && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                                    <Layers className="h-3 w-3 mr-0.5" />
                                    {customer.products.length}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="font-medium mb-1">Compra consolidada:</p>
                                  <ul className="text-xs space-y-0.5">
                                    {customer.products.map((p, i) => (
                                      <li key={i}>• {p}</li>
                                    ))}
                                  </ul>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <span className="text-sm truncate block" title={customer.products.join(" + ")}>
                          {customer.products.length > 1
                            ? `${customer.products[0]} + ${customer.products.length - 1} outro(s)`
                            : customer.products[0]}
                        </span>
                      </TableCell>
                      <TableCell>
                        {contact?.document ? (
                          <span className="font-mono text-sm">
                            {formatDocument(contact.document)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">Não informado</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {contact?.address ? (
                          <span className="text-sm truncate block">
                            {contact.address}, {contact.address_number}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">Não informado</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {contact?.city && contact?.state ? (
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
                      {onlyIncomplete && (
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {getMissingFields(customer).map((field) => (
                              <Badge 
                                key={field} 
                                variant="destructive" 
                                className="text-xs px-1.5 py-0.5"
                              >
                                {field}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      )}
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
