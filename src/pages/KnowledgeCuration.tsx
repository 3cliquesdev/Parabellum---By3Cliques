import { useState } from "react";
import { 
  GraduationCap, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Edit2, 
  MessageSquare,
  AlertTriangle,
  Sparkles,
  ArrowLeft,
  Filter,
  ShieldAlert,
  Shield,
  Copy,
  Eye
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useKnowledgeCandidates, useKnowledgeCandidateStats, type KnowledgeCandidate, type CandidateStatus, type CandidateFilters, type RiskLevel } from "@/hooks/useKnowledgeCandidates";
import { useApproveCandidate } from "@/hooks/useApproveCandidate";
import { useRejectCandidate } from "@/hooks/useRejectCandidate";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function KnowledgeCuration() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<CandidateStatus>('pending');
  const [selectedCandidate, setSelectedCandidate] = useState<KnowledgeCandidate | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [highRiskConfirmOpen, setHighRiskConfirmOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [filters, setFilters] = useState<CandidateFilters>({});
  
  // Editable fields
  const [editProblem, setEditProblem] = useState("");
  const [editSolution, setEditSolution] = useState("");
  const [editWhenToUse, setEditWhenToUse] = useState("");
  const [editWhenNotToUse, setEditWhenNotToUse] = useState("");
  const [editCategory, setEditCategory] = useState("");

  const { data: candidates = [], isLoading } = useKnowledgeCandidates(activeTab, filters);
  const { data: stats } = useKnowledgeCandidateStats();
  const approveCandidate = useApproveCandidate();
  const rejectCandidate = useRejectCandidate();

  const handleOpenEdit = (candidate: KnowledgeCandidate) => {
    setSelectedCandidate(candidate);
    setEditProblem(candidate.problem);
    // If PII detected, pre-fill with sanitized version
    setEditSolution(candidate.contains_pii && candidate.sanitized_solution ? candidate.sanitized_solution : candidate.solution);
    setEditWhenToUse(candidate.when_to_use || "");
    setEditWhenNotToUse(candidate.when_not_to_use || "");
    setEditCategory(candidate.category || "Aprendizado Passivo");
    setEditDialogOpen(true);
  };

  const handleQuickApprove = (candidate: KnowledgeCandidate) => {
    // 🆕 Block direct approve for PII candidates
    if (candidate.contains_pii) {
      toast({
        title: "⚠️ PII detectado",
        description: "Este candidato contém dados pessoais. Use 'Editar e Aprovar' para sanitizar.",
        variant: "destructive",
      });
      handleOpenEdit(candidate);
      return;
    }
    // 🆕 Require confirmation for high risk
    if (candidate.risk_level === 'high') {
      setSelectedCandidate(candidate);
      setHighRiskConfirmOpen(true);
      return;
    }
    approveCandidate.mutate({ candidateId: candidate.id });
  };

  const handleConfirmHighRiskApprove = () => {
    if (!selectedCandidate) return;
    approveCandidate.mutate({ candidateId: selectedCandidate.id, forceApprove: true });
    setHighRiskConfirmOpen(false);
  };

  const handleApproveWithEdits = () => {
    if (!selectedCandidate) return;
    approveCandidate.mutate({
      candidateId: selectedCandidate.id,
      edits: {
        problem: editProblem,
        solution: editSolution,
        when_to_use: editWhenToUse,
        when_not_to_use: editWhenNotToUse,
        category: editCategory,
      },
      forceApprove: true,
    }, {
      onSuccess: () => setEditDialogOpen(false),
    });
  };

  const handleOpenReject = (candidate: KnowledgeCandidate) => {
    setSelectedCandidate(candidate);
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  const handleConfirmReject = () => {
    if (!selectedCandidate || !rejectionReason.trim()) return;
    rejectCandidate.mutate({
      candidateId: selectedCandidate.id,
      reason: rejectionReason,
    }, {
      onSuccess: () => setRejectDialogOpen(false),
    });
  };

  const getConfidenceColor = (score: number | null) => {
    if (!score) return "bg-muted";
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getConfidenceLabel = (score: number | null) => {
    if (!score) return "N/A";
    if (score >= 80) return "Alta";
    if (score >= 60) return "Média";
    return "Baixa";
  };

  const getRiskBadge = (level: RiskLevel) => {
    switch (level) {
      case 'high': return <Badge variant="destructive" className="gap-1"><ShieldAlert className="h-3 w-3" />Alto Risco</Badge>;
      case 'medium': return <Badge variant="warning" className="gap-1"><Shield className="h-3 w-3" />Médio</Badge>;
      default: return <Badge variant="success" className="gap-1"><Shield className="h-3 w-3" />Baixo</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/knowledge')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <GraduationCap className="h-8 w-8 text-primary" />
              Curadoria de Conhecimento
            </h1>
            <p className="text-muted-foreground mt-1">
              Revise e aprove conhecimento extraído automaticamente
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-yellow-500/10">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold">{stats?.pending || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-green-500/10">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aprovados</p>
                <p className="text-2xl font-bold">{stats?.approved || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-red-500/10">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rejeitados</p>
                <p className="text-2xl font-bold">{stats?.rejected || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Extraído</p>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
              </div>
            </div>
            {/* PII / Risk counters */}
            {((stats?.pii_flagged || 0) > 0 || (stats?.high_risk || 0) > 0) && (
              <div className="flex gap-2 mt-2">
                {(stats?.pii_flagged || 0) > 0 && (
                  <Badge variant="destructive" className="text-xs">{stats?.pii_flagged} PII</Badge>
                )}
                {(stats?.high_risk || 0) > 0 && (
                  <Badge variant="warning" className="text-xs">{stats?.high_risk} Alto Risco</Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select
          value={filters.riskLevel || 'all'}
          onValueChange={(v) => setFilters(prev => ({ ...prev, riskLevel: v === 'all' ? undefined : v as RiskLevel }))}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Nível de risco" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os riscos</SelectItem>
            <SelectItem value="low">Baixo</SelectItem>
            <SelectItem value="medium">Médio</SelectItem>
            <SelectItem value="high">Alto</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.containsPii === undefined ? 'all' : filters.containsPii ? 'yes' : 'no'}
          onValueChange={(v) => setFilters(prev => ({ ...prev, containsPii: v === 'all' ? undefined : v === 'yes' }))}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="PII" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos (PII)</SelectItem>
            <SelectItem value="yes">Com PII</SelectItem>
            <SelectItem value="no">Sem PII</SelectItem>
          </SelectContent>
        </Select>

        {(filters.riskLevel || filters.containsPii !== undefined) && (
          <Button variant="ghost" size="sm" onClick={() => setFilters({})}>
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CandidateStatus)}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Pendentes ({stats?.pending || 0})
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Aprovados
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-2">
            <XCircle className="h-4 w-4" />
            Rejeitados
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-2">
            <Filter className="h-4 w-4" />
            Todos
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Carregando candidatos...
            </div>
          ) : candidates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {activeTab === 'pending' 
                    ? "Nenhum conhecimento aguardando curadoria" 
                    : `Nenhum candidato ${activeTab === 'approved' ? 'aprovado' : activeTab === 'rejected' ? 'rejeitado' : ''}`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {candidates.map((candidate) => (
                <Card key={candidate.id} className={`hover:shadow-md transition-shadow ${candidate.contains_pii ? 'border-destructive/40' : candidate.risk_level === 'high' ? 'border-warning/40' : ''}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-lg">{candidate.problem}</CardTitle>
                          <Badge 
                            variant={candidate.status === 'approved' ? 'default' : candidate.status === 'rejected' ? 'destructive' : 'secondary'}
                          >
                            {candidate.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                            {candidate.status === 'approved' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {candidate.status === 'rejected' && <XCircle className="h-3 w-3 mr-1" />}
                            {candidate.status === 'pending' ? 'Pendente' : candidate.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                          </Badge>
                          {/* 🆕 PII & Risk badges */}
                          {candidate.contains_pii && (
                            <Badge variant="destructive" className="gap-1">
                              <ShieldAlert className="h-3 w-3" />PII Detectado
                            </Badge>
                          )}
                          {getRiskBadge(candidate.risk_level)}
                        </div>
                        
                        <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                          {candidate.departments?.name && (
                            <Badge variant="outline">{candidate.departments.name}</Badge>
                          )}
                          {candidate.category && (
                            <Badge variant="secondary">{candidate.category}</Badge>
                          )}
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            {candidate.extracted_by || 'IA'}
                          </span>
                          <span>
                            {formatDistanceToNow(new Date(candidate.created_at), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })}
                          </span>
                          {/* Quality scores */}
                          {candidate.clarity_score != null && (
                            <span className="text-xs">Clareza: {candidate.clarity_score}/10</span>
                          )}
                          {candidate.completeness_score != null && (
                            <span className="text-xs">Completude: {candidate.completeness_score}/10</span>
                          )}
                        </div>
                      </div>

                      {/* Confidence Score */}
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground mb-1">Confiança</p>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={candidate.confidence_score || 0} 
                            className={`w-16 h-2 ${getConfidenceColor(candidate.confidence_score)}`}
                          />
                          <span className="text-sm font-medium">
                            {candidate.confidence_score || 0}%
                          </span>
                        </div>
                        <Badge variant="outline" className="mt-1 text-xs">
                          {getConfidenceLabel(candidate.confidence_score)}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* 🆕 PII Warning Alert */}
                    {candidate.contains_pii && (
                      <div className="p-3 bg-destructive/5 rounded-lg border border-destructive/20">
                        <p className="font-medium text-destructive mb-1 flex items-center gap-1">
                          <ShieldAlert className="h-4 w-4" />
                          ⚠️ Dados pessoais detectados na solução
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Este candidato contém PII. Edite para remover dados sensíveis antes de aprovar.
                        </p>
                        {candidate.sanitized_solution && (
                          <div className="mt-2 p-2 bg-background rounded border">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Versão sanitizada sugerida:</p>
                            <p className="text-sm">{candidate.sanitized_solution}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 🆕 Duplicate warning */}
                    {candidate.duplicate_article && (
                      <div className="p-3 bg-warning/5 rounded-lg border border-warning/20">
                        <p className="font-medium text-warning flex items-center gap-1">
                          <Copy className="h-4 w-4" />
                          Artigo similar encontrado: "{candidate.duplicate_article.title}"
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Considere atualizar o artigo existente em vez de criar um novo.
                        </p>
                      </div>
                    )}

                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Solução:</p>
                      <CardDescription className="whitespace-pre-wrap">
                        {candidate.solution}
                      </CardDescription>
                    </div>

                    {(candidate.when_to_use || candidate.when_not_to_use) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {candidate.when_to_use && (
                          <div className="p-3 bg-green-500/5 rounded-lg border border-green-500/20">
                            <p className="font-medium text-green-700 mb-1">✓ Quando usar:</p>
                            <p className="text-muted-foreground">{candidate.when_to_use}</p>
                          </div>
                        )}
                        {candidate.when_not_to_use && (
                          <div className="p-3 bg-red-500/5 rounded-lg border border-red-500/20">
                            <p className="font-medium text-red-700 mb-1">✗ Quando NÃO usar:</p>
                            <p className="text-muted-foreground">{candidate.when_not_to_use}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 🆕 Evidence Snippets */}
                    {candidate.evidence_snippets && candidate.evidence_snippets.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                          <Eye className="h-3 w-3" /> Trechos de Evidência
                        </p>
                        <div className="space-y-1">
                          {candidate.evidence_snippets.map((snippet, i) => (
                            <div key={i} className={`p-2 rounded text-sm border ${snippet.role === 'Agente' ? 'bg-primary/5 border-primary/10' : 'bg-muted/50 border-muted'}`}>
                              <span className="font-medium text-xs">{snippet.role}:</span>{' '}
                              <span className="text-muted-foreground">{snippet.content}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {candidate.rejection_reason && (
                      <div className="p-3 bg-red-500/5 rounded-lg border border-red-500/20">
                        <p className="font-medium text-red-700 mb-1 flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4" />
                          Motivo da rejeição:
                        </p>
                        <p className="text-muted-foreground">{candidate.rejection_reason}</p>
                      </div>
                    )}

                    {candidate.tags && candidate.tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {candidate.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Actions for pending candidates */}
                    {candidate.status === 'pending' && (
                      <div className="flex items-center gap-2 pt-2 border-t flex-wrap">
                        <Button 
                          variant="default" 
                          size="sm"
                          onClick={() => handleQuickApprove(candidate)}
                          disabled={approveCandidate.isPending}
                          className="gap-1"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Aprovar
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleOpenEdit(candidate)}
                          className="gap-1"
                        >
                          <Edit2 className="h-4 w-4" />
                          Editar e Aprovar
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleOpenReject(candidate)}
                          className="gap-1 text-destructive hover:text-destructive"
                        >
                          <XCircle className="h-4 w-4" />
                          Rejeitar
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setSelectedCandidate(candidate);
                            setRejectionReason("Conhecimento duplicado - já existe na base de conhecimento");
                            rejectCandidate.mutate({
                              candidateId: candidate.id,
                              reason: "duplicate_knowledge",
                            });
                          }}
                          disabled={rejectCandidate.isPending}
                          className="gap-1 text-orange-600 hover:text-orange-700"
                        >
                          <AlertTriangle className="h-4 w-4" />
                          Já existe na KB
                        </Button>
                        {candidate.source_conversation_id && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => navigate(`/inbox?conversation=${candidate.source_conversation_id}`)}
                            className="gap-1 ml-auto"
                          >
                            <MessageSquare className="h-4 w-4" />
                            Ver Conversa
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5" />
              Editar e Aprovar Conhecimento
            </DialogTitle>
            <DialogDescription>
              Revise e ajuste o conteúdo antes de publicar na base de conhecimento.
            </DialogDescription>
          </DialogHeader>
          
          {/* PII notice in edit dialog */}
          {selectedCandidate?.contains_pii && (
            <div className="p-3 bg-destructive/5 rounded-lg border border-destructive/20">
              <p className="text-sm font-medium text-destructive flex items-center gap-1">
                <ShieldAlert className="h-4 w-4" />
                PII detectado — remova dados pessoais antes de aprovar
              </p>
            </div>
          )}

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="problem">Problema / Pergunta</Label>
              <Textarea
                id="problem"
                value={editProblem}
                onChange={(e) => setEditProblem(e.target.value)}
                placeholder="Descreva o problema ou pergunta..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="solution">Solução / Resposta</Label>
              <Textarea
                id="solution"
                value={editSolution}
                onChange={(e) => setEditSolution(e.target.value)}
                placeholder="Descreva a solução..."
                rows={4}
              />
              {selectedCandidate?.sanitized_solution && editSolution !== selectedCandidate.sanitized_solution && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditSolution(selectedCandidate.sanitized_solution!)}
                  className="gap-1 text-xs"
                >
                  <Shield className="h-3 w-3" />
                  Usar versão sanitizada
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="whenToUse">Quando usar</Label>
                <Textarea
                  id="whenToUse"
                  value={editWhenToUse}
                  onChange={(e) => setEditWhenToUse(e.target.value)}
                  placeholder="Quando aplicar esta solução..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whenNotToUse">Quando NÃO usar</Label>
                <Textarea
                  id="whenNotToUse"
                  value={editWhenNotToUse}
                  onChange={(e) => setEditWhenNotToUse(e.target.value)}
                  placeholder="Exceções e contraindicações..."
                  rows={2}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Input
                id="category"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                placeholder="Ex: Pagamento, Suporte, Produto..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleApproveWithEdits}
              disabled={approveCandidate.isPending || !editProblem.trim() || !editSolution.trim()}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {approveCandidate.isPending ? 'Aprovando...' : 'Aprovar e Publicar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Rejeitar Conhecimento
            </AlertDialogTitle>
            <AlertDialogDescription>
              Explique o motivo da rejeição para registro e melhoria do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-4">
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Motivo da rejeição..."
              rows={3}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReject}
              disabled={rejectCandidate.isPending || !rejectionReason.trim()}
              className="bg-destructive hover:bg-destructive/90"
            >
              {rejectCandidate.isPending ? 'Rejeitando...' : 'Confirmar Rejeição'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 🆕 High Risk Confirmation Dialog */}
      <AlertDialog open={highRiskConfirmOpen} onOpenChange={setHighRiskConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-warning" />
              Confirmação: Alto Risco
            </AlertDialogTitle>
            <AlertDialogDescription>
              Este candidato foi classificado como <strong>alto risco</strong>. Tem certeza que deseja aprovar sem edição? 
              Recomendamos revisar cuidadosamente antes de publicar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (selectedCandidate) handleOpenEdit(selectedCandidate); setHighRiskConfirmOpen(false); }}>
              Editar antes
            </AlertDialogAction>
            <AlertDialogAction onClick={handleConfirmHighRiskApprove} className="bg-warning hover:bg-warning/90 text-warning-foreground">
              Aprovar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
