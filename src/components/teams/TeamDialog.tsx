import { useEffect, useState } from "react";
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
import { useUsers } from "@/hooks/useUsers";
import { useTeams, useCreateTeam, useUpdateTeam } from "@/hooks/useTeams";
import { supabase } from "@/integrations/supabase/client";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  color: z.string().default("#3B82F6"),
  manager_id: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const COLORS = [
  "#2563EB", "#3B82F6", "#10B981", "#06B6D4", "#6366F1",
  "#8B5CF6", "#14B8A6", "#0EA5E9", "#0284C7", "#4F46E5",
];

interface TeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId?: string;
}

export default function TeamDialog({ open, onOpenChange, teamId }: TeamDialogProps) {
  const { data: users } = useUsers();
  const { data: teams } = useTeams();
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const [loading, setLoading] = useState(false);

  const team = teams?.find(t => t.id === teamId);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      color: "#3B82F6",
      manager_id: "",
    },
  });

  useEffect(() => {
    if (team) {
      form.reset({
        name: team.name,
        description: team.description || "",
        color: team.color || "#3B82F6",
        manager_id: team.manager_id || "",
      });
    } else {
      form.reset({
        name: "",
        description: "",
        color: "#3B82F6",
        manager_id: "",
      });
    }
  }, [team, form]);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const payload = {
        name: data.name,
        description: data.description || null,
        color: data.color,
        manager_id: data.manager_id || null,
      };

      if (teamId) {
        await updateTeam.mutateAsync({ id: teamId, ...payload });
      } else {
        await createTeam.mutateAsync(payload);
      }
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const managers = users?.filter(u => 
    ["admin", "manager", "support_manager", "cs_manager", "general_manager"].includes(u.role)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{teamId ? "Editar Time" : "Novo Time"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Time</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Suporte N1" {...field} />
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
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Descrição do time..." 
                      className="resize-none"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cor</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`w-8 h-8 rounded-full border-2 transition-all ${
                            field.value === color ? "border-foreground scale-110" : "border-transparent"
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => field.onChange(color)}
                        />
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="manager_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gestor (Opcional)</FormLabel>
                  <Select 
                    value={field.value || "none"} 
                    onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um gestor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {managers?.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : teamId ? "Salvar" : "Criar Time"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
