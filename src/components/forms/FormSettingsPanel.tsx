import { FormSettings } from "@/hooks/useForms";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

interface FormSettingsPanelProps {
  settings: FormSettings;
  onChange: (updates: Partial<FormSettings>) => void;
}

export function FormSettingsPanel({ settings, onChange }: FormSettingsPanelProps) {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-semibold mb-4">Design do Formulário</h4>
      </div>

      {/* Logo */}
      <div className="space-y-2">
        <Label>Logo (URL)</Label>
        <Input
          value={settings.logo_url || ""}
          onChange={(e) => onChange({ logo_url: e.target.value })}
          placeholder="https://..."
        />
      </div>

      {/* Cores */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Cor de Fundo</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={settings.background_color || "#0a0a0a"}
              onChange={(e) => onChange({ background_color: e.target.value })}
              className="w-12 h-9 p-1 cursor-pointer"
            />
            <Input
              value={settings.background_color || "#0a0a0a"}
              onChange={(e) => onChange({ background_color: e.target.value })}
              className="flex-1"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Cor do Botão</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={settings.button_color || "#2563EB"}
              onChange={(e) => onChange({ button_color: e.target.value })}
              className="w-12 h-9 p-1 cursor-pointer"
            />
            <Input
              value={settings.button_color || "#2563EB"}
              onChange={(e) => onChange({ button_color: e.target.value })}
              className="flex-1"
            />
          </div>
        </div>
      </div>

      {/* Imagem de Fundo */}
      <div className="space-y-2">
        <Label>Imagem de Fundo (URL)</Label>
        <Input
          value={settings.background_image || ""}
          onChange={(e) => onChange({ background_image: e.target.value })}
          placeholder="https://..."
        />
      </div>

      <Separator />

      {/* Texto do Botão */}
      <div className="space-y-2">
        <Label>Texto do Botão</Label>
        <Input
          value={settings.button_text || "Continuar"}
          onChange={(e) => onChange({ button_text: e.target.value })}
        />
      </div>

      <Separator />

      {/* Navegação */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm">Navegação</h4>
        
        <div className="flex items-center justify-between">
          <Label>Barra de Progresso</Label>
          <Switch
            checked={settings.show_progress_bar !== false}
            onCheckedChange={(checked) => onChange({ show_progress_bar: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label>Permitir Voltar</Label>
          <Switch
            checked={settings.allow_back_navigation !== false}
            onCheckedChange={(checked) => onChange({ allow_back_navigation: checked })}
          />
        </div>
      </div>

      <Separator />

      {/* Mensagem de Sucesso */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm">Tela de Sucesso</h4>

        <div className="space-y-2">
          <Label>Título</Label>
          <Input
            value={settings.thank_you_title || "Obrigado!"}
            onChange={(e) => onChange({ thank_you_title: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Mensagem</Label>
          <Textarea
            value={settings.thank_you_message || "Suas respostas foram enviadas com sucesso."}
            onChange={(e) => onChange({ thank_you_message: e.target.value })}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label>URL de Redirecionamento (opcional)</Label>
          <Input
            value={settings.redirect_url || ""}
            onChange={(e) => onChange({ redirect_url: e.target.value })}
            placeholder="https://..."
          />
        </div>
      </div>
    </div>
  );
}
