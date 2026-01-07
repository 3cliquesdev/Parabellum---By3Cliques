import { useState } from "react";
import { motion } from "framer-motion";
import { FormField, FormSchema, FormSettings, DEFAULT_FORM_SETTINGS } from "@/hooks/useForms";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Check, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FormFileUpload } from "@/components/forms/FormFileUpload";

// Helper to convert hex to rgba
function hexToRgba(hex: string, opacity: number = 1): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(26, 26, 46, ${opacity})`;
  return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
}

interface SinglePageFormViewProps {
  schema: FormSchema;
  formId?: string;
  isPreview?: boolean;
  title?: string;
  description?: string;
  isEmbedded?: boolean;
}

export function SinglePageFormView({ schema, formId, isPreview = false, title, description, isEmbedded = false }: SinglePageFormViewProps) {
  const { toast } = useToast();
  const settings = { ...DEFAULT_FORM_SETTINGS, ...schema?.settings };
  const fields = schema?.fields || [];

  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Card styles based on settings
  const cardOpacity = (settings.card_opacity ?? 90) / 100;
  const cardStyles: React.CSSProperties = {
    backgroundColor: hexToRgba(settings.card_background_color || "#1a1a2e", cardOpacity),
    borderRadius: `${settings.border_radius ?? 16}px`,
    backdropFilter: cardOpacity < 1 ? "blur(12px)" : undefined,
    WebkitBackdropFilter: cardOpacity < 1 ? "blur(12px)" : undefined,
  };

  // Input styles
  const inputStyles: React.CSSProperties = {
    backgroundColor: settings.input_background_color || "#ffffff",
    color: settings.input_text_color || "#000000",
    borderColor: settings.input_border_color || "#e5e7eb",
  };

  const updateAnswer = (fieldId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    for (const field of fields) {
      if (field.required && !answers[field.id]) {
        toast({
          title: "Campo obrigatório",
          description: `O campo "${field.label}" é obrigatório.`,
          variant: "destructive",
        });
        return;
      }
    }

    if (isPreview) {
      setIsSubmitted(true);
      return;
    }

    if (!formId) {
      toast({
        title: "Erro",
        description: "ID do formulário não encontrado.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Build responses object mapping field_id to value
      const responses: Record<string, any> = {};
      for (const field of fields) {
        responses[field.id] = answers[field.id] || null;
      }

      const { data: result, error } = await supabase.functions.invoke('form-submit-v3', {
        body: {
          form_id: formId,
          responses,
        },
      });

      if (error) throw error;
      if (!result?.success) throw new Error(result?.error || 'Erro ao processar formulário');

      setIsSubmitted(true);

      toast({
        title: "Formulário enviado!",
        description: "Suas respostas foram recebidas com sucesso.",
      });

      if (settings.redirect_url) {
        setTimeout(() => {
          window.location.href = settings.redirect_url!;
        }, 2000);
      }
    } catch (error: any) {
      console.error("Error submitting form:", error);
      toast({
        title: "Erro ao enviar formulário",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success screen
  // In preview mode, use h-full to fit within parent container with scroll
  const containerClass = isPreview ? "flex flex-col h-full" : (isEmbedded ? "" : "min-h-screen flex flex-col");
  
  if (isSubmitted) {
    return (
      <div 
        className={isEmbedded ? "h-full flex items-center justify-center p-6" : "min-h-screen flex items-center justify-center p-6"}
        style={{
          backgroundColor: settings.background_color,
          backgroundImage: settings.background_image ? `url(${settings.background_image})` : undefined,
          backgroundSize: "cover",
        }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center max-w-md p-8"
          style={cardStyles}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="h-20 w-20 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-6"
          >
            <Check className="h-10 w-10 text-white" />
          </motion.div>
          <h1 
            className="text-3xl font-bold mb-3"
            style={{ color: settings.text_color }}
          >
            {settings.thank_you_title || "Obrigado!"}
          </h1>
          <p 
            className="text-lg"
            style={{ color: settings.text_color, opacity: 0.7 }}
          >
            {settings.thank_you_message || "Suas respostas foram enviadas com sucesso."}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div 
      className={containerClass}
      style={{ 
        backgroundColor: settings.background_color,
        backgroundImage: settings.background_image ? `url(${settings.background_image})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Header with Logo, Title, and Description */}
      <header className="p-4 sm:p-6">
        <div className="max-w-2xl mx-auto">
          {settings.logo_url && (
            <img 
              src={settings.logo_url} 
              alt="Logo" 
              className="h-8 sm:h-10"
            />
          )}
          {title && (
            <h1 
              className="text-2xl sm:text-3xl font-bold mt-4 break-words whitespace-pre-wrap"
              style={{ color: settings.text_color }}
            >
              {title}
            </h1>
          )}
          {description && (
            <p 
              className="text-base mt-2 break-words whitespace-pre-wrap"
              style={{ color: settings.text_color, opacity: 0.7 }}
            >
              {description}
            </p>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className={`${isEmbedded ? '' : 'flex-1'} flex items-start justify-center p-4 sm:p-6 pt-8`}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl p-6 sm:p-8"
          style={cardStyles}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {fields.map((field, index) => (
              <motion.div
                key={field.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="space-y-2"
              >
                <Label 
                  className="text-base font-medium"
                  style={{ color: settings.text_color }}
                >
                  {field.label}
                  {field.required && (
                    <span className="text-red-400 ml-1">*</span>
                  )}
                </Label>
                {field.description && (
                  <p 
                    className="text-sm"
                    style={{ color: settings.text_color, opacity: 0.6 }}
                  >
                    {field.description}
                  </p>
                )}
                <FormFieldInput
                  field={field}
                  value={answers[field.id]}
                  onChange={(value) => updateAnswer(field.id, value)}
                  settings={settings}
                  inputStyles={inputStyles}
                />
              </motion.div>
            ))}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-6 text-lg font-semibold mt-8"
              style={{ 
                backgroundColor: settings.button_color,
                color: settings.button_text_color,
                borderRadius: `${Math.min(settings.border_radius ?? 16, 12)}px`,
              }}
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Check className="h-5 w-5 mr-2" />
              )}
              Enviar
            </Button>
          </form>
        </motion.div>
      </main>
    </div>
  );
}

// Field Input Component
interface FormFieldInputProps {
  field: FormField;
  value: any;
  onChange: (value: any) => void;
  settings: FormSettings;
  inputStyles: React.CSSProperties;
}

function FormFieldInput({ field, value, onChange, settings, inputStyles }: FormFieldInputProps) {
  switch (field.type) {
    case "text":
    case "email":
    case "phone":
    case "number":
      return (
        <Input
          type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : field.type === "number" ? "number" : "text"}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="h-12"
          style={inputStyles}
          required={field.required}
        />
      );

    case "long_text":
      return (
        <textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="w-full min-h-[100px] p-3 rounded-lg border resize-none focus:outline-none focus:ring-2 focus:ring-primary break-all"
          style={inputStyles}
          required={field.required}
        />
      );

    case "select":
      return (
        <div className="space-y-2">
          {field.options?.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`w-full p-3 text-left rounded-lg border transition-all ${
                value === option 
                  ? "ring-2 ring-primary" 
                  : "hover:border-primary/50"
              }`}
              style={{
                ...inputStyles,
                borderColor: value === option 
                  ? settings.button_color 
                  : inputStyles.borderColor,
              }}
            >
              {option}
            </button>
          ))}
        </div>
      );

    case "rating":
      return (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: (field.max ?? 10) - (field.min ?? 0) + 1 }, (_, i) => i + (field.min ?? 0)).map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => onChange(num)}
              className={`w-10 h-10 rounded-lg font-bold transition-all ${
                value === num 
                  ? "ring-2 ring-primary" 
                  : "hover:opacity-80"
              }`}
              style={{
                backgroundColor: value === num ? settings.button_color : inputStyles.backgroundColor,
                color: value === num ? settings.button_text_color : inputStyles.color,
              }}
            >
              {num}
            </button>
          ))}
        </div>
      );

    case "yes_no":
      return (
        <div className="flex gap-3">
          {["Sim", "Não"].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`flex-1 p-3 rounded-lg font-medium transition-all ${
                value === option 
                  ? "ring-2 ring-primary" 
                  : "hover:opacity-80"
              }`}
              style={{
                backgroundColor: value === option ? settings.button_color : inputStyles.backgroundColor,
                color: value === option ? settings.button_text_color : inputStyles.color,
              }}
            >
              {option}
            </button>
          ))}
        </div>
      );

    case "date":
      return (
        <Input
          type="date"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-12"
          style={inputStyles}
          required={field.required}
        />
      );

    case "file":
      return (
        <FormFileUpload
          value={value || []}
          onChange={onChange}
          accept={field.accept || "image/*,.pdf"}
          maxSizeMb={field.max_size_mb || 10}
          maxFiles={field.max_files || 5}
          inputStyles={inputStyles}
          settings={settings}
        />
      );

    default:
      return (
        <Input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="h-12"
          style={inputStyles}
          required={field.required}
        />
      );
  }
}
