import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTopTopics } from "@/hooks/useTopTopics";
import { MessageSquare, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface TopTopicsWidgetProps {
  startDate: Date;
  endDate: Date;
}

const TOPIC_ICONS: Record<string, string> = {
  'Financeiro': '💰',
  'Tecnico': '🔧',
  'Técnico': '🔧',
  'Bug': '🐛',
  'Saque': '💸',
  'Reclamacao': '😤',
  'Reclamação': '😤',
  'Duvida': '❔',
  'Dúvida': '❔',
  'Outro': '❓',
  'Outros': '❓',
};

export function TopTopicsWidget({ startDate, endDate }: TopTopicsWidgetProps) {
  const { data: topics, isLoading } = useTopTopics(startDate, endDate);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Top 5 Tópicos Mais Frequentes
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Top 5 Categorias
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Categorias de tickets mais frequentes
        </p>
      </CardHeader>
      <CardContent>
        {topics?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum tópico registrado neste período</p>
          </div>
        ) : (
          <div className="space-y-4">
            {topics?.map((topic, index) => (
              <div key={topic.topic} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{TOPIC_ICONS[topic.topic] || '💬'}</span>
                    <div>
                      <div className="font-medium">{topic.topic}</div>
                      <div className="text-xs text-muted-foreground">
                        {topic.count} {topic.count === 1 ? 'ocorrência' : 'ocorrências'}
                      </div>
                    </div>
                  </div>
                  <Badge 
                    variant={index === 0 ? 'default' : 'secondary'}
                    className="ml-2"
                  >
                    {topic.percentage.toFixed(1)}%
                  </Badge>
                </div>
                <Progress value={topic.percentage} className="h-2" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
