import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Copy,
  FlaskConical,
  BarChart3,
  Mail,
  Layers,
  Eye,
  Power,
  PowerOff,
} from "lucide-react";
import {
  useEmailTemplatesV2,
  useDeleteEmailTemplateV2,
  useDuplicateEmailTemplateV2,
  useTemplateMetrics,
  useToggleEmailTemplateV2Status,
} from "@/hooks/useEmailBuilderV2";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EmailTemplatesV2ListProps {
  onCreateNew: () => void;
}

export function EmailTemplatesV2List({ onCreateNew }: EmailTemplatesV2ListProps) {
  const navigate = useNavigate();
  const { data: templates, isLoading } = useEmailTemplatesV2();
  const deleteMutation = useDeleteEmailTemplateV2();
  const duplicateMutation = useDuplicateEmailTemplateV2();
  const toggleStatusMutation = useToggleEmailTemplateV2Status();
  
  const [search, setSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

  const handleDuplicate = (id: string) => {
    duplicateMutation.mutate(id);
  };

  const handleToggleStatus = (id: string, currentStatus: boolean) => {
    toggleStatusMutation.mutate({ id, is_active: !currentStatus });
  };

  const filteredTemplates = templates?.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description?.toLowerCase().includes(search.toLowerCase()) ||
      t.category?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = (id: string) => {
    setTemplateToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (templateToDelete) {
      await deleteMutation.mutateAsync(templateToDelete);
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    }
  };

  const getCategoryColor = (category: string | null) => {
    const colors: Record<string, string> = {
      welcome: "bg-green-500/20 text-green-400 border-green-500/50",
      transactional: "bg-blue-500/20 text-blue-400 border-blue-500/50",
      notification: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
      marketing: "bg-purple-500/20 text-purple-400 border-purple-500/50",
      onboarding: "bg-cyan-500/20 text-cyan-400 border-cyan-500/50",
    };
    return colors[category || ""] || "bg-muted text-muted-foreground";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Carregando templates V2...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={onCreateNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Template V2
        </Button>
      </div>

      {/* Empty State */}
      {!filteredTemplates || filteredTemplates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-primary/10 p-6 mb-6">
              <Layers className="h-16 w-16 text-primary" />
            </div>
            <h3 className="text-2xl font-semibold mb-2">
              {search ? "Nenhum resultado" : "Nenhum template V2"}
            </h3>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              {search
                ? "Tente uma busca diferente"
                : "Crie seu primeiro template com o novo editor visual drag-and-drop"}
            </p>
            {!search && (
              <Button onClick={onCreateNew} size="lg" className="gap-2">
                <Plus className="h-5 w-5" />
                Criar Template V2
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={() => navigate(`/email-templates/v2/builder/${template.id}`)}
              onDelete={() => handleDelete(template.id)}
              onDuplicate={() => handleDuplicate(template.id)}
              onToggleStatus={() => handleToggleStatus(template.id, template.is_active ?? false)}
              isDuplicating={duplicateMutation.isPending}
              isTogglingStatus={toggleStatusMutation.isPending}
              getCategoryColor={getCategoryColor}
            />
          ))}
        </div>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar este template? Esta ação não pode
              ser desfeita e todos os dados associados serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface TemplateCardProps {
  template: {
    id: string;
    name: string;
    description?: string | null;
    category?: string | null;
    default_subject?: string | null;
    is_active?: boolean | null;
    ab_testing_enabled?: boolean | null;
    version?: number | null;
    created_at?: string | null;
    updated_at?: string | null;
  };
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleStatus: () => void;
  isDuplicating: boolean;
  isTogglingStatus: boolean;
  getCategoryColor: (category: string | null) => string;
}

function TemplateCard({
  template,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleStatus,
  isDuplicating,
  isTogglingStatus,
  getCategoryColor,
}: TemplateCardProps) {
  const { data: metrics } = useTemplateMetrics(template.id);

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Badge
              variant={template.is_active ? "default" : "secondary"}
              className={
                template.is_active
                  ? "bg-green-500/20 text-green-400 border-green-500/50"
                  : ""
              }
            >
              {template.is_active ? "● Ativo" : "○ Inativo"}
            </Badge>
            {template.ab_testing_enabled && (
              <Badge variant="outline" className="gap-1">
                <FlaskConical className="h-3 w-3" />
                A/B
              </Badge>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onToggleStatus} disabled={isTogglingStatus}>
                {template.is_active ? (
                  <>
                    <PowerOff className="h-4 w-4 mr-2" />
                    {isTogglingStatus ? "Desativando..." : "Desativar"}
                  </>
                ) : (
                  <>
                    <Power className="h-4 w-4 mr-2 text-green-500" />
                    {isTogglingStatus ? "Ativando..." : "Ativar"}
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate} disabled={isDuplicating}>
                <Copy className="h-4 w-4 mr-2" />
                {isDuplicating ? "Duplicando..." : "Duplicar"}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Deletar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <CardTitle className="text-lg mt-2">{template.name}</CardTitle>
        {template.description && (
          <CardDescription className="line-clamp-2">
            {template.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Subject */}
        {template.default_subject && (
          <div className="text-sm">
            <span className="text-muted-foreground">Assunto: </span>
            <span className="font-medium">{template.default_subject}</span>
          </div>
        )}

        {/* Metrics */}
        {metrics && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-lg bg-muted/50">
              <div className="text-lg font-bold">{metrics.total_sent || 0}</div>
              <div className="text-xs text-muted-foreground">Enviados</div>
            </div>
            <div className="p-2 rounded-lg bg-muted/50">
              <div className="text-lg font-bold text-green-500">
                {metrics.open_rate?.toFixed(1) || 0}%
              </div>
              <div className="text-xs text-muted-foreground">Aberturas</div>
            </div>
            <div className="p-2 rounded-lg bg-muted/50">
              <div className="text-lg font-bold text-primary">
                {metrics.ctr?.toFixed(1) || 0}%
              </div>
              <div className="text-xs text-muted-foreground">Cliques</div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t">
          <Badge variant="outline" className={getCategoryColor(template.category)}>
            {template.category || "Sem categoria"}
          </Badge>
          <span className="text-xs text-muted-foreground">
            v{template.version || 1} •{" "}
            {template.updated_at
              ? formatDistanceToNow(new Date(template.updated_at), {
                  addSuffix: true,
                  locale: ptBR,
                })
              : "—"}
          </span>
        </div>

        {/* Action Button */}
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={onEdit}
        >
          <Pencil className="h-4 w-4" />
          Editar Template
        </Button>
      </CardContent>
    </Card>
  );
}
