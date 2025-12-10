import * as React from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ 
  title = "Algo deu errado", 
  description = "Ocorreu um erro inesperado. Tente novamente.",
  onRetry,
  className
}: ErrorStateProps) {
  return (
    <div className={cn("text-center py-12 px-4", className)}>
      <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
        <AlertCircle className="h-6 w-6 text-destructive" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-muted-foreground mt-1">{description}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="mt-4">
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
