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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useCreatePipeline } from "@/hooks/useCreatePipeline";
import { useUpdatePipeline } from "@/hooks/useUpdatePipeline";
import { useDeletePipeline } from "@/hooks/useDeletePipeline";
import { usePipelines } from "@/hooks/usePipelines";
import { Settings, Trash2, Edit } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const pipelineSchema = z.object({
  name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  is_default: z.boolean().optional(),
});

type PipelineFormData = z.infer<typeof pipelineSchema>;

interface PipelineDialogProps {
  trigger?: React.ReactNode;
}

export default function PipelineDialog({ trigger }: PipelineDialogProps) {
  const [open, setOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<Tables<"pipelines"> | null>(null);
  
  const { data: pipelines } = usePipelines();
  const createPipeline = useCreatePipeline();
  const updatePipeline = useUpdatePipeline();
  const deletePipeline = useDeletePipeline();

  const form = useForm<PipelineFormData>({
    resolver: zodResolver(pipelineSchema),
    defaultValues: {
      name: "",
      is_default: false,
    },
  });

  const onSubmit = async (data: PipelineFormData) => {
    if (editingPipeline) {
      await updatePipeline.mutateAsync({
        id: editingPipeline.id,
        name: data.name,
        is_default: data.is_default,
      });
    } else {
      await createPipeline.mutateAsync({
        name: data.name,
        is_default: data.is_default,
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
                {pipelines?.map((pipeline) => (
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
                      form.reset({ name: "", is_default: false });
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
