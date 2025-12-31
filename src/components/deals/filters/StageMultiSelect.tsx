import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useStages } from "@/hooks/useStages";

interface StageMultiSelectProps {
  pipelineId: string;
  selected: string[];
  onChange: (stageIds: string[]) => void;
}

export function StageMultiSelect({ pipelineId, selected, onChange }: StageMultiSelectProps) {
  const { data: stages } = useStages(pipelineId);

  const toggleStage = (stageId: string) => {
    if (selected.includes(stageId)) {
      onChange(selected.filter((s) => s !== stageId));
    } else {
      onChange([...selected, stageId]);
    }
  };

  if (!stages || stages.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma etapa disponível</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
      {stages.map((stage) => (
        <div key={stage.id} className="flex items-center space-x-2">
          <Checkbox
            id={`stage-${stage.id}`}
            checked={selected.includes(stage.id)}
            onCheckedChange={() => toggleStage(stage.id)}
          />
          <Label
            htmlFor={`stage-${stage.id}`}
            className="text-sm font-normal cursor-pointer flex items-center gap-2"
          >
            <span
              className="w-3 h-3 rounded-full bg-primary"
            />
            {stage.name}
          </Label>
        </div>
      ))}
    </div>
  );
}
