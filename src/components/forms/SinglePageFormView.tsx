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
              
              return (
              <motion.div
                key={field.id}
                initial={anim.initial}
                animate={{ opacity: 1, y: anim.y ?? 0, x: anim.x ?? 0, scale: anim.scale ?? 1, rotateX: anim.rotateX ?? 0 }}
                transition={isBounce 
                  ? { delay: index * stagger, type: "spring" as const, stiffness: 300, damping: 15 }
                  : { delay: index * stagger, duration: 0.4, ease: "easeOut" }
                }
                className="space-y-2"
              >
                <Label 
                  className="text-base"
                  style={{ 
                    color: settings.text_color,
                    fontWeight: labelWeight,
                    letterSpacing,
                    lineHeight,
                  }}
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
              );
            })}

            <motion.div
              whileHover={settings.hover_effect_enabled !== false ? { 
                scale: settings.hover_scale ?? 1.02,
                boxShadow: settings.hover_glow !== false ? `0 0 20px ${settings.button_color}50` : undefined,
              } : undefined}
              whileTap={settings.hover_effect_enabled !== false ? { scale: 0.98 } : undefined}
              transition={{ duration: 0.2 }}
              className="mt-8"
              style={{ borderRadius: `${Math.min(settings.border_radius ?? 16, 12)}px` }}
            >
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-6 text-lg font-semibold transition-all duration-200"
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
            </motion.div>
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
