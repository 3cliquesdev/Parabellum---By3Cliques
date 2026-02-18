import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Zap, Search, Plus, Pencil, Trash2 } from "lucide-react";
import { useCannedResponses, useIncrementMacroUsage, useDeleteCannedResponse, CannedResponse } from "@/hooks/useCannedResponses";
import { MacroDialog } from "@/components/MacroDialog";
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
import { cn } from "@/lib/utils";

interface MacrosPopoverProps {
  onSelectMacro: (content: string) => void;
  disabled?: boolean;
}

// FASE 5: Menu de Macros (Respostas Rápidas) + Gerenciamento inline
export function MacrosPopover({ onSelectMacro, disabled }: MacrosPopoverProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: macros = [], isLoading } = useCannedResponses(search || undefined);
  const incrementUsage = useIncrementMacroUsage();
  const deleteMacro = useDeleteCannedResponse();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMacro, setEditingMacro] = useState<CannedResponse | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<CannedResponse | null>(null);

  const handleSelect = (macro: { id: string; content: string }) => {
    onSelectMacro(macro.content);
    incrementUsage.mutate(macro.id);
    setOpen(false);
    setSearch("");
  };

  const handleCreate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingMacro(null);
    setDialogOpen(true);
  };

  const handleEdit = (e: React.MouseEvent, macro: CannedResponse) => {
    e.stopPropagation();
    setEditingMacro(macro);
    setDialogOpen(true);
  };

  const handleDeleteClick = (e: React.MouseEvent, macro: CannedResponse) => {
    e.stopPropagation();
    setDeleteTarget(macro);
  };

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      deleteMacro.mutate(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="h-10 w-10 shrink-0 text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
            title="Macros / Respostas Rápidas"
          >
            <Zap className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-80 p-0"
          align="start"
          side="top"
          sideOffset={8}
        >
          <div className="p-3 border-b flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar macro..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
                autoFocus
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              title="Nova Macro"
              onClick={handleCreate}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="h-[280px]">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Carregando...
              </div>
            ) : macros.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {search ? "Nenhuma macro encontrada" : "Nenhuma macro cadastrada"}
              </div>
            ) : (
              <div className="p-2">
                {macros.map((macro) => (
                  <div
                    key={macro.id}
                    className={cn(
                      "group w-full text-left p-3 rounded-lg hover:bg-accent transition-colors",
                      "border border-transparent hover:border-border flex items-start gap-2"
                    )}
                  >
                    <button
                      className="flex-1 text-left min-w-0"
                      onClick={() => handleSelect(macro)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate flex-1">
                          {macro.title}
                        </span>
                        <code className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          /{macro.shortcut}
                        </code>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {macro.content}
                      </p>
                    </button>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Editar"
                        onClick={(e) => handleEdit(e, macro)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        title="Excluir"
                        onClick={(e) => handleDeleteClick(e, macro)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="p-2 border-t bg-muted/30">
            <p className="text-[10px] text-muted-foreground text-center">
              Digite <code className="px-1 rounded bg-muted">\</code> ou{" "}
              <code className="px-1 rounded bg-muted">Ctrl+M</code> para acessar macros
            </p>
          </div>
        </PopoverContent>
      </Popover>

      {/* Macro create/edit dialog */}
      <MacroDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        macro={editingMacro}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir macro?</AlertDialogTitle>
            <AlertDialogDescription>
              A macro <strong>"{deleteTarget?.title}"</strong> será excluída permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
