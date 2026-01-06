import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Phone, Users, Mail, CheckSquare, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreateActivity } from "@/hooks/useCreateActivity";
import { useUpdateActivity } from "@/hooks/useUpdateActivity";
import { useAuth } from "@/hooks/useAuth";
import { useSalesReps } from "@/hooks/useSalesReps";
import type { Tables } from "@/integrations/supabase/types";

const activitySchema = z.object({
  type: z.enum(["call", "meeting", "email", "task", "lunch"]),
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().optional(),
  due_date: z.date({ required_error: "Data é obrigatória" }),
  due_time: z.string().min(1, "Hora é obrigatória"),
  assigned_to: z.string().min(1, "Responsável é obrigatório"),
});

type ActivityFormData = z.infer<typeof activitySchema>;

interface ActivityDialogProps {
  trigger: React.ReactNode;
  contactId?: string;
  dealId?: string;
  activity?: Tables<"activities">;
  onSuccess?: () => void;
}

const activityTypeIcons = {
  call: Phone,
  meeting: Users,
  email: Mail,
  task: CheckSquare,
  lunch: Utensils,
};

const activityTypeLabels = {
  call: "Ligação",
  meeting: "Reunião",
  email: "Email",
  task: "Tarefa",
  lunch: "Almoço",
};

export default function ActivityDialog({ trigger, contactId, dealId, activity, onSuccess }: ActivityDialogProps) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { data: salesReps } = useSalesReps();
  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();

  const form = useForm<ActivityFormData>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      type: activity?.type || "call",
      title: activity?.title || "",
      description: activity?.description || "",
      due_date: activity?.due_date ? new Date(activity.due_date) : undefined,
      due_time: activity?.due_date ? format(new Date(activity.due_date), "HH:mm") : "09:00",
      assigned_to: activity?.assigned_to || user?.id || "",
    },
  });

  const onSubmit = async (data: ActivityFormData) => {
    const [hours, minutes] = data.due_time.split(":");
    const dueDate = new Date(data.due_date);
    dueDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    if (activity) {
      await updateActivity.mutateAsync({
        id: activity.id,
        type: data.type,
        title: data.title,
        description: data.description,
        due_date: dueDate.toISOString(),
        assigned_to: data.assigned_to,
      });
    } else {
      await createActivity.mutateAsync({
        contact_id: contactId,
        deal_id: dealId,
        type: data.type,
        title: data.title,
        description: data.description,
        due_date: dueDate.toISOString(),
        assigned_to: data.assigned_to,
        created_by: user?.id,
      });
    }

    setOpen(false);
    form.reset();
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {activity ? "Editar Atividade" : "Nova Atividade"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Atividade</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(activityTypeLabels).map(([value, label]) => {
                        const Icon = activityTypeIcons[value as keyof typeof activityTypeIcons];
                        return (
                          <SelectItem key={value} value={value}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              <span>{label}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Ligar para cliente" {...field} />
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
                    <Textarea placeholder="Detalhes da atividade..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "dd/MM/yyyy", { locale: ptBR })
                            ) : (
                              <span>Selecionar</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="due_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hora</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="assigned_to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Atribuir para</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {salesReps?.map((rep) => (
                        <SelectItem key={rep.id} value={rep.id}>
                          {rep.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" className="flex-1">
                {activity ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
