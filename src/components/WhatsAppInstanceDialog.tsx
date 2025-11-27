import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
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
import { Button } from "@/components/ui/button";
import { useCreateWhatsAppInstance, useUpdateWhatsAppInstance } from "@/hooks/useWhatsAppInstances";
import { useDepartments } from "@/hooks/useDepartments";
import { useConsultants } from "@/hooks/useConsultants";

const formSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  instance_name: z.string().min(3, "Nome da instância deve ter pelo menos 3 caracteres"),
  api_url: z.string().url("URL inválida"),
  api_token: z.string().min(10, "Token inválido"),
  ai_mode: z.enum(["autopilot", "copilot", "disabled"]),
  department_id: z.string().optional(),
  user_id: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface WhatsAppInstanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance?: any;
}

export function WhatsAppInstanceDialog({
  open,
  onOpenChange,
  instance,
}: WhatsAppInstanceDialogProps) {
  const createMutation = useCreateWhatsAppInstance();
  const updateMutation = useUpdateWhatsAppInstance();
  const { data: departments } = useDepartments();
  const { data: consultants } = useConsultants();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: instance ? {
      name: instance.name,
      instance_name: instance.instance_name,
      api_url: instance.api_url,
      api_token: instance.api_token,
      ai_mode: instance.ai_mode,
      department_id: instance.department_id || undefined,
      user_id: instance.user_id || undefined,
    } : {
      name: "",
      instance_name: "",
      api_url: "",
      api_token: "",
      ai_mode: "autopilot",
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      if (instance) {
        await updateMutation.mutateAsync({ id: instance.id, ...data });
      } else {
        await createMutation.mutateAsync(data as any);
      }
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error("Error saving instance:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {instance ? "Editar Instância WhatsApp" : "Nova Instância WhatsApp"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Instância</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: WhatsApp Suporte" {...field} />
                  </FormControl>
                  <FormDescription>
                    Nome descritivo para identificar esta instância
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="instance_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Técnico (Evolution API)</FormLabel>
                  <FormControl>
                    <Input placeholder="suporte_whatsapp" {...field} />
                  </FormControl>
                  <FormDescription>
                    Nome único usado na Evolution API (sem espaços)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="api_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL da Evolution API</FormLabel>
                  <FormControl>
                    <Input placeholder="https://api.evolution.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="api_token"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Token</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Token de autenticação" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ai_mode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modo de IA</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o modo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="autopilot">
                        🤖 Autopilot - IA responde automaticamente
                      </SelectItem>
                      <SelectItem value="copilot">
                        🤝 Copilot - IA sugere, humano aprova
                      </SelectItem>
                      <SelectItem value="disabled">
                        ⛔ Desabilitado - Somente humano
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="department_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Departamento (Opcional)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um departamento" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">Nenhum (Geral)</SelectItem>
                      {departments?.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Vincular instância a um departamento específico
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="user_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Consultor (Opcional)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um consultor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">Nenhum (Número Geral)</SelectItem>
                      {consultants?.map((consultant) => (
                        <SelectItem key={consultant.id} value={consultant.id}>
                          {consultant.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Se preenchido, conversas serão atribuídas automaticamente a este consultor
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {instance ? "Atualizar" : "Criar Instância"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
