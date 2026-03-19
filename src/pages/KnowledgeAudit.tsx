import { useState, useMemo } from "react";
import { PageContainer, PageHeader, PageContent, PageFilters } from "@/components/ui/page-container";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  useKnowledgeAuditArticles,
  useDistinctProductTags,
  usePersonaCategories,
  
  getArticleIssues,
  type AuditArticle,
  type AuditIssue,
} from "@/hooks/useKnowledgeAudit";
import { useKnowledgeCategories } from "@/hooks/useKnowledgeCategories";
import { AlertCircle, AlertTriangle, CheckCircle2, Search, Tag, FolderOpen, Save } from "lucide-react";

type IssueFilter = "all" | "no_embedding" | "no_category" | "empty_product_tags" | "orphan_category" | "clean";

export default function KnowledgeAudit() {
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

  // Combine persona categories with existing DB categories for validation
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

  // Stats
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
        const tagToAdd = bulkProductTag.trim();
        if (!tagToAdd) return;
        for (let i = 0; i < ids.length; i += 100) {
          const batch = ids.slice(i, i + 100);
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

  const issueBadge = (issue: AuditIssue) => (
    <Badge
      key={issue.type}
      variant={issue.severity === "error" ? "destructive" : "secondary"}
      className="text-xs whitespace-nowrap"
    >
      {issue.severity === "error" ? "🔴" : "🟡"} {issue.label}
    </Badge>
  );

  return (
    <PageContainer>
      <PageHeader title="Auditoria da Base de Conhecimento" description="Identifique e corrija problemas nos artigos que afetam a busca da IA" />

      {/* Stats cards */}
      <PageFilters>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total" value={stats.total} icon={<FolderOpen className="h-4 w-4" />} onClick={() => setIssueFilter("all")} active={issueFilter === "all"} />
          <StatCard label="Sem embedding" value={stats.noEmbed} icon={<AlertCircle className="h-4 w-4 text-destructive" />} onClick={() => setIssueFilter("no_embedding")} active={issueFilter === "no_embedding"} color="destructive" />
          <StatCard label="Sem categoria" value={stats.noCat} icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} onClick={() => setIssueFilter("no_category")} active={issueFilter === "no_category"} color="warning" />
          <StatCard label="Categoria órfã" value={stats.orphan} icon={<AlertCircle className="h-4 w-4 text-destructive" />} onClick={() => setIssueFilter("orphan_category")} active={issueFilter === "orphan_category"} color="destructive" />
          <StatCard label="Sem product_tags" value={stats.noProd} icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} onClick={() => setIssueFilter("empty_product_tags")} active={issueFilter === "empty_product_tags"} color="warning" />
          <StatCard label="OK" value={stats.clean} icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} onClick={() => setIssueFilter("clean")} active={issueFilter === "clean"} color="success" />
        </div>

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
          </div>
        )}
      </PageFilters>

      <PageContent>
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando artigos...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Product Tags</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Problemas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((article) => (
                <TableRow key={article.id} className={article.issues.length > 0 ? "bg-destructive/5" : ""}>
                  <TableCell>
                    <Checkbox checked={selected.has(article.id)} onCheckedChange={() => toggleSelect(article.id)} />
                  </TableCell>
                  <TableCell className="font-medium max-w-[300px] truncate" title={article.title}>
                    {article.title}
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
                        className="text-left hover:underline text-sm cursor-pointer"
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
                        className="text-left cursor-pointer"
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
                    <div className="flex flex-wrap gap-1">
                      {(article.tags || []).slice(0, 3).map((t) => (
                        <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                      ))}
                      {(article.tags || []).length > 3 && (
                        <Badge variant="secondary" className="text-xs">+{(article.tags || []).length - 3}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={article.is_published ? "default" : "secondary"} className="text-xs">
                      {article.is_published ? "Publicado" : "Rascunho"}
                    </Badge>
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
        )}
      </PageContent>
    </PageContainer>
  );
}

function StatCard({ label, value, icon, onClick, active, color }: {
  label: string; value: number; icon: React.ReactNode; onClick: () => void; active: boolean; color?: string;
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
