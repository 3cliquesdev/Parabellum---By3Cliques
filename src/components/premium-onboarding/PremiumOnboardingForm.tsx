import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2, Shield, User, Brain, Smartphone, Store, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { validateEmail, validatePhoneBR } from "@/lib/validators";

import { OnboardingFormData } from "./types";
import { OnboardingProgressBar } from "./OnboardingProgressBar";
import { OnboardingSuccessModal } from "./OnboardingSuccessModal";
import { Step1PersonalData } from "./steps/Step1PersonalData";
import { Step2Knowledge } from "./steps/Step2Knowledge";
import { Step3Devices } from "./steps/Step3Devices";
import { Step4Experience } from "./steps/Step4Experience";
import { Step5Formalization } from "./steps/Step5Formalization";

const STEPS = [
  { id: 1, title: "Dados", icon: User },
  { id: 2, title: "Conhecimento", icon: Brain },
  { id: 3, title: "Dispositivos", icon: Smartphone },
  { id: 4, title: "Experiência", icon: Store },
  { id: 5, title: "Formalização", icon: FileCheck },
];

const initialFormData: OnboardingFormData = {
  name: "",
  email: "",
  whatsapp: "",
  knowledge_it: 0,
  knowledge_internet: 0,
  main_device: "",
  social_networks: [],
  has_online_store: null,
  dropshipping_experience: "",
  platform_used: "",
  formalization: "",
  investment_budget: "",
};

export function PremiumOnboardingForm() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<OnboardingFormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof OnboardingFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleChange = (field: keyof OnboardingFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user types
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<Record<keyof OnboardingFormData, string>> = {};

    if (step === 1) {
      if (!formData.name || formData.name.length < 3) {
        newErrors.name = "Nome deve ter pelo menos 3 caracteres";
      }
      if (!formData.email) {
        newErrors.email = "E-mail é obrigatório";
      } else if (!validateEmail(formData.email).valid) {
        newErrors.email = "E-mail inválido";
      }
      if (!formData.whatsapp) {
        newErrors.whatsapp = "WhatsApp é obrigatório";
      } else if (!validatePhoneBR(formData.whatsapp).valid) {
        newErrors.whatsapp = "WhatsApp inválido";
      }
    }

    if (step === 3) {
      if (!formData.main_device) {
        newErrors.main_device = "Selecione um dispositivo";
      }
    }

    if (step === 4) {
      if (formData.has_online_store === null) {
        newErrors.has_online_store = "Selecione uma opção";
      }
      if (!formData.dropshipping_experience) {
        newErrors.dropshipping_experience = "Selecione uma opção";
      }
    }

    if (step === 5) {
      if (!formData.formalization) {
        newErrors.formalization = "Selecione uma opção";
      }
      if (!formData.investment_budget) {
        newErrors.investment_budget = "Selecione uma faixa de investimento";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < STEPS.length) {
        setCurrentStep((prev) => prev + 1);
      } else {
        handleSubmit();
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("onboarding_submissions").insert({
        name: formData.name,
        email: formData.email,
        whatsapp: formData.whatsapp,
        knowledge_it: formData.knowledge_it,
        knowledge_internet: formData.knowledge_internet,
        main_device: formData.main_device,
        social_networks: formData.social_networks,
        has_online_store: formData.has_online_store,
        dropshipping_experience: formData.dropshipping_experience,
        platform_used: formData.platform_used || null,
        formalization: formData.formalization,
        investment_budget: formData.investment_budget,
      });

      if (error) throw error;

      setShowSuccess(true);
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error("Erro ao enviar formulário. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    setFormData(initialFormData);
    setCurrentStep(1);
  };

  const renderStep = () => {
    const stepProps = { data: formData, onChange: handleChange, errors };

    switch (currentStep) {
      case 1:
        return <Step1PersonalData {...stepProps} />;
      case 2:
        return <Step2Knowledge {...stepProps} />;
      case 3:
        return <Step3Devices {...stepProps} />;
      case 4:
        return <Step4Experience {...stepProps} />;
      case 5:
        return <Step5Formalization {...stepProps} />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-background">
      {/* Header with Progress */}
      <div className="bg-card border-b border-border px-4 py-3 sm:px-6">
        <OnboardingProgressBar steps={STEPS} currentStep={currentStep} />
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Footer with Navigation */}
      <div className="bg-card border-t border-border px-4 py-4 sm:px-6">
        <div className="max-w-xl mx-auto space-y-4">
          {/* Navigation Buttons */}
          <div className="flex gap-3">
            {currentStep > 1 && (
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isSubmitting}
                className="h-14 px-6 rounded-xl"
              >
                <ChevronLeft className="h-5 w-5 mr-1" />
                Voltar
              </Button>
            )}

            <Button
              onClick={handleNext}
              disabled={isSubmitting}
              className={cn(
                "flex-1 h-14 text-lg font-semibold rounded-xl",
                "bg-gradient-to-r from-primary to-primary/80",
                "hover:from-primary/90 hover:to-primary/70",
                "transition-all duration-300"
              )}
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : currentStep === STEPS.length ? (
                "Enviar"
              ) : (
                <>
                  Próximo
                  <ChevronRight className="h-5 w-5 ml-1" />
                </>
              )}
            </Button>
          </div>

          {/* LGPD Text */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-4 w-4 text-emerald-600" />
            <span>
              Seus dados estão protegidos conforme a{" "}
              <span className="font-medium">LGPD</span>
            </span>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <OnboardingSuccessModal isOpen={showSuccess} onClose={handleSuccessClose} />
    </div>
  );
}
