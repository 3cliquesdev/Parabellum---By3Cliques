import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon, Check, AlertCircle } from "lucide-react";

export interface PremiumInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: LucideIcon;
  error?: string;
  success?: boolean;
  hint?: string;
}

const PremiumInput = React.forwardRef<HTMLInputElement, PremiumInputProps>(
  ({ className, type, label, icon: Icon, error, success, hint, id, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const hasValue = Boolean(props.value);
    const isFloating = isFocused || hasValue;
    
    const inputId = id || `premium-input-${label.toLowerCase().replace(/\s/g, '-')}`;

    return (
      <div className="relative w-full">
        {/* Input Container */}
        <div
          className={cn(
            "relative flex items-center rounded-xl border-2 bg-background transition-all duration-300",
            "hover:border-primary/40 hover:shadow-md",
            isFocused && "border-primary shadow-lg shadow-primary/10",
            error && "border-destructive hover:border-destructive",
            success && !error && hasValue && "border-success hover:border-success",
            !isFocused && !error && !success && "border-border",
            className
          )}
        >
          {/* Icon */}
          {Icon && (
            <div
              className={cn(
                "pl-4 transition-colors duration-300",
                isFocused && "text-primary",
                error && "text-destructive",
                success && !error && hasValue && "text-success",
                !isFocused && !error && !success && "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
          )}

          {/* Input Field */}
          <input
            type={type}
            id={inputId}
            className={cn(
              "peer h-14 w-full bg-transparent px-4 pt-4 pb-1 text-base",
              "placeholder:text-transparent focus:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-50",
              Icon && "pl-3"
            )}
            ref={ref}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={label}
            {...props}
          />

          {/* Floating Label */}
          <label
            htmlFor={inputId}
            className={cn(
              "absolute transition-all duration-300 pointer-events-none text-muted-foreground",
              Icon ? "left-12" : "left-4",
              isFloating
                ? "top-2 text-xs font-medium"
                : "top-1/2 -translate-y-1/2 text-base",
              isFocused && "text-primary",
              error && "text-destructive",
              success && !error && hasValue && "text-success"
            )}
          >
            {label}
          </label>

          {/* Status Icons */}
          <div className="pr-4">
            {error && <AlertCircle className="h-5 w-5 text-destructive" />}
            {success && !error && hasValue && (
              <Check className="h-5 w-5 text-success" />
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <p className="mt-1.5 ml-1 text-sm text-destructive flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-200">
            {error}
          </p>
        )}

        {/* Hint Text */}
        {hint && !error && (
          <p className="mt-1 ml-1 text-xs text-muted-foreground">{hint}</p>
        )}
      </div>
    );
  }
);

PremiumInput.displayName = "PremiumInput";

export { PremiumInput };
