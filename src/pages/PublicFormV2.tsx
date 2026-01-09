import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { usePublicFormSchema } from "@/hooks/usePublicFormSchema";
import { FormField, FormSchema, FieldLogic, DEFAULT_FORM_SETTINGS, FormSettings } from "@/hooks/useForms";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RatingField, YesNoField, LongTextField, DateField, SelectField } from "@/components/forms/fields";
import { SinglePageFormView } from "@/components/forms/SinglePageFormView";
import { FormFileUpload, UploadedFile } from "@/components/forms/FormFileUpload";
import { FormProgressIndicator } from "@/components/forms/FormProgressIndicator";
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
  
  // Use public endpoint for non-preview mode (works without auth)
  const { data: publicFormData, isLoading: isLoadingForm } = usePublicFormSchema(isPreview ? undefined : formId);

  // Use prop schema for preview, or loaded form data from public endpoint
  const schema = propSchema || publicFormData?.schema;
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

      // Tratar erro de limite de submissões (pode vir no error do Supabase client)
      if (error) {
        // Tentar parsear o body do erro para verificar se é limite atingido
        try {
          const errorBody = typeof error.context?.body === 'string' 
            ? JSON.parse(error.context.body) 
            : error.context?.body;
          
          if (errorBody?.error === 'submission_limit_reached') {
            setSubmissionError({
              type: 'limit',
              message: errorBody.message || 'Você já preencheu este formulário anteriormente.'
            });
            return;
          }
        } catch (parseError) {
          // Se não conseguir parsear, continua para erro genérico
        }
        throw error;
      }
      
      // Check for submission limit error (caso venha no result com success=true)
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

  // Background gradient helper
  const getBackgroundStyle = (imageUrl?: string): React.CSSProperties => {
    if (imageUrl) {
      return { backgroundImage: `url(${imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" };
    }
    if (settings.background_gradient_enabled) {
      const from = settings.background_gradient_from || "#1a1a2e";
      const to = settings.background_gradient_to || "#0a0a0a";
      const dir = settings.background_gradient_direction || "to-b";
      const directionMap: Record<string, string> = {
        "to-b": "to bottom",
        "to-r": "to right",
        "to-br": "to bottom right",
        "to-bl": "to bottom left",
        "radial": "circle",
      };
      const gradient = dir === "radial" 
        ? `radial-gradient(${directionMap[dir]}, ${from}, ${to})`
        : `linear-gradient(${directionMap[dir]}, ${from}, ${to})`;
      return { background: gradient };
    }
    return { backgroundColor: settings.background_color };
  };

  // Card styles based on settings
  const cardOpacity = (settings.card_opacity ?? 90) / 100;
  const shadowIntensity = settings.card_shadow_intensity ?? 3;
  const shadowMap: Record<number, string> = {
    1: "0 2px 8px rgba(0,0,0,0.1)",
    2: "0 4px 16px rgba(0,0,0,0.15)",
    3: "0 8px 24px rgba(0,0,0,0.2)",
    4: "0 12px 32px rgba(0,0,0,0.25)",
    5: "0 16px 48px rgba(0,0,0,0.3)",
  };
  
  const cardStyles: React.CSSProperties = {
    backgroundColor: hexToRgba(settings.card_background_color || "#1a1a2e", cardOpacity),
    borderRadius: `${settings.border_radius ?? 16}px`,
    backdropFilter: cardOpacity < 1 ? "blur(12px)" : undefined,
    WebkitBackdropFilter: cardOpacity < 1 ? "blur(12px)" : undefined,
    boxShadow: settings.card_shadow !== false ? shadowMap[shadowIntensity] : undefined,
    border: settings.card_border_width && settings.card_border_color 
      ? `${settings.card_border_width}px solid ${settings.card_border_color}` 
      : undefined,
  };

  // Logo styles based on settings
  const logoSizeMap: Record<string, string> = {
    small: "h-6",
    medium: "h-10",
    large: "h-16",
  };
  const logoPositionClass: Record<string, string> = {
    left: "justify-start",
    center: "justify-center",
    right: "justify-end",
  };

  // Font family mapping
  const fontFamilyMap: Record<string, string> = {
    inter: "'Inter', sans-serif",
    poppins: "'Poppins', sans-serif",
    roboto: "'Roboto', sans-serif",
    montserrat: "'Montserrat', sans-serif",
    playfair: "'Playfair Display', serif",
    lato: "'Lato', sans-serif",
    raleway: "'Raleway', sans-serif",
    oswald: "'Oswald', sans-serif",
  };
  const fontFamily = fontFamilyMap[settings.font_family || "inter"];

  // Font weight mapping
  const fontWeightMap: Record<string, number> = {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  };
  const titleWeight = fontWeightMap[settings.title_weight || "bold"];
  const labelWeight = fontWeightMap[settings.label_weight || "bold"];
  const letterSpacing = `${settings.letter_spacing ?? 0}px`;
  const lineHeight = settings.line_height ?? 1.5;

  // Transition variants based on settings
  const transitionDuration = settings.transition_duration ?? 0.3;
  const getTransitionVariants = (type: string, dir: number) => {
    switch (type) {
      case "fade":
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        };
      case "zoom":
        return {
          initial: { opacity: 0, scale: 0.8 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 1.2 },
        };
      case "scale":
        return {
          initial: { opacity: 0, scale: 0.9 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.9 },
        };
      case "slide":
      default:
        return {
          initial: { opacity: 0, x: dir * 100 },
          animate: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: dir * -100 },
        };
    }
  };
  const transitionVariants = getTransitionVariants(settings.transition_type || "slide", direction);

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
  if (!isPreview && !publicFormData) {
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
        title={publicFormData?.title || formTitle || publicFormData?.name || formName}
        description={publicFormData?.description || formDescription}
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
        ...getBackgroundStyle(currentField?.image_url || settings.background_image),
        fontFamily,
      }}
    >
      {/* Header with Logo, Title, Description and Progress */}
      <header className="p-4 sm:p-6">
        <div className="max-w-2xl mx-auto">
          {settings.logo_url && (
            <div className={`flex ${logoPositionClass[settings.logo_position || "left"]} mb-4`}>
              <img 
                src={settings.logo_url} 
                alt="Logo" 
                className={`${logoSizeMap[settings.logo_size || "medium"]} object-contain`}
              />
            </div>
          )}
          {(publicFormData?.title || formTitle || publicFormData?.name || formName) && (
            <h1 
              className="mb-2 break-words whitespace-pre-wrap"
              style={{ 
                color: settings.title_color || settings.text_color,
                fontSize: `${settings.title_size ?? 24}px`,
                fontWeight: titleWeight,
                letterSpacing,
                lineHeight,
              }}
            >
              {publicFormData?.title || formTitle || publicFormData?.name || formName}
            </h1>
          )}
          {(publicFormData?.description || formDescription) && (
            <p 
              className="mb-4 break-words whitespace-pre-wrap"
              style={{ 
                color: settings.description_color || settings.text_color, 
                opacity: 0.7,
                fontSize: `${settings.description_size ?? 14}px`,
                letterSpacing,
                lineHeight,
              }}
            >
              {publicFormData?.description || formDescription}
            </p>
          )}
          {settings.show_progress_bar !== false && fields.length > 0 && settings.progress_position !== "bottom" && (
            <div className="mt-4">
              <FormProgressIndicator
                currentStep={currentIndex}
                totalSteps={fields.length}
                settings={settings}
              />
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
                initial={transitionVariants.initial}
                animate={transitionVariants.animate}
                exit={transitionVariants.exit}
                transition={{ duration: transitionDuration, ease: "easeInOut" }}
                style={{
                  ...cardStyles,
                  padding: `${settings.container_padding ?? 32}px`,
                }}
              >
                <div className="space-y-2" style={{ marginBottom: `${settings.field_gap ?? 24}px` }}>
                  <h1 
                    className="text-2xl sm:text-3xl lg:text-4xl"
                    style={{ 
                      color: settings.text_color,
                      fontWeight: labelWeight,
                      letterSpacing,
                      lineHeight,
                    }}
                  >
                    {currentField.label}
                    {currentField.required && (
                      <span className="text-red-400 ml-1">*</span>
                    )}
                  </h1>
                  {currentField.description && (
                    <p 
                      className="text-lg"
                      style={{ 
                        color: settings.text_color, 
                        opacity: 0.6,
                        letterSpacing,
                        lineHeight,
                      }}
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
          <motion.div
            whileHover={settings.hover_effect_enabled !== false ? { 
              scale: settings.hover_scale ?? 1.02,
              boxShadow: settings.hover_glow !== false ? `0 0 20px ${settings.button_color}50` : undefined,
            } : undefined}
            whileTap={settings.hover_effect_enabled !== false ? { scale: 0.98 } : undefined}
            transition={{ duration: 0.2 }}
            style={{ borderRadius: `${Math.min(settings.border_radius ?? 16, 12)}px` }}
          >
            <Button
              onClick={handleNext}
              disabled={currentField?.required && !answers[currentField?.id]}
              style={{ 
                backgroundColor: settings.button_color,
                color: settings.button_text_color,
                borderRadius: `${Math.min(settings.border_radius ?? 16, 12)}px`,
              }}
              className="px-8 py-6 text-lg font-semibold transition-all duration-200"
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
          </motion.div>
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

        {/* Bottom Progress Indicator */}
        {settings.show_progress_bar !== false && fields.length > 0 && settings.progress_position === "bottom" && (
          <div className="max-w-2xl mx-auto mt-6">
            <FormProgressIndicator
              currentStep={currentIndex}
              totalSteps={fields.length}
              settings={settings}
            />
          </div>
        )}
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
          {field.options?.map((option) => {
            const isSelected = value === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => onChange(option)}
                className={`w-full p-4 text-left rounded-lg transition-all ${
                  isSelected ? "" : "hover:opacity-80"
                }`}
                style={{
                  backgroundColor: isSelected 
                    ? (settings.selection_background_color || settings.button_color) 
                    : inputStyles.backgroundColor,
                  color: isSelected 
                    ? (settings.selection_text_color || settings.button_text_color) 
                    : inputStyles.color,
                  borderColor: isSelected 
                    ? (settings.selection_highlight_color || settings.button_color)
                    : inputStyles.borderColor,
                  borderWidth: isSelected ? `${settings.selection_border_width ?? 3}px` : '1px',
                  borderStyle: 'solid',
                }}
              >
                {option}
              </button>
            );
          })}
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
