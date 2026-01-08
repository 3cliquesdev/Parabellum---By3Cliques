import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateProjectBoard, useProjectBoardTemplates } from "@/hooks/useProjectBoards";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  template_id: z.string().optional(),
  due_date: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface CreateBoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDealId?: string;
  defaultContactId?: string;
  defaultOrganizationId?: string;
  defaultName?: string;
}

export function CreateBoardDialog({
  open,
  onOpenChange,
  defaultDealId,
  defaultContactId,
  defaultOrganizationId,
  defaultName,
}: CreateBoardDialogProps) {
  const navigate = useNavigate();
  const { data: templates, isLoading: loadingTemplates } = useProjectBoardTemplates();
  const createBoard = useCreateProjectBoard();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: defaultName || "",
      description: "",
      template_id: "none",
      due_date: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    const board = await createBoard.mutateAsync({
      name: data.name,
      description: data.description,
      template_id: data.template_id === "none" ? undefined : data.template_id,
      due_date: data.due_date || undefined,
      deal_id: defaultDealId,
      contact_id: defaultContactId,
      organization_id: defaultOrganizationId,
    });

    onOpenChange(false);
    form.reset();
    navigate(`/projects/${board.id}`);
  };

  // Find default template
  const defaultTemplate = templates?.find((t) => t.is_default);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Projeto</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Projeto</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Loja Maria Silva" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva o projeto..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="template_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={loadingTemplates}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um template" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Sem template</SelectItem>
                      {templates?.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                          {template.is_default && " (Padrão)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prazo (opcional)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createBoard.isPending}>
                {createBoard.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Criar Projeto
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
