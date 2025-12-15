import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, MessageSquare } from "lucide-react";
import { FormDisplayMode } from "@/hooks/useForms";

interface DisplayModeSelectorProps {
  value: FormDisplayMode;
  onChange: (value: FormDisplayMode) => void;
}

export function DisplayModeSelector({ value, onChange }: DisplayModeSelectorProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Modo de Exibição</CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={value}
          onValueChange={(v) => onChange(v as FormDisplayMode)}
          className="space-y-3"
        >
          <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
            <RadioGroupItem value="single_page" id="single_page" className="mt-0.5" />
            <Label htmlFor="single_page" className="cursor-pointer flex-1">
              <div className="flex items-center gap-2 font-medium">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Página Única
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Todos os campos visíveis de uma vez (formulário tradicional)
              </p>
            </Label>
          </div>
          <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
            <RadioGroupItem value="conversational" id="conversational" className="mt-0.5" />
            <Label htmlFor="conversational" className="cursor-pointer flex-1">
              <div className="flex items-center gap-2 font-medium">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                Conversacional
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Um campo por vez, estilo Typeform
              </p>
            </Label>
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
