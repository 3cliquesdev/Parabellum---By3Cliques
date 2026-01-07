import { Smartphone, Globe } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { StepProps, DEVICE_OPTIONS, SOCIAL_NETWORKS } from "../types";
import { cn } from "@/lib/utils";

export function Step3Devices({ data, onChange }: StepProps) {
  const handleSocialNetworkChange = (network: string, checked: boolean) => {
    const current = data.social_networks || [];
    
    // Se marcou "nenhuma", desmarca todas as outras
    if (network === "nenhuma" && checked) {
      onChange("social_networks", ["nenhuma"]);
      return;
    }
    
    // Se marcou outra rede, remove "nenhuma"
    let updated = current.filter((n) => n !== "nenhuma");
    
    if (checked) {
      updated = [...updated, network];
    } else {
      updated = updated.filter((n) => n !== network);
    }
    
    onChange("social_networks", updated);
  };

  return (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Smartphone className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Seus dispositivos
        </h2>
        <p className="text-muted-foreground">
          Queremos entender como você acessa a internet
        </p>
      </div>

      {/* Dispositivo Principal */}
      <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          Qual dispositivo você mais usa?
        </h3>

        <RadioGroup
          value={data.main_device || ""}
          onValueChange={(value) => onChange("main_device", value)}
          className="grid grid-cols-2 gap-3"
        >
          {DEVICE_OPTIONS.map((option) => (
            <Label
              key={option.value}
              htmlFor={`device-${option.value}`}
              className={cn(
                "flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
                "hover:border-primary/40 hover:bg-primary/5",
                data.main_device === option.value
                  ? "border-primary bg-primary/10"
                  : "border-border"
              )}
            >
              <RadioGroupItem
                value={option.value}
                id={`device-${option.value}`}
              />
              <span className="font-medium">{option.label}</span>
            </Label>
          ))}
        </RadioGroup>
      </div>

      {/* Redes Sociais */}
      <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          Quais redes sociais você usa?
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Selecione todas que se aplicam
        </p>

        <div className="grid grid-cols-2 gap-3">
          {SOCIAL_NETWORKS.map((network) => {
            const isChecked = (data.social_networks || []).includes(network.value);
            return (
              <Label
                key={network.value}
                htmlFor={`network-${network.value}`}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
                  "hover:border-primary/40 hover:bg-primary/5",
                  isChecked
                    ? "border-primary bg-primary/10"
                    : "border-border"
                )}
              >
                <Checkbox
                  id={`network-${network.value}`}
                  checked={isChecked}
                  onCheckedChange={(checked) =>
                    handleSocialNetworkChange(network.value, checked as boolean)
                  }
                />
                <span className="font-medium">{network.label}</span>
              </Label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
