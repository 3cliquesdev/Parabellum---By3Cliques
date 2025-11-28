import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCustomerContext } from "@/hooks/useCustomerContext";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OnboardingSummaryCardProps {
  contactId: string;
}

export default function OnboardingSummaryCard({ contactId }: OnboardingSummaryCardProps) {
  const { data: context, isLoading } = useCustomerContext(contactId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!context?.journeySteps || context.journeySteps.length === 0) {
    return null;
  }

  const totalSteps = context.journeySteps.length;
  const completedSteps = context.journeySteps.filter(s => s.completed).length;
  const progress = Math.round((completedSteps / totalSteps) * 100);

  const firstStepDate = context.journeySteps[0]?.created_at;
  const lastCompletedStep = context.journeySteps
    .filter(s => s.completed && s.completed_at)
    .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Resumo Onboarding</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Progresso</span>
            <span className="text-sm font-medium">{completedSteps}/{totalSteps}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {firstStepDate && isValid(new Date(firstStepDate)) && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">Início:</span>{" "}
            {format(new Date(firstStepDate), "dd/MM/yyyy", { locale: ptBR })}
          </div>
        )}

        {lastCompletedStep && lastCompletedStep.completed_at && isValid(new Date(lastCompletedStep.completed_at)) && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">Última etapa:</span>{" "}
            {format(new Date(lastCompletedStep.completed_at), "dd/MM/yyyy", { locale: ptBR })}
          </div>
        )}

        {context.seller && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <Avatar className="h-6 w-6">
              <AvatarImage src={context.seller.avatar_url || undefined} />
              <AvatarFallback className="text-xs">
                {context.seller.full_name?.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Vendedor Original</p>
              <p className="text-sm font-medium truncate">{context.seller.full_name}</p>
            </div>
          </div>
        )}

        {context.deal?.product && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-1">Produto</p>
            <Badge variant="secondary" className="text-xs">
              {context.deal.product.name}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
