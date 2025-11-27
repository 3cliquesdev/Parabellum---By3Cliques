import { useEffect } from "react";
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
import { useUsers } from "@/hooks/useUsers";

const formSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  instance_name: z.string().min(3, "Nome da instância deve ter pelo menos 3 caracteres"),
  api_url: z.string()
    .url("URL inválida")
    .refine((url) => {
      try {
        const hostname = new URL(url).hostname;
        // Validar que o domínio tem pelo menos um ponto (TLD)
        // Exemplos válidos: example.com, api.evolution.com
        // Exemplos inválidos: localhost, cloudfy (sem extensão)
        const parts = hostname.split('.');
        return parts.length >= 2 && parts[parts.length - 1].length >= 2;
      } catch {
        return false;
      }
    }, "Domínio inválido. Use formato: https://dominio.com (com extensão como .com, .net, etc)"),
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
  const { data: users, isLoading: usersLoading } = useUsers();

  console.log('[WhatsAppInstanceDialog] Users data:', users);
  console.log('[WhatsAppInstanceDialog] Users loading:', usersLoading);
  console.log('[WhatsAppInstanceDialog] Instance:', instance);

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: "Admin",
      manager: "Gerente",
      sales_rep: "Vendedor",
      consultant: "Consultor",
      support_agent: "Suporte",
    };
    return labels[role] || role;
  };

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      instance_name: "",
      api_url: "",
      api_token: "",
      ai_mode: "autopilot",
      department_id: "__none__",
      user_id: "__none__",
    },
  });

  // Reinicializar formulário quando instance ou open mudar
  useEffect(() => {
    if (open && instance) {
      console.log('[WhatsAppInstanceDialog] Reinicializando form com instance:', instance);
      form.reset({
        name: instance.name,
        instance_name: instance.instance_name,
        api_url: instance.api_url,
        api_token: instance.api_token,
        ai_mode: instance.ai_mode,
        department_id: instance.department_id || "__none__",
        user_id: instance.user_id || "__none__",
      });
    } else if (open && !instance) {
      console.log('[WhatsAppInstanceDialog] Reinicializando form para nova instância');
      form.reset({
        name: "",
        instance_name: "",
        api_url: "",
        api_token: "",
        ai_mode: "autopilot",
        department_id: "__none__",
        user_id: "__none__",
      });
    }
  }, [open, instance, form]);

  const onSubmit = async (data: FormData) => {
    console.log('[WhatsAppInstanceDialog] Submitting data:', data);
    try {
      const payload = {
        ...data,
        department_id: data.department_id === "__none__" ? null : data.department_id,
        user_id: data.user_id === "__none__" ? null : data.user_id,
      };
      
      if (instance) {
        await updateMutation.mutateAsync({ id: instance.id, ...payload });
      } else {
        await createMutation.mutateAsync(payload as any);
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
                  {field.value && (
                    <div className="mt-2 p-2 bg-muted/50 rounded text-xs space-y-1">
                      <p className="text-muted-foreground">🔧 Tentando conectar em:</p>
                      <code className="text-foreground font-mono break-all block">
                        {field.value}
                      </code>
                      {(() => {
                        try {
                          const url = new URL(field.value);
                          const hostname = url.hostname;
                          const parts = hostname.split('.');
                          
                          if (parts.length < 2 || parts[parts.length - 1].length < 2) {
                            return (
                              <p className="text-red-600 dark:text-red-400 font-medium">
                                ❌ Erro: Domínio incompleto "{hostname}". 
                                Adicione a extensão correta (exemplo: {hostname}.com)
                              </p>
                            );
                          }
                        } catch (e) {
                          return (
                            <p className="text-red-600 dark:text-red-400 font-medium">
                              ❌ URL inválida
                            </p>
                          );
                        }
                        return null;
                      })()}
                      {field.value.startsWith('http:') && window.location.protocol === 'https:' && (
                        <p className="text-red-600 dark:text-red-400 font-medium">
                          ⚠️ Atenção: Você está usando HTTP em um site HTTPS. Isso será bloqueado pelo navegador (Mixed Content).
                        </p>
                      )}
                      {field.value.includes('localhost') && (
                        <p className="text-yellow-600 dark:text-yellow-400 font-medium">
                          ⚠️ Localhost detectado. Isso só funciona em desenvolvimento local.
                        </p>
                      )}
                    </div>
                  )}
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
                      <SelectItem value="__none__">Nenhum (Geral)</SelectItem>
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
                  <FormLabel>Atribuir ao Usuário (Dono do Número)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o dono" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhum (Número Geral)</SelectItem>
                      {usersLoading && (
                        <SelectItem value="__loading__" disabled>
                          Carregando usuários...
                        </SelectItem>
                      )}
                      {users?.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name || user.email} ({getRoleLabel(user.role)})
                        </SelectItem>
                      ))}
                      {!usersLoading && (!users || users.length === 0) && (
                        <SelectItem value="__empty__" disabled>
                          Nenhum usuário encontrado
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Mensagens recebidas serão atribuídas diretamente a este usuário. Deixe vazio para roteamento geral.
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
