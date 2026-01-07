import { User, Mail, Phone } from "lucide-react";
import { PremiumInput } from "@/components/ui/premium-input";
import { StepProps } from "../types";
import { validateEmail, validatePhoneBR, formatPhoneBR } from "@/lib/validators";

export function Step1PersonalData({ data, onChange, errors }: StepProps) {
  const handleWhatsAppChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneBR(e.target.value);
    onChange("whatsapp", formatted);
  };

  const emailValidation = data.email ? validateEmail(data.email) : null;
  const phoneValidation = data.whatsapp ? validatePhoneBR(data.whatsapp) : null;

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Vamos começar!
        </h2>
        <p className="text-muted-foreground">
          Preencha seus dados para iniciarmos sua jornada
        </p>
      </div>

      <PremiumInput
        label="Nome completo"
        icon={User}
        value={data.name || ""}
        onChange={(e) => onChange("name", e.target.value)}
        error={errors.name}
        success={!!data.name && data.name.length >= 3}
        placeholder="Digite seu nome completo"
      />

      <PremiumInput
        label="E-mail"
        type="email"
        icon={Mail}
        value={data.email || ""}
        onChange={(e) => onChange("email", e.target.value)}
        error={errors.email || (emailValidation && !emailValidation.valid ? emailValidation.message : undefined)}
        success={emailValidation?.valid}
        placeholder="seu@email.com"
      />

      <PremiumInput
        label="WhatsApp"
        type="tel"
        icon={Phone}
        value={data.whatsapp || ""}
        onChange={handleWhatsAppChange}
        error={errors.whatsapp || (phoneValidation && !phoneValidation.valid ? phoneValidation.message : undefined)}
        success={phoneValidation?.valid}
        placeholder="(11) 99999-9999"
        hint="Usaremos para entrar em contato com você"
      />
    </div>
  );
}
