import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCadenceTasks } from "@/hooks/useCadenceTasks";
import { useCompleteCadenceTask } from "@/hooks/useCompleteCadenceTask";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Mail, MessageCircle, Phone, CheckCircle2, SkipForward, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const taskTypeIcons = {
  email: Mail,
  whatsapp: MessageCircle,
  call: Phone,
  task: CheckCircle2,
};

const taskTypeLabels = {
  email: "Email",
  whatsapp: "WhatsApp",
  call: "Ligação",
  task: "Tarefa Manual",
};

const taskTypeColors = {
  email: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  whatsapp: "bg-green-500/10 text-green-600 border-green-500/20",
  call: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  task: "bg-orange-500/10 text-orange-600 border-orange-500/20",
};

export default function SalesTasks() {
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState<string | undefined>(undefined);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: tasks, isLoading } = useCadenceTasks({
    date: selectedDate,
    status: "pending",
    taskType: selectedType,
  });

  const completeMutation = useCompleteCadenceTask();

  const handleComplete = (taskId: string) => {
    completeMutation.mutate({ task_id: taskId, skip: false });
  };

  const handleSkip = (taskId: string) => {
    completeMutation.mutate({ task_id: taskId, skip: true });
  };

  const taskCounts = {
    all: tasks?.length || 0,
    email: tasks?.filter((t) => t.task_type === "email").length || 0,
    whatsapp: tasks?.filter((t) => t.task_type === "whatsapp").length || 0,
    call: tasks?.filter((t) => t.task_type === "call").length || 0,
    task: tasks?.filter((t) => t.task_type === "task").length || 0,
  };

  if (isLoading) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">⚡ Workzone - Execução Diária</h1>
        <p className="text-muted-foreground">
          Fila de tarefas de cadências agendadas para hoje
        </p>
      </div>

      {/* Filtros */}
      <div className="mb-6 flex flex-wrap gap-3 items-center">
        <Button
          variant={selectedType === undefined ? "default" : "outline"}
          onClick={() => setSelectedType(undefined)}
          className="gap-2"
        >
          Todas
          <Badge variant="secondary" className="ml-1">
            {taskCounts.all}
          </Badge>
        </Button>
        <Button
          variant={selectedType === "email" ? "default" : "outline"}
          onClick={() => setSelectedType("email")}
          className="gap-2"
        >
          <Mail className="h-4 w-4" />
          Emails
          <Badge variant="secondary" className="ml-1">
            {taskCounts.email}
          </Badge>
        </Button>
        <Button
          variant={selectedType === "whatsapp" ? "default" : "outline"}
          onClick={() => setSelectedType("whatsapp")}
          className="gap-2"
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
          <Badge variant="secondary" className="ml-1">
            {taskCounts.whatsapp}
          </Badge>
        </Button>
        <Button
          variant={selectedType === "call" ? "default" : "outline"}
          onClick={() => setSelectedType("call")}
          className="gap-2"
        >
          <Phone className="h-4 w-4" />
          Ligações
          <Badge variant="secondary" className="ml-1">
            {taskCounts.call}
          </Badge>
        </Button>
        <Button
          variant={selectedType === "task" ? "default" : "outline"}
          onClick={() => setSelectedType("task")}
          className="gap-2"
        >
          <CheckCircle2 className="h-4 w-4" />
          Tarefas
          <Badge variant="secondary" className="ml-1">
            {taskCounts.task}
          </Badge>
        </Button>

        {/* Date Selector */}
        <div className="ml-auto flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-border rounded-md bg-background text-foreground"
          />
        </div>
      </div>

      {/* Task List */}
      {tasks && tasks.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {tasks.map((task) => {
            const Icon = taskTypeIcons[task.task_type as keyof typeof taskTypeIcons];
            const contact = task.contact as any;
            const enrollment = task.enrollment as any;
            const cadence = enrollment?.cadence as any;

            return (
              <Card key={task.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    {/* Contact Avatar */}
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={contact?.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {contact?.first_name?.[0]}{contact?.last_name?.[0]}
                      </AvatarFallback>
                    </Avatar>

                    {/* Task Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">
                          {contact?.first_name} {contact?.last_name}
                        </h3>
                        <Badge
                          variant="outline"
                          className={taskTypeColors[task.task_type as keyof typeof taskTypeColors]}
                        >
                          {Icon && <Icon className="h-3 w-3 mr-1" />}
                          {taskTypeLabels[task.task_type as keyof typeof taskTypeLabels]}
                        </Badge>
                      </div>

                      <p className="text-sm text-muted-foreground mb-1">
                        📧 {contact?.email} {contact?.phone && `• 📱 ${contact?.phone}`}
                      </p>

                      {contact?.company && (
                        <p className="text-sm text-muted-foreground mb-2">
                          🏢 {contact?.company}
                        </p>
                      )}

                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="secondary" className="text-xs">
                          🎯 {cadence?.name || "Cadência"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Passo {enrollment?.current_step || 1}
                        </span>
                      </div>

                      <div className="bg-muted/30 rounded-lg p-3 mb-3">
                        <p className="text-sm font-medium text-foreground mb-1">{task.title}</p>
                        {task.description && (
                          <p className="text-sm text-muted-foreground">{task.description}</p>
                        )}
                      </div>

                      {task.template_content && (
                        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 mb-3">
                          <p className="text-xs font-medium text-blue-600 mb-1">📄 Template:</p>
                          <p className="text-sm text-foreground whitespace-pre-wrap">
                            {task.template_content}
                          </p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleComplete(task.id)}
                          disabled={completeMutation.isPending}
                          className="gap-2"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Executar
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleSkip(task.id)}
                          disabled={completeMutation.isPending}
                          className="gap-2"
                        >
                          <SkipForward className="h-4 w-4" />
                          Pular
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-center">🎉 Nenhuma tarefa pendente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground">
              Você não tem tarefas de cadências agendadas para {format(new Date(selectedDate), "d 'de' MMMM", { locale: ptBR })}.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
