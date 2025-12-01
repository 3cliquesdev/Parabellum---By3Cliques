import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateTrainingExample } from "@/hooks/useTrainingExamples";
import { Star } from "lucide-react";

interface SaveTrainingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personaId: string;
  userMessage: string;
  assistantMessage: string;
}

const categories = [
  "Objeções",
  "Dúvidas Técnicas",
  "Reclamações",
  "Solicitações Financeiras",
  "Informações Gerais",
  "Outro"
];

const scenarioTypes = [
  { value: "normal", label: "😊 Normal" },
  { value: "irritado", label: "😤 Irritado" },
  { value: "confuso", label: "😕 Confuso" },
  { value: "tecnico", label: "🤓 Técnico" }
];

export const SaveTrainingDialog = ({
  open,
  onOpenChange,
  personaId,
  userMessage,
  assistantMessage,
}: SaveTrainingDialogProps) => {
  const [editedOutput, setEditedOutput] = useState(assistantMessage);
  const [category, setCategory] = useState("");
  const [scenarioType, setScenarioType] = useState("normal");
  
  const createExample = useCreateTrainingExample();

  const handleSave = async () => {
    await createExample.mutateAsync({
      persona_id: personaId,
      input_text: userMessage,
      ideal_output: editedOutput,
      category,
      scenario_type: scenarioType
    });
    onOpenChange(false);
    setEditedOutput(assistantMessage);
    setCategory("");
    setScenarioType("normal");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Salvar como Exemplo de Treinamento
          </DialogTitle>
          <DialogDescription>
            Este exemplo será usado para treinar a IA através de Few-Shot Learning
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Cliente disse:</Label>
            <div className="p-3 bg-muted rounded-md text-sm mt-1">
              {userMessage}
            </div>
          </div>

          <div>
            <Label htmlFor="ideal-output">Como a IA DEVE responder:</Label>
            <Textarea
              id="ideal-output"
              value={editedOutput}
              onChange={(e) => setEditedOutput(e.target.value)}
              rows={6}
              className="mt-1"
              placeholder="Edite a resposta se necessário..."
            />
            <p className="text-xs text-muted-foreground mt-1">
              💡 Você pode ajustar a resposta para torná-la o exemplo ideal
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="scenario">Tipo de Cenário</Label>
              <Select value={scenarioType} onValueChange={setScenarioType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {scenarioTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={createExample.isPending}>
              <Star className="h-4 w-4 mr-2" />
              Salvar Exemplo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};