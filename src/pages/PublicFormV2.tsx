import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useForm } from "@/hooks/useForms";
import { FormField, FormSchema, FieldLogic, DEFAULT_FORM_SETTINGS } from "@/hooks/useForms";
import { useSubmitForm } from "@/hooks/useForms";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RatingField, YesNoField, LongTextField, DateField, SelectField } from "@/components/forms/fields";
import { ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PublicFormV2Props {
  formId?: string;
  schema?: FormSchema;
  isPreview?: boolean;
}

export default function PublicFormV2({ formId: propFormId, schema: propSchema, isPreview = false }: PublicFormV2Props) {
  const { formId: paramFormId } = useParams<{ formId: string }>();
  const formId = propFormId || paramFormId;
  
  const { data: formData, isLoading: isLoadingForm } = useForm(isPreview ? undefined : formId);
  const submitForm = useSubmitForm();

  // Use prop schema for preview, or loaded form data
  const schema = propSchema || formData?.schema;
  const settings = schema?.settings || DEFAULT_FORM_SETTINGS;
  const fields = schema?.fields || [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [direction, setDirection] = useState(1);

  const currentField = fields[currentIndex];
  const progress = fields.length > 0 ? ((currentIndex + 1) / fields.length) * 100 : 0;

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleNext();
      } else if (e.key === "Escape" && settings.allow_back_navigation !== false) {
        handleBack();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, answers, settings.allow_back_navigation]);

  // Evaluate conditional logic
  const evaluateCondition = useCallback((logic: FieldLogic, value: any): boolean => {
    const compareValue = String(value || "").toLowerCase();
    const targetValue = String(logic.value || "").toLowerCase();

    switch (logic.condition) {
      case "equals":
        return compareValue === targetValue;
      case "not_equals":
        return compareValue !== targetValue;
      case "contains":
        return compareValue.includes(targetValue);
      case "greater_than":
        return Number(value) > Number(logic.value);
      case "less_than":
        return Number(value) < Number(logic.value);
      default:
        return false;
    }
  }, []);

  // Find next field considering logic
  const findNextIndex = useCallback((fromIndex: number): number => {
    const currentField = fields[fromIndex];
    const currentAnswer = answers[currentField?.id];

    // Check if current field has logic that triggers
    if (currentField?.logic) {
      const shouldJump = evaluateCondition(currentField.logic, currentAnswer);
      if (shouldJump) {
        const jumpIndex = fields.findIndex(f => f.id === currentField.logic!.jump_to);
        if (jumpIndex !== -1) {
          return jumpIndex;
        }
      }
    }

    return fromIndex + 1;
  }, [fields, answers, evaluateCondition]);

  const handleNext = () => {
    if (!currentField) return;

    // Validate required fields
    if (currentField.required && !answers[currentField.id]) {
      return;
    }

    const nextIndex = findNextIndex(currentIndex);

    if (nextIndex >= fields.length) {
      handleSubmit();
    } else {
      setDirection(1);
      setCurrentIndex(nextIndex);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0 && settings.allow_back_navigation !== false) {
      setDirection(-1);
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSubmit = async () => {
    if (isPreview) {
      setIsSubmitted(true);
      return;
    }

    // Extract email and name fields
    const emailField = fields.find(f => f.type === "email");
    const nameFields = fields.filter(f => 
      f.type === "text" && 
      (f.label.toLowerCase().includes("nome") || f.label.toLowerCase().includes("name"))
    );

    const email = emailField ? answers[emailField.id] : "";
    const firstName = nameFields[0] ? answers[nameFields[0].id] : "Lead";
    const lastName = nameFields[1] ? answers[nameFields[1].id] : "Formulário";

    const phoneField = fields.find(f => f.type === "phone");
    const phone = phoneField ? answers[phoneField.id] : undefined;

    try {
      await submitForm.mutateAsync({
        email,
        first_name: firstName,
        last_name: lastName,
        phone,
      });
      setIsSubmitted(true);

      if (settings.redirect_url) {
        setTimeout(() => {
          window.location.href = settings.redirect_url!;
        }, 2000);
      }
    } catch (error) {
      // Error handled by mutation
    }
  };

  const updateAnswer = (value: any) => {
    if (!currentField) return;
    setAnswers(prev => ({ ...prev, [currentField.id]: value }));
  };

  // Loading state
  if (!isPreview && isLoadingForm) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: settings.background_color }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  // No form found
  if (!isPreview && !formData) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: settings.background_color }}
      >
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-2">Formulário não encontrado</h1>
          <p className="text-white/60">Este formulário pode ter sido desativado.</p>
        </div>
      </div>
    );
  }

  // Success screen
  if (isSubmitted) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-6"
        style={{ 
          backgroundColor: settings.background_color,
          backgroundImage: settings.background_image ? `url(${settings.background_image})` : undefined,
          backgroundSize: "cover",
        }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center max-w-md"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="h-20 w-20 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-6"
          >
            <Check className="h-10 w-10 text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold text-white mb-3">
            {settings.thank_you_title || "Obrigado!"}
          </h1>
          <p className="text-white/70 text-lg">
            {settings.thank_you_message || "Suas respostas foram enviadas com sucesso."}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex flex-col"
      style={{ 
        backgroundColor: settings.background_color,
        backgroundImage: currentField?.image_url 
          ? `url(${currentField.image_url})` 
          : settings.background_image 
            ? `url(${settings.background_image})` 
            : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Header with Logo and Progress */}
      <header className="p-4 sm:p-6">
        <div className="max-w-2xl mx-auto">
          {settings.logo_url && (
            <img 
              src={settings.logo_url} 
              alt="Logo" 
              className="h-8 sm:h-10 mb-4"
            />
          )}
          {settings.show_progress_bar !== false && fields.length > 0 && (
            <div className="space-y-2">
              <Progress value={progress} className="h-1" />
              <p className="text-xs text-white/50">
                {currentIndex + 1} de {fields.length}
              </p>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait" custom={direction}>
            {currentField && (
              <motion.div
                key={currentField.id}
                custom={direction}
                initial={{ opacity: 0, x: direction * 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -100 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="space-y-8"
              >
                {/* Question */}
                <div className="space-y-2">
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">
                    {currentField.label}
                    {currentField.required && (
                      <span className="text-red-400 ml-1">*</span>
                    )}
                  </h1>
                  {currentField.description && (
                    <p className="text-white/60 text-lg">
                      {currentField.description}
                    </p>
                  )}
                </div>

                {/* Input Field */}
                <div>
                  <FormFieldInput
                    field={currentField}
                    value={answers[currentField.id]}
                    onChange={updateAnswer}
                    settings={settings}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer with Navigation */}
      <footer className="p-4 sm:p-6">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          {/* Back Button */}
          <div>
            {currentIndex > 0 && settings.allow_back_navigation !== false && (
              <Button
                variant="ghost"
                onClick={handleBack}
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                <ChevronLeft className="h-5 w-5 mr-1" />
                Voltar
              </Button>
            )}
          </div>

          {/* Next/Submit Button */}
          <Button
            onClick={handleNext}
            disabled={currentField?.required && !answers[currentField?.id]}
            style={{ backgroundColor: settings.button_color }}
            className="px-8 py-6 text-lg font-semibold"
          >
            {currentIndex === fields.length - 1 ? (
              <>
                Enviar
                <Check className="h-5 w-5 ml-2" />
              </>
            ) : (
              <>
                {settings.button_text || "Continuar"}
                <ChevronRight className="h-5 w-5 ml-2" />
              </>
            )}
          </Button>
        </div>

        {/* Keyboard Hint */}
        <div className="max-w-2xl mx-auto mt-4 text-center">
          <p className="text-xs text-white/30">
            Pressione <kbd className="px-1 py-0.5 bg-white/10 rounded">Enter ↵</kbd> para avançar
            {settings.allow_back_navigation !== false && (
              <> ou <kbd className="px-1 py-0.5 bg-white/10 rounded">Esc</kbd> para voltar</>
            )}
          </p>
        </div>
      </footer>
    </div>
  );
}

// Field Input Component
interface FormFieldInputProps {
  field: FormField;
  value: any;
  onChange: (value: any) => void;
  settings: any;
}

function FormFieldInput({ field, value, onChange, settings }: FormFieldInputProps) {
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
          className="h-14 text-lg bg-white/5 border-white/20 text-white placeholder:text-white/40 focus:border-primary"
          autoFocus
        />
      );

    case "long_text":
      return (
        <LongTextField
          value={value || ""}
          onChange={onChange}
          placeholder={field.placeholder}
        />
      );

    case "select":
      return (
        <SelectField
          value={value}
          onChange={onChange}
          options={field.options || []}
        />
      );

    case "rating":
      return (
        <RatingField
          value={value}
          onChange={onChange}
          min={field.min ?? 0}
          max={field.max ?? 10}
        />
      );

    case "yes_no":
      return (
        <YesNoField
          value={value}
          onChange={onChange}
        />
      );

    case "date":
      return (
        <DateField
          value={value ? new Date(value) : null}
          onChange={(date) => onChange(date.toISOString())}
          placeholder={field.placeholder}
        />
      );

    default:
      return null;
  }
}
