import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Search,
  LayoutTemplate,
  Mail,
  Bell,
  ShoppingCart,
  Users,
  Zap,
  Star,
  Check,
} from "lucide-react";
import { useEmailLayouts } from "@/hooks/useEmailBuilderV2";
import { EmailBlock } from "@/types/emailBuilderV2";

interface LayoutLibraryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectLayout: (blocks: Omit<EmailBlock, "id" | "template_id">[]) => void;
}

const categoryIcons: Record<string, React.ReactNode> = {
  welcome: <Mail className="h-4 w-4" />,
  transactional: <ShoppingCart className="h-4 w-4" />,
  notification: <Bell className="h-4 w-4" />,
  marketing: <Zap className="h-4 w-4" />,
  onboarding: <Users className="h-4 w-4" />,
};

const categoryLabels: Record<string, string> = {
  welcome: "Boas-vindas",
  transactional: "Transacional",
  notification: "Notificação",
  marketing: "Marketing",
  onboarding: "Onboarding",
  all: "Todos",
};

export function LayoutLibrary({
  open,
  onOpenChange,
  onSelectLayout,
}: LayoutLibraryProps) {
  const { data: layouts, isLoading } = useEmailLayouts();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);

  const filteredLayouts = layouts?.filter((layout) => {
    const matchesSearch =
      layout.name.toLowerCase().includes(search.toLowerCase()) ||
      layout.description?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || layout.category === selectedCategory;
    return matchesSearch && matchesCategory && layout.is_active;
  });

  const categories = [
    "all",
    ...Array.from(new Set(layouts?.map((l) => l.category) || [])),
  ];

  const handleSelectLayout = () => {
    const layout = layouts?.find((l) => l.id === selectedLayoutId);
    if (layout && layout.blocks) {
      const blocks = (layout.blocks as unknown as Omit<EmailBlock, "id" | "template_id">[]);
      onSelectLayout(blocks);
      onOpenChange(false);
      setSelectedLayoutId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5 text-primary" />
            Biblioteca de Layouts
          </DialogTitle>
          <DialogDescription>
            Escolha um layout pré-construído para começar rapidamente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar layouts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Categories */}
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-transparent p-0">
              {categories.map((category) => (
                <TabsTrigger
                  key={category}
                  value={category}
                  className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {categoryIcons[category]}
                  {categoryLabels[category] || category}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={selectedCategory} className="mt-4">
              <ScrollArea className="h-[400px] pr-4">
                {isLoading ? (
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    Carregando layouts...
                  </div>
                ) : filteredLayouts && filteredLayouts.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {filteredLayouts.map((layout) => {
                      const isSelected = selectedLayoutId === layout.id;
                      return (
                        <Card
                          key={layout.id}
                          className={`cursor-pointer transition-all hover:border-primary/50 ${
                            isSelected
                              ? "border-primary ring-2 ring-primary/20"
                              : ""
                          }`}
                          onClick={() => setSelectedLayoutId(layout.id)}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                {categoryIcons[layout.category] || (
                                  <LayoutTemplate className="h-4 w-4" />
                                )}
                                <CardTitle className="text-sm">
                                  {layout.name}
                                </CardTitle>
                              </div>
                              {isSelected && (
                                <div className="p-1 rounded-full bg-primary">
                                  <Check className="h-3 w-3 text-primary-foreground" />
                                </div>
                              )}
                            </div>
                            <CardDescription className="text-xs line-clamp-2">
                              {layout.description}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-0">
                            {/* Preview Thumbnail */}
                            <div className="aspect-video rounded-md bg-muted/50 border border-border/50 flex items-center justify-center overflow-hidden">
                              {layout.thumbnail_url ? (
                                <img
                                  src={layout.thumbnail_url}
                                  alt={layout.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="text-center p-4">
                                  <LayoutTemplate className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                                  <span className="text-xs text-muted-foreground">
                                    {(layout.blocks as unknown as unknown[])?.length || 0} blocos
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Meta */}
                            <div className="flex items-center justify-between mt-3">
                              <Badge variant="secondary" className="text-xs">
                                {categoryLabels[layout.category] || layout.category}
                              </Badge>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                {layout.is_system && (
                                  <Star className="h-3 w-3 text-yellow-500" />
                                )}
                                <span>{layout.usage_count || 0} usos</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <LayoutTemplate className="h-10 w-10 mb-2 opacity-50" />
                    <p>Nenhum layout encontrado</p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {selectedLayoutId
              ? "1 layout selecionado"
              : "Selecione um layout para continuar"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSelectLayout}
              disabled={!selectedLayoutId}
            >
              Usar Layout
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
