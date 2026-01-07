import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import type { FormField, FieldScoringOption } from "@/hooks/useForms";

interface FieldScoringConfigProps {
  field: FormField;
  onUpdate: (updates: Partial<FormField>) => void;
}

export function FieldScoringConfig({ field, onUpdate }: FieldScoringConfigProps) {
  const scoringEnabled = field.scoring?.enabled ?? false;

  // Get options based on field type
  const getFieldOptions = (): string[] => {
    if (field.type === "select" && field.options) {
      return field.options;
    }
    if (field.type === "yes_no") {
      return ["Sim", "Não"];
    }
    if (field.type === "rating") {
      const min = field.min ?? 0;
      const max = field.max ?? 10;
      return Array.from({ length: max - min + 1 }, (_, i) => String(min + i));
    }
    return [];
  };

  const fieldOptions = getFieldOptions();

  // Initialize scoring options if needed
  const initializeScoring = (enabled: boolean) => {
    if (enabled && (!field.scoring?.options || field.scoring.options.length === 0)) {
      const initialOptions: FieldScoringOption[] = fieldOptions.map(opt => ({
        value: opt,
        points: 0,
      }));
      onUpdate({
        scoring: {
          enabled: true,
          options: initialOptions,
        },
      });
    } else {
      onUpdate({
        scoring: {
          enabled,
          options: field.scoring?.options || [],
        },
      });
    }
  };

  // Update points for a specific option
  const updateOptionPoints = (value: string, points: number) => {
    const currentOptions = field.scoring?.options || [];
    const optionExists = currentOptions.find(o => o.value === value);
    
    let newOptions: FieldScoringOption[];
    if (optionExists) {
      newOptions = currentOptions.map(o => 
        o.value === value ? { ...o, points } : o
      );
    } else {
      newOptions = [...currentOptions, { value, points }];
    }

    onUpdate({
      scoring: {
        enabled: true,
        options: newOptions,
      },
    });
  };

  const getPointsForOption = (value: string): number => {
    return field.scoring?.options?.find(o => o.value === value)?.points ?? 0;
  };

  // Only show for scoreable field types
  const isScoreableType = ["select", "yes_no", "rating"].includes(field.type);
  
  if (!isScoreableType || fieldOptions.length === 0) {
    return null;
  }

  return (
    <Card className="border-dashed border-amber-500/50 bg-amber-500/5">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-sm font-medium">Scoring de Lead</CardTitle>
          </div>
          <Switch
            checked={scoringEnabled}
            onCheckedChange={initializeScoring}
          />
        </div>
      </CardHeader>
      
      {scoringEnabled && (
        <CardContent className="pt-0 pb-3 px-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Defina pontos para cada opção:
            </Label>
            <div className="grid gap-2">
              {fieldOptions.map((option) => (
                <div key={option} className="flex items-center gap-2">
                  <span className="flex-1 text-sm truncate" title={option}>
                    {option}
                  </span>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={getPointsForOption(option)}
                      onChange={(e) => updateOptionPoints(option, parseInt(e.target.value) || 0)}
                      className="w-16 h-8 text-center text-sm"
                    />
                    <span className="text-xs text-muted-foreground">pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
