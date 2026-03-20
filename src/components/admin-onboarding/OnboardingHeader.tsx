import { Button } from "@/components/ui/button";
import { OnboardingProgressBar } from "./OnboardingProgress";
import { RefreshCw, RotateCcw, Loader2 } from "lucide-react";
import { useCRMBranding } from "@/hooks/useCRMBranding";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface OnboardingHeaderProps {
  progress: number;
  isValidating: boolean;
  onValidateAll: () => Promise<void>;
  onReset: () => Promise<void>;
}

export function OnboardingHeader({
  progress,
  isValidating,
  onValidateAll,
  onReset,
}: OnboardingHeaderProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Bem-vindo ao Parabellum CRM
          </h1>
          <p className="text-muted-foreground mt-1">
            Complete as etapas abaixo para configurar seu sistema e começar a usar todos os recursos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onValidateAll}
            disabled={isValidating}
          >
            {isValidating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Validar Tudo
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <RotateCcw className="h-4 w-4 mr-2" />
                Resetar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Resetar Onboarding?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso irá limpar todo o progresso do onboarding. Você precisará
                  completar todas as etapas novamente. Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onReset}>
                  Sim, resetar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <OnboardingProgressBar progress={progress} />
    </div>
  );
}
