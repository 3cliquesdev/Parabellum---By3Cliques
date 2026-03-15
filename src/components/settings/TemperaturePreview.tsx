import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Thermometer, Snowflake, Sun, Flame, Zap } from "lucide-react";

interface TemperaturePreviewProps {
  value: number;
  onChange: (value: number) => void;
}

type TemperatureBand = {
  label: string;
  description: string;
  icon: React.ReactNode;
  example: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  badgeClass: string;
};

function getBand(temp: number): TemperatureBand {
  if (temp <= 0.3) {
    return {
      label: "Preciso",
      description: "Respostas factuais e diretas, sem variação",
      icon: <Snowflake className="h-4 w-4" />,
      example: "O prazo de entrega é de 3 a 5 dias úteis.",
      bgClass: "bg-blue-50 dark:bg-blue-950/30",
      textClass: "text-blue-700 dark:text-blue-300",
      borderClass: "border-blue-200 dark:border-blue-800",
      badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    };
  }
  if (temp <= 0.7) {
    return {
      label: "Equilibrado",
      description: "Tom natural com leve personalidade",
      icon: <Sun className="h-4 w-4" />,
      example: "Seu pedido deve chegar em 3 a 5 dias úteis. Posso ajudar com mais alguma coisa?",
      bgClass: "bg-emerald-50 dark:bg-emerald-950/30",
      textClass: "text-emerald-700 dark:text-emerald-300",
      borderClass: "border-emerald-200 dark:border-emerald-800",
      badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    };
  }
  if (temp <= 1.2) {
    return {
      label: "Criativo",
      description: "Respostas expressivas e engajantes",
      icon: <Flame className="h-4 w-4" />,
      example: "Ótima notícia! Seu pedido está a caminho e deve chegar em breve, entre 3 e 5 dias úteis 🚀",
      bgClass: "bg-amber-50 dark:bg-amber-950/30",
      textClass: "text-amber-700 dark:text-amber-300",
      borderClass: "border-amber-200 dark:border-amber-800",
      badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    };
  }
  return {
    label: "Experimental",
    description: "Muito criativo — pode gerar respostas imprevisíveis",
    icon: <Zap className="h-4 w-4" />,
    example: "Seu pedido já está voando rumo a você! Em uns 3 a 5 dias úteis ele bate na sua porta 📦✨",
    bgClass: "bg-red-50 dark:bg-red-950/30",
    textClass: "text-red-700 dark:text-red-300",
    borderClass: "border-red-200 dark:border-red-800",
    badgeClass: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };
}

export function TemperaturePreview({ value, onChange }: TemperaturePreviewProps) {
  const band = getBand(value);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Thermometer className="h-4 w-4 text-muted-foreground" />
          Temperature
        </Label>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${band.badgeClass}`}>
          {band.icon}
          <span className="ml-1">{band.label} — {value.toFixed(1)}</span>
        </span>
      </div>

      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(Math.round(v * 10) / 10)}
        min={0}
        max={2}
        step={0.1}
        className="py-2"
      />

      <div className="flex justify-between text-[10px] text-muted-foreground px-0.5 -mt-1">
        <span>0 — Preciso</span>
        <span>1.0</span>
        <span>2.0 — Criativo</span>
      </div>

      <Card className={`border ${band.borderClass} ${band.bgClass} transition-colors duration-300`}>
        <CardContent className="p-3 space-y-1.5">
          <p className={`text-xs font-medium ${band.textClass}`}>
            {band.description}
          </p>
          <p className="text-sm text-foreground/80 italic leading-relaxed">
            "{band.example}"
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
