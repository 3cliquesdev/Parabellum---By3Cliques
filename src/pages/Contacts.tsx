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
import { Search, Plus, Mail, Phone, Trash2, Eye, Filter } from "lucide-react";
import { useContacts, useDeleteContact } from "@/hooks/useContacts";
import ContactDialog from "@/components/ContactDialog";
import ContactSheet from "@/components/ContactSheet";
import { ContactCard } from "@/components/contacts/ContactCard";
import { PageContainer, PageHeader, PageContent, PageFilters } from "@/components/ui/page-container";
import { useIsMobileBreakpoint } from "@/hooks/useBreakpoint";
import type { Tables } from "@/integrations/supabase/types";

type ContactWithOrg = Tables<"contacts"> & {
  organizations: { name: string } | null;
};

export default function Contacts() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isMobile = useIsMobileBreakpoint();
  const filter = searchParams.get("filter") || "all";
  const [searchQuery, setSearchQuery] = useState("");
  const [customerType, setCustomerType] = useState("all");
  const [blocked, setBlocked] = useState("all");
  const [subscriptionPlan, setSubscriptionPlan] = useState("all");
  const [selectedContact, setSelectedContact] = useState<ContactWithOrg | null>(null);
  const [showContactSheet, setShowContactSheet] = useState(false);
  
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

  const handleContactClick = (contact: ContactWithOrg) => {
    if (isMobile) {
      navigate(`/contacts/${contact.id}`);
    } else {
      setSelectedContact(contact);
      setShowContactSheet(true);
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Contatos" description="Gerencie seus contatos e relacionamentos">
        <ContactDialog
          trigger={
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {!isMobile && "Adicionar Contato"}
            </Button>
          }
        />
      </PageHeader>

      <PageFilters>
        <Tabs value={filter} onValueChange={handleFilterChange}>
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="active">Ativos</TabsTrigger>
            <TabsTrigger value="inactive">Inativos</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar contatos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filters - Hidden on mobile for simplicity */}
        {!isMobile && (
          <div className="flex items-center gap-2 flex-wrap">
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
        )}
      </PageFilters>

      <PageContent>
        {!filteredContacts || filteredContacts.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">
              {searchQuery ? "Nenhum contato encontrado" : "Nenhum contato cadastrado ainda"}
            </p>
          </div>
        ) : isMobile ? (
          /* Mobile: Card List */
          <div className="rounded-lg border border-border bg-card divide-y divide-border">
            {filteredContacts.map((contact: ContactWithOrg) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                onClick={() => handleContactClick(contact)}
              />
            ))}
          </div>
        ) : (
          /* Desktop: Table */
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
                  <TableRow 
                    key={contact.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleContactClick(contact)}
                  >
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
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/contacts/${contact.id}`);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir {contact.first_name} {contact.last_name}? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteContact.mutate(contact.id);
                                }}
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
      </PageContent>

      {/* Contact Sheet - Desktop only */}
      {!isMobile && (
        <ContactSheet
          contact={selectedContact}
          open={showContactSheet}
          onOpenChange={setShowContactSheet}
        />
      )}
    </PageContainer>
  );
}
