import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { Search, Plus, Mail, Phone, Pencil, Trash2, Eye, Filter } from "lucide-react";
import { useContacts, useDeleteContact } from "@/hooks/useContacts";
import ContactDialog from "@/components/ContactDialog";
import type { Tables } from "@/integrations/supabase/types";

type ContactWithOrg = Tables<"contacts"> & {
  organizations: { name: string } | null;
};

export default function Contacts() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const filter = searchParams.get("filter") || "all";
  const [searchQuery, setSearchQuery] = useState("");
  const [customerType, setCustomerType] = useState("all");
  const [blocked, setBlocked] = useState("all");
  const [subscriptionPlan, setSubscriptionPlan] = useState("all");
  
  const { data: contacts, isLoading } = useContacts({
    searchQuery,
    customerType,
    blocked,
    subscriptionPlan,
  });
  const deleteContact = useDeleteContact();

  const handleFilterChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("filter", value);
    navigate(`/contacts?${params.toString()}`);
  };

  const filteredContacts = useMemo(() => {
    if (!contacts) return [];
    
    switch (filter) {
      case "active":
        return contacts.filter(c => c.email || c.phone);
      case "inactive":
        return contacts.filter(c => !c.email && !c.phone);
      default:
        return contacts;
    }
  }, [contacts, filter]);

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
            <h2 className="text-3xl font-bold text-foreground">Contatos</h2>
            <p className="text-muted-foreground">Gerencie seus contatos e relacionamentos</p>
          </div>
          <ContactDialog
            trigger={
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Contato
              </Button>
            }
          />
        </div>
        
        <Tabs value={filter} onValueChange={handleFilterChange} className="mb-6">
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="active">Ativos</TabsTrigger>
            <TabsTrigger value="inactive">Inativos</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="mb-6 space-y-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar contatos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Filtros:</span>
          
          <Select value={customerType} onValueChange={setCustomerType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tipo de Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Tipos</SelectItem>
              <SelectItem value="Cliente">Cliente</SelectItem>
              <SelectItem value="Vendedor">Vendedor</SelectItem>
              <SelectItem value="Fornecedor">Fornecedor</SelectItem>
              <SelectItem value="Parceiro">Parceiro</SelectItem>
            </SelectContent>
          </Select>

          <Select value={blocked} onValueChange={setBlocked}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="false">Ativos</SelectItem>
              <SelectItem value="true">Bloqueados</SelectItem>
            </SelectContent>
          </Select>

          <Select value={subscriptionPlan} onValueChange={setSubscriptionPlan}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Plano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Planos</SelectItem>
              <SelectItem value="Free">Free</SelectItem>
              <SelectItem value="Basic">Basic</SelectItem>
              <SelectItem value="Premium">Premium</SelectItem>
              <SelectItem value="Enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>

          {(customerType !== 'all' || blocked !== 'all' || subscriptionPlan !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCustomerType('all');
                setBlocked('all');
                setSubscriptionPlan('all');
              }}
            >
              Limpar Filtros
            </Button>
          )}
        </div>
      </div>

      {!filteredContacts || filteredContacts.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">
            {searchQuery ? "Nenhum contato encontrado" : "Nenhum contato cadastrado ainda"}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[150px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.map((contact: ContactWithOrg) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {contact.first_name[0]}{contact.last_name[0]}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {contact.first_name} {contact.last_name}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {contact.email ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        {contact.email}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {contact.phone ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        {contact.phone}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {contact.customer_type ? (
                      <Badge variant="outline">{contact.customer_type}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {contact.subscription_plan ? (
                      <Badge variant="secondary">{contact.subscription_plan}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {contact.blocked ? (
                      <Badge variant="destructive">Bloqueado</Badge>
                    ) : (
                      <Badge variant="default" className="bg-green-500">Ativo</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => navigate(`/contacts/${contact.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <ContactDialog
                        contact={contact}
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
                              Tem certeza que deseja excluir {contact.first_name} {contact.last_name}? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteContact.mutate(contact.id)}
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
