import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { LinkedClient, ConsultantDistribution } from "@/hooks/useConsultantDistributionReport";

interface LinkedClientsTableProps {
  clients: LinkedClient[];
  consultants: ConsultantDistribution[];
  isLoading: boolean;
}

const PAGE_SIZE = 20;

export function LinkedClientsTable({ clients, consultants, isLoading }: LinkedClientsTableProps) {
  const [search, setSearch] = useState("");
  const [selectedConsultant, setSelectedConsultant] = useState<string>("all");
  const [page, setPage] = useState(1);

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const matchesSearch =
        search === "" ||
        `${client.first_name} ${client.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
        client.email?.toLowerCase().includes(search.toLowerCase());

      const matchesConsultant =
        selectedConsultant === "all" || client.consultant_id === selectedConsultant;

      return matchesSearch && matchesConsultant;
    });
  }, [clients, search, selectedConsultant]);

  const totalPages = Math.ceil(filteredClients.length / PAGE_SIZE);
  const paginatedClients = filteredClients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportToCSV = () => {
    const headers = ["Cliente", "Email", "Telefone", "Consultor", "Status", "Data Cadastro"];
    const rows = filteredClients.map((c) => [
      `${c.first_name} ${c.last_name}`,
      c.email || "",
      c.phone || "",
      c.consultant_name,
      c.status,
      format(new Date(c.created_at), "dd/MM/yyyy", { locale: ptBR }),
    ]);

    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `clientes-vinculados-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Lista de Clientes Vinculados</CardTitle>
            <CardDescription>
              {filteredClients.length.toLocaleString("pt-BR")} clientes encontrados
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-8 w-[200px]"
              />
            </div>
            <Select
              value={selectedConsultant}
              onValueChange={(v) => {
                setSelectedConsultant(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar consultor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos consultores</SelectItem>
                {consultants.map((c) => (
                  <SelectItem key={c.consultant_id} value={c.consultant_id}>
                    {c.consultant_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={exportToCSV}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Consultor</TableHead>
                <TableHead>Data Cadastro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhum cliente encontrado
                  </TableCell>
                </TableRow>
              ) : (
                paginatedClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">
                      {client.first_name} {client.last_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{client.email || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{client.phone || "-"}</TableCell>
                    <TableCell>{client.consultant_name}</TableCell>
                    <TableCell>
                      {format(new Date(client.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
