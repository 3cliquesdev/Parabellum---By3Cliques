import { Brain, Lightbulb } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { StepProps } from "../types";
import { cn } from "@/lib/utils";

const KNOWLEDGE_LABELS = [
  "Nenhum",
  "Básico",
  "Intermediário",
  "Bom",
  "Avançado",
  "Expert",
];

export function Step2Knowledge({ data, onChange }: StepProps) {
  const itLevel = data.knowledge_it ?? 0;
  const internetLevel = data.knowledge_internet ?? 0;

  return (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Brain className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Seu conhecimento
        </h2>
        <p className="text-muted-foreground">
          Nos ajude a entender seu nível de familiaridade com tecnologia
        </p>
      </div>

      {/* Conhecimento em Informática */}
      <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
        <div className="flex items-start gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/10">
            <Lightbulb className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">
              Conhecimento em Informática
            </h3>
            <p className="text-sm text-muted-foreground">
              Como você avalia suas habilidades com computadores?
            </p>
          </div>
        </div>

        <Slider
          value={[itLevel]}
          onValueChange={(value) => onChange("knowledge_it", value[0])}
          max={5}
          min={0}
          step={1}
          className="w-full"
        />

        <div className="flex justify-between mt-3">
          {KNOWLEDGE_LABELS.map((label, index) => (
            <span
              key={label}
              className={cn(
                "text-xs transition-colors",
                itLevel === index
                  ? "text-primary font-semibold"
                  : "text-muted-foreground"
              )}
            >
              {label}
            </span>
          ))}
        </div>

        <div className="mt-4 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-medium">
            Nível: {KNOWLEDGE_LABELS[itLevel]}
          </span>
        </div>
      </div>

      {/* Conhecimento em Internet/Redes */}
      <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
        <div className="flex items-start gap-3 mb-6">
          <div className="p-2 rounded-lg bg-secondary/80">
            <Brain className="h-5 w-5 text-secondary-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">
              Conhecimento em Internet e Redes Sociais
            </h3>
            <p className="text-sm text-muted-foreground">
              Qual sua experiência navegando e usando redes sociais?
            </p>
          </div>
        </div>

        <Slider
          value={[internetLevel]}
          onValueChange={(value) => onChange("knowledge_internet", value[0])}
          max={5}
          min={0}
          step={1}
          className="w-full"
        />

        <div className="flex justify-between mt-3">
          {KNOWLEDGE_LABELS.map((label, index) => (
            <span
              key={label}
              className={cn(
                "text-xs transition-colors",
                internetLevel === index
                  ? "text-primary font-semibold"
                  : "text-muted-foreground"
              )}
            >
              {label}
            </span>
          ))}
        </div>

        <div className="mt-4 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-medium">
            Nível: {KNOWLEDGE_LABELS[internetLevel]}
          </span>
        </div>
      </div>
    </div>
  );
}
