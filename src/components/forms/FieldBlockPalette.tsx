import { FormFieldType } from "@/hooks/useForms";
import { Button } from "@/components/ui/button";
import { 
  Type, 
  Mail, 
  Phone, 
  List, 
  Star, 
  AlignLeft, 
  ThumbsUp, 
  Calendar,
  Hash,
  Paperclip
} from "lucide-react";

interface FieldBlockPaletteProps {
  onAddField: (type: FormFieldType) => void;
}

const FIELD_BLOCKS: { type: FormFieldType; label: string; icon: React.ReactNode; description: string }[] = [
  { type: "text", label: "Texto Curto", icon: <Type className="h-4 w-4" />, description: "Nome, título..." },
  { type: "email", label: "E-mail", icon: <Mail className="h-4 w-4" />, description: "Endereço de e-mail" },
  { type: "phone", label: "Telefone", icon: <Phone className="h-4 w-4" />, description: "Número de telefone" },
  { type: "long_text", label: "Texto Longo", icon: <AlignLeft className="h-4 w-4" />, description: "Comentários, feedback..." },
  { type: "select", label: "Múltipla Escolha", icon: <List className="h-4 w-4" />, description: "Lista de opções" },
  { type: "rating", label: "Avaliação 0-10", icon: <Star className="h-4 w-4" />, description: "Escala NPS" },
  { type: "yes_no", label: "Sim / Não", icon: <ThumbsUp className="h-4 w-4" />, description: "Resposta binária" },
  { type: "date", label: "Data", icon: <Calendar className="h-4 w-4" />, description: "Seletor de data" },
  { type: "number", label: "Número", icon: <Hash className="h-4 w-4" />, description: "Valor numérico" },
  { type: "file", label: "Anexo", icon: <Paperclip className="h-4 w-4" />, description: "Upload de arquivos" },
];

export function FieldBlockPalette({ onAddField }: FieldBlockPaletteProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        Clique para adicionar ao formulário
      </p>
      {FIELD_BLOCKS.map((block) => (
        <Button
          key={block.type}
          variant="outline"
          className="w-full justify-start gap-3 h-auto py-3 px-3 hover:bg-primary/5 hover:border-primary/30 transition-all"
          onClick={() => onAddField(block.type)}
        >
          <div className="flex-shrink-0 h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center text-primary">
            {block.icon}
          </div>
          <div className="text-left">
            <p className="font-medium text-sm">{block.label}</p>
            <p className="text-xs text-muted-foreground">{block.description}</p>
          </div>
        </Button>
      ))}
    </div>
  );
}
