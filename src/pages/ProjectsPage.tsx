import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, LayoutGrid, List, Filter, Archive, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProjectBoards } from "@/hooks/useProjectBoards";
import { ProjectBoardCard } from "@/components/projects/ProjectBoardCard";
import { CreateBoardDialog } from "@/components/projects/CreateBoardDialog";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("active");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: boards, isLoading } = useProjectBoards({ status, search });

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Projetos</h1>
            <p className="text-muted-foreground">
              Gerencie seus projetos de criação de lojas online
            </p>
          </div>
          <Button 
            onClick={() => setCreateDialogOpen(true)}
            data-tour="projects-create-button"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Projeto
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="relative w-64" data-tour="projects-search">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar projetos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Tabs value={status} onValueChange={setStatus} data-tour="projects-tabs">
              <TabsList>
                <TabsTrigger value="all" className="gap-1.5">
                  <Filter className="h-3.5 w-3.5" />
                  Todos
                </TabsTrigger>
                <TabsTrigger value="active" className="gap-1.5">
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Ativos
                </TabsTrigger>
                <TabsTrigger value="completed" className="gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Concluídos
                </TabsTrigger>
                <TabsTrigger value="archived" className="gap-1.5">
                  <Archive className="h-3.5 w-3.5" />
                  Arquivados
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex items-center gap-2" data-tour="projects-view-toggle">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Boards Grid/List */}
        {isLoading ? (
          <div className={`grid gap-4 ${viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1"}`}>
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
          </div>
        ) : boards?.length === 0 ? (
          <div className="text-center py-12">
            <LayoutGrid className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Nenhum projeto encontrado
            </h3>
            <p className="text-muted-foreground mb-4">
              {search ? "Tente ajustar os filtros" : "Comece criando seu primeiro projeto"}
            </p>
            {!search && (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Projeto
              </Button>
            )}
          </div>
        ) : (
          <div className={`grid gap-4 ${viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1"}`}>
            {boards?.map((board, index) => (
              <div key={board.id} data-tour={index === 0 ? "projects-board-card" : undefined}>
                <ProjectBoardCard
                  board={board}
                  viewMode={viewMode}
                  onClick={() => navigate(`/projects/${board.id}`)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateBoardDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

    </div>
  );
}
