import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSkills } from "@/hooks/useSkills";
import { Loader2 } from "lucide-react";

interface SkillsMultiSelectProps {
  selectedSkillIds: string[];
  onSelectionChange: (skillIds: string[]) => void;
}

export default function SkillsMultiSelect({ 
  selectedSkillIds, 
  onSelectionChange 
}: SkillsMultiSelectProps) {
  const { data: skills, isLoading } = useSkills();

  const handleToggle = (skillId: string) => {
    if (selectedSkillIds.includes(skillId)) {
      onSelectionChange(selectedSkillIds.filter(id => id !== skillId));
    } else {
      onSelectionChange([...selectedSkillIds, skillId]);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Carregando habilidades...</span>
      </div>
    );
  }

  if (!skills || skills.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        Nenhuma habilidade cadastrada. Crie habilidades em Configurações → Habilidades.
      </div>
    );
  }

  return (
    <ScrollArea className="h-[200px] border rounded-md p-4">
      <div className="space-y-3">
        {skills.map((skill) => {
          const isSelected = selectedSkillIds.includes(skill.id);
          
          return (
            <div key={skill.id} className="flex items-center space-x-3">
              <Checkbox
                id={`skill-${skill.id}`}
                checked={isSelected}
                onCheckedChange={() => handleToggle(skill.id)}
              />
              <Label
                htmlFor={`skill-${skill.id}`}
                className="flex items-center gap-2 cursor-pointer flex-1"
              >
                <Badge
                  style={{
                    backgroundColor: skill.color,
                    color: 'white'
                  }}
                  className="text-xs"
                >
                  {skill.name}
                </Badge>
                {skill.description && (
                  <span className="text-xs text-muted-foreground">
                    {skill.description}
                  </span>
                )}
              </Label>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
