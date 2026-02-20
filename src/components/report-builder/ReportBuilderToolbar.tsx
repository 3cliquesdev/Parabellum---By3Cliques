import { Button } from "@/components/ui/button";
import { Play, Save } from "lucide-react";

interface ReportBuilderToolbarProps {
  onPreview: () => void;
  onSave: () => void;
  previewDisabled?: boolean;
  saveDisabled?: boolean;
  loading?: boolean;
}

export function ReportBuilderToolbar({ onPreview, onSave, previewDisabled, saveDisabled, loading }: ReportBuilderToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      <Button onClick={onPreview} disabled={previewDisabled || loading}>
        <Play className="h-4 w-4 mr-1" />
        {loading ? "Executando..." : "Preview"}
      </Button>
      <Button variant="outline" onClick={onSave} disabled={saveDisabled}>
        <Save className="h-4 w-4 mr-1" />
        Salvar
      </Button>
    </div>
  );
}
