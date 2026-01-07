import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useForm } from "@/hooks/useForms";
import { FormField, FormSchema, FieldLogic, DEFAULT_FORM_SETTINGS, FormSettings } from "@/hooks/useForms";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RatingField, YesNoField, LongTextField, DateField, SelectField } from "@/components/forms/fields";
import { SinglePageFormView } from "@/components/forms/SinglePageFormView";
import { FormFileUpload, UploadedFile } from "@/components/forms/FormFileUpload";
import { ChevronLeft, ChevronRight, Check, Loader2, AlertCircle } from "lucide-react";

// Helper to convert hex to rgba
function hexToRgba(hex: string, opacity: number = 1): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(26, 26, 46, ${opacity})`;
  return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
}

interface PublicFormV2Props {
  formId?: string;
  schema?: FormSchema;
  isPreview?: boolean;
  formName?: string;
  formTitle?: string;
  formDescription?: string;
  isEmbedded?: boolean;
}

export default function PublicFormV2({ formId: propFormId, schema: propSchema, isPreview = false, formName, formTitle, formDescription, isEmbedded = false }: PublicFormV2Props) {
  const { formId: paramFormId } = useParams<{ formId: string }>();
  const formId = propFormId || paramFormId;
  
  const { data: formData, isLoading: isLoadingForm } = useForm(isPreview ? undefined : formId);

  // Use prop schema for preview, or loaded form data
  const schema = propSchema || formData?.schema;
  const settings = { ...DEFAULT_FORM_SETTINGS, ...schema?.settings };
  const fields = schema?.fields || [];
  const displayMode = settings.display_mode || "conversational";

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [direction, setDirection] = useState(1);
  const [submissionError, setSubmissionError] = useState<{
    type: 'limit' | 'generic';
    message: string;
  } | null>(null);

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

    if (!formId) {
      console.error("Form ID not found");
      return;
    }

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
      
      // Check for submission limit error
      if (result?.error === 'submission_limit_reached') {
        setSubmissionError({
          type: 'limit',
          message: result.message || 'Você já preencheu este formulário o número máximo de vezes permitido.'
        });
        return;
      }
      
      if (!result?.success) throw new Error(result?.error || 'Erro ao processar formulário');

      setIsSubmitted(true);

      if (settings.redirect_url) {
        setTimeout(() => {
          window.location.href = settings.redirect_url!;
        }, 2000);
      }
    } catch (error: any) {
      console.error("Error submitting form:", error);
      setSubmissionError({
        type: 'generic',
        message: 'Ocorreu um erro ao enviar o formulário. Tente novamente.'
      });
    }
  };

  const updateAnswer = (value: any) => {
    if (!currentField) return;
    setAnswers(prev => ({ ...prev, [currentField.id]: value }));
  };

  // Card styles based on settings
  const cardOpacity = (settings.card_opacity ?? 90) / 100;
  const cardStyles: React.CSSProperties = {
    backgroundColor: hexToRgba(settings.card_background_color || "#1a1a2e", cardOpacity),
    borderRadius: `${settings.border_radius ?? 16}px`,
    backdropFilter: cardOpacity < 1 ? "blur(12px)" : undefined,
    WebkitBackdropFilter: cardOpacity < 1 ? "blur(12px)" : undefined,
  };

  // Input styles - FORCED HIGH CONTRAST
  const inputStyles: React.CSSProperties = {
    backgroundColor: settings.input_background_color || "#ffffff",
    color: settings.input_text_color || "#000000",
    borderColor: settings.input_border_color || "#e5e7eb",
  };

  // Loading state
  if (!isPreview && isLoadingForm) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: settings.background_color }}
      >
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: settings.text_color }} />
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
        <div className="text-center" style={{ color: settings.text_color }}>
          <h1 className="text-2xl font-bold mb-2">Formulário não encontrado</h1>
          <p style={{ opacity: 0.6 }}>Este formulário pode ter sido desativado.</p>
        </div>
      </div>
    );
  }

  // Submission limit reached screen
  if (submissionError?.type === 'limit') {
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
          className="text-center max-w-md p-8"
          style={cardStyles}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="h-20 w-20 rounded-full bg-amber-500 flex items-center justify-center mx-auto mb-6"
          >
            <AlertCircle className="h-10 w-10 text-white" />
          </motion.div>
          <h1 
            className="text-2xl font-bold mb-3"
            style={{ color: settings.text_color }}
          >
            Limite atingido
          </h1>
          <p 
            className="text-lg"
            style={{ color: settings.text_color, opacity: 0.7 }}
          >
            {submissionError.message}
          </p>
        </motion.div>
      </div>
    );
  }

  // Single Page Mode - render all fields at once
  if (displayMode === "single_page" && schema) {
    return (
      <SinglePageFormView 
        schema={schema} 
        formId={formId} 
        isPreview={isPreview}
        title={formData?.title || formTitle || formData?.name || formName}
        description={formData?.description || formDescription}
        isEmbedded={isEmbedded}
      />
    );
  }

  // Success screen (for conversational mode)
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

  // Conversational Mode (default) - one field at a time
  // In preview mode, content flows naturally - scroll is controlled by parent wrapper
  const containerClass = isPreview 
    ? "flex flex-col" 
    : (isEmbedded ? "" : "min-h-screen flex flex-col");

  return (
    <div 
      className={containerClass}
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
      {/* Header with Logo, Title, Description and Progress */}
      <header className="p-4 sm:p-6">
        <div className="max-w-2xl mx-auto">
          {settings.logo_url && (
            <img 
              src={settings.logo_url} 
              alt="Logo" 
              className="h-8 sm:h-10 mb-4"
            />
          )}
          {(formData?.title || formTitle || formData?.name || formName) && (
            <h1 
              className="text-xl sm:text-2xl font-bold mb-2 break-words whitespace-pre-wrap"
              style={{ color: settings.text_color }}
            >
              {formData?.title || formTitle || formData?.name || formName}
            </h1>
          )}
          {(formData?.description || formDescription) && (
            <p 
              className="text-sm mb-4 break-words whitespace-pre-wrap"
              style={{ color: settings.text_color, opacity: 0.7 }}
            >
              {formData?.description || formDescription}
            </p>
          )}
          {settings.show_progress_bar !== false && fields.length > 0 && (
            <div className="space-y-2">
              <Progress value={progress} className="h-1" />
              <p className="text-xs" style={{ color: settings.text_color, opacity: 0.5 }}>
                {currentIndex + 1} de {fields.length}
              </p>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className={`${isEmbedded ? '' : 'flex-1'} flex ${isEmbedded ? 'items-start' : 'items-center'} justify-center p-4 sm:p-6`}>
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
                className="p-6 sm:p-8"
                style={cardStyles}
              >
                {/* Question */}
                <div className="space-y-2 mb-8">
                  <h1 
                    className="text-2xl sm:text-3xl lg:text-4xl font-bold"
                    style={{ color: settings.text_color }}
                  >
                    {currentField.label}
                    {currentField.required && (
                      <span className="text-red-400 ml-1">*</span>
                    )}
                  </h1>
                  {currentField.description && (
                    <p 
                      className="text-lg"
                      style={{ color: settings.text_color, opacity: 0.6 }}
                    >
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
                    inputStyles={inputStyles}
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
                style={{ 
                  color: settings.text_color,
                  opacity: 0.7,
                }}
                className="hover:opacity-100"
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
            style={{ 
              backgroundColor: settings.button_color,
              color: settings.button_text_color,
              borderRadius: `${Math.min(settings.border_radius ?? 16, 12)}px`,
            }}
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
          <p 
            className="text-xs"
            style={{ color: settings.text_color, opacity: 0.3 }}
          >
            Pressione <kbd 
              className="px-1 py-0.5 rounded"
              style={{ backgroundColor: hexToRgba(settings.text_color || "#fff", 0.1) }}
            >Enter ↵</kbd> para avançar
            {settings.allow_back_navigation !== false && (
              <> ou <kbd 
                className="px-1 py-0.5 rounded"
                style={{ backgroundColor: hexToRgba(settings.text_color || "#fff", 0.1) }}
              >Esc</kbd> para voltar</>
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
          className="h-14 text-lg"
          style={inputStyles}
          autoFocus
        />
      );

    case "long_text":
      return (
        <textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="w-full min-h-[120px] p-4 text-lg rounded-lg border resize-none focus:outline-none focus:ring-2 focus:ring-primary break-all"
          style={inputStyles}
          autoFocus
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
              className={`w-full p-4 text-left rounded-lg border transition-all ${
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
        <div className="flex flex-wrap gap-2 justify-center">
          {Array.from({ length: (field.max ?? 10) - (field.min ?? 0) + 1 }, (_, i) => i + (field.min ?? 0)).map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => onChange(num)}
              className={`w-12 h-12 rounded-lg font-bold transition-all ${
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
        <div className="flex gap-4 justify-center">
          {["Sim", "Não"].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`px-8 py-4 rounded-lg font-semibold text-lg transition-all ${
                value === opt 
                  ? "ring-2 ring-primary" 
                  : "hover:opacity-80"
              }`}
              style={{
                backgroundColor: value === opt ? settings.button_color : inputStyles.backgroundColor,
                color: value === opt ? settings.button_text_color : inputStyles.color,
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      );

    case "date":
      return (
        <Input
          type="date"
          value={value ? value.split("T")[0] : ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-14 text-lg"
          style={inputStyles}
          autoFocus
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
      return null;
  }
}
