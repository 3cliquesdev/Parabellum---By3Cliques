import { FormSettings } from "@/hooks/useForms";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { ImageUploader } from "@/components/ImageUploader";

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
      <ImageUploader
        label="Logo"
        value={settings.logo_url}
        onChange={(url) => onChange({ logo_url: url || undefined })}
        folder="forms/logos"
      />

      <Separator />

      {/* Cores de Fundo */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm">Fundo</h4>
        
        <div className="space-y-2">
          <Label>Cor de Fundo da Página</Label>
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

        {/* Imagem de Fundo */}
        <ImageUploader
          label="Imagem de Fundo"
          value={settings.background_image}
          onChange={(url) => onChange({ background_image: url || undefined })}
          folder="forms/backgrounds"
          previewClassName="h-32"
        />
      </div>

      <Separator />

      {/* Card/Container */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm">Cartão / Container</h4>
        
        <div className="space-y-2">
          <Label>Cor do Container</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={settings.card_background_color || "#1a1a2e"}
              onChange={(e) => onChange({ card_background_color: e.target.value })}
              className="w-12 h-9 p-1 cursor-pointer"
            />
            <Input
              value={settings.card_background_color || "#1a1a2e"}
              onChange={(e) => onChange({ card_background_color: e.target.value })}
              className="flex-1"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Opacidade do Container: {settings.card_opacity ?? 90}%</Label>
          <Slider
            value={[settings.card_opacity ?? 90]}
            onValueChange={([val]) => onChange({ card_opacity: val })}
            min={0}
            max={100}
            step={5}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Valores menores criam efeito de glassmorphism
          </p>
        </div>

        <div className="space-y-2">
          <Label>Arredondamento: {settings.border_radius ?? 16}px</Label>
          <Slider
            value={[settings.border_radius ?? 16]}
            onValueChange={([val]) => onChange({ border_radius: val })}
            min={0}
            max={30}
            step={2}
            className="w-full"
          />
        </div>
      </div>

      <Separator />

      {/* Textos */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm">Textos</h4>
        
        <div className="space-y-2">
          <Label>Cor do Título</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={settings.title_color || settings.text_color || "#ffffff"}
              onChange={(e) => onChange({ title_color: e.target.value })}
              className="w-12 h-9 p-1 cursor-pointer"
            />
            <Input
              value={settings.title_color || settings.text_color || "#ffffff"}
              onChange={(e) => onChange({ title_color: e.target.value })}
              className="flex-1"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Cor da Descrição</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={settings.description_color || settings.text_color || "#ffffff"}
              onChange={(e) => onChange({ description_color: e.target.value })}
              className="w-12 h-9 p-1 cursor-pointer"
            />
            <Input
              value={settings.description_color || settings.text_color || "#ffffff"}
              onChange={(e) => onChange({ description_color: e.target.value })}
              className="flex-1"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Cor dos Labels/Textos</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={settings.text_color || "#ffffff"}
              onChange={(e) => onChange({ text_color: e.target.value })}
              className="w-12 h-9 p-1 cursor-pointer"
            />
            <Input
              value={settings.text_color || "#ffffff"}
              onChange={(e) => onChange({ text_color: e.target.value })}
              className="flex-1"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Inputs */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm">Campos de Entrada</h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Fundo do Input</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={settings.input_background_color || "#ffffff"}
                onChange={(e) => onChange({ input_background_color: e.target.value })}
                className="w-12 h-9 p-1 cursor-pointer"
              />
              <Input
                value={settings.input_background_color || "#ffffff"}
                onChange={(e) => onChange({ input_background_color: e.target.value })}
                className="flex-1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Texto do Input</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={settings.input_text_color || "#000000"}
                onChange={(e) => onChange({ input_text_color: e.target.value })}
                className="w-12 h-9 p-1 cursor-pointer"
              />
              <Input
                value={settings.input_text_color || "#000000"}
                onChange={(e) => onChange({ input_text_color: e.target.value })}
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Borda do Input</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={settings.input_border_color || "#e5e7eb"}
              onChange={(e) => onChange({ input_border_color: e.target.value })}
              className="w-12 h-9 p-1 cursor-pointer"
            />
            <Input
              value={settings.input_border_color || "#e5e7eb"}
              onChange={(e) => onChange({ input_border_color: e.target.value })}
              className="flex-1"
            />
          </div>
        </div>

        <Separator className="my-2" />

        {/* Opções de Seleção */}
        <h4 className="font-medium text-sm pt-2">Opções de Seleção</h4>
        <p className="text-xs text-muted-foreground">Personalize como as opções selecionadas aparecem</p>

        <div className="space-y-2">
          <Label>Cor do Destaque (Borda)</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={settings.selection_highlight_color || settings.button_color || "#3b82f6"}
              onChange={(e) => onChange({ selection_highlight_color: e.target.value })}
              className="w-12 h-9 p-1 cursor-pointer"
            />
            <Input
              value={settings.selection_highlight_color || settings.button_color || "#3b82f6"}
              onChange={(e) => onChange({ selection_highlight_color: e.target.value })}
              className="flex-1"
              placeholder="Usa cor do botão se vazio"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Cor de Fundo (Selecionado)</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={settings.selection_background_color || settings.button_color || "#3b82f6"}
              onChange={(e) => onChange({ selection_background_color: e.target.value })}
              className="w-12 h-9 p-1 cursor-pointer"
            />
            <Input
              value={settings.selection_background_color || settings.button_color || "#3b82f6"}
              onChange={(e) => onChange({ selection_background_color: e.target.value })}
              className="flex-1"
              placeholder="Usa cor do botão se vazio"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Cor do Texto (Selecionado)</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={settings.selection_text_color || settings.button_text_color || "#ffffff"}
              onChange={(e) => onChange({ selection_text_color: e.target.value })}
              className="w-12 h-9 p-1 cursor-pointer"
            />
            <Input
              value={settings.selection_text_color || settings.button_text_color || "#ffffff"}
              onChange={(e) => onChange({ selection_text_color: e.target.value })}
              className="flex-1"
              placeholder="Usa cor do texto do botão se vazio"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Botão */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm">Botão de Ação</h4>

        <div className="space-y-2">
          <Label>Texto do Botão</Label>
          <Input
            value={settings.button_text || "Continuar"}
            onChange={(e) => onChange({ button_text: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
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

          <div className="space-y-2">
            <Label>Cor do Texto</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={settings.button_text_color || "#ffffff"}
                onChange={(e) => onChange({ button_text_color: e.target.value })}
                className="w-12 h-9 p-1 cursor-pointer"
              />
              <Input
                value={settings.button_text_color || "#ffffff"}
                onChange={(e) => onChange({ button_text_color: e.target.value })}
                className="flex-1"
              />
            </div>
          </div>
        </div>
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
