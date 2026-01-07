import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle,
  Send,
  Check,
  MessageCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FormField {
  id: string;
  type: string;
  label: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
}

interface FormStepCardProps {
  step: {
    id: string;
    step_name: string;
    position: number;
    completed: boolean;
    is_critical: boolean;
    form_id?: string;
  };
  stepNumber: number;
  totalSteps: number;
  contactId: string;
  customerName: string;
  supportPhone: string;
  saving: boolean;
  onFormSubmit: () => void;
}

const EMOJIS = ["😡", "😠", "😤", "😞", "😐", "🙂", "😊", "😃", "😄", "🤩", "🥳"];

export function FormStepCard({
  step,
  stepNumber,
  totalSteps,
  contactId,
  customerName,
  supportPhone,
  saving,
  onFormSubmit,
}: FormStepCardProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<any>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);

  useEffect(() => {
    if (step.form_id) {
      fetchForm();
    }
  }, [step.form_id]);

  const fetchForm = async () => {
    if (!step.form_id) return;

    try {
      const { data, error } = await supabase
        .from("forms")
        .select("*")
        .eq("id", step.form_id)
        .single();

      if (error) throw error;

      setForm(data);
      const schema = data.schema as any;
      setFields(schema?.fields || []);
    } catch (err) {
      console.error("Error fetching form:", err);
      toast({
        title: "Erro ao carregar formulário",
        description: "Não foi possível carregar o formulário. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    // Validate required fields
    const missingFields = fields.filter(
      (f) => f.required && !answers[f.id]
    );

    if (missingFields.length > 0) {
      toast({
        title: "Campos obrigatórios",
        description: `Por favor, preencha: ${missingFields.map((f) => f.label).join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      // Build responses
      const responses: Record<string, any> = {};
      for (const field of fields) {
        responses[field.id] = answers[field.id] || null;
      }

      // Submit form via edge function
      const { data: result, error } = await supabase.functions.invoke("form-submit-v3", {
        body: {
          form_id: step.form_id,
          responses,
          contact_id: contactId, // Pass contact_id so the function knows who submitted
        },
      });

      if (error) throw error;

      // Mark step as completed
      await supabase
        .from("customer_journey_steps")
        .update({
          completed: true,
          completed_at: new Date().toISOString(),
        })
        .eq("id", step.id);

      toast({
        title: "Formulário enviado! 🎉",
        description: "Suas respostas foram salvas com sucesso.",
      });

      onFormSubmit();
    } catch (err) {
      console.error("Error submitting form:", err);
      toast({
        title: "Erro ao enviar",
        description: "Não foi possível enviar o formulário. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const whatsappUrl = `https://wa.me/${supportPhone}?text=${encodeURIComponent(
    `Olá! Sou ${customerName} e preciso de ajuda com o formulário "${step.step_name}" do meu onboarding.`
  )}`;

  const renderField = (field: FormField) => {
    switch (field.type) {
      case "text":
      case "email":
      case "phone":
        return (
          <Input
            type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
            placeholder={field.placeholder || field.label}
            value={answers[field.id] || ""}
            onChange={(e) => setAnswers({ ...answers, [field.id]: e.target.value })}
            className="bg-white/5 border-border focus:border-primary"
          />
        );

      case "long_text":
        return (
          <Textarea
            placeholder={field.placeholder || "Escreva sua resposta..."}
            value={answers[field.id] || ""}
            onChange={(e) => setAnswers({ ...answers, [field.id]: e.target.value })}
            rows={4}
            className="resize-none bg-white/5 border-border focus:border-primary"
          />
        );

      case "select":
        return (
          <div className="space-y-2">
            {(field.options || []).map((option, index) => (
              <motion.button
                key={option}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setAnswers({ ...answers, [field.id]: option })}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all",
                  answers[field.id] === option
                    ? "bg-primary text-primary-foreground ring-2 ring-primary/50"
                    : "bg-white/5 hover:bg-white/10 border border-border"
                )}
              >
                <span className="flex-shrink-0 h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center font-mono text-sm">
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="flex-1">{option}</span>
                {answers[field.id] === option && (
                  <Check className="h-5 w-5 flex-shrink-0" />
                )}
              </motion.button>
            ))}
          </div>
        );

      case "yes_no":
        return (
          <div className="flex gap-4">
            {["Sim", "Não"].map((option) => (
              <motion.button
                key={option}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setAnswers({ ...answers, [field.id]: option })}
                className={cn(
                  "flex-1 p-4 rounded-xl font-medium transition-all",
                  answers[field.id] === option
                    ? option === "Sim"
                      ? "bg-emerald-500 text-white"
                      : "bg-red-500 text-white"
                    : "bg-white/5 hover:bg-white/10 border border-border"
                )}
              >
                {option}
              </motion.button>
            ))}
          </div>
        );

      case "rating":
        const min = field.min || 0;
        const max = field.max || 10;
        const numbers = Array.from({ length: max - min + 1 }, (_, i) => min + i);
        const displayValue = hoveredRating ?? answers[field.id];

        const getColor = (num: number) => {
          const normalizedValue = (num - min) / (max - min);
          if (normalizedValue <= 0.3) return "bg-red-500 hover:bg-red-400";
          if (normalizedValue <= 0.6) return "bg-yellow-500 hover:bg-yellow-400";
          return "bg-green-500 hover:bg-green-400";
        };

        return (
          <div className="space-y-4">
            <div className="flex justify-center">
              <motion.div
                key={displayValue}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-5xl"
              >
                {displayValue != null ? EMOJIS[Math.min(displayValue, EMOJIS.length - 1)] : "🤔"}
              </motion.div>
            </div>
            <div className="flex justify-center gap-2 flex-wrap">
              {numbers.map((num) => (
                <motion.button
                  key={num}
                  type="button"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onMouseEnter={() => setHoveredRating(num)}
                  onMouseLeave={() => setHoveredRating(null)}
                  onClick={() => setAnswers({ ...answers, [field.id]: num })}
                  className={cn(
                    "h-10 w-10 rounded-full text-sm font-bold transition-colors",
                    answers[field.id] === num
                      ? `${getColor(num)} ring-2 ring-offset-2 ring-offset-background ring-white`
                      : "bg-muted hover:bg-muted/80"
                  )}
                >
                  {num}
                </motion.button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Nada provável</span>
              <span>Muito provável</span>
            </div>
          </div>
        );

      default:
        return (
          <Input
            placeholder={field.placeholder || field.label}
            value={answers[field.id] || ""}
            onChange={(e) => setAnswers({ ...answers, [field.id]: e.target.value })}
            className="bg-white/5 border-border"
          />
        );
    }
  };

  if (loading) {
    return (
      <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl shadow-xl border-white/20">
        <CardContent className="py-16 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Carregando formulário...</p>
        </CardContent>
      </Card>
    );
  }

  if (!form) {
    return (
      <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl shadow-xl border-white/20">
        <CardContent className="py-16 flex flex-col items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-destructive mb-4" />
          <p className="text-muted-foreground">Formulário não encontrado</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl shadow-xl border-white/20 overflow-hidden">
      {/* Header */}
      <CardHeader className="bg-gradient-to-r from-primary/5 to-emerald-500/5 border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
              step.completed 
                ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600" 
                : "bg-primary/10 text-primary"
            )}>
              {step.completed ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <FileText className="w-6 h-6" />
              )}
            </div>
            <div>
              <CardTitle className="text-xl mb-1">{step.step_name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Etapa {stepNumber} de {totalSteps}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <FileText className="w-3 h-3" />
              Formulário
            </Badge>
            {step.completed && (
              <Badge className="bg-emerald-500 gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Enviado
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {step.completed ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center py-8"
          >
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Formulário Enviado!</h3>
            <p className="text-muted-foreground text-center">
              Obrigado por preencher o formulário. Você pode continuar para a próxima etapa.
            </p>
          </motion.div>
        ) : (
          <>
            {/* Form Description */}
            {form.description && (
              <p className="text-muted-foreground">{form.description}</p>
            )}

            {/* Fields */}
            <div className="space-y-8">
              {fields.map((field, index) => (
                <motion.div
                  key={field.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="space-y-3"
                >
                  <label className="block">
                    <span className="text-lg font-medium">
                      {field.label}
                      {field.required && <span className="text-destructive ml-1">*</span>}
                    </span>
                    {field.description && (
                      <span className="block text-sm text-muted-foreground mt-1">
                        {field.description}
                      </span>
                    )}
                  </label>
                  {renderField(field)}
                </motion.div>
              ))}
            </div>

            {/* Submit Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="pt-4"
            >
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-6 text-lg bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Enviar Respostas
                  </>
                )}
              </Button>
            </motion.div>
          </>
        )}

        {/* WhatsApp Help */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors text-sm font-medium"
          >
            <MessageCircle className="w-4 h-4" />
            Precisa de ajuda? Fale conosco no WhatsApp
          </a>
        </motion.div>
      </CardContent>
    </Card>
  );
}
