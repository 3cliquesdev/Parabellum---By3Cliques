import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateKnowledgeArticle } from "@/hooks/useCreateKnowledgeArticle";
import { useUpdateKnowledgeArticle } from "@/hooks/useUpdateKnowledgeArticle";
import { useGenerateEmbedding } from "@/hooks/useGenerateEmbedding";
import { useFindSimilarArticles } from "@/hooks/useFindSimilarArticles";
import { useKnowledgeCategories } from "@/hooks/useKnowledgeCategories";
import { useDistinctProductTags } from "@/hooks/useKnowledgeAudit";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, X } from "lucide-react";

interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[];
  product_tags?: string[];
  is_published: boolean;
  source?: string | null;
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
  const [productTags, setProductTags] = useState<string[]>([]);
  const [isPublished, setIsPublished] = useState(false);
  const [isCustomCategory, setIsCustomCategory] = useState(false);

  const createArticle = useCreateKnowledgeArticle();
  const updateArticle = useUpdateKnowledgeArticle();
  const generateEmbedding = useGenerateEmbedding();
  const { data: existingCategories = [] } = useKnowledgeCategories();
  const { data: existingProductTags = [] } = useDistinctProductTags();
  
  const { data: similarArticles } = useFindSimilarArticles(
    article?.id || null,
    0.90
  );

  useEffect(() => {
    if (article) {
      setTitle(article.title);
      setContent(article.content);
      const articleCategory = article.category || "";
      setCategory(articleCategory);
      setTagsInput(article.tags.join(", "));
      setProductTags(article.product_tags || []);
      setIsPublished(article.is_published);
      if (articleCategory && existingCategories.length > 0 && !existingCategories.includes(articleCategory)) {
        setIsCustomCategory(true);
      } else {
        setIsCustomCategory(false);
      }
    } else {
      setTitle("");
      setContent("");
      setCategory("");
      setTagsInput("");
      setProductTags([]);
      setIsPublished(false);
      setIsCustomCategory(false);
    }
  }, [article, open, existingCategories]);

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
        product_tags: productTags,
        is_published: isPublished,
      });
      articleId = article.id;
    } else {
      const newArticle = await createArticle.mutateAsync({
        title,
        content,
        category: category || undefined,
        tags,
        product_tags: productTags,
        is_published: isPublished,
      });
      articleId = newArticle.id;
    }

    if (articleId && content) {
      generateEmbedding.mutate({ articleId, content });
    }

    onOpenChange(false);
  };

  const isAIDraft = article?.source === 'ai_draft';
  const urlParams = new URLSearchParams(window.location.search);
  const isEditingAIDraft = urlParams.get('ai_draft') === 'true' || isAIDraft;

  const toggleProductTag = (tag: string) => {
    setProductTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const [newProductTag, setNewProductTag] = useState("");
  const addCustomProductTag = () => {
    const trimmed = newProductTag.trim();
    if (trimmed && !productTags.includes(trimmed)) {
      setProductTags((prev) => [...prev, trimmed]);
    }
    setNewProductTag("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{article ? "Editar Artigo" : "Novo Artigo"}</DialogTitle>
        </DialogHeader>

        {isEditingAIDraft && (
          <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              <strong>Conteúdo gerado por IA — revisão obrigatória antes de publicar.</strong>
              <p className="mt-1 text-sm">
                Este rascunho foi criado automaticamente a partir de uma lacuna de conhecimento.
                Revise e edite o conteúdo antes de publicar.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {similarArticles && similarArticles.length > 0 && (
          <Alert className="bg-amber-50 border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>Artigos similares detectados:</strong>
              <ul className="mt-2 space-y-1 text-sm">
                {similarArticles.map((similar) => (
                  <li key={similar.id}>
                    • {similar.title} ({Math.round(similar.similarity * 100)}% similar)
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs">
                Considere mesclar ou atualizar o artigo existente ao invés de criar duplicatas.
              </p>
            </AlertDescription>
          </Alert>
        )}

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
            <Select
              value={isCustomCategory ? "__custom__" : category}
              onValueChange={(val) => {
                if (val === "__custom__") {
                  setIsCustomCategory(true);
                  setCategory("");
                } else {
                  setIsCustomCategory(false);
                  setCategory(val);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {existingCategories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
                <SelectItem value="__custom__">➕ Outra categoria...</SelectItem>
              </SelectContent>
            </Select>
            {isCustomCategory && (
              <Input
                className="mt-2"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Digite a nova categoria"
              />
            )}
          </div>

          {/* Product Tags — campo que AFETA a busca da IA */}
          <div>
            <Label>Product Tags <span className="text-xs text-muted-foreground">(afeta filtro de busca da IA)</span></Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5 mb-2">
              {existingProductTags.map((tag) => (
                <Badge
                  key={tag}
                  variant={productTags.includes(tag) ? "default" : "outline"}
                  className="cursor-pointer select-none"
                  onClick={() => toggleProductTag(tag)}
                >
                  {tag}
                  {productTags.includes(tag) && <X className="h-3 w-3 ml-1" />}
                </Badge>
              ))}
              {productTags.filter((t) => !existingProductTags.includes(t)).map((tag) => (
                <Badge key={tag} variant="default" className="cursor-pointer select-none" onClick={() => toggleProductTag(tag)}>
                  {tag} <X className="h-3 w-3 ml-1" />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newProductTag}
                onChange={(e) => setNewProductTag(e.target.value)}
                placeholder="Adicionar nova product tag..."
                className="flex-1"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomProductTag(); } }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addCustomProductTag} disabled={!newProductTag.trim()}>
                Adicionar
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="tags">Tags (separadas por vírgula) <span className="text-xs text-muted-foreground">(informativo)</span></Label>
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
