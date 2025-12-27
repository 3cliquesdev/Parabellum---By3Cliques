import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpDown, Download, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ConsultantDistribution } from "@/hooks/useConsultantDistributionReport";

interface ClientsByConsultantTableProps {
  data: ConsultantDistribution[];
  isLoading: boolean;
}

type SortKey = "consultant_name" | "total_clients" | "active_clients" | "churned_clients" | "last_assignment";

export function ClientsByConsultantTable({ data, isLoading }: ClientsByConsultantTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total_clients");
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const filteredData = data
    .filter((c) => c.consultant_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

  const exportToCSV = () => {
    const headers = ["Consultor", "Total Clientes", "Ativos", "Churned", "Leads", "Último Vínculo"];
    const rows = filteredData.map((c) => [
      c.consultant_name,
      c.total_clients,
      c.active_clients,
      c.churned_clients,
      c.leads,
      c.last_assignment ? format(new Date(c.last_assignment), "dd/MM/yyyy", { locale: ptBR }) : "-",
    ]);

    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `clientes-por-consultor-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
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
            <CardTitle>Clientes por Consultor</CardTitle>
            <CardDescription>Distribuição atual de clientes entre os consultores</CardDescription>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar consultor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-[200px]"
              />
            </div>
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
                <TableHead>Consultor</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3 h-8"
                    onClick={() => handleSort("total_clients")}
                  >
                    Total
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3 h-8"
                    onClick={() => handleSort("active_clients")}
                  >
                    Ativos
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3 h-8"
                    onClick={() => handleSort("churned_clients")}
                  >
                    Churned
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>Leads</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3 h-8"
                    onClick={() => handleSort("last_assignment")}
                  >
                    Último Vínculo
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum consultor encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((consultant) => (
                  <TableRow key={consultant.consultant_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={consultant.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(consultant.consultant_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{consultant.consultant_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{consultant.total_clients}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-green-600 font-medium">{consultant.active_clients}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-red-600">{consultant.churned_clients}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">{consultant.leads}</span>
                    </TableCell>
                    <TableCell>
                      {consultant.last_assignment
                        ? format(new Date(consultant.last_assignment), "dd/MM/yyyy", { locale: ptBR })
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
