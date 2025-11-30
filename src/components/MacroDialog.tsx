import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDepartments } from "@/hooks/useDepartments";
import { useCreateCannedResponse, useUpdateCannedResponse, CannedResponse } from "@/hooks/useCannedResponses";
import { Loader2 } from "lucide-react";

interface MacroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  macro?: CannedResponse | null;
}

export function MacroDialog({ open, onOpenChange, macro }: MacroDialogProps) {
  const [title, setTitle] = useState("");
  const [shortcut, setShortcut] = useState("");
  const [content, setContent] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [departmentId, setDepartmentId] = useState<string>("");

  const { data: departments = [] } = useDepartments();
  const createMacro = useCreateCannedResponse();
  const updateMacro = useUpdateCannedResponse();

  const isEditing = !!macro;

  useEffect(() => {
    if (macro) {
      setTitle(macro.title);
      setShortcut(macro.shortcut);
      setContent(macro.content);
      setIsPublic(macro.is_public);
      setDepartmentId(macro.department_id || "");
    } else {
      setTitle("");
      setShortcut("");
      setContent("");
      setIsPublic(false);
      setDepartmentId("");
    }
  }, [macro, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      title,
      shortcut: shortcut.toLowerCase().trim(),
      content,
      is_public: isPublic,
      department_id: isPublic && departmentId ? departmentId : null,
    };

    if (isEditing) {
      await updateMacro.mutateAsync({ id: macro.id, ...data });
    } else {
      await createMacro.mutateAsync(data);
    }

    onOpenChange(false);
  };

  const isSaving = createMacro.isPending || updateMacro.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Macro" : "Nova Macro"}</DialogTitle>
          <DialogDescription>
            Crie respostas prontas para agilizar o atendimento. Use atalhos como /ola ou /saudacao.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              placeholder="Ex: Saudação inicial"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="shortcut">Atalho</Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">/</span>
              <Input
                id="shortcut"
                placeholder="Ex: ola, saudacao, status"
                value={shortcut}
                onChange={(e) => setShortcut(e.target.value.toLowerCase())}
                required
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Digite "/" no chat e comece a escrever este atalho para usar
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Conteúdo</Label>
            <Textarea
              id="content"
              placeholder="Olá! Como posso ajudar você hoje?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              required
            />
            <p className="text-xs text-muted-foreground">
              {content.length} caracteres
            </p>
          </div>

          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="is-public">Compartilhar com equipe?</Label>
              <p className="text-xs text-muted-foreground">
                Permitir que outros agentes usem esta macro
              </p>
            </div>
            <Switch
              id="is-public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
          </div>

          {isPublic && (
            <div className="space-y-2">
              <Label htmlFor="department">Departamento (opcional)</Label>
              <Select value={departmentId || "global"} onValueChange={(value) => setDepartmentId(value === "global" ? "" : value)}>
                <SelectTrigger id="department">
                  <SelectValue placeholder="Global (todos os departamentos)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global (todos)</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Se deixar vazio, ficará disponível para todos os departamentos
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Salvar" : "Criar Macro"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
