import { useState } from "react";
import { ArrowLeft, Shield, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  useAILearningTimeline, 
  LEARNING_TYPE_LABELS, 
  CONFIDENCE_LABELS, 
  STATUS_LABELS,
  type AILearningEvent 
} from "@/hooks/useAILearningTimeline";

export default function AIAuditPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [typeFilter, setTypeFilter] = useState<'all' | 'kb' | 'routing' | 'reply' | 'draft'>('all');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AILearningEvent | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const { 
    timeline, 
    stats, 
    isLoading, 
    approve, 
    reject, 
    isApproving, 
    isRejecting 
  } = useAILearningTimeline({
    status: statusFilter,
    type: typeFilter,
  });

  const handleApprove = (event: AILearningEvent) => {
    approve(event.id);
  };

  const handleRejectClick = (event: AILearningEvent) => {
    setSelectedEvent(event);
    setRejectionReason('');
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = () => {
    if (selectedEvent && rejectionReason.trim()) {
      reject({ eventId: selectedEvent.id, reason: rejectionReason.trim() });
      setRejectDialogOpen(false);
      setSelectedEvent(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b px-4 py-4 sticky top-0 z-10">
        <div className="container mx-auto flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/settings/ai")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Auditoria de IA
            </h1>
            <p className="text-sm text-muted-foreground">
              Revise e aprove/rejeite aprendizados automáticos da IA
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className={statusFilter === 'pending' ? 'ring-2 ring-primary' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-warning" />
                Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.pending}</p>
            </CardContent>
          </Card>
          
          <Card className={statusFilter === 'approved' ? 'ring-2 ring-primary' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                Aprovados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.approved}</p>
            </CardContent>
          </Card>
          
          <Card className={statusFilter === 'rejected' ? 'ring-2 ring-primary' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" />
                Rejeitados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.rejected}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Linha do Tempo de Aprendizado</CardTitle>
            <CardDescription>
              Todo aprendizado da IA é registrado aqui para revisão humana
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="approved">Aprovados</SelectItem>
                  <SelectItem value="rejected">Rejeitados</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="kb">Base de Conhecimento</SelectItem>
                  <SelectItem value="routing">Roteamento</SelectItem>
                  <SelectItem value="reply">Resposta</SelectItem>
                  <SelectItem value="draft">Rascunho</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="max-w-[300px]">Resumo</TableHead>
                    <TableHead>Confiança</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : timeline.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum aprendizado encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    timeline.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(event.learned_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {LEARNING_TYPE_LABELS[event.learning_type] || event.learning_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate" title={event.summary}>
                          {event.summary}
                        </TableCell>
                        <TableCell>
                          <span className={CONFIDENCE_LABELS[event.confidence]?.color || ''}>
                            {CONFIDENCE_LABELS[event.confidence]?.label || event.confidence}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_LABELS[event.status]?.variant || 'outline'}>
                            {STATUS_LABELS[event.status]?.label || event.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {event.status === 'pending' && (
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleApprove(event)}
                                disabled={isApproving}
                              >
                                <CheckCircle className="h-4 w-4 mr-1 text-success" />
                                Aprovar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRejectClick(event)}
                                disabled={isRejecting}
                              >
                                <XCircle className="h-4 w-4 mr-1 text-destructive" />
                                Rejeitar
                              </Button>
                            </div>
                          )}
                          {event.status === 'rejected' && event.rejection_reason && (
                            <span className="text-xs text-muted-foreground" title={event.rejection_reason}>
                              {event.rejection_reason.substring(0, 30)}...
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Como funciona a auditoria
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Shadow Mode:</strong> Quando ativo, a IA gera sugestões mas nunca as aplica automaticamente.
              Tudo fica com status "Pendente" até revisão humana.
            </p>
            <p>
              <strong>Aprovar:</strong> O aprendizado será considerado válido e poderá influenciar respostas futuras.
            </p>
            <p>
              <strong>Rejeitar:</strong> O aprendizado será descartado e não influenciará a IA. 
              Indique o motivo para melhorar futuras sugestões.
            </p>
          </CardContent>
        </Card>
      </main>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Aprendizado</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição para melhorar futuras sugestões da IA.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-md bg-muted p-3 text-sm">
              <strong>Resumo:</strong> {selectedEvent?.summary}
            </div>
            <Textarea
              placeholder="Motivo da rejeição..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleRejectConfirm}
              disabled={!rejectionReason.trim() || isRejecting}
            >
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
