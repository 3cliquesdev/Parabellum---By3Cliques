import { FormSettings, LogoPosition, LogoSize, FontFamily, FontWeight, TransitionType, EntryAnimation, GradientDirection } from "@/hooks/useForms";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { ImageUploader } from "@/components/ImageUploader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlignLeft, AlignCenter, AlignRight, Zap, Palette, Sparkles, Moon, Sun, Flame, Leaf, Waves, Gem } from "lucide-react";

// Temas pré-definidos
const PREDEFINED_THEMES: Record<string, { name: string; icon: React.ReactNode; settings: Partial<FormSettings> }> = {
  dark_elegant: {
    name: "Dark Elegante",
    icon: <Moon className="h-4 w-4" />,
    settings: {
      background_color: "#0a0a0a",
      background_gradient_enabled: true,
      background_gradient_from: "#1a1a2e",
      background_gradient_to: "#0a0a0a",
      background_gradient_direction: "to-b",
      card_background_color: "#1a1a2e",
      card_opacity: 90,
      text_color: "#ffffff",
      title_color: "#ffffff",
      description_color: "#e0e0e0",
      button_color: "#6366f1",
      button_text_color: "#ffffff",
      input_background_color: "#ffffff",
      input_text_color: "#000000",
      border_radius: 16,
      font_family: "inter",
      title_weight: "bold",
    },
  },
  light_minimal: {
    name: "Light Minimal",
    icon: <Sun className="h-4 w-4" />,
    settings: {
      background_color: "#f8fafc",
      background_gradient_enabled: false,
      card_background_color: "#ffffff",
      card_opacity: 100,
      card_shadow: true,
      card_shadow_intensity: 2,
      text_color: "#1e293b",
      title_color: "#0f172a",
      description_color: "#475569",
      button_color: "#0f172a",
      button_text_color: "#ffffff",
      input_background_color: "#f1f5f9",
      input_text_color: "#1e293b",
      input_border_color: "#e2e8f0",
      border_radius: 12,
      font_family: "inter",
      title_weight: "semibold",
    },
  },
  vibrant_gradient: {
    name: "Vibrante",
    icon: <Flame className="h-4 w-4" />,
    settings: {
      background_gradient_enabled: true,
      background_gradient_from: "#7c3aed",
      background_gradient_to: "#db2777",
      background_gradient_direction: "to-br",
      card_background_color: "#ffffff",
      card_opacity: 95,
      card_shadow: true,
      card_shadow_intensity: 4,
      text_color: "#1e1e1e",
      title_color: "#7c3aed",
      description_color: "#6b7280",
      button_color: "#7c3aed",
      button_text_color: "#ffffff",
      input_background_color: "#faf5ff",
      input_text_color: "#1e1e1e",
      border_radius: 20,
      font_family: "poppins",
      title_weight: "bold",
      hover_glow: true,
    },
  },
  nature_calm: {
    name: "Natureza",
    icon: <Leaf className="h-4 w-4" />,
    settings: {
      background_gradient_enabled: true,
      background_gradient_from: "#134e4a",
      background_gradient_to: "#0f766e",
      background_gradient_direction: "to-b",
      card_background_color: "#ffffff",
      card_opacity: 92,
      card_shadow: true,
      text_color: "#134e4a",
      title_color: "#0f766e",
      description_color: "#5eead4",
      button_color: "#14b8a6",
      button_text_color: "#ffffff",
      input_background_color: "#f0fdfa",
      input_text_color: "#134e4a",
      border_radius: 16,
      font_family: "lato",
      title_weight: "semibold",
    },
  },
  ocean_blue: {
    name: "Oceano",
    icon: <Waves className="h-4 w-4" />,
    settings: {
      background_gradient_enabled: true,
      background_gradient_from: "#0c4a6e",
      background_gradient_to: "#082f49",
      background_gradient_direction: "radial",
      card_background_color: "#0ea5e9",
      card_opacity: 20,
      card_border_color: "#38bdf8",
      card_border_width: 1,
      text_color: "#ffffff",
      title_color: "#7dd3fc",
      description_color: "#bae6fd",
      button_color: "#0ea5e9",
      button_text_color: "#ffffff",
      input_background_color: "#ffffff",
      input_text_color: "#0c4a6e",
      border_radius: 12,
      font_family: "montserrat",
      title_weight: "bold",
    },
  },
  luxury_gold: {
    name: "Luxo",
    icon: <Gem className="h-4 w-4" />,
    settings: {
      background_color: "#0c0c0c",
      background_gradient_enabled: false,
      card_background_color: "#1c1c1c",
      card_opacity: 100,
      card_border_color: "#d4af37",
      card_border_width: 2,
      card_shadow: true,
      card_shadow_intensity: 3,
      text_color: "#f5f5f5",
      title_color: "#d4af37",
      description_color: "#a3a3a3",
      button_color: "#d4af37",
      button_text_color: "#0c0c0c",
      input_background_color: "#2a2a2a",
      input_text_color: "#f5f5f5",
      input_border_color: "#404040",
      border_radius: 8,
      font_family: "playfair",
      title_weight: "bold",
      letter_spacing: 1,
    },
  },
};

interface FormSettingsPanelProps {
  settings: FormSettings;
  onChange: (updates: Partial<FormSettings>) => void;
}

export function FormSettingsPanel({ settings, onChange }: FormSettingsPanelProps) {
  const applyTheme = (themeKey: string) => {
    const theme = PREDEFINED_THEMES[themeKey];
    if (theme) {
      onChange(theme.settings);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-semibold mb-4">Design do Formulário</h4>
      </div>

      {/* Temas Pré-definidos */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" />
          <Label>Temas Prontos</Label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(PREDEFINED_THEMES).map(([key, theme]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyTheme(key)}
              className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-muted/30 hover:bg-muted hover:border-primary/50 transition-all text-left group"
            >
              <span className="text-muted-foreground group-hover:text-primary transition-colors">
                {theme.icon}
              </span>
              <span className="text-xs font-medium">{theme.name}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Clique em um tema para aplicar. Personalize depois.
        </p>
      </div>

      <Separator />

      {/* Logo */}
      <ImageUploader
        label="Logo"
        value={settings.logo_url}
        onChange={(url) => onChange({ logo_url: url || undefined })}
        folder="forms/logos"
      />

      {/* Logo Position */}
      <div className="space-y-2">
        <Label>Posição do Logo</Label>
        <div className="flex gap-2">
          {[
            { value: "left" as LogoPosition, icon: AlignLeft, label: "Esquerda" },
            { value: "center" as LogoPosition, icon: AlignCenter, label: "Centro" },
            { value: "right" as LogoPosition, icon: AlignRight, label: "Direita" },
          ].map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange({ logo_position: value })}
              className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-md border transition-colors ${
                (settings.logo_position || "left") === value 
                  ? "bg-primary text-primary-foreground border-primary" 
                  : "bg-muted/50 hover:bg-muted border-border"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="text-xs">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Logo Size */}
      <div className="space-y-2">
        <Label>Tamanho do Logo</Label>
        <Select
          value={settings.logo_size || "medium"}
          onValueChange={(value: LogoSize) => onChange({ logo_size: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="small">Pequeno (24px)</SelectItem>
            <SelectItem value="medium">Médio (40px)</SelectItem>
            <SelectItem value="large">Grande (64px)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Cores de Fundo */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm">Fundo</h4>
        
        {/* Gradient Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Usar Gradiente</Label>
            <p className="text-xs text-muted-foreground">Fundo com gradiente de cores</p>
          </div>
          <Switch
            checked={settings.background_gradient_enabled === true}
            onCheckedChange={(checked) => onChange({ background_gradient_enabled: checked })}
          />
        </div>

        {settings.background_gradient_enabled ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Cor Inicial</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={settings.background_gradient_from || "#1a1a2e"}
                    onChange={(e) => onChange({ background_gradient_from: e.target.value })}
                    className="w-10 h-9 p-1 cursor-pointer"
                  />
                  <Input
                    value={settings.background_gradient_from || "#1a1a2e"}
                    onChange={(e) => onChange({ background_gradient_from: e.target.value })}
                    className="flex-1 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cor Final</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={settings.background_gradient_to || "#0a0a0a"}
                    onChange={(e) => onChange({ background_gradient_to: e.target.value })}
                    className="w-10 h-9 p-1 cursor-pointer"
                  />
                  <Input
                    value={settings.background_gradient_to || "#0a0a0a"}
                    onChange={(e) => onChange({ background_gradient_to: e.target.value })}
                    className="flex-1 text-xs"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Direção do Gradiente</Label>
              <Select
                value={settings.background_gradient_direction || "to-b"}
                onValueChange={(value: GradientDirection) => onChange({ background_gradient_direction: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="to-b">↓ Vertical (Cima → Baixo)</SelectItem>
                  <SelectItem value="to-r">→ Horizontal (Esquerda → Direita)</SelectItem>
                  <SelectItem value="to-br">↘ Diagonal (Canto Superior Esq → Inf Dir)</SelectItem>
                  <SelectItem value="to-bl">↙ Diagonal (Canto Superior Dir → Inf Esq)</SelectItem>
                  <SelectItem value="radial">◉ Radial (Centro → Bordas)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        ) : (
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
        )}

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

        <Separator className="my-2" />

        {/* Container Shadow */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Sombra do Container</Label>
            <p className="text-xs text-muted-foreground">Adiciona profundidade</p>
          </div>
          <Switch
            checked={settings.card_shadow !== false}
            onCheckedChange={(checked) => onChange({ card_shadow: checked })}
          />
        </div>

        {settings.card_shadow !== false && (
          <div className="space-y-2">
            <Label>Intensidade da Sombra: {settings.card_shadow_intensity ?? 3}</Label>
            <Slider
              value={[settings.card_shadow_intensity ?? 3]}
              onValueChange={([val]) => onChange({ card_shadow_intensity: val })}
              min={1}
              max={5}
              step={1}
              className="w-full"
            />
          </div>
        )}

        <Separator className="my-2" />

        {/* Container Border */}
        <div className="space-y-2">
          <Label>Borda do Container</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={settings.card_border_color || "#333333"}
              onChange={(e) => onChange({ card_border_color: e.target.value })}
              className="w-12 h-9 p-1 cursor-pointer"
            />
            <Input
              value={settings.card_border_color || ""}
              onChange={(e) => onChange({ card_border_color: e.target.value })}
              className="flex-1"
              placeholder="Sem borda"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Espessura da Borda: {settings.card_border_width ?? 0}px</Label>
          <Slider
            value={[settings.card_border_width ?? 0]}
            onValueChange={([val]) => onChange({ card_border_width: val })}
            min={0}
            max={5}
            step={1}
            className="w-full"
          />
        </div>
      </div>

      <Separator />

      {/* Tipografia */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm">Tipografia</h4>
        
        <div className="space-y-2">
          <Label>Fonte</Label>
          <Select
            value={settings.font_family || "inter"}
            onValueChange={(value: FontFamily) => onChange({ font_family: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inter">Inter (Moderna)</SelectItem>
              <SelectItem value="poppins">Poppins (Geométrica)</SelectItem>
              <SelectItem value="roboto">Roboto (Clean)</SelectItem>
              <SelectItem value="montserrat">Montserrat (Elegante)</SelectItem>
              <SelectItem value="playfair">Playfair Display (Clássica)</SelectItem>
              <SelectItem value="lato">Lato (Humanista)</SelectItem>
              <SelectItem value="raleway">Raleway (Sofisticada)</SelectItem>
              <SelectItem value="oswald">Oswald (Impactante)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Peso do Título</Label>
            <Select
              value={settings.title_weight || "bold"}
              onValueChange={(value: FontWeight) => onChange({ title_weight: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Leve (300)</SelectItem>
                <SelectItem value="normal">Normal (400)</SelectItem>
                <SelectItem value="medium">Médio (500)</SelectItem>
                <SelectItem value="semibold">Semi-Bold (600)</SelectItem>
                <SelectItem value="bold">Bold (700)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Peso dos Labels</Label>
            <Select
              value={settings.label_weight || "bold"}
              onValueChange={(value: FontWeight) => onChange({ label_weight: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Leve (300)</SelectItem>
                <SelectItem value="normal">Normal (400)</SelectItem>
                <SelectItem value="medium">Médio (500)</SelectItem>
                <SelectItem value="semibold">Semi-Bold (600)</SelectItem>
                <SelectItem value="bold">Bold (700)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Tamanho do Título: {settings.title_size ?? 24}px</Label>
          <Slider
            value={[settings.title_size ?? 24]}
            onValueChange={([val]) => onChange({ title_size: val })}
            min={16}
            max={48}
            step={2}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label>Tamanho da Descrição: {settings.description_size ?? 14}px</Label>
          <Slider
            value={[settings.description_size ?? 14]}
            onValueChange={([val]) => onChange({ description_size: val })}
            min={12}
            max={24}
            step={1}
            className="w-full"
          />
        </div>

        <Separator className="my-2" />

        <div className="space-y-2">
          <Label>Espaçamento entre Letras: {settings.letter_spacing ?? 0}px</Label>
          <Slider
            value={[settings.letter_spacing ?? 0]}
            onValueChange={([val]) => onChange({ letter_spacing: val })}
            min={-2}
            max={4}
            step={0.5}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Ajuste a distância entre caracteres
          </p>
        </div>

        <div className="space-y-2">
          <Label>Altura de Linha: {(settings.line_height ?? 1.5).toFixed(1)}</Label>
          <Slider
            value={[(settings.line_height ?? 1.5) * 10]}
            onValueChange={([val]) => onChange({ line_height: val / 10 })}
            min={10}
            max={20}
            step={1}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Espaço vertical entre linhas de texto
          </p>
        </div>
      </div>

      <Separator />

      {/* Cores de Texto */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm">Cores de Texto</h4>
        
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

      {/* Animações */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <h4 className="font-medium text-sm">Animações</h4>
        </div>
        
        <div className="space-y-2">
          <Label>Tipo de Transição</Label>
          <Select
            value={settings.transition_type || "slide"}
            onValueChange={(value: TransitionType) => onChange({ transition_type: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="slide">Deslizar (Slide)</SelectItem>
              <SelectItem value="fade">Desvanecer (Fade)</SelectItem>
              <SelectItem value="zoom">Zoom</SelectItem>
              <SelectItem value="scale">Escala (Scale)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Efeito de transição entre campos (modo conversacional)
          </p>
        </div>

        <div className="space-y-2">
          <Label>Duração: {((settings.transition_duration ?? 0.3) * 1000).toFixed(0)}ms</Label>
          <Slider
            value={[(settings.transition_duration ?? 0.3) * 10]}
            onValueChange={([val]) => onChange({ transition_duration: val / 10 })}
            min={2}
            max={8}
            step={1}
            className="w-full"
          />
        </div>

        <Separator className="my-2" />

        {/* Animação de Entrada */}
        <div className="space-y-2">
          <Label>Animação de Entrada</Label>
          <Select
            value={settings.entry_animation || "fade-up"}
            onValueChange={(value: EntryAnimation) => onChange({ entry_animation: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma</SelectItem>
              <SelectItem value="fade-up">Fade Up ↑</SelectItem>
              <SelectItem value="fade-down">Fade Down ↓</SelectItem>
              <SelectItem value="fade-left">Fade Left ←</SelectItem>
              <SelectItem value="fade-right">Fade Right →</SelectItem>
              <SelectItem value="zoom-in">Zoom In</SelectItem>
              <SelectItem value="bounce">Bounce</SelectItem>
              <SelectItem value="flip">Flip</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Efeito quando os elementos aparecem na tela
          </p>
        </div>

        <div className="space-y-2">
          <Label>Delay entre Elementos: {settings.entry_stagger ?? 50}ms</Label>
          <Slider
            value={[settings.entry_stagger ?? 50]}
            onValueChange={([val]) => onChange({ entry_stagger: val })}
            min={0}
            max={200}
            step={10}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Intervalo entre animações de cada campo
          </p>
        </div>

        <Separator className="my-2" />

        {/* Efeitos de Hover */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Efeitos de Hover</Label>
            <p className="text-xs text-muted-foreground">Animações ao passar o mouse</p>
          </div>
          <Switch
            checked={settings.hover_effect_enabled !== false}
            onCheckedChange={(checked) => onChange({ hover_effect_enabled: checked })}
          />
        </div>

        {settings.hover_effect_enabled !== false && (
          <>
            <div className="space-y-2">
              <Label>Escala: {((settings.hover_scale ?? 1.02) * 100).toFixed(0)}%</Label>
              <Slider
                value={[(settings.hover_scale ?? 1.02) * 100]}
                onValueChange={([val]) => onChange({ hover_scale: val / 100 })}
                min={100}
                max={110}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Aumento de tamanho no hover
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Efeito Glow</Label>
                <p className="text-xs text-muted-foreground">Brilho suave nos elementos</p>
              </div>
              <Switch
                checked={settings.hover_glow !== false}
                onCheckedChange={(checked) => onChange({ hover_glow: checked })}
              />
            </div>
          </>
        )}
      </div>

      <Separator />

      {/* Espaçamento Avançado */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm">Espaçamento</h4>
        
        <div className="space-y-2">
          <Label>Padding do Container: {settings.container_padding ?? 32}px</Label>
          <Slider
            value={[settings.container_padding ?? 32]}
            onValueChange={([val]) => onChange({ container_padding: val })}
            min={16}
            max={64}
            step={4}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Espaço interno do container principal
          </p>
        </div>

        <div className="space-y-2">
          <Label>Gap entre Campos: {settings.field_gap ?? 24}px</Label>
          <Slider
            value={[settings.field_gap ?? 24]}
            onValueChange={([val]) => onChange({ field_gap: val })}
            min={8}
            max={48}
            step={4}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Distância entre os campos do formulário
          </p>
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
          <Label>Espessura da Borda: {settings.selection_border_width ?? 3}px</Label>
          <Slider
            value={[settings.selection_border_width ?? 3]}
            onValueChange={([val]) => onChange({ selection_border_width: val })}
            min={1}
            max={8}
            step={1}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Define a espessura da borda quando uma opção está selecionada
          </p>
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
