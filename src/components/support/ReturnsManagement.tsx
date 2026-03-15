import { useState } from "react";
import { useAdminReturns, AdminReturn } from "@/hooks/useReturns";
import { REASON_LABELS, STATUS_CONFIG } from "@/hooks/useClientReturns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AdminReturnDialog } from "./AdminReturnDialog";
import { ReturnDetailsDialog } from "./ReturnDetailsDialog";
import { PageContainer } from "@/components/ui/page-container";

export default function ReturnsManagement() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<AdminReturn | null>(null);
  const { data: returns, isLoading } = useAdminReturns(statusFilter);

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-4 mb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="approved">Aprovada</SelectItem>
            <SelectItem value="rejected">Rejeitada</SelectItem>
            <SelectItem value="refunded">Reembolsada</SelectItem>
          </SelectContent>
        </Select>

        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Devolução
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !returns || returns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <RotateCcw className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">Nenhuma devolução encontrada</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Protocolo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Criado por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns.map((ret) => {
                const statusCfg = STATUS_CONFIG[ret.status] || STATUS_CONFIG.pending;
                const clientName = ret.contacts
                  ? `${ret.contacts.first_name} ${ret.contacts.last_name}`
                  : ret.registered_email || "—";
                return (
                  <TableRow
                    key={ret.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedReturn(ret)}
                  >
                    <TableCell className="font-mono text-xs">
                      {ret.id.substring(0, 8).toUpperCase()}
                    </TableCell>
                    <TableCell>{clientName}</TableCell>
                    <TableCell>{ret.external_order_id}</TableCell>
                    <TableCell>
                      <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                    </TableCell>
                    <TableCell>{REASON_LABELS[ret.reason] || ret.reason}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(ret.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {ret.created_by === "admin" ? "Admin" : "Cliente"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AdminReturnDialog open={showCreate} onOpenChange={setShowCreate} />
      <ReturnDetailsDialog
        returnData={selectedReturn}
        onClose={() => setSelectedReturn(null)}
      />
    </PageContainer>
  );
}
