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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useCreateForm, useUpdateForm, type FormSchema } from "@/hooks/useForms";
import FormBuilder from "./FormBuilder";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100),
  description: z.string().max(500).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface FormDialogProps {
  form?: any;
  trigger: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
}

export default function FormDialog({ form: existingForm, trigger, onOpenChange }: FormDialogProps) {
  const [open, setOpen] = useState(false);
  const [schema, setSchema] = useState<FormSchema>(
    existingForm?.schema || { fields: [] }
  );
  const createForm = useCreateForm();
  const updateForm = useUpdateForm();

  const formHook = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: existingForm?.name || "",
      description: existingForm?.description || "",
    },
  });

  useEffect(() => {
    if (existingForm) {
      formHook.reset({
        name: existingForm.name,
        description: existingForm.description || "",
      });
      setSchema(existingForm.schema);
    }
  }, [existingForm, formHook]);

  const onSubmit = async (data: FormData) => {
    const payload = {
      name: data.name,
      description: data.description,
      schema,
    };

    if (existingForm) {
      await updateForm.mutateAsync({ id: existingForm.id, updates: payload });
    } else {
      await createForm.mutateAsync(payload);
    }

    setOpen(false);
    formHook.reset();
    setSchema({ fields: [] });
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingForm ? "Editar Formulário" : "Novo Formulário"}
          </DialogTitle>
        </DialogHeader>
        <Form {...formHook}>
          <form onSubmit={formHook.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={formHook.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Formulário</FormLabel>
                  <FormControl>
                    <Input placeholder="Formulário de Contato" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={formHook.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Breve descrição do formulário"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormBuilder schema={schema} onChange={setSchema} />

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createForm.isPending || updateForm.isPending}
              >
                {existingForm ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
