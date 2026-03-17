import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useCreatePipeline } from "@/hooks/useCreatePipeline";
import { useUpdatePipeline } from "@/hooks/useUpdatePipeline";
import { useDeletePipeline } from "@/hooks/useDeletePipeline";
import { usePipelines } from "@/hooks/usePipelines";
import { useDepartments } from "@/hooks/useDepartments";
import { Settings, Trash2, Edit } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const pipelineSchema = z.object({
  name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  is_default: z.boolean().optional(),
  department_id: z.string().nullable().optional(),
});

type PipelineFormData = z.infer<typeof pipelineSchema>;

interface PipelineDialogProps {
  trigger?: React.ReactNode;
}

export default function PipelineDialog({ trigger }: PipelineDialogProps) {
  const [open, setOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<Tables<"pipelines"> | null>(null);
  
  const { data: pipelines } = usePipelines();
  const { data: departments } = useDepartments({ activeOnly: true });
  const createPipeline = useCreatePipeline();
  const updatePipeline = useUpdatePipeline();
  const deletePipeline = useDeletePipeline();

  const form = useForm<PipelineFormData>({
    resolver: zodResolver(pipelineSchema),
    defaultValues: {
      name: "",
      is_default: false,
      department_id: null,
    },
  });

  const onSubmit = async (data: PipelineFormData) => {
    if (editingPipeline) {
      await updatePipeline.mutateAsync({
        id: editingPipeline.id,
        name: data.name,
        is_default: data.is_default,
        department_id: data.department_id || null,
      });
    } else {
      await createPipeline.mutateAsync({
        name: data.name,
        is_default: data.is_default,
        department_id: data.department_id || null,
      });
    }
    form.reset();
    setEditingPipeline(null);
    setOpen(false);
  };

  const handleEdit = (pipeline: Tables<"pipelines">) => {
    setEditingPipeline(pipeline);
    form.reset({
      name: pipeline.name,
      is_default: pipeline.is_default || false,
      department_id: (pipeline as any).department_id || null,
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja deletar este pipeline? Todas as etapas e negócios vinculados serão afetados.")) {
      await deletePipeline.mutateAsync(id);
    }
  };

  const handleDialogChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setEditingPipeline(null);
      form.reset();
    }
  };

  const getDepartmentName = (pipeline: any) => {
    return pipeline.departments?.name || null;
  };

  const getDepartmentColor = (pipeline: any) => {
    return pipeline.departments?.color || null;
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Settings className="h-4 w-4" />
            Gerenciar Pipelines
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {editingPipeline ? "Editar Pipeline" : "Gerenciar Pipelines"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Lista de pipelines existentes */}
          {!editingPipeline && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Pipelines Existentes</h3>
              <div className="space-y-2">
                {pipelines?.map((pipeline: any) => (
                  <div
                    key={pipeline.id}
                    className="flex items-center justify-between p-3 border-2 border-border rounded-lg bg-card"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{pipeline.name}</span>
                      {pipeline.is_default && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                          Padrão
                        </span>
                      )}
                      {getDepartmentName(pipeline) && (
                        <span
                          className="text-xs px-2 py-1 rounded"
                          style={{
                            backgroundColor: getDepartmentColor(pipeline) ? `${getDepartmentColor(pipeline)}20` : undefined,
                            color: getDepartmentColor(pipeline) || undefined,
                          }}
                        >
                          {getDepartmentName(pipeline)}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(pipeline)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(pipeline.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formulário de criar/editar */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      Nome do Pipeline <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Vendas B2B, Pós-Vendas..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="department_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      Departamento
                    </FormLabel>
                    <Select
                      value={field.value || "none"}
                      onValueChange={(val) => field.onChange(val === "none" ? null : val)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Todos os departamentos" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Todos os departamentos</SelectItem>
                        {departments?.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: dept.color }}
                              />
                              {dept.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Sem departamento = visível para todos
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_default"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">
                      Definir como pipeline padrão
                    </FormLabel>
                  </FormItem>
                )}
              />

              <div className="flex gap-2">
                <Button type="submit" disabled={createPipeline.isPending || updatePipeline.isPending}>
                  {editingPipeline ? "Salvar Alterações" : "Criar Pipeline"}
                </Button>
                {editingPipeline && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingPipeline(null);
                      form.reset({ name: "", is_default: false, department_id: null });
                    }}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
