import { useState, useEffect } from "react";
import { ResponsiveDialogSheet } from "@/components/ui/responsive-dialog-sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, ChevronsUpDown, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUpdateKnowledgeArticle } from "@/hooks/useUpdateKnowledgeArticle";
import { useProductTags } from "@/hooks/useProductTags";
import { useQueryClient } from "@tanstack/react-query";

interface AuditArticleEditDialogProps {
  articleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  validCategories: string[];
}

export function AuditArticleEditDialog({
  articleId,
  open,
  onOpenChange,
  validCategories,
}: AuditArticleEditDialogProps) {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [productTags, setProductTags] = useState<string[]>([]);
  const [tags, setTags] = useState("");
  const [problem, setProblem] = useState("");
  const [solution, setSolution] = useState("");

  const updateArticle = useUpdateKnowledgeArticle();
  const queryClient = useQueryClient();
  const { data: existingProductTags = [] } = useProductTags();
  const productTagNames = existingProductTags.map((t) => t.name);

  useEffect(() => {
    if (!open || !articleId) return;
    setLoading(true);
    supabase
      .from("knowledge_articles")
      .select("title, content, category, product_tags, tags, problem, solution")
      .eq("id", articleId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setTitle(data.title || "");
          setContent(data.content || "");
          setCategory(data.category || "");
          setProductTags((data.product_tags || []) as string[]);
          setTags((data.tags || []).join(", "));
          setProblem((data as any).problem || "");
          setSolution((data as any).solution || "");
        }
        setLoading(false);
      });
  }, [open, articleId]);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setContent("");
      setCategory("");
      setProductTags([]);
      setTags("");
      setProblem("");
      setSolution("");
    }
  }, [open]);

  const toggleProductTag = (tag: string) => {
    setProductTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const removeProductTag = (tag: string) => {
    setProductTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleSave = () => {
    if (!articleId) return;
    updateArticle.mutate(
      {
        id: articleId,
        title,
        content,
        category: category || undefined,
        product_tags: productTags,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        problem: problem || undefined,
        solution: solution || undefined,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["knowledge-audit-articles"] });
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <ResponsiveDialogSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Editar artigo"
      description="Edição rápida dos campos do artigo"
      desktopWidth="640px"
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Conteúdo</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {validCategories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Product Tags</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal">
                    {productTags.length > 0
                      ? `${productTags.length} tag(s) selecionada(s)`
                      : "Selecionar tags..."}
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {productTagNames.map((tag) => (
                      <label
                        key={tag}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm"
                      >
                        <Checkbox
                          checked={productTags.includes(tag)}
                          onCheckedChange={() => toggleProductTag(tag)}
                        />
                        <span>{tag}</span>
                      </label>
                    ))}
                    {productTagNames.length === 0 && (
                      <p className="text-xs text-muted-foreground px-2 py-1">Nenhuma tag cadastrada</p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              {productTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {productTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                      {tag}
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-destructive"
                        onClick={() => removeProductTag(tag)}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Tags</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tag1, tag2" />
          </div>

          {(problem || solution) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {problem && (
                <div className="space-y-1.5">
                  <Label>Problema</Label>
                  <Textarea value={problem} onChange={(e) => setProblem(e.target.value)} rows={3} />
                </div>
              )}
              {solution && (
                <div className="space-y-1.5">
                  <Label>Solução</Label>
                  <Textarea value={solution} onChange={(e) => setSolution(e.target.value)} rows={3} />
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={updateArticle.isPending}>
              {updateArticle.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar
            </Button>
          </div>
        </div>
      )}
    </ResponsiveDialogSheet>
  );
}
