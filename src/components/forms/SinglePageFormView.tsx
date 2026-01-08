import { useState } from "react";
import { motion } from "framer-motion";
import { FormField, FormSchema, FormSettings, DEFAULT_FORM_SETTINGS } from "@/hooks/useForms";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Check, Loader2, AlertCircle, CheckCircle2, ArrowRight, Send, Rocket, Star } from "lucide-react";
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
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [shakeFields, setShakeFields] = useState<Record<string, boolean>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Input styles
  const inputStyles: React.CSSProperties = {
    backgroundColor: settings.input_background_color || "#ffffff",
    color: settings.input_text_color || "#000000",
    borderColor: settings.input_border_color || "#e5e7eb",
  };

  // Validation helpers
  const validateField = (field: FormField, value: any): string | null => {
    if (field.required && !value) {
      return "Este campo é obrigatório";
    }
    if (field.type === "email" && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return "Email inválido";
      }
    }
    if (field.type === "phone" && value) {
      const phoneRegex = /^[\d\s\-\(\)]+$/;
      if (value.length < 8 || !phoneRegex.test(value)) {
        return "Telefone inválido";
      }
    }
    return null;
  };

  const getFieldValidationStatus = (fieldId: string): "valid" | "invalid" | "neutral" => {
    const field = fields.find(f => f.id === fieldId);
    if (!field || !settings.show_field_validation) return "neutral";
    if (!touched[fieldId]) return "neutral";
    
    const error = validateField(field, answers[fieldId]);
    if (error) return "invalid";
    if (answers[fieldId]) return "valid";
    return "neutral";
  };

  const updateAnswer = (fieldId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [fieldId]: value }));
    setTouched(prev => ({ ...prev, [fieldId]: true }));
    
    // Clear validation error when user types
    const field = fields.find(f => f.id === fieldId);
    if (field) {
      const error = validateField(field, value);
      setValidationErrors(prev => ({ ...prev, [fieldId]: error || "" }));
    }
  };

  const markFieldTouched = (fieldId: string) => {
    setTouched(prev => ({ ...prev, [fieldId]: true }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    let hasErrors = false;
    const newErrors: Record<string, string> = {};
    const newShakes: Record<string, boolean> = {};

    for (const field of fields) {
      const error = validateField(field, answers[field.id]);
      if (error) {
        hasErrors = true;
        newErrors[field.id] = error;
        if (settings.shake_on_error !== false) {
          newShakes[field.id] = true;
        }
      }
    }

    setValidationErrors(newErrors);
    setTouched(Object.fromEntries(fields.map(f => [f.id, true])));
    
    if (hasErrors) {
      setShakeFields(newShakes);
      // Reset shake after animation
      setTimeout(() => setShakeFields({}), 500);
      
      const firstErrorField = fields.find(f => newErrors[f.id]);
      toast({
        title: "Campo inválido",
        description: firstErrorField ? newErrors[firstErrorField.id] : "Corrija os erros antes de enviar.",
        variant: "destructive",
      });
      return;
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
  // In preview mode, we need overflow-y-auto to enable scrolling within the fixed-height container
  // In public mode (not preview, not embedded), use h-screen + overflow-y-auto to bypass global body overflow:hidden
  const containerClass = isPreview 
    ? "flex flex-col overflow-y-auto" 
    : (isEmbedded ? "" : "h-screen flex flex-col overflow-y-auto");
  
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
        ...getBackgroundStyle(settings.background_image),
        fontFamily,
      }}
    >
      {/* Header with Logo, Title, and Description */}
      <header className="p-4 sm:p-6">
        <div className="max-w-2xl mx-auto">
          {settings.logo_url && (
            <div className={`flex ${logoPositionClass[settings.logo_position || "left"]}`}>
              <img 
                src={settings.logo_url} 
                alt="Logo" 
                className={`${logoSizeMap[settings.logo_size || "medium"]} object-contain`}
              />
            </div>
          )}
          {title && (
            <h1 
              className="mt-4 break-words whitespace-pre-wrap"
              style={{ 
                color: settings.title_color || settings.text_color,
                fontSize: `${settings.title_size ?? 24}px`,
                fontWeight: titleWeight,
                letterSpacing,
                lineHeight,
              }}
            >
              {title}
            </h1>
          )}
          {description && (
            <p 
              className="mt-2 break-words whitespace-pre-wrap"
              style={{ 
                color: settings.description_color || settings.text_color, 
                opacity: 0.7,
                fontSize: `${settings.description_size ?? 14}px`,
                letterSpacing,
                lineHeight,
              }}
            >
              {description}
            </p>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className={`${isEmbedded || isPreview ? '' : 'flex-1'} flex items-start justify-center p-4 sm:p-6 pt-8`}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl"
          style={{
            ...cardStyles,
            padding: `${settings.container_padding ?? 32}px`,
          }}
        >
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: `${settings.field_gap ?? 24}px` }}>
            {fields.map((field, index) => {
              const stagger = (settings.entry_stagger ?? 50) / 1000;
              const getEntryAnimation = () => {
                switch (settings.entry_animation) {
                  case "none":
                    return { initial: { opacity: 1 }, y: 0, x: 0, scale: 1, rotateX: 0 };
                  case "fade-down":
                    return { initial: { opacity: 0, y: -20 }, y: 0 };
                  case "fade-left":
                    return { initial: { opacity: 0, x: -30 }, x: 0 };
                  case "fade-right":
                    return { initial: { opacity: 0, x: 30 }, x: 0 };
                  case "zoom-in":
                    return { initial: { opacity: 0, scale: 0.8 }, scale: 1 };
                  case "bounce":
                    return { initial: { opacity: 0, y: -30 }, y: 0 };
                  case "flip":
                    return { initial: { opacity: 0, rotateX: -90 }, rotateX: 0 };
                  case "fade-up":
                  default:
                    return { initial: { opacity: 0, y: 20 }, y: 0 };
                }
              };
              const anim = getEntryAnimation();
              const isBounce = settings.entry_animation === "bounce";
              
              const validationStatus = getFieldValidationStatus(field.id);
              const errorColor = settings.validation_error_color || "#ef4444";
              const successColor = settings.validation_success_color || "#22c55e";
              const isShaking = shakeFields[field.id];
              const fieldError = validationErrors[field.id];
              
              return (
              <motion.div
                key={field.id}
                initial={anim.initial}
                animate={{ 
                  opacity: 1, 
                  y: anim.y ?? 0, 
                  x: isShaking ? [0, -10, 10, -10, 10, 0] : (anim.x ?? 0), 
                  scale: anim.scale ?? 1, 
                  rotateX: anim.rotateX ?? 0 
                }}
                transition={isShaking 
                  ? { duration: 0.4, ease: "easeInOut" }
                  : isBounce 
                    ? { delay: index * stagger, type: "spring" as const, stiffness: 300, damping: 15 }
                    : { delay: index * stagger, duration: 0.4, ease: "easeOut" }
                }
                className="space-y-2"
              >
                <div className="flex items-center gap-2">
                  <Label 
                    className="text-base flex-1"
                    style={{ 
                      color: validationStatus === "invalid" ? errorColor : settings.text_color,
                      fontWeight: labelWeight,
                      letterSpacing,
                      lineHeight,
                    }}
                  >
                    {field.label}
                    {field.required && settings.show_required_asterisk !== false && (
                      <span style={{ color: errorColor }} className="ml-1">*</span>
                    )}
                  </Label>
                  {settings.show_field_validation !== false && validationStatus !== "neutral" && (
                    <motion.span
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    >
                      {validationStatus === "valid" ? (
                        <CheckCircle2 className="h-4 w-4" style={{ color: successColor }} />
                      ) : (
                        <AlertCircle className="h-4 w-4" style={{ color: errorColor }} />
                      )}
                    </motion.span>
                  )}
                </div>
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
                  onBlur={() => markFieldTouched(field.id)}
                  settings={settings}
                  inputStyles={inputStyles}
                  validationStatus={validationStatus}
                  errorColor={errorColor}
                  successColor={successColor}
                />
                {/* Validation Message */}
                {settings.validation_style === "prominent" && validationStatus === "invalid" && fieldError && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm flex items-center gap-1"
                    style={{ color: errorColor }}
                  >
                    {fieldError}
                  </motion.p>
                )}
              </motion.div>
              );
            })}

            <SubmitButton settings={settings} isSubmitting={isSubmitting} />
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
  onBlur?: () => void;
  settings: FormSettings;
  inputStyles: React.CSSProperties;
  validationStatus?: "valid" | "invalid" | "neutral";
  errorColor?: string;
  successColor?: string;
}

function FormFieldInput({ field, value, onChange, onBlur, settings, inputStyles, validationStatus, errorColor, successColor }: FormFieldInputProps) {
  const getValidationBorderColor = () => {
    if (!validationStatus || validationStatus === "neutral") return inputStyles.borderColor;
    return validationStatus === "valid" ? successColor : errorColor;
  };

  const validatedInputStyles: React.CSSProperties = {
    ...inputStyles,
    borderColor: getValidationBorderColor(),
    borderWidth: validationStatus && validationStatus !== "neutral" ? "2px" : "1px",
    transition: "border-color 0.2s, border-width 0.2s",
  };

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
          onBlur={onBlur}
          placeholder={field.placeholder}
          className="h-12"
          style={validatedInputStyles}
          required={field.required}
        />
      );

    case "long_text":
      return (
        <textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={field.placeholder}
          className="w-full min-h-[100px] p-3 rounded-lg border resize-none focus:outline-none focus:ring-2 focus:ring-primary break-all"
          style={validatedInputStyles}
          required={field.required}
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
                className={`w-full p-3 text-left rounded-lg transition-all ${
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

// Submit Button Component
interface SubmitButtonProps {
  settings: FormSettings;
  isSubmitting: boolean;
}

function SubmitButton({ settings, isSubmitting }: SubmitButtonProps) {
  const getButtonIcon = () => {
    if (isSubmitting) return <Loader2 className="h-5 w-5 animate-spin" />;
    switch (settings.button_icon) {
      case "check": return <Check className="h-5 w-5" />;
      case "arrow": return <ArrowRight className="h-5 w-5" />;
      case "send": return <Send className="h-5 w-5" />;
      case "rocket": return <Rocket className="h-5 w-5" />;
      case "star": return <Star className="h-5 w-5" />;
      default: return null;
    }
  };

  const sizeClasses = {
    small: "py-2 text-sm",
    medium: "py-4 text-base",
    large: "py-6 text-lg font-semibold",
  };

  const getButtonStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      borderRadius: `${settings.button_border_radius ?? 12}px`,
      color: settings.button_text_color || "#ffffff",
    };

    switch (settings.button_style) {
      case "outline":
        return {
          ...baseStyles,
          backgroundColor: "transparent",
          border: `${settings.button_border_width ?? 2}px solid ${settings.button_border_color || settings.button_color || "#2563EB"}`,
          color: settings.button_border_color || settings.button_color || "#2563EB",
        };
      case "gradient":
        return {
          ...baseStyles,
          background: `linear-gradient(135deg, ${settings.button_color || "#2563EB"}, ${settings.button_gradient_to || "#7c3aed"})`,
        };
      case "glass":
        return {
          ...baseStyles,
          backgroundColor: `${settings.button_color || "#2563EB"}30`,
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: `1px solid ${settings.button_color || "#2563EB"}50`,
        };
      default:
        return {
          ...baseStyles,
          backgroundColor: settings.button_color || "#2563EB",
        };
    }
  };

  const buttonStyles = getButtonStyles();
  
  if (settings.button_shadow !== false) {
    buttonStyles.boxShadow = `0 4px 14px ${settings.button_shadow_color || settings.button_color || "#2563EB"}40`;
  }

  const getHoverProps = () => {
    switch (settings.button_hover_effect) {
      case "scale":
        return { scale: 1.03 };
      case "glow":
        return { boxShadow: `0 0 25px ${settings.button_color || "#2563EB"}60` };
      case "lift":
        return { y: -3, boxShadow: `0 8px 20px ${settings.button_shadow_color || settings.button_color || "#2563EB"}50` };
      default:
        return {};
    }
  };

  const icon = getButtonIcon();
  const isRight = settings.button_icon_position === "right";

  return (
    <motion.div
      whileHover={settings.button_hover_effect !== "none" ? getHoverProps() : undefined}
      whileTap={settings.button_hover_effect !== "none" ? { scale: 0.98 } : undefined}
      transition={{ duration: 0.2 }}
      className="mt-8"
      style={{ borderRadius: `${settings.button_border_radius ?? 12}px` }}
    >
      <Button
        type="submit"
        disabled={isSubmitting}
        className={`${settings.button_full_width !== false ? "w-full" : "px-8"} ${sizeClasses[settings.button_size || "large"]} flex items-center justify-center gap-2 transition-all duration-200`}
        style={buttonStyles}
      >
        {icon && !isRight && icon}
        <span>{settings.button_text || "Enviar"}</span>
        {icon && isRight && icon}
      </Button>
    </motion.div>
  );
}
