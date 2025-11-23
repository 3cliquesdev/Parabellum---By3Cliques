import { useParams } from "react-router-dom";
import { useForm as useReactHookForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm, useSubmitForm } from "@/hooks/useForms";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";

export default function PublicForm() {
  const { formId } = useParams<{ formId: string }>();
  const { data: formData, isLoading } = useForm(formId);
  const submitForm = useSubmitForm();
  const [submitted, setSubmitted] = useState(false);

  // Build dynamic schema based on form fields
  const buildSchema = () => {
    if (!formData) return z.object({});

    const schemaFields: any = {};
    
    formData.schema.fields.forEach((field) => {
      let validator: any;

      switch (field.type) {
        case "email":
          validator = z.string().email("E-mail inválido");
          break;
        case "phone":
          validator = z.string().min(1, "Telefone é obrigatório");
          break;
        default:
          validator = z.string();
      }

      if (field.required) {
        validator = validator.min(1, `${field.label} é obrigatório`);
      } else {
        validator = validator.optional().or(z.literal(""));
      }

      schemaFields[field.id] = validator;
    });

    return z.object(schemaFields);
  };

  const formHook = useReactHookForm({
    resolver: zodResolver(buildSchema()),
    defaultValues: formData?.schema.fields.reduce((acc, field) => {
      acc[field.id] = "";
      return acc;
    }, {} as any) || {},
  });

  const onSubmit = async (data: any) => {
    // Map form data to contact fields
    const submission: any = {
      first_name: data[formData?.schema.fields.find(f => f.label.toLowerCase().includes("nome"))?.id || ""] || "Lead",
      last_name: data[formData?.schema.fields.find(f => f.label.toLowerCase().includes("sobrenome"))?.id || ""] || "Formulário",
    };

    // Find email and phone fields
    const emailField = formData?.schema.fields.find(f => f.type === "email");
    const phoneField = formData?.schema.fields.find(f => f.type === "phone");

    if (emailField && data[emailField.id]) {
      submission.email = data[emailField.id];
    }
    if (phoneField && data[phoneField.id]) {
      submission.phone = data[phoneField.id];
    }

    await submitForm.mutateAsync(submission);
    setSubmitted(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#22c55e]"></div>
      </div>
    );
  }

  if (!formData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-12 text-center">
            <p className="text-[#999999]">Formulário não encontrado</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-12 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-[#22c55e] mx-auto" />
            <h2 className="text-2xl font-bold text-white">Formulário enviado!</h2>
            <p className="text-[#999999]">
              Obrigado pelo seu interesse. Entraremos em contato em breve.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>{formData.name}</CardTitle>
          {formData.description && (
            <CardDescription>{formData.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <Form {...formHook}>
            <form onSubmit={formHook.handleSubmit(onSubmit)} className="space-y-4">
              {formData.schema.fields.map((field) => (
                <FormField
                  key={field.id}
                  control={formHook.control}
                  name={field.id}
                  render={({ field: formField }) => (
                    <FormItem>
                      <FormLabel>
                        {field.label}
                        {field.required && <span className="text-destructive ml-1">*</span>}
                      </FormLabel>
                      <FormControl>
                        {field.type === "select" && field.options ? (
                          <Select
                            onValueChange={formField.onChange}
                            value={formField.value}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={field.placeholder || "Selecione"} />
                            </SelectTrigger>
                            <SelectContent>
                              {field.options.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
                            placeholder={field.placeholder || ""}
                            {...formField}
                          />
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              <Button type="submit" className="w-full" disabled={submitForm.isPending}>
                {submitForm.isPending ? "Enviando..." : "Enviar"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
