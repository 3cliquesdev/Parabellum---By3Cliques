import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateOrganization, useUpdateOrganization } from "@/hooks/useOrganizations";
import { useDepartments } from "@/hooks/useDepartments";
import type { Tables } from "@/integrations/supabase/types";

const organizationSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100),
  domain: z.string().max(100).optional().or(z.literal("")),
  default_department_id: z.string().optional().or(z.literal("")),
});

type OrganizationFormData = z.infer<typeof organizationSchema>;

interface OrganizationDialogProps {
  organization?: Tables<"organizations">;
  trigger: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
}

export default function OrganizationDialog({ organization, trigger, onOpenChange }: OrganizationDialogProps) {
  const [open, setOpen] = useState(false);
  const createOrganization = useCreateOrganization();
  const updateOrganization = useUpdateOrganization();
  const { data: departments = [] } = useDepartments({ activeOnly: true });

  const form = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: organization?.name || "",
      domain: organization?.domain || "",
      default_department_id: (organization as any)?.default_department_id || "none",
    },
  });

  useEffect(() => {
    if (organization) {
      form.reset({
        name: organization.name,
        domain: organization.domain || "",
        default_department_id: (organization as any)?.default_department_id || "none",
      });
    }
  }, [organization, form]);

  const onSubmit = async (data: OrganizationFormData) => {
    const payload = {
      name: data.name,
      domain: data.domain || null,
      default_department_id: data.default_department_id === "none" ? null : data.default_department_id || null,
    };

    if (organization) {
      await updateOrganization.mutateAsync({ id: organization.id, updates: payload });
    } else {
      await createOrganization.mutateAsync(payload);
    }

    setOpen(false);
    form.reset();
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {organization ? "Editar Organização" : "Nova Organização"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    Nome <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Corp" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="domain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Domínio (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="acme.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="default_department_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Departamento padrão (opcional)</FormLabel>
                  <Select value={field.value || ""} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhum" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dept.color }} />
                            <span>{dept.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createOrganization.isPending || updateOrganization.isPending}>
                {organization ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
