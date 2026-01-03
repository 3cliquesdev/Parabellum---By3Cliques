import * as React from "react";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

interface PasswordStrengthProps {
  password: string;
  className?: string;
}

interface StrengthCriteria {
  label: string;
  met: boolean;
}

export function usePasswordStrength(password: string) {
  const criteria: StrengthCriteria[] = React.useMemo(() => [
    { label: "Mínimo 8 caracteres", met: password.length >= 8 },
    { label: "Letra maiúscula", met: /[A-Z]/.test(password) },
    { label: "Letra minúscula", met: /[a-z]/.test(password) },
    { label: "Número", met: /[0-9]/.test(password) },
    { label: "Caractere especial", met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
  ], [password]);

  const strength = React.useMemo(() => {
    const metCount = criteria.filter(c => c.met).length;
    if (metCount === 0) return { level: 0, label: "", color: "" };
    if (metCount <= 2) return { level: 1, label: "Fraca", color: "destructive" };
    if (metCount <= 3) return { level: 2, label: "Média", color: "warning" };
    if (metCount <= 4) return { level: 3, label: "Boa", color: "info" };
    return { level: 4, label: "Forte", color: "success" };
  }, [criteria]);

  return { criteria, strength };
}

export function PasswordStrength({ password, className }: PasswordStrengthProps) {
  const { criteria, strength } = usePasswordStrength(password);

  if (!password) return null;

  return (
    <div className={cn("space-y-3 animate-in fade-in slide-in-from-top-2 duration-300", className)}>
      {/* Strength Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Força da senha</span>
          <span
            className={cn(
              "text-xs font-semibold",
              strength.color === "destructive" && "text-destructive",
              strength.color === "warning" && "text-warning",
              strength.color === "info" && "text-info",
              strength.color === "success" && "text-success"
            )}
          >
            {strength.label}
          </span>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={cn(
                "h-2 flex-1 rounded-full transition-all duration-300",
                level <= strength.level
                  ? cn(
                      strength.color === "destructive" && "bg-destructive",
                      strength.color === "warning" && "bg-warning",
                      strength.color === "info" && "bg-info",
                      strength.color === "success" && "bg-success"
                    )
                  : "bg-muted"
              )}
            />
          ))}
        </div>
      </div>

      {/* Criteria List */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {criteria.map((criterion, index) => (
          <div
            key={index}
            className={cn(
              "flex items-center gap-2 text-xs transition-colors duration-200",
              criterion.met ? "text-success" : "text-muted-foreground"
            )}
          >
            {criterion.met ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <X className="h-3.5 w-3.5" />
            )}
            {criterion.label}
          </div>
        ))}
      </div>
    </div>
  );
}
