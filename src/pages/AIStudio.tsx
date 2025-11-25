import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, Brain, Zap } from "lucide-react";
import { usePersonas } from "@/hooks/usePersonas";
import { useDeletePersona } from "@/hooks/useDeletePersona";
import { useUpdatePersona } from "@/hooks/useUpdatePersona";
import { useRoutingRules } from "@/hooks/useRoutingRules";
import { PersonaDialog } from "@/components/PersonaDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function AIStudio() {
  const { data: personas, isLoading: loadingPersonas } = usePersonas();
  const { data: routingRules, isLoading: loadingRules } = useRoutingRules();
  const deletePersona = useDeletePersona();
  const updatePersona = useUpdatePersona();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [personaToDelete, setPersonaToDelete] = useState<string | null>(null);

  const handleDelete = async () => {
    if (personaToDelete) {
      await deletePersona.mutateAsync(personaToDelete);
      setDeleteDialogOpen(false);
      setPersonaToDelete(null);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    await updatePersona.mutateAsync({
      id,
      data: { is_active: !currentStatus },
    });
  };

  if (loadingPersonas || loadingRules) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Carregando AI Studio...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Brain className="h-8 w-8 text-primary" />
            AI Studio
          </h1>
          <p className="text-muted-foreground mt-1">
            Centro de Comando da Inteligência Artificial
          </p>
        </div>
        <PersonaDialog
          trigger={
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Persona
            </Button>
          }
        />
      </div>

      {/* Personas Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {personas?.map((persona) => (
          <Card key={persona.id} className="p-6 space-y-4 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="text-xl font-bold">{persona.name}</h3>
                <p className="text-sm text-muted-foreground">{persona.role}</p>
              </div>
              <Badge variant={persona.is_active ? "default" : "secondary"}>
                {persona.is_active ? "Ativa" : "Inativa"}
              </Badge>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">System Prompt</p>
                <p className="text-sm line-clamp-3">{persona.system_prompt}</p>
              </div>

              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Temp:</span>{" "}
                  <span className="font-medium">{persona.temperature}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Tokens:</span>{" "}
                  <span className="font-medium">{persona.max_tokens}</span>
                </div>
              </div>

              {persona.knowledge_base_paths && persona.knowledge_base_paths.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Base de Conhecimento
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {persona.knowledge_base_paths.map((path, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {path.split("/").pop()}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-2">
                <Switch
                  checked={persona.is_active ?? false}
                  onCheckedChange={() => handleToggleActive(persona.id, persona.is_active ?? false)}
                />
                <span className="text-sm text-muted-foreground">Ativa</span>
              </div>
              <div className="flex gap-2">
                <PersonaDialog
                  trigger={
                    <Button variant="ghost" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                  }
                  persona={persona}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPersonaToDelete(persona.id);
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {(!personas || personas.length === 0) && (
          <Card className="p-12 col-span-full text-center">
            <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Nenhuma Persona Criada</h3>
            <p className="text-muted-foreground mb-4">
              Crie sua primeira persona AI para começar
            </p>
            <PersonaDialog
              trigger={
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nova Persona
                </Button>
              }
            />
          </Card>
        )}
      </div>

      {/* Routing Rules Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Regras de Roteamento
          </h2>
        </div>

        <Card className="p-6">
          {routingRules && routingRules.length > 0 ? (
            <div className="space-y-3">
              {routingRules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{rule.channel}</Badge>
                      {rule.department && (
                        <Badge variant="secondary">{rule.department}</Badge>
                      )}
                      <span className="text-sm text-muted-foreground">
                        → {rule.ai_personas?.name || "Sem persona"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Prioridade: {rule.priority}
                    </p>
                  </div>
                  <Badge variant={rule.is_active ? "default" : "secondary"}>
                    {rule.is_active ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Zap className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">
                Nenhuma regra de roteamento configurada
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Persona?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A persona será permanentemente removida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
