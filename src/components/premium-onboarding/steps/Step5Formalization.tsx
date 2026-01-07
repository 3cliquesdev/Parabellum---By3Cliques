import { FileCheck, Wallet, Building2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StepProps, FORMALIZATION_OPTIONS, INVESTMENT_OPTIONS } from "../types";
import { cn } from "@/lib/utils";

export function Step5Formalization({ data, onChange }: StepProps) {
  return (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <FileCheck className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Último passo!
        </h2>
        <p className="text-muted-foreground">
          Informações sobre formalização e investimento
        </p>
      </div>

      {/* Formalização */}
      <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Você possui CNPJ ou MEI?
        </h3>

        <RadioGroup
          value={data.formalization || ""}
          onValueChange={(value) => onChange("formalization", value)}
          className="space-y-3"
        >
          {FORMALIZATION_OPTIONS.map((option) => (
            <Label
              key={option.value}
              htmlFor={`form-${option.value}`}
              className={cn(
                "flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
                "hover:border-primary/40 hover:bg-primary/5",
                data.formalization === option.value
                  ? "border-primary bg-primary/10"
                  : "border-border"
              )}
            >
              <RadioGroupItem value={option.value} id={`form-${option.value}`} />
              <span className="font-medium">{option.label}</span>
            </Label>
          ))}
        </RadioGroup>
      </div>

      {/* Investimento */}
      <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          Qual seu orçamento inicial para investir?
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Isso nos ajuda a recomendar o melhor plano para você
        </p>

        <Select
          value={data.investment_budget || ""}
          onValueChange={(value) => onChange("investment_budget", value)}
        >
          <SelectTrigger className="h-14 text-base rounded-xl border-2">
            <SelectValue placeholder="Selecione uma faixa de investimento" />
          </SelectTrigger>
          <SelectContent>
            {INVESTMENT_OPTIONS.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                className="py-3 text-base"
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
