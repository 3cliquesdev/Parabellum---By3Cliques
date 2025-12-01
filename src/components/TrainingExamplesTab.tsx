import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit2, Plus, GraduationCap } from "lucide-react";
import { useTrainingExamples, useCreateTrainingExample, useDeleteTrainingExample, useUpdateTrainingExample } from "@/hooks/useTrainingExamples";

interface TrainingExamplesTabProps {
  personaId: string | null;
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
  { value: "normal", label: "😊 Normal", color: "bg-slate-100 text-slate-700" },
  { value: "irritado", label: "😤 Irritado", color: "bg-red-100 text-red-700" },
  { value: "confuso", label: "😕 Confuso", color: "bg-yellow-100 text-yellow-700" },
  { value: "tecnico", label: "🤓 Técnico", color: "bg-blue-100 text-blue-700" }
];

export const TrainingExamplesTab = ({ personaId }: TrainingExamplesTabProps) => {
  const [inputText, setInputText] = useState("");
  const [idealOutput, setIdealOutput] = useState("");
  const [category, setCategory] = useState<string>("");
  const [scenarioType, setScenarioType] = useState("normal");
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: examples, isLoading } = useTrainingExamples(personaId);
  const createExample = useCreateTrainingExample();
  const updateExample = useUpdateTrainingExample();
  const deleteExample = useDeleteTrainingExample();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personaId || !inputText || !idealOutput) return;

    if (editingId) {
      await updateExample.mutateAsync({
        id: editingId,
        data: { input_text: inputText, ideal_output: idealOutput, category, scenario_type: scenarioType }
      });
      setEditingId(null);
    } else {
      await createExample.mutateAsync({
        persona_id: personaId,
        input_text: inputText,
        ideal_output: idealOutput,
        category,
        scenario_type: scenarioType
      });
    }

    setInputText("");
    setIdealOutput("");
    setCategory("");
    setScenarioType("normal");
  };

  const handleEdit = (example: any) => {
    setInputText(example.input_text);
    setIdealOutput(example.ideal_output);
    setCategory(example.category || "");
    setScenarioType(example.scenario_type);
    setEditingId(example.id);
  };

  const handleCancelEdit = () => {
    setInputText("");
    setIdealOutput("");
    setCategory("");
    setScenarioType("normal");
    setEditingId(null);
  };

  if (!personaId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Salve a persona primeiro para adicionar exemplos de treinamento
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com estatísticas */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Exemplos de Treinamento (Few-Shot Learning)</h3>
        </div>
        <Badge variant="secondary">
          {examples?.length || 0} exemplos cadastrados
        </Badge>
      </div>

      {/* Formulário */}
      <Card className="p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="input">O que o cliente disse?</Label>
            <Input
              id="input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder='Ex: "Tá caro demais"'
              required
            />
          </div>

          <div>
            <Label htmlFor="output">Como a IA DEVE responder?</Label>
            <Textarea
              id="output"
              value={idealOutput}
              onChange={(e) => setIdealOutput(e.target.value)}
              placeholder="Ex: Entendo sua preocupação! O valor pode parecer alto à primeira vista, mas considere que..."
              rows={4}
              required
            />
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

          <div className="flex gap-2">
            <Button type="submit" disabled={createExample.isPending || updateExample.isPending}>
              {editingId ? (
                <>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Atualizar Exemplo
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Exemplo
                </>
              )}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={handleCancelEdit}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </Card>

      {/* Lista de exemplos */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Carregando exemplos...</div>
        ) : examples?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum exemplo cadastrado ainda. Adicione o primeiro exemplo acima!
          </div>
        ) : (
          examples?.map((example) => (
            <Card key={example.id} className="p-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Cliente disse:</Label>
                      <p className="text-sm font-medium">{example.input_text}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">IA deve responder:</Label>
                      <p className="text-sm">{example.ideal_output}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(example)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteExample.mutate(example.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  {example.category && (
                    <Badge variant="secondary" className="text-xs">
                      {example.category}
                    </Badge>
                  )}
                  <Badge 
                    className={`text-xs ${scenarioTypes.find(t => t.value === example.scenario_type)?.color}`}
                  >
                    {scenarioTypes.find(t => t.value === example.scenario_type)?.label}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Usado {example.usage_count}x
                  </Badge>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};