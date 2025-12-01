import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useCreatePersona } from "@/hooks/useCreatePersona";
import { useUpdatePersona } from "@/hooks/useUpdatePersona";
import { useKnowledgeCategories } from "@/hooks/useKnowledgeCategories";

interface PersonaDialogProps {
  trigger: React.ReactNode;
  persona?: {
    id: string;
    name: string;
    role: string;
    system_prompt: string;
    temperature: number | null;
    max_tokens: number | null;
    knowledge_base_paths: string[] | null;
    is_active: boolean | null;
    use_priority_instructions: boolean | null;
  };
  onOpenChange?: (open: boolean) => void;
}

export function PersonaDialog({ trigger, persona, onOpenChange }: PersonaDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(500);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [usePriorityInstructions, setUsePriorityInstructions] = useState(false);

  const createPersona = useCreatePersona();
  const updatePersona = useUpdatePersona();
  const { data: availableCategories = [], isLoading: loadingCategories } = useKnowledgeCategories();

  useEffect(() => {
    if (persona) {
      setName(persona.name);
      setRole(persona.role);
      setSystemPrompt(persona.system_prompt);
      setTemperature(persona.temperature ?? 0.7);
      setMaxTokens(persona.max_tokens ?? 500);
      setSelectedCategories(persona.knowledge_base_paths ?? []);
      setIsActive(persona.is_active ?? true);
      setUsePriorityInstructions(persona.use_priority_instructions ?? false);
    } else {
      setName("");
      setRole("");
      setSystemPrompt("");
      setTemperature(0.7);
      setMaxTokens(500);
      setSelectedCategories([]);
      setIsActive(true);
      setUsePriorityInstructions(false);
    }
  }, [persona, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      name,
      role,
      system_prompt: systemPrompt,
      temperature,
      max_tokens: maxTokens,
      knowledge_base_paths: selectedCategories.length > 0 ? selectedCategories : null,
      is_active: isActive,
      use_priority_instructions: usePriorityInstructions,
    };

    if (persona) {
      await updatePersona.mutateAsync({ id: persona.id, data });
    } else {
      await createPersona.mutateAsync(data);
    }

    setOpen(false);
    onOpenChange?.(false);
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      onOpenChange?.(isOpen);
    }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{persona ? "Editar Persona" : "Nova Persona"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Persona</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Hunter, Helper"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Papel/Função</Label>
            <Input
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Ex: Assistente de Vendas, Suporte Técnico"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="systemPrompt">System Prompt</Label>
            <Textarea
              id="systemPrompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Descreva a personalidade e comportamento da IA..."
              className="min-h-[120px]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="temperature">Temperature ({temperature})</Label>
              <Input
                id="temperature"
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">0 = Preciso, 2 = Criativo</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxTokens">Max Tokens</Label>
              <Input
                id="maxTokens"
                type="number"
                min="50"
                max="4000"
                step="50"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Limite de resposta</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label>Categorias da Base de Conhecimento</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Selecione quais categorias esta persona pode acessar. Deixe vazio para acessar todas.
              </p>
            </div>
            
            {loadingCategories ? (
              <p className="text-sm text-muted-foreground">Carregando categorias...</p>
            ) : availableCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma categoria encontrada. Crie artigos primeiro.</p>
            ) : (
              <div className="border rounded-lg p-4 space-y-2 max-h-[180px] overflow-y-auto">
                {availableCategories.map((category) => (
                  <div key={category} className="flex items-center space-x-2">
                    <Checkbox
                      id={`category-${category}`}
                      checked={selectedCategories.includes(category)}
                      onCheckedChange={() => toggleCategory(category)}
                    />
                <Label
                  htmlFor={`category-${category}`}
                  className="cursor-pointer"
                >
                  {category}
                </Label>
                  </div>
                ))}
              </div>
            )}
            
            {selectedCategories.length > 0 && (
              <div className="text-xs text-muted-foreground">
                ✅ {selectedCategories.length} categoria(s) selecionada(s): {selectedCategories.join(", ")}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label htmlFor="isActive">Persona Ativa</Label>
              <p className="text-sm text-muted-foreground">Permitir uso em conversações</p>
            </div>
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/20">
            <div className="flex-1">
              <Label htmlFor="usePriorityInstructions" className="flex items-center gap-2">
                🔐 Instruções Prioritárias
                <span className="text-xs font-normal text-amber-600 dark:text-amber-500">(Requer Autorização)</span>
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Quando ativado, usa instruções personalizadas para boas-vindas e verificação OTP. 
                <span className="text-amber-600 dark:text-amber-500 font-medium"> Apenas Admin/Manager podem ativar.</span>
              </p>
            </div>
            <Switch
              id="usePriorityInstructions"
              checked={usePriorityInstructions}
              onCheckedChange={setUsePriorityInstructions}
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createPersona.isPending || updatePersona.isPending}>
              {persona ? "Salvar Alterações" : "Criar Persona"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
