import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useCreateKnowledgeArticle } from "@/hooks/useCreateKnowledgeArticle";
import { useUpdateKnowledgeArticle } from "@/hooks/useUpdateKnowledgeArticle";
import { useGenerateEmbedding } from "@/hooks/useGenerateEmbedding";

interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[];
  is_published: boolean;
}

interface KnowledgeArticleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  article?: KnowledgeArticle | null;
}

export default function KnowledgeArticleDialog({ open, onOpenChange, article }: KnowledgeArticleDialogProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [isPublished, setIsPublished] = useState(false);

  const createArticle = useCreateKnowledgeArticle();
  const updateArticle = useUpdateKnowledgeArticle();
  const generateEmbedding = useGenerateEmbedding();

  useEffect(() => {
    if (article) {
      setTitle(article.title);
      setContent(article.content);
      setCategory(article.category || "");
      setTagsInput(article.tags.join(", "));
      setIsPublished(article.is_published);
    } else {
      setTitle("");
      setContent("");
      setCategory("");
      setTagsInput("");
      setIsPublished(false);
    }
  }, [article, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const tags = tagsInput.split(",").map(tag => tag.trim()).filter(Boolean);
    let articleId: string;

    if (article) {
      await updateArticle.mutateAsync({
        id: article.id,
        title,
        content,
        category: category || undefined,
        tags,
        is_published: isPublished,
      });
      articleId = article.id;
    } else {
      const newArticle = await createArticle.mutateAsync({
        title,
        content,
        category: category || undefined,
        tags,
        is_published: isPublished,
      });
      articleId = newArticle.id;
    }

    // FASE 3: Gerar embedding automaticamente para busca semântica
    if (articleId && content) {
      generateEmbedding.mutate({ articleId, content });
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{article ? "Editar Artigo" : "Novo Artigo"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Como resolver problema X..."
              required
            />
          </div>

          <div>
            <Label htmlFor="category">Categoria</Label>
            <Input
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Técnico, Financeiro, Produto..."
            />
          </div>

          <div>
            <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
            <Input
              id="tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="api, erro, integração"
            />
          </div>

          <div>
            <Label htmlFor="content">Conteúdo *</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escreva o conteúdo do artigo aqui..."
              rows={12}
              required
            />
          </div>

          <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
            <Switch
              id="is_published"
              checked={isPublished}
              onCheckedChange={setIsPublished}
            />
            <div>
              <Label htmlFor="is_published" className="cursor-pointer font-medium">
                Publicar artigo
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Artigos publicados ficam visíveis para agentes de suporte
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createArticle.isPending || updateArticle.isPending}>
              {article ? "Salvar Alterações" : "Criar Artigo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
