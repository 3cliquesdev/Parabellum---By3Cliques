import { useState, useEffect } from "react";
import { ResponsiveDialogSheet } from "@/components/ui/responsive-dialog-sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUpdateKnowledgeArticle } from "@/hooks/useUpdateKnowledgeArticle";
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
  const [productTags, setProductTags] = useState("");
  const [tags, setTags] = useState("");
  const [problem, setProblem] = useState("");
  const [solution, setSolution] = useState("");

  const updateArticle = useUpdateKnowledgeArticle();
  const queryClient = useQueryClient();

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
          setProductTags((data.product_tags || []).join(", "));
          setTags((data.tags || []).join(", "));
          setProblem((data as any).problem || "");
          setSolution((data as any).solution || "");
        }
        setLoading(false);
      });
  }, [open, articleId]);

  // Clear state when dialog closes or article changes
  useEffect(() => {
    if (!open) {
      setTitle("");
      setContent("");
      setCategory("");
      setProductTags("");
      setTags("");
      setProblem("");
      setSolution("");
    }
  }, [open]);

  const handleSave = () => {
    if (!articleId) return;
    updateArticle.mutate(
      {
        id: articleId,
        title,
        content,
        category: category || undefined,
        product_tags: productTags.split(",").map((t) => t.trim()).filter(Boolean),
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
              <Input value={productTags} onChange={(e) => setProductTags(e.target.value)} placeholder="tag1, tag2" />
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
