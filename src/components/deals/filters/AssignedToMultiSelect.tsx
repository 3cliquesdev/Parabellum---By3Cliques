import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSalesReps } from "@/hooks/useSalesReps";

interface AssignedToMultiSelectProps {
  selected: string[];
  onChange: (userIds: string[]) => void;
}

export function AssignedToMultiSelect({ selected, onChange }: AssignedToMultiSelectProps) {
  const { data: salesReps } = useSalesReps();

  const toggleUser = (userId: string) => {
    if (selected.includes(userId)) {
      onChange(selected.filter((s) => s !== userId));
    } else {
      onChange([...selected, userId]);
    }
  };

  if (!salesReps || salesReps.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum vendedor disponível</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
      {salesReps.map((rep) => (
        <div key={rep.id} className="flex items-center space-x-2">
          <Checkbox
            id={`rep-${rep.id}`}
            checked={selected.includes(rep.id)}
            onCheckedChange={() => toggleUser(rep.id)}
          />
          <Label
            htmlFor={`rep-${rep.id}`}
            className="text-sm font-normal cursor-pointer flex items-center gap-2"
          >
            <Avatar className="h-6 w-6">
              <AvatarImage src={rep.avatar_url || undefined} />
              <AvatarFallback className="text-xs">
                {rep.full_name?.substring(0, 2).toUpperCase() || "??"}
              </AvatarFallback>
            </Avatar>
            {rep.full_name || "Sem nome"}
          </Label>
        </div>
      ))}
    </div>
  );
}
