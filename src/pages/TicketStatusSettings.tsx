import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { ArrowLeft, Plus, MoreHorizontal, GripVertical, Pencil, Trash2, Mail, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useTicketStatuses,
  useReorderTicketStatuses,
  useToggleStatusActive,
  useToggleStatusNotification,
  useDeleteTicketStatus,
  type TicketStatus,
} from "@/hooks/useTicketStatuses";
import { StatusDialog } from "@/components/settings/StatusDialog";
import { getStatusIcon } from "@/lib/ticketStatusIcons";

interface SortableStatusItemProps {
  status: TicketStatus;
  onEdit: (status: TicketStatus) => void;
  onDelete: (status: TicketStatus) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
  onToggleEmail: (id: string, value: boolean) => void;
  onToggleWhatsApp: (id: string, value: boolean) => void;
}

function SortableStatusItem({
  status,
  onEdit,
  onDelete,
  onToggleActive,
  onToggleEmail,
  onToggleWhatsApp,
}: SortableStatusItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: status.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const IconComponent = getStatusIcon(status.icon);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:bg-muted/30 transition-colors"
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Status Badge */}
      <div
        className="flex items-center gap-2 px-3 py-1 rounded-full text-white text-sm font-medium min-w-[140px]"
        style={{ backgroundColor: status.color }}
      >
        <IconComponent className="h-4 w-4" />
        <span>{status.label}</span>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1.5 flex-1">
        {status.is_archived_status && (
          <Badge variant="secondary" className="text-xs">Arquivado</Badge>
        )}
        {status.is_final_status && (
          <Badge variant="outline" className="text-xs">Final</Badge>
        )}
        {!status.is_active && (
          <Badge variant="destructive" className="text-xs">Inativo</Badge>
        )}
      </div>

      {/* Notification toggles */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2" title="Notificação por Email">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <Switch
            checked={status.send_email_notification}
            onCheckedChange={(checked) => onToggleEmail(status.id, checked)}
            className="data-[state=checked]:bg-primary"
          />
        </div>
        <div className="flex items-center gap-2 opacity-50" title="Notificação por WhatsApp (em breve)">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <Switch
            checked={status.send_whatsapp_notification}
            onCheckedChange={(checked) => onToggleWhatsApp(status.id, checked)}
            disabled
          />
        </div>
      </div>

      {/* Active toggle */}
      <Switch
        checked={status.is_active}
        onCheckedChange={(checked) => onToggleActive(status.id, checked)}
        className="data-[state=checked]:bg-green-500"
      />

      {/* Actions menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(status)}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onDelete(status)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default function TicketStatusSettings() {
  const navigate = useNavigate();
  const { data: statuses, isLoading } = useTicketStatuses();
  const reorderMutation = useReorderTicketStatuses();
  const toggleActiveMutation = useToggleStatusActive();
  const toggleNotificationMutation = useToggleStatusNotification();
  const deleteMutation = useDeleteTicketStatus();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<TicketStatus | null>(null);
  const [deleteConfirmStatus, setDeleteConfirmStatus] = useState<TicketStatus | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeStatuses = statuses?.filter(s => !s.is_archived_status) || [];
  const archivedStatuses = statuses?.filter(s => s.is_archived_status) || [];

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const allStatuses = [...activeStatuses, ...archivedStatuses];
      const oldIndex = allStatuses.findIndex(s => s.id === active.id);
      const newIndex = allStatuses.findIndex(s => s.id === over.id);
      
      const newOrder = arrayMove(allStatuses, oldIndex, newIndex);
      reorderMutation.mutate(newOrder.map(s => s.id));
    }
  };

  const handleEdit = (status: TicketStatus) => {
    setEditingStatus(status);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingStatus(null);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (deleteConfirmStatus) {
      await deleteMutation.mutateAsync(deleteConfirmStatus.id);
      setDeleteConfirmStatus(null);
    }
  };

  const handleToggleActive = (id: string, isActive: boolean) => {
    toggleActiveMutation.mutate({ id, is_active: isActive });
  };

  const handleToggleEmail = (id: string, value: boolean) => {
    toggleNotificationMutation.mutate({ id, field: 'send_email_notification', value });
  };

  const handleToggleWhatsApp = (id: string, value: boolean) => {
    toggleNotificationMutation.mutate({ id, field: 'send_whatsapp_notification', value });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const allStatuses = [...activeStatuses, ...archivedStatuses];

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Status de Tickets</h1>
            <p className="text-muted-foreground">
              Gerencie os status disponíveis para tickets
            </p>
          </div>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Status
        </Button>
      </div>

      {/* Status List */}
      <Card>
        <CardHeader>
          <CardTitle>Status Configurados</CardTitle>
          <CardDescription>
            Arraste para reordenar. Use os toggles para controlar ativação e notificações.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            {/* Active Statuses */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Status Ativos
              </h3>
              <SortableContext
                items={activeStatuses.map(s => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {activeStatuses.map(status => (
                    <SortableStatusItem
                      key={status.id}
                      status={status}
                      onEdit={handleEdit}
                      onDelete={setDeleteConfirmStatus}
                      onToggleActive={handleToggleActive}
                      onToggleEmail={handleToggleEmail}
                      onToggleWhatsApp={handleToggleWhatsApp}
                    />
                  ))}
                </div>
              </SortableContext>
            </div>

            {/* Divider */}
            {archivedStatuses.length > 0 && (
              <div className="border-t border-border my-4" />
            )}

            {/* Archived Statuses */}
            {archivedStatuses.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Status de Arquivamento
                </h3>
                <SortableContext
                  items={archivedStatuses.map(s => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {archivedStatuses.map(status => (
                      <SortableStatusItem
                        key={status.id}
                        status={status}
                        onEdit={handleEdit}
                        onDelete={setDeleteConfirmStatus}
                        onToggleActive={handleToggleActive}
                        onToggleEmail={handleToggleEmail}
                        onToggleWhatsApp={handleToggleWhatsApp}
                      />
                    ))}
                  </div>
                </SortableContext>
              </div>
            )}
          </DndContext>
        </CardContent>
      </Card>

      {/* Status Dialog */}
      <StatusDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        status={editingStatus}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmStatus} onOpenChange={() => setDeleteConfirmStatus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Status</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o status "{deleteConfirmStatus?.label}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
