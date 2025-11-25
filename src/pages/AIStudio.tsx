import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Brain, Zap, Wrench, FlaskConical } from "lucide-react";
import { SandboxTest } from "@/components/SandboxTest";
import { RLHFMetricsCard } from "@/components/RLHFMetricsCard";
import { Skeleton } from "@/components/ui/skeleton";
import { usePersonas } from "@/hooks/usePersonas";
import { useDeletePersona } from "@/hooks/useDeletePersona";
import { useUpdatePersona } from "@/hooks/useUpdatePersona";
import { useRoutingRules } from "@/hooks/useRoutingRules";
import { useAITools } from "@/hooks/useAITools";
import { useUpdateAITool } from "@/hooks/useUpdateAITool";
import { usePersonaTools } from "@/hooks/usePersonaTools";
import { useTogglePersonaTool } from "@/hooks/useTogglePersonaTool";
import { PersonaDialog } from "@/components/PersonaDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function AIStudio() {
  const { data: personas, isLoading: loadingPersonas } = usePersonas();
  const { data: routingRules, isLoading: loadingRules } = useRoutingRules();
  const { data: tools, isLoading: loadingTools } = useAITools();
  
  const [selectedPersonaForTools, setSelectedPersonaForTools] = useState<string | null>(null);
  const { data: personaTools } = usePersonaTools(selectedPersonaForTools);
  
  const deletePersona = useDeletePersona();
  const updatePersona = useUpdatePersona();
  const updateTool = useUpdateAITool();
  const togglePersonaTool = useTogglePersonaTool();
  
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

  const isToolLinkedToPersona = (toolId: string) => {
    return personaTools?.some((tool: any) => tool.id === toolId) || false;
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
      </div>

      <Tabs defaultValue="personas" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="personas" className="transition-all data-[state=active]:scale-105">
            <Brain className="mr-2 h-4 w-4" />
            Personas
          </TabsTrigger>
          <TabsTrigger value="tools" className="transition-all data-[state=active]:scale-105">
            <Wrench className="mr-2 h-4 w-4" />
            AI Tools
          </TabsTrigger>
          <TabsTrigger value="sandbox" className="transition-all data-[state=active]:scale-105">
            <FlaskConical className="mr-2 h-4 w-4" />
            Sandbox
          </TabsTrigger>
        </TabsList>

        {/* PERSONAS TAB */}
        <TabsContent value="personas" className="space-y-6 mt-6 animate-fade-in">
          <div className="flex justify-between items-start gap-6">
            <div className="flex-1">
              <PersonaDialog
                trigger={
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nova Persona
                  </Button>
                }
              />
            </div>
            <div className="w-full max-w-md">
              <RLHFMetricsCard />
            </div>
          </div>

          {/* Personas Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loadingPersonas ? (
              // Loading Skeletons
              Array.from({ length: 3 }).map((_, idx) => (
                <Card key={idx} className="p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-6 w-32" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="h-6 w-16" />
                  </div>
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <div className="flex gap-4">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t">
                    <Skeleton className="h-6 w-24" />
                    <div className="flex gap-2">
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                    </div>
                  </div>
                </Card>
              ))
            ) : personas?.map((persona) => (
              <Card key={persona.id} className="p-6 space-y-4 hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
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

            {!loadingPersonas && (!personas || personas.length === 0) && (
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
        </TabsContent>

        {/* AI TOOLS TAB */}
        <TabsContent value="tools" className="space-y-6 mt-6 animate-fade-in">
          {/* Persona Selector */}
          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-1">Selecione uma Persona</h3>
                <p className="text-sm text-muted-foreground">
                  Escolha uma persona para gerenciar quais tools ela pode utilizar
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {personas?.map((persona) => (
                  <Button
                    key={persona.id}
                    variant={selectedPersonaForTools === persona.id ? "default" : "outline"}
                    onClick={() => setSelectedPersonaForTools(persona.id)}
                    className="justify-start h-auto py-3"
                  >
                    <Brain className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{persona.name}</span>
                  </Button>
                ))}
              </div>
            </div>
          </Card>

          {/* AI Tools Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {loadingTools ? (
              // Loading Skeletons for Tools
              Array.from({ length: 4 }).map((_, idx) => (
                <Card key={idx} className="p-6 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-start gap-3">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-6 w-12" />
                    </div>
                  </div>
                </Card>
              ))
            ) : tools && tools.length > 0 ? (
              tools.map((tool) => {
                const isLinked = isToolLinkedToPersona(tool.id);
                return (
                  <Card key={tool.id} className="p-6 space-y-4 hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
                    <div className="space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                          <Wrench className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-bold">{tool.name}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {tool.description}
                          </p>
                        </div>
                      </div>

                      {tool.requires_auth && (
                        <Badge variant="outline" className="w-fit">
                          Requer Autenticação
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-3 pt-4 border-t">
                      {/* Global Tool Toggle */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Tool Global</p>
                          <p className="text-xs text-muted-foreground">
                            Ativa/desativa a tool no sistema
                          </p>
                        </div>
                        <Switch
                          checked={tool.is_enabled}
                          onCheckedChange={(checked) =>
                            updateTool.mutate({ id: tool.id, is_enabled: checked })
                          }
                        />
                      </div>

                      {/* Persona-specific Toggle */}
                      {selectedPersonaForTools && tool.is_enabled && (
                        <div className="flex items-center justify-between pt-3 border-t">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">
                              Vinculada à Persona
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Permite que a persona use esta tool
                            </p>
                          </div>
                          <Switch
                            checked={isLinked}
                            onCheckedChange={(checked) =>
                              togglePersonaTool.mutate({
                                personaId: selectedPersonaForTools,
                                toolId: tool.id,
                                isLinked: !checked,
                              })
                            }
                          />
                        </div>
                      )}

                      {selectedPersonaForTools && !tool.is_enabled && (
                        <p className="text-xs text-muted-foreground text-center py-2 border-t">
                          Ative a tool globalmente primeiro
                        </p>
                      )}
                    </div>
                  </Card>
                );
              })
            ) : (
              <Card className="p-12 col-span-2 text-center">
                <Wrench className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Nenhuma Tool Disponível</h3>
                <p className="text-muted-foreground">
                  Nenhuma AI tool foi configurada no sistema
                </p>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* SANDBOX TAB */}
        <TabsContent value="sandbox" className="mt-6 animate-fade-in">
          <SandboxTest />
        </TabsContent>
      </Tabs>

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
