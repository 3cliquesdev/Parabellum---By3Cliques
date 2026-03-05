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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCreateContact, useUpdateContact } from "@/hooks/useContacts";
import { useUpsertContact } from "@/hooks/useUpsertContact";
import { useOrganizations } from "@/hooks/useOrganizations";
import { useSalesReps } from "@/hooks/useSalesReps";
import { useDepartments } from "@/hooks/useDepartments";
import { useProfiles } from "@/hooks/useProfiles";
import type { Tables } from "@/integrations/supabase/types";

const contactSchema = z.object({
  first_name: z.string().min(1, "Nome é obrigatório").max(100),
  last_name: z.string().min(1, "Sobrenome é obrigatório").max(100),
  email: z.string().email("E-mail inválido").max(255).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  document: z.string().max(18).optional().nullable(),
  birth_date: z.string().optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  address_number: z.string().max(10).optional().nullable(),
  address_complement: z.string().max(100).optional().nullable(),
  neighborhood: z.string().max(100).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(2).optional().nullable(),
  zip_code: z.string().max(9).optional().nullable(),
  organization_id: z.string().uuid().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  preferred_agent_id: z.string().uuid().optional().nullable(),
  preferred_department_id: z.string().uuid().optional().nullable(),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface ContactDialogProps {
  contact?: Tables<"contacts">;
  trigger: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
}

// Máscaras de formatação
const formatCPF = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 11) {
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

const formatPhone = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 10) {
    return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
};

const formatCEP = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  return numbers.replace(/(\d{5})(\d{3})/, '$1-$2');
};

export default function ContactDialog({ contact, trigger, onOpenChange }: ContactDialogProps) {
  const [open, setOpen] = useState(false);
  const updateContact = useUpdateContact();
  const upsertContact = useUpsertContact();
  const { data: organizations } = useOrganizations();
  const { data: salesReps, isLoading: salesRepsLoading } = useSalesReps();
  const { data: departments = [] } = useDepartments({ activeOnly: true });
  const { data: profiles = [] } = useProfiles();

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      first_name: contact?.first_name || "",
      last_name: contact?.last_name || "",
      email: contact?.email || "",
      phone: contact?.phone || "",
      document: contact?.document || "",
      birth_date: contact?.birth_date || "",
      address: contact?.address || "",
      address_number: contact?.address_number || "",
      address_complement: contact?.address_complement || "",
      neighborhood: contact?.neighborhood || "",
      city: contact?.city || "",
      state: contact?.state || "",
      zip_code: contact?.zip_code || "",
      organization_id: contact?.organization_id || "",
      assigned_to: (contact as any)?.assigned_to || "",
      preferred_agent_id: contact?.preferred_agent_id || "",
      preferred_department_id: contact?.preferred_department_id || "",
    },
  });

  useEffect(() => {
    if (contact) {
      form.reset({
        first_name: contact.first_name,
        last_name: contact.last_name,
        email: contact.email || "",
        phone: contact.phone || "",
        document: contact.document || "",
        birth_date: contact.birth_date || "",
        address: contact.address || "",
        address_number: contact.address_number || "",
        address_complement: contact.address_complement || "",
        neighborhood: contact.neighborhood || "",
        city: contact.city || "",
        state: contact.state || "",
        zip_code: contact.zip_code || "",
        organization_id: contact.organization_id || "",
        assigned_to: (contact as any)?.assigned_to || "",
        preferred_agent_id: contact.preferred_agent_id || "",
        preferred_department_id: contact.preferred_department_id || "",
      });
    }
  }, [contact, form]);

  const onSubmit = async (data: ContactFormData) => {
    if (contact) {
      const payload = {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email || null,
        phone: data.phone || null,
        document: data.document || null,
        birth_date: data.birth_date || null,
        address: data.address || null,
        address_number: data.address_number || null,
        address_complement: data.address_complement || null,
        neighborhood: data.neighborhood || null,
        city: data.city || null,
        state: data.state || null,
        zip_code: data.zip_code || null,
        organization_id: data.organization_id || null,
        assigned_to: data.assigned_to || null,
        preferred_agent_id: data.preferred_agent_id || null,
        preferred_department_id: data.preferred_department_id || null,
      };
      await updateContact.mutateAsync({ id: contact.id, updates: payload });
    } else {
      if (!data.email) {
        form.setError("email", {
          type: "manual",
          message: "Email é obrigatório para criar novo contato",
        });
        return;
      }

      const upsertPayload = {
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone || undefined,
        organization_id: data.organization_id || undefined,
        assigned_to: data.assigned_to || undefined,
        source: 'manual' as const,
      };
      await upsertContact.mutateAsync(upsertPayload);
    }

    setOpen(false);
    form.reset();
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {contact ? "Editar Contato" : "Novo Contato"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* DADOS BÁSICOS */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b pb-2">📋 DADOS BÁSICOS</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        Nome <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="João" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        Sobrenome <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Silva" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        E-mail
                        {!contact && <span className="text-destructive ml-1">*</span>}
                      </FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="joao@exemplo.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="(11) 98765-4321" 
                          {...field}
                          onChange={(e) => {
                            const formatted = formatPhone(e.target.value);
                            field.onChange(formatted);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="document"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF/CNPJ</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="000.000.000-00" 
                          {...field}
                          onChange={(e) => {
                            const formatted = formatCPF(e.target.value);
                            field.onChange(formatted);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="birth_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Nascimento</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* ENDEREÇO */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b pb-2">📍 ENDEREÇO</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="zip_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEP</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="00000-000" 
                          {...field}
                          onChange={(e) => {
                            const formatted = formatCEP(e.target.value);
                            field.onChange(formatted);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rua</FormLabel>
                      <FormControl>
                        <Input placeholder="Av. Paulista" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="address_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número</FormLabel>
                      <FormControl>
                        <Input placeholder="1000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address_complement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Complemento</FormLabel>
                      <FormControl>
                        <Input placeholder="Apto 101" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="neighborhood"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bairro</FormLabel>
                      <FormControl>
                        <Input placeholder="Bela Vista" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade</FormLabel>
                      <FormControl>
                        <Input placeholder="São Paulo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UF</FormLabel>
                      <FormControl>
                        <Input placeholder="SP" maxLength={2} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* ASSOCIAÇÕES */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b pb-2">🏢 ASSOCIAÇÕES</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="organization_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organização</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma organização" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {organizations?.map((org) => (
                            <SelectItem key={org.id} value={org.id}>
                              {org.name}
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
                  name="assigned_to"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Responsável</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={salesRepsLoading ? "Carregando..." : "Selecione um responsável"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {salesReps && salesReps.length > 0 ? (
                            salesReps.map((rep) => (
                              <SelectItem key={rep.id} value={rep.id}>
                                {rep.full_name} {rep.job_title && `(${rep.job_title})`}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-data" disabled>
                              {salesRepsLoading ? "Carregando..." : "Nenhum responsável disponível"}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* ROTEAMENTO PREFERENCIAL */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="preferred_department_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Departamento preferido</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Nenhum" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
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
                <FormField
                  control={form.control}
                  name="preferred_agent_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Atendente preferido</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Nenhum" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {profiles.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={upsertContact.isPending || updateContact.isPending}>
                {contact ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
