import { Node } from "reactflow";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Database, 
  BookOpen, 
  Package,
  Users,
  ShoppingCart,
  GraduationCap,
  Info
} from "lucide-react";
import { useKnowledgeCategories } from "@/hooks/useKnowledgeCategories";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RAGSourcesSectionProps {
  selectedNode: Node;
  updateNodeData: (field: string, value: any) => void;
}

export function RAGSourcesSection({
  selectedNode,
  updateNodeData,
}: RAGSourcesSectionProps) {
  const { data: kbCategories, isLoading: loadingCategories } = useKnowledgeCategories();
  
  const selectedCategories: string[] = selectedNode.data.kb_categories || [];
  
  const handleCategoryToggle = (category: string) => {
    const current = selectedNode.data.kb_categories || [];
    const newCategories = current.includes(category)
      ? current.filter((c: string) => c !== category)
      : [...current, category];
    updateNodeData("kb_categories", newCategories);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-primary" />
        <Label className="text-xs font-semibold uppercase tracking-wide">
          De onde a IA busca informação
        </Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p className="text-xs">
                Escolha de onde a IA vai puxar as informações para responder o cliente.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Base de Conhecimento */}
      <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-500" />
            <Label className="text-sm font-medium">Artigos e FAQ</Label>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/10">
              Supabase
            </Badge>
          </div>
          <Switch
            checked={selectedNode.data.use_knowledge_base !== false}
            onCheckedChange={(checked) => updateNodeData("use_knowledge_base", checked)}
          />
        </div>

        {selectedNode.data.use_knowledge_base !== false && (
          <div className="space-y-2 pt-2">
            <Label className="text-[11px] text-muted-foreground">
              Buscar apenas nestas categorias:
            </Label>
            
            {loadingCategories ? (
              <div className="space-y-1.5">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-3/4" />
              </div>
            ) : kbCategories && kbCategories.length > 0 ? (
              <div className="max-h-52 overflow-y-auto border rounded-md p-1 space-y-1">
                {kbCategories.map((category) => (
                  <label
                    key={category}
                    className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 px-2 py-1 rounded"
                  >
                    <Checkbox
                      checked={selectedCategories.includes(category)}
                      onCheckedChange={() => handleCategoryToggle(category)}
                      className="h-3.5 w-3.5"
                    />
                    <span className="truncate">{category}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground italic">
                Nenhuma categoria na KB
              </p>
            )}

            {selectedCategories.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {selectedCategories.map((cat) => (
                  <Badge
                    key={cat}
                    variant="secondary"
                    className="text-[10px] px-1.5 cursor-pointer hover:bg-destructive/20"
                    onClick={() => handleCategoryToggle(cat)}
                  >
                    {cat} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CRM / Clientes */}
      <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-500" />
            <Label className="text-sm font-medium">CRM / Clientes</Label>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
              CRM
            </Badge>
          </div>
          <Switch
            checked={selectedNode.data.use_crm_data === true}
            onCheckedChange={(checked) => updateNodeData("use_crm_data", checked)}
          />
        </div>

        {selectedNode.data.use_crm_data && (
          <p className="text-[10px] text-muted-foreground px-2 pt-1">
            A IA consulta dados do cliente (nome, email, status, consultor)
          </p>
        )}
      </div>

      {/* Kiwify (Vendas/Financeiro) */}
      <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-purple-500" />
            <Label className="text-sm font-medium">Kiwify (Produtos e Serviços)</Label>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-purple-500/40 text-purple-600 dark:text-purple-400 bg-purple-500/10">
              Kiwify
            </Badge>
          </div>
          <Switch
            checked={selectedNode.data.use_kiwify_data === true}
            onCheckedChange={(checked) => updateNodeData("use_kiwify_data", checked)}
          />
        </div>

        {selectedNode.data.use_kiwify_data && (
          <p className="text-[10px] text-muted-foreground px-2 pt-1">
            A IA consulta produtos e serviços contratados pelo cliente
          </p>
        )}
      </div>

      {/* Rastreio de Envio */}
      <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-orange-500" />
            <Label className="text-sm font-medium">Rastreio de Envio</Label>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-orange-500/40 text-orange-600 dark:text-orange-400 bg-orange-500/10">
              Logística
            </Badge>
          </div>
          <Switch
            checked={selectedNode.data.use_tracking === true}
            onCheckedChange={(checked) => updateNodeData("use_tracking", checked)}
          />
        </div>

        {selectedNode.data.use_tracking && (
          <p className="text-[10px] text-muted-foreground px-2 pt-1">
            A IA consulta onde está o pacote do cliente
          </p>
        )}
      </div>

      {/* Treinamento Sandbox */}
      <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-cyan-500" />
            <Label className="text-sm font-medium">Treinamento Sandbox</Label>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-cyan-500/40 text-cyan-600 dark:text-cyan-400 bg-cyan-500/10">
              Sandbox
            </Badge>
          </div>
          <Switch
            checked={selectedNode.data.use_sandbox_data === true}
            onCheckedChange={(checked) => updateNodeData("use_sandbox_data", checked)}
          />
        </div>

        {selectedNode.data.use_sandbox_data && (
          <p className="text-[10px] text-muted-foreground px-2 pt-1">
            A IA consulta regras aprendidas por correção manual
          </p>
        )}
      </div>
    </div>
  );
}
