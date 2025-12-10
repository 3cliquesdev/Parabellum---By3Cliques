import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ChevronRight, 
  CheckCircle2, 
  Circle, 
  Clock, 
  SkipForward,
  RefreshCw,
  Loader2,
  LucideIcon
} from "lucide-react";
import { OnboardingStepStatus } from "@/lib/onboarding-engine";

interface OnboardingStepCardProps {
  stepNumber: number;
  title: string;
  description: string;
  icon: LucideIcon;
  route: string;
  status: OnboardingStepStatus;
  onValidate: () => Promise<boolean>;
  onSkip: () => Promise<void>;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export function OnboardingStepCard({
  stepNumber,
  title,
  description,
  icon: Icon,
  route,
  status,
  onValidate,
  onSkip,
  isExpanded = false,
  onToggle,
}: OnboardingStepCardProps) {
  const navigate = useNavigate();
  const [isValidating, setIsValidating] = useState(false);

  const handleValidate = async () => {
    setIsValidating(true);
    await onValidate();
    setIsValidating(false);
  };

  const handleGoToStep = () => {
    navigate(route);
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="default" className="bg-green-500/20 text-green-600 border-green-500/30">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Concluído
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge variant="secondary" className="bg-amber-500/20 text-amber-600 border-amber-500/30">
            <Clock className="h-3 w-3 mr-1" />
            Em andamento
          </Badge>
        );
      case 'skipped':
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <SkipForward className="h-3 w-3 mr-1" />
            Pulado
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <Circle className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        );
    }
  };

  return (
    <Card 
      className={cn(
        "transition-all duration-300 cursor-pointer hover:shadow-md",
        status === 'completed' && "bg-green-500/5 border-green-500/20",
        isExpanded && "ring-2 ring-primary/20"
      )}
      onClick={onToggle}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Step Number & Icon */}
          <div 
            className={cn(
              "flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center",
              status === 'completed' 
                ? "bg-green-500/20 text-green-600" 
                : "bg-primary/10 text-primary"
            )}
          >
            {status === 'completed' ? (
              <CheckCircle2 className="h-6 w-6" />
            ) : (
              <Icon className="h-6 w-6" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Etapa {stepNumber}</span>
                {getStatusBadge()}
              </div>
              <ChevronRight 
                className={cn(
                  "h-5 w-5 text-muted-foreground transition-transform",
                  isExpanded && "rotate-90"
                )}
              />
            </div>
            
            <h3 className="font-semibold text-foreground truncate">{title}</h3>
            
            {isExpanded && (
              <div className="mt-3 space-y-3 animate-in fade-in-0 slide-in-from-top-2 duration-200">
                <p className="text-sm text-muted-foreground">{description}</p>
                
                <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                  {status !== 'completed' && (
                    <>
                      <Button
                        size="sm"
                        onClick={handleGoToStep}
                      >
                        Ir para configuração
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleValidate}
                        disabled={isValidating}
                      >
                        {isValidating ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-1" />
                        )}
                        Validar
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onSkip()}
                        className="text-muted-foreground"
                      >
                        <SkipForward className="h-4 w-4 mr-1" />
                        Pular
                      </Button>
                    </>
                  )}
                  
                  {status === 'completed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleGoToStep}
                    >
                      Revisar configuração
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
