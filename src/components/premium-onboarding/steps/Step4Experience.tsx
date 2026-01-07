import { Store, ShoppingBag, Info } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PremiumInput } from "@/components/ui/premium-input";
import { StepProps, DROPSHIPPING_OPTIONS } from "../types";
import { cn } from "@/lib/utils";

export function Step4Experience({ data, onChange }: StepProps) {
  return (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Store className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Sua experiência
        </h2>
        <p className="text-muted-foreground">
          Conte-nos sobre sua experiência com vendas online
        </p>
      </div>

      {/* Já teve loja online */}
      <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-primary" />
          Você já teve uma loja online?
        </h3>

        <RadioGroup
          value={data.has_online_store === true ? "sim" : data.has_online_store === false ? "nao" : ""}
          onValueChange={(value) => onChange("has_online_store", value === "sim")}
          className="grid grid-cols-2 gap-3"
        >
          <Label
            htmlFor="store-sim"
            className={cn(
              "flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
              "hover:border-primary/40 hover:bg-primary/5",
              data.has_online_store === true
                ? "border-primary bg-primary/10"
                : "border-border"
            )}
          >
            <RadioGroupItem value="sim" id="store-sim" />
            <span className="font-medium">Sim</span>
          </Label>
          <Label
            htmlFor="store-nao"
            className={cn(
              "flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
              "hover:border-primary/40 hover:bg-primary/5",
              data.has_online_store === false
                ? "border-primary bg-primary/10"
                : "border-border"
            )}
          >
            <RadioGroupItem value="nao" id="store-nao" />
            <span className="font-medium">Não</span>
          </Label>
        </RadioGroup>
      </div>

      {/* Conhece Dropshipping */}
      <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Store className="h-5 w-5 text-primary" />
          Você conhece dropshipping?
        </h3>

        <RadioGroup
          value={data.dropshipping_experience || ""}
          onValueChange={(value) => onChange("dropshipping_experience", value)}
          className="space-y-3"
        >
          {DROPSHIPPING_OPTIONS.map((option) => (
            <Label
              key={option.value}
              htmlFor={`drop-${option.value}`}
              className={cn(
                "flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
                "hover:border-primary/40 hover:bg-primary/5",
                data.dropshipping_experience === option.value
                  ? "border-primary bg-primary/10"
                  : "border-border"
              )}
            >
              <RadioGroupItem value={option.value} id={`drop-${option.value}`} />
              <span className="font-medium">{option.label}</span>
            </Label>
          ))}
        </RadioGroup>

        {/* Conditional: Tooltip para quem não conhece */}
        {data.dropshipping_experience === "nao_conheco" && (
          <Alert className="mt-4 bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              <strong>O que é dropshipping?</strong><br />
              É um modelo de vendas onde você não precisa ter estoque. Quando um cliente compra, 
              o fornecedor envia direto para ele. Não se preocupe, vamos te ensinar tudo!
            </AlertDescription>
          </Alert>
        )}

        {/* Conditional: Campo extra para quem já vendeu */}
        {data.dropshipping_experience === "sim_vendi" && (
          <div className="mt-4">
            <PremiumInput
              label="Qual plataforma você usou?"
              value={data.platform_used || ""}
              onChange={(e) => onChange("platform_used", e.target.value)}
              placeholder="Ex: Shopify, Nuvemshop, WooCommerce..."
              hint="Opcional - nos ajuda a entender sua experiência"
            />
          </div>
        )}
      </div>
    </div>
  );
}
