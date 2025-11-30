import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuditLogs } from "@/hooks/useAuditLogs";
import { useProfiles } from "@/hooks/useProfiles";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Shield, Trash2, Edit, Download, PlusCircle, Eye } from "lucide-react";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import AuditLogDiffDialog from "@/components/AuditLogDiffDialog";

export default function AuditLogs() {
  const [tableFilter, setTableFilter] = useState<string | undefined>();
  const [actionFilter, setActionFilter] = useState<string | undefined>();
  const [userFilter, setUserFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [diffDialogOpen, setDiffDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  
  const { data: logs = [], isLoading } = useAuditLogs({
    table_name: tableFilter,
    action: actionFilter,
    user_id: userFilter,
    start_date: dateRange?.from?.toISOString(),
    end_date: dateRange?.to?.toISOString(),
  });
  
  const { data: profiles } = useProfiles();

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'DELETE': return <Trash2 className="w-4 h-4" />;
      case 'UPDATE': return <Edit className="w-4 h-4" />;
      case 'EXPORT': return <Download className="w-4 h-4" />;
      default: return null;
    }
  };

  const getActionBadge = (action: string) => {
    const variants: Record<string, "destructive" | "default" | "secondary"> = {
      'DELETE': 'destructive',
      'UPDATE': 'default',
      'INSERT': 'default',
      'EXPORT': 'secondary',
    };
    return variants[action] || 'default';
  };
  
  const handleViewDiff = (log: any) => {
    setSelectedLog(log);
    setDiffDialogOpen(true);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Logs de Auditoria</h1>
          <p className="text-muted-foreground">
            Registro imutável de todas as operações críticas do sistema
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Filtre os logs por tabela, ação, usuário ou período
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Select value={tableFilter} onValueChange={setTableFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as Tabelas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Tabelas</SelectItem>
                <SelectItem value="contacts">Contatos</SelectItem>
                <SelectItem value="deals">Negócios</SelectItem>
                <SelectItem value="tickets">Tickets</SelectItem>
                <SelectItem value="conversations">Conversas</SelectItem>
                <SelectItem value="canned_responses">Macros</SelectItem>
              </SelectContent>
            </Select>

            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as Ações" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Ações</SelectItem>
                <SelectItem value="INSERT">Criações</SelectItem>
                <SelectItem value="UPDATE">Atualizações</SelectItem>
                <SelectItem value="DELETE">Exclusões</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os Usuários" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Usuários</SelectItem>
                {profiles?.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <DatePickerWithRange 
              date={dateRange}
              onDateChange={setDateRange}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Auditoria</CardTitle>
          <CardDescription>
            {logs.length} registros encontrados (últimos 100)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Tabela</TableHead>
                  <TableHead>Registro ID</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
              {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Carregando logs...
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum log de auditoria encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">
                        {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {log.user?.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2) || 'SY'}
                            </AvatarFallback>
                          </Avatar>
                          <span>{log.user?.full_name || 'Sistema'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={getActionBadge(log.action)} 
                          className={`gap-1 ${log.action === 'INSERT' ? 'bg-green-600 hover:bg-green-600/80' : ''}`}
                        >
                          {getActionIcon(log.action)}
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">{log.table_name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {log.record_id?.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDiff(log)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Ver Alterações
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
      
      <AuditLogDiffDialog
        open={diffDialogOpen}
        onOpenChange={setDiffDialogOpen}
        oldData={selectedLog?.old_data}
        newData={selectedLog?.new_data}
        action={selectedLog?.action}
      />
    </div>
  );
}
