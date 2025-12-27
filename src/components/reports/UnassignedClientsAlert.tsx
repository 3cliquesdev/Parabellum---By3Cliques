import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Loader2, Shuffle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UnassignedClient {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  source: string | null;
}

interface UnassignedClientsAlertProps {
  clients: UnassignedClient[];
  total: number;
  isLoading: boolean;
  onDistribute: (limit: number) => void;
  isDistributing: boolean;
}

export function UnassignedClientsAlert({
  clients,
  total,
  isLoading,
  onDistribute,
  isDistributing,
}: UnassignedClientsAlertProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [limit, setLimit] = useState(100);

  if (isLoading) return null;
  if (total === 0) return null;

  const handleDistribute = () => {
    onDistribute(limit);
    setShowDialog(false);
  };

  return (
    <>
      <Alert variant="destructive" className="border-red-200 bg-red-50 dark:bg-red-950/20">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Atenção: {total.toLocaleString("pt-BR")} clientes sem consultor</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>
            Esses clientes foram importados mas não passaram pelo fluxo de distribuição.
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDialog(true)}
            disabled={isDistributing}
          >
            {isDistributing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Distribuindo...
              </>
            ) : (
              <>
                <Shuffle className="mr-2 h-4 w-4" />
                Distribuir em Lote
              </>
            )}
          </Button>
        </AlertDescription>
      </Alert>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Clientes Sem Consultor</CardTitle>
          <CardDescription>
            Mostrando {clients.length} de {total.toLocaleString("pt-BR")} clientes não atribuídos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead>Cadastro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.slice(0, 10).map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">
                      {client.first_name} {client.last_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{client.email || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{client.phone || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{client.source || "-"}</TableCell>
                    <TableCell>
                      {format(new Date(client.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {total > 10 && (
            <p className="mt-2 text-sm text-muted-foreground text-center">
              + {(total - 10).toLocaleString("pt-BR")} clientes não exibidos
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Distribuir Clientes em Lote</DialogTitle>
            <DialogDescription>
              Os clientes serão distribuídos entre os consultores ativos usando Round Robin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="limit">Quantidade de clientes a distribuir</Label>
              <Input
                id="limit"
                type="number"
                min={1}
                max={total}
                value={limit}
                onChange={(e) => setLimit(Math.min(total, Math.max(1, parseInt(e.target.value) || 1)))}
              />
              <p className="text-sm text-muted-foreground">
                Total disponível: {total.toLocaleString("pt-BR")} clientes
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleDistribute} disabled={isDistributing}>
              {isDistributing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Distribuindo...
                </>
              ) : (
                <>
                  <Shuffle className="mr-2 h-4 w-4" />
                  Distribuir {limit} clientes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
