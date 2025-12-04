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
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCreateEmailTemplate } from "@/hooks/useCreateEmailTemplate";
import { useUpdateEmailTemplate } from "@/hooks/useUpdateEmailTemplate";
import type { Tables } from "@/integrations/supabase/types";
import { Copy, Mail, Briefcase, User, Building2, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const AVAILABLE_VARIABLES = {
  customer: [
    { key: "[CUSTOMER_FIRST_NAME]", description: "Nome do cliente" },
    { key: "[CUSTOMER_LAST_NAME]", description: "Sobrenome do cliente" },
    { key: "[CUSTOMER_FULL_NAME]", description: "Nome completo do cliente" },
    { key: "[CUSTOMER_EMAIL]", description: "Email do cliente" },
    { key: "[CUSTOMER_PHONE]", description: "Telefone do cliente" },
    { key: "[CUSTOMER_COMPANY]", description: "Empresa do cliente" },
    { key: "[CUSTOMER_STATUS]", description: "Status do cliente" },
  ],
  deal: [
    { key: "[DEAL_TITLE]", description: "Título do negócio" },
    { key: "[DEAL_VALUE]", description: "Valor do negócio" },
    { key: "[DEAL_CURRENCY]", description: "Moeda do negócio" },
    { key: "[DEAL_STATUS]", description: "Status do negócio" },
    { key: "[DEAL_PROBABILITY]", description: "Probabilidade do negócio" },
  ],
  sales_rep: [
    { key: "[SALES_REP_NAME]", description: "Nome do vendedor" },
    { key: "[SALES_REP_EMAIL]", description: "Email do vendedor" },
    { key: "[SALES_REP_JOB_TITLE]", description: "Cargo do vendedor" },
  ],
  organization: [
    { key: "[ORGANIZATION_NAME]", description: "Nome da organização" },
    { key: "[ORGANIZATION_DOMAIN]", description: "Domínio da organização" },
  ],
  contextual: [
    { key: "[CURRENT_DATE]", description: "Data atual" },
    { key: "[CURRENT_TIME]", description: "Hora atual" },
    { key: "[CURRENT_YEAR]", description: "Ano atual" },
  ],
};

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  subject: z.string().min(1, "Assunto é obrigatório"),
  html_body: z.string().min(1, "Corpo do email é obrigatório"),
  trigger_type: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

interface EmailTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: Tables<"email_templates">;
}

export function EmailTemplateDialog({
  open,
  onOpenChange,
  template,
}: EmailTemplateDialogProps) {
  const createMutation = useCreateEmailTemplate();
  const updateMutation = useUpdateEmailTemplate();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      subject: "",
      html_body: "",
      trigger_type: null,
      is_active: true,
    },
  });

  useEffect(() => {
    if (template) {
      form.reset({
        name: template.name,
        subject: template.subject,
        html_body: template.html_body,
        trigger_type: template.trigger_type,
        is_active: template.is_active,
      });
    } else {
      form.reset({
        name: "",
        subject: "",
        html_body: "",
        trigger_type: null,
        is_active: true,
      });
    }
  }, [template, form, open]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: `${text} copiado para área de transferência`,
    });
  };

  const onSubmit = async (data: FormValues) => {
    try {
      // Extract variables from html_body using new format [VARIABLE]
      const variableRegex = /\[([A-Z_]+)\]/g;
      const matches = data.html_body.matchAll(variableRegex);
      const variables = Array.from(matches, m => m[1]);

      if (template) {
        await updateMutation.mutateAsync({
          id: template.id,
          name: data.name,
          subject: data.subject,
          html_body: data.html_body,
          trigger_type: data.trigger_type,
          is_active: data.is_active,
          variables: variables,
        });
      } else {
        await createMutation.mutateAsync({
          name: data.name,
          subject: data.subject,
          html_body: data.html_body,
          trigger_type: data.trigger_type,
          is_active: data.is_active,
          variables: variables,
          design_json: null,
        });
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Error submitting template:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0 flex flex-col">
        <div className="flex flex-1 min-h-0">
          {/* Main Form Area */}
          <div className="flex-1 overflow-y-auto p-6">
            <DialogHeader>
              <DialogTitle>
                {template ? "Editar Template de Email" : "Novo Template de Email"}
              </DialogTitle>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Template</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Boas-vindas ao Cliente" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assunto</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Bem-vindo à nossa plataforma!" {...field} />
                      </FormControl>
                      <FormDescription>
                        Use variáveis como: [CUSTOMER_FIRST_NAME], [DEAL_VALUE], etc.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="html_body"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Corpo do Email (HTML)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="<h1>Olá [CUSTOMER_FIRST_NAME]</h1>..."
                          className="min-h-[300px] font-mono text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Escreva o conteúdo do email em HTML. Consulte o painel lateral para ver todas as variáveis disponíveis.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="trigger_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Gatilho (Opcional)</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um gatilho" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="deal_won">Negócio Ganho</SelectItem>
                          <SelectItem value="deal_created">Negócio Criado</SelectItem>
                          <SelectItem value="deal_lost">Negócio Perdido</SelectItem>
                          <SelectItem value="contact_created">Contato Criado</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Associe este template a um gatilho específico para uso automático
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Template Ativo
                        </FormLabel>
                        <FormDescription>
                          Templates inativos não estarão disponíveis para uso
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-3 pt-4">
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
                    {template ? "Salvar Alterações" : "Criar Template"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>

          {/* Variables Sidebar Panel */}
          <div className="w-80 border-l bg-muted/30 p-6 overflow-y-auto max-h-full">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-2">Parâmetros Disponíveis</h3>
                <p className="text-xs text-muted-foreground">
                  Clique para copiar e cole no template
                </p>
              </div>

              <div className="space-y-6">
                {/* Customer Variables */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Mail className="h-4 w-4 text-primary" />
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                      Dados do Cliente
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {AVAILABLE_VARIABLES.customer.map((variable) => (
                      <button
                        key={variable.key}
                        type="button"
                        onClick={() => copyToClipboard(variable.key)}
                        className="w-full flex items-center justify-between p-2 rounded-md hover:bg-accent text-left group transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono text-primary truncate">
                            {variable.key}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {variable.description}
                          </p>
                        </div>
                        <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Deal Variables */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Briefcase className="h-4 w-4 text-primary" />
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                      Dados do Negócio
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {AVAILABLE_VARIABLES.deal.map((variable) => (
                      <button
                        key={variable.key}
                        type="button"
                        onClick={() => copyToClipboard(variable.key)}
                        className="w-full flex items-center justify-between p-2 rounded-md hover:bg-accent text-left group transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono text-primary truncate">
                            {variable.key}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {variable.description}
                          </p>
                        </div>
                        <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sales Rep Variables */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <User className="h-4 w-4 text-primary" />
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                      Dados do Vendedor
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {AVAILABLE_VARIABLES.sales_rep.map((variable) => (
                      <button
                        key={variable.key}
                        type="button"
                        onClick={() => copyToClipboard(variable.key)}
                        className="w-full flex items-center justify-between p-2 rounded-md hover:bg-accent text-left group transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono text-primary truncate">
                            {variable.key}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {variable.description}
                          </p>
                        </div>
                        <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Organization Variables */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="h-4 w-4 text-primary" />
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                      Dados da Organização
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {AVAILABLE_VARIABLES.organization.map((variable) => (
                      <button
                        key={variable.key}
                        type="button"
                        onClick={() => copyToClipboard(variable.key)}
                        className="w-full flex items-center justify-between p-2 rounded-md hover:bg-accent text-left group transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono text-primary truncate">
                            {variable.key}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {variable.description}
                          </p>
                        </div>
                        <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Contextual Variables */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="h-4 w-4 text-primary" />
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                      Dados Contextuais
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {AVAILABLE_VARIABLES.contextual.map((variable) => (
                      <button
                        key={variable.key}
                        type="button"
                        onClick={() => copyToClipboard(variable.key)}
                        className="w-full flex items-center justify-between p-2 rounded-md hover:bg-accent text-left group transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono text-primary truncate">
                            {variable.key}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {variable.description}
                          </p>
                        </div>
                        <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
