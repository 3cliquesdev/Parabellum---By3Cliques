import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDepartments } from "@/hooks/useDepartments";
import { Loader2, X } from "lucide-react";

interface DepartmentsMultiSelectProps {
  selectedDepartmentIds: string[];
  onSelectionChange: (ids: string[]) => void;
  excludeId?: string; // Não listar o departamento primário
}

export default function DepartmentsMultiSelect({
  selectedDepartmentIds,
  onSelectionChange,
  excludeId,
}: DepartmentsMultiSelectProps) {
  const { data: departments, isLoading } = useDepartments({ activeOnly: true });

  const handleToggle = (deptId: string) => {
    if (selectedDepartmentIds.includes(deptId)) {
      onSelectionChange(selectedDepartmentIds.filter(id => id !== deptId));
    } else {
      onSelectionChange([...selectedDepartmentIds, deptId]);
    }
  };

  const filteredDepts = departments?.filter(d => d.id !== excludeId) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  if (filteredDepts.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        Nenhum departamento adicional disponível
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Selecionados (chips) */}
      {selectedDepartmentIds.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {selectedDepartmentIds
            .map(id => filteredDepts.find(d => d.id === id))
            .filter(Boolean)
            .map(dept => (
              <Badge
                key={dept?.id}
                style={{ backgroundColor: dept?.color }}
                className="flex items-center gap-1 cursor-pointer text-white hover:opacity-80 transition-opacity"
                onClick={() => handleToggle(dept!.id)}
              >
                {dept?.name}
                <X className="w-3 h-3" />
              </Badge>
            ))}
        </div>
      )}

      {/* Lista de seleção */}
      <ScrollArea className="h-[200px] border rounded-md p-4 bg-background">
        <div className="space-y-3">
          {filteredDepts.map(dept => (
            <div key={dept.id} className="flex items-center space-x-3">
              <Checkbox
                id={`dept-${dept.id}`}
                checked={selectedDepartmentIds.includes(dept.id)}
                onCheckedChange={() => handleToggle(dept.id)}
              />
              <Label
                htmlFor={`dept-${dept.id}`}
                className="flex items-center gap-2 cursor-pointer flex-1"
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: dept.color }}
                />
                <span className="text-sm">{dept.name}</span>
              </Label>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
