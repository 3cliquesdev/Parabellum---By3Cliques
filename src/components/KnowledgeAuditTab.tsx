import { useState, useMemo } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  useKnowledgeAuditArticles,
  useDistinctProductTags,
  usePersonaCategories,
  getArticleIssues,
  type AuditIssue,
} from "@/hooks/useKnowledgeAudit";
import { useKnowledgeCategories } from "@/hooks/useKnowledgeCategories";
import { AlertCircle, AlertTriangle, CheckCircle2, Search, Tag, FolderOpen, Save, Loader2, Zap, Send, ShieldCheck, Pencil } from "lucide-react";
import { AuditArticleEditDialog } from "@/components/knowledge/AuditArticleEditDialog";

type IssueFilter = "all" | "no_embedding" | "no_category" | "empty_product_tags" | "orphan_category" | "clean";

function StatCard({ label, value, icon, onClick, active }: {
  label: string; value: number; icon: React.ReactNode; onClick: () => void; active: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 p-3 rounded-lg border transition-colors text-left ${
        active ? "ring-2 ring-primary bg-primary/5 border-primary" : "bg-card hover:bg-accent"
      }`}
    >
      {icon}
      <div>
        <div className="text-lg font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </button>
  );
}

export function KnowledgeAuditTab() {
  const { data: articles = [], isLoading } = useKnowledgeAuditArticles();
  const { data: productTags = [] } = useDistinctProductTags();
  const { data: personaCategories = [] } = usePersonaCategories();
  const { data: existingCategories = [] } = useKnowledgeCategories();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [issueFilter, setIssueFilter] = useState<IssueFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkProductTag, setBulkProductTag] = useState("");
  const [editingCell, setEditingCell] = useState<{ id: string; field: "category" | "product_tags" } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);
  const [editArticleId, setEditArticleId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const validCategories = useMemo(() => {
    return [...new Set([...personaCategories, ...existingCategories])].sort();
  }, [personaCategories, existingCategories]);

  const articlesWithIssues = useMemo(() => {
    return articles.map((a) => ({
      ...a,
      issues: getArticleIssues(a, personaCategories),
    }));
  }, [articles, personaCategories]);

  const filtered = useMemo(() => {
    return articlesWithIssues.filter((a) => {
      if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter !== "all" && a.category !== categoryFilter) return false;
      if (issueFilter === "clean" && a.issues.length > 0) return false;
      if (issueFilter !== "all" && issueFilter !== "clean" && !a.issues.some((i) => i.type === issueFilter)) return false;
      return true;
    });
  }, [articlesWithIssues, search, issueFilter, categoryFilter]);

  const stats = useMemo(() => {
    const total = articlesWithIssues.length;
    const noEmbed = articlesWithIssues.filter((a) => a.issues.some((i) => i.type === "no_embedding")).length;
    const noCat = articlesWithIssues.filter((a) => a.issues.some((i) => i.type === "no_category")).length;
    const orphan = articlesWithIssues.filter((a) => a.issues.some((i) => i.type === "orphan_category")).length;
    const noProd = articlesWithIssues.filter((a) => a.issues.some((i) => i.type === "empty_product_tags")).length;
    const clean = articlesWithIssues.filter((a) => a.issues.length === 0).length;
    return { total, noEmbed, noCat, orphan, noProd, clean };
  }, [articlesWithIssues]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((a) => a.id)));
    }
  };

  const saveInlineEdit = async (id: string, field: "category" | "product_tags") => {
    setSaving(true);
    try {
      const updateData: any = {};
      if (field === "category") {
        updateData.category = editValue || null;
      } else {
        updateData.product_tags = editValue.split(",").map((t) => t.trim()).filter(Boolean);
      }
      const { error } = await supabase.from("knowledge_articles").update(updateData).eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["knowledge-audit-articles"] });
      toast({ title: "Salvo", description: `${field === "category" ? "Categoria" : "Product tags"} atualizado.` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
      setEditingCell(null);
    }
  };

  const applyBulk = async (field: "category" | "product_tags") => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      const ids = Array.from(selected);
      const updateData: any = {};
      if (field === "category") {
        updateData.category = bulkCategory || null;
      } else {
        // bulkProductTag is now a single tag from dropdown — append to existing
        const tagToAdd = bulkProductTag.trim();
        if (!tagToAdd) return;
        for (let i = 0; i < ids.length; i += 100) {
          const batch = ids.slice(i, i + 100);
          // Fetch current tags for each article
          const { data: currentArticles } = await supabase
            .from("knowledge_articles")
            .select("id, product_tags")
            .in("id", batch);
          if (currentArticles) {
            for (const art of currentArticles) {
              const current = (art.product_tags as string[]) || [];
              if (!current.includes(tagToAdd)) {
                await supabase
                  .from("knowledge_articles")
                  .update({ product_tags: [...current, tagToAdd] })
                  .eq("id", art.id);
              }
            }
          }
        }
        queryClient.invalidateQueries({ queryKey: ["knowledge-audit-articles"] });
        toast({ title: "Atualizado em lote", description: `${ids.length} artigos atualizados.` });
        setSelected(new Set());
        setSaving(false);
        return;
      }
      for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100);
        const { error } = await supabase.from("knowledge_articles").update(updateData).in("id", batch);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["knowledge-audit-articles"] });
      toast({ title: "Atualizado em lote", description: `${ids.length} artigos atualizados.` });
      setSelected(new Set());
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ---- Actions: Generate Embedding ----
  const handleGenerateEmbedding = async (articleId: string) => {
    setActionLoading((prev) => new Set(prev).add(articleId));
    try {
      // Fetch article content
      const { data: article, error: fetchErr } = await supabase
        .from("knowledge_articles")
        .select("title, content, problem, solution")
        .eq("id", articleId)
        .single();
      if (fetchErr || !article) throw new Error("Artigo não encontrado");

      const content = [article.title, article.content, article.problem, article.solution]
        .filter(Boolean)
        .join("\n\n");

      const { error } = await supabase.functions.invoke("generate-article-embedding", {
        body: { article_id: articleId, content },
      });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["knowledge-audit-articles"] });
      toast({ title: "✅ Embedding gerado", description: "Artigo indexado para busca semântica." });
    } catch (err: any) {
      toast({ title: "Erro ao gerar embedding", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading((prev) => {
        const next = new Set(prev);
        next.delete(articleId);
        return next;
      });
    }
  };

  // ---- Actions: Publish ----
  const handlePublish = async (articleId: string) => {
    setActionLoading((prev) => new Set(prev).add(articleId));
    try {
      const { error } = await supabase
        .from("knowledge_articles")
        .update({ is_published: true, published_at: new Date().toISOString() })
        .eq("id", articleId);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["knowledge-audit-articles"] });
      toast({ title: "✅ Artigo publicado" });
    } catch (err: any) {
      toast({ title: "Erro ao publicar", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading((prev) => {
        const next = new Set(prev);
        next.delete(articleId);
        return next;
      });
    }
  };

  // ---- Bulk Approve ----
  const handleBulkApprove = async () => {
    const eligibleArticles = filtered.filter(
      (a) => selected.has(a.id) && a.issues.length === 0
    );
    if (eligibleArticles.length === 0) {
      toast({ title: "Nenhum artigo elegível", description: "Selecione artigos sem problemas para aprovar.", variant: "destructive" });
      return;
    }

    setBulkApproving(true);
    let successCount = 0;
    let errorCount = 0;

    for (const article of eligibleArticles) {
      try {
        // Generate embedding if needed
        if (!article.embedding_generated) {
          const { data: fullArticle } = await supabase
            .from("knowledge_articles")
            .select("title, content, problem, solution")
            .eq("id", article.id)
            .single();

          if (fullArticle) {
            const content = [fullArticle.title, fullArticle.content, fullArticle.problem, fullArticle.solution]
              .filter(Boolean)
              .join("\n\n");

            await supabase.functions.invoke("generate-article-embedding", {
              body: { article_id: article.id, content },
            });
          }
        }

        // Publish if draft
        if (!article.is_published) {
          await supabase
            .from("knowledge_articles")
            .update({ is_published: true, published_at: new Date().toISOString() })
            .eq("id", article.id);
        }

        successCount++;
      } catch {
        errorCount++;
      }
    }

    queryClient.invalidateQueries({ queryKey: ["knowledge-audit-articles"] });
    setBulkApproving(false);
    setSelected(new Set());

    toast({
      title: `✅ Aprovação em lote concluída`,
      description: `${successCount} aprovados${errorCount > 0 ? `, ${errorCount} erros` : ""}`,
    });
  };

  const getActionButton = (article: typeof articlesWithIssues[0]) => {
    const isLoading = actionLoading.has(article.id);
    const hasIssues = article.issues.filter(i => i.type !== "no_embedding").length > 0;
    const needsEmbedding = !article.embedding_generated;
    const isDraft = !article.is_published;

    if (isLoading) {
      return (
        <Button size="xs" variant="ghost" disabled>
          <Loader2 className="h-3 w-3 animate-spin" />
        </Button>
      );
    }

    // Has issues other than embedding → disabled with tooltip
    if (hasIssues) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button size="xs" variant="ghost" disabled className="opacity-50">
                  <AlertTriangle className="h-3 w-3" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Corrija os problemas primeiro</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    // Needs embedding
    if (needsEmbedding) {
      return (
        <Button size="xs" variant="outline" onClick={() => handleGenerateEmbedding(article.id)}>
          <Zap className="h-3 w-3 mr-1" /> Embedding
        </Button>
      );
    }

    // Has embedding but is draft → publish
    if (isDraft) {
      return (
        <Button size="xs" variant="default" onClick={() => handlePublish(article.id)}>
          <Send className="h-3 w-3 mr-1" /> Publicar
        </Button>
      );
    }

    // All good
    return (
      <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300 bg-emerald-50">
        <ShieldCheck className="h-3 w-3 mr-1" /> Auditado
      </Badge>
    );
  };

  const issueBadge = (issue: AuditIssue) => (
    <Badge
      key={issue.type}
      variant={issue.severity === "error" ? "destructive" : "secondary"}
      className="text-xs whitespace-nowrap"
    >
      {issue.severity === "error" ? "🔴" : "🟡"} {issue.label}
    </Badge>
  );

  const selectedEligibleCount = filtered.filter(
    (a) => selected.has(a.id) && a.issues.length === 0
  ).length;

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total" value={stats.total} icon={<FolderOpen className="h-4 w-4" />} onClick={() => setIssueFilter("all")} active={issueFilter === "all"} />
        <StatCard label="Sem embedding" value={stats.noEmbed} icon={<AlertCircle className="h-4 w-4 text-destructive" />} onClick={() => setIssueFilter("no_embedding")} active={issueFilter === "no_embedding"} />
        <StatCard label="Sem categoria" value={stats.noCat} icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} onClick={() => setIssueFilter("no_category")} active={issueFilter === "no_category"} />
        <StatCard label="Categoria órfã" value={stats.orphan} icon={<AlertCircle className="h-4 w-4 text-destructive" />} onClick={() => setIssueFilter("orphan_category")} active={issueFilter === "orphan_category"} />
        <StatCard label="Sem product_tags" value={stats.noProd} icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} onClick={() => setIssueFilter("empty_product_tags")} active={issueFilter === "empty_product_tags"} />
        <StatCard label="OK" value={stats.clean} icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} onClick={() => setIssueFilter("clean")} active={issueFilter === "clean"} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por título..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {existingCategories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-muted rounded-lg border">
          <span className="text-sm font-medium">{selected.size} selecionados</span>
          <Select value={bulkCategory} onValueChange={setBulkCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Categoria..." />
            </SelectTrigger>
            <SelectContent>
              {validCategories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" disabled={!bulkCategory || saving} onClick={() => applyBulk("category")}>
            <FolderOpen className="h-3 w-3 mr-1" /> Aplicar categoria
          </Button>
          <Select value={bulkProductTag} onValueChange={setBulkProductTag}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Product tag..." />
            </SelectTrigger>
            <SelectContent>
              {productTags.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" disabled={!bulkProductTag || saving} onClick={() => applyBulk("product_tags")}>
            <Tag className="h-3 w-3 mr-1" /> Aplicar tags
          </Button>

          <div className="border-l border-border h-6 mx-1" />

          <Button
            size="sm"
            variant="success"
            disabled={selectedEligibleCount === 0 || bulkApproving}
            onClick={handleBulkApprove}
          >
            {bulkApproving ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <ShieldCheck className="h-3 w-3 mr-1" />
            )}
            Aprovar auditados ({selectedEligibleCount})
          </Button>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando artigos...</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead className="min-w-[200px]">Título</TableHead>
                <TableHead className="min-w-[140px]">Categoria</TableHead>
                <TableHead className="min-w-[150px]">Product Tags</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="min-w-[120px]">Ações</TableHead>
                <TableHead>Problemas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((article) => (
                <TableRow key={article.id} className={article.issues.length > 0 ? "bg-destructive/5" : ""}>
                  <TableCell>
                    <Checkbox checked={selected.has(article.id)} onCheckedChange={() => toggleSelect(article.id)} />
                  </TableCell>
                  <TableCell className="font-medium max-w-[300px]">
                    <button
                      className="text-left truncate max-w-full hover:underline hover:text-primary cursor-pointer"
                      title={article.title}
                      onClick={() => {
                        setEditArticleId(article.id);
                        setEditDialogOpen(true);
                      }}
                    >
                      {article.title}
                    </button>
                  </TableCell>
                  <TableCell>
                    {editingCell?.id === article.id && editingCell.field === "category" ? (
                      <div className="flex items-center gap-1">
                        <Select value={editValue} onValueChange={setEditValue}>
                          <SelectTrigger className="w-[150px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {validCategories.map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="xs" onClick={() => saveInlineEdit(article.id, "category")} disabled={saving}>
                          <Save className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        className="text-left hover:bg-accent/50 rounded px-2 py-1 text-sm cursor-pointer w-full"
                        onClick={() => {
                          setEditingCell({ id: article.id, field: "category" });
                          setEditValue(article.category || "");
                        }}
                      >
                        {article.category || <span className="text-muted-foreground italic">vazio</span>}
                      </button>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingCell?.id === article.id && editingCell.field === "product_tags" ? (
                      <div className="flex items-center gap-1">
                        <Input
                          className="w-[180px] h-8 text-xs"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          placeholder="tag1, tag2"
                        />
                        <Button size="xs" onClick={() => saveInlineEdit(article.id, "product_tags")} disabled={saving}>
                          <Save className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        className="text-left cursor-pointer hover:bg-accent/50 rounded px-2 py-1 w-full"
                        onClick={() => {
                          setEditingCell({ id: article.id, field: "product_tags" });
                          setEditValue((article.product_tags || []).join(", "));
                        }}
                      >
                        {article.product_tags?.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {article.product_tags.map((t) => (
                              <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic text-sm">vazio</span>
                        )}
                      </button>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={article.is_published ? "default" : "secondary"} className="text-xs">
                      {article.is_published ? "Publicado" : "Rascunho"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => {
                                setEditArticleId(article.id);
                                setEditDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Editar artigo</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      {getActionButton(article)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {article.issues.length === 0 ? (
                        <Badge variant="outline" className="text-xs text-emerald-600">✓ OK</Badge>
                      ) : (
                        article.issues.map(issueBadge)
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum artigo encontrado com os filtros atuais.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
      <AuditArticleEditDialog
        articleId={editArticleId}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        validCategories={validCategories}
      />
    </div>
  );
}
