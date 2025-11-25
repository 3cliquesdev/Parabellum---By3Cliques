import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useCreatePersona } from "@/hooks/useCreatePersona";
import { useUpdatePersona } from "@/hooks/useUpdatePersona";

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
  const [knowledgeBase, setKnowledgeBase] = useState("");
  const [isActive, setIsActive] = useState(true);

  const createPersona = useCreatePersona();
  const updatePersona = useUpdatePersona();

  useEffect(() => {
    if (persona) {
      setName(persona.name);
      setRole(persona.role);
      setSystemPrompt(persona.system_prompt);
      setTemperature(persona.temperature ?? 0.7);
      setMaxTokens(persona.max_tokens ?? 500);
      setKnowledgeBase(persona.knowledge_base_paths?.join("\n") ?? "");
      setIsActive(persona.is_active ?? true);
    } else {
      setName("");
      setRole("");
      setSystemPrompt("");
      setTemperature(0.7);
      setMaxTokens(500);
      setKnowledgeBase("");
      setIsActive(true);
    }
  }, [persona, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const knowledgePaths = knowledgeBase
      .split("\n")
      .map((path) => path.trim())
      .filter((path) => path.length > 0);

    const data = {
      name,
      role,
      system_prompt: systemPrompt,
      temperature,
      max_tokens: maxTokens,
      knowledge_base_paths: knowledgePaths.length > 0 ? knowledgePaths : null,
      is_active: isActive,
    };

    if (persona) {
      await updatePersona.mutateAsync({ id: persona.id, data });
    } else {
      await createPersona.mutateAsync(data);
    }

    setOpen(false);
    onOpenChange?.(false);
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

          <div className="space-y-2">
            <Label htmlFor="knowledgeBase">Base de Conhecimento (opcional)</Label>
            <Textarea
              id="knowledgeBase"
              value={knowledgeBase}
              onChange={(e) => setKnowledgeBase(e.target.value)}
              placeholder="Caminhos para documentos (um por linha)&#10;/docs/vendas/processo.md&#10;/docs/produtos/catalogo.md"
              className="min-h-[80px] font-mono text-xs"
            />
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
