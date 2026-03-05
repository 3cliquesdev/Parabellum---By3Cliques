import { useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Building2, Plus, Users, TrendingUp, Pencil, Trash2 } from "lucide-react";
import { useOrganizations, useDeleteOrganization } from "@/hooks/useOrganizations";
import OrganizationDialog from "@/components/OrganizationDialog";
import OrganizationContactsDialog from "@/components/OrganizationContactsDialog";

export default function Organizations() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const filter = searchParams.get("filter") || "all";
  const { data: organizations, isLoading } = useOrganizations();
  const deleteOrganization = useDeleteOrganization();

  const handleFilterChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("filter", value);
    navigate(`/organizations?${params.toString()}`);
  };

  const filteredOrganizations = useMemo(() => {
    if (!organizations) return [];
    
    switch (filter) {
      case "partners":
        return organizations.filter(o => o.domain);
      default:
        return organizations;
    }
  }, [organizations, filter]);

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Organizações</h2>
            <p className="text-muted-foreground">Gerencie relacionamentos empresariais</p>
          </div>
          <OrganizationDialog
            trigger={
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Organização
              </Button>
            }
          />
        </div>
        
        <Tabs value={filter} onValueChange={handleFilterChange}>
          <TabsList>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="partners">Parceiras</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {!filteredOrganizations || filteredOrganizations.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">Nenhuma organização cadastrada ainda</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredOrganizations.map((org) => (
            <Card key={org.id} className="hover:border-primary transition-colors">
              <CardHeader>
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex gap-1">
                    <OrganizationDialog
                      organization={org}
                      trigger={
                        <Button variant="ghost" size="sm">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      }
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir {org.name}? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteOrganization.mutate(org.id)}
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <CardTitle className="text-xl">{org.name}</CardTitle>
                {org.domain && <p className="text-sm text-muted-foreground">{org.domain}</p>}
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <OrganizationContactsDialog
                    orgId={org.id}
                    orgName={org.name}
                    trigger={
                      <button className="flex items-center justify-between w-full hover:bg-muted/50 rounded-md p-1 -m-1 transition-colors">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span className="text-sm">Contatos</span>
                        </div>
                        <span className="font-semibold text-foreground">{org.contactsCount}</span>
                      </button>
                    }
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-sm">Negócios Ativos</span>
                    </div>
                    <span className="font-semibold text-foreground">{org.activeDeals}</span>
                  </div>
                  <div className="pt-3 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Receita Total</span>
                      <span className="font-bold text-success">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(org.totalRevenue)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
