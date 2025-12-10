import * as React from "react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  text?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-8 w-8",
  lg: "h-12 w-12",
};

export function LoadingState({ text = "Carregando...", size = "md", className }: LoadingStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 gap-3", className)}>
      <div 
        className={cn(
          "animate-spin rounded-full border-2 border-muted border-t-primary", 
          sizeClasses[size]
        )} 
      />
      <p className="text-muted-foreground text-sm">{text}</p>
    </div>
  );
}
