import { Card, CardContent } from "@/components/ui/card";
import { displayName, displayInitials } from "@/lib/displayName";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Phone, Building2, Calendar, MessageCircle, MapPin, FileText, Pencil, Eye, EyeOff, Link2, Unlink, Search, Loader2 } from "lucide-react";
import { format, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import ContactDialog from "./ContactDialog";

interface ContactInfoCardProps {
  contact: Tables<"contacts"> & {
    organizations: { name: string } | null;
  };
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  lead: { label: "Lead", className: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  qualified: { label: "Qualificado", className: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  customer: { label: "Cliente", className: "bg-green-500/10 text-green-500 border-green-500/20" },
  inactive: { label: "Inativo", className: "bg-gray-500/10 text-gray-500 border-gray-500/20" },
  churned: { label: "Churned", className: "bg-red-500/10 text-red-500 border-red-500/20" },
};

export default function ContactInfoCard({ contact }: ContactInfoCardProps) {
  const statusInfo = STATUS_CONFIG[contact.status || "lead"];
  const [showFullData, setShowFullData] = useState(false);
  const [showCPF, setShowCPF] = useState(false);
  const [orgSearchTerm, setOrgSearchTerm] = useState("");
  const debouncedOrgSearch = useDebouncedValue(orgSearchTerm, 300);
  const [orgPopoverOpen, setOrgPopoverOpen] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [confirmSwitch, setConfirmSwitch] = useState<{ orgId: string; orgName: string } | null>(null);

  const queryClient = useQueryClient();

  // Search organizations
  const { data: orgResults, isLoading: isSearchingOrgs } = useQuery({
    queryKey: ["org-search", debouncedOrgSearch],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name")
        .ilike("name", `%${debouncedOrgSearch}%`)
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: debouncedOrgSearch.length >= 2,
  });

  // Link/unlink mutation
  const linkOrgMutation = useMutation({
    mutationFn: async (organizationId: string | null) => {
      const { error } = await supabase
        .from("contacts")
        .update({ organization_id: organizationId })
        .eq("id", contact.id);
      if (error) throw error;
    },
    onSuccess: (_, orgId) => {
      queryClient.invalidateQueries({ queryKey: ["contact", contact.id] });
      queryClient.invalidateQueries({ queryKey: ["organization-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast.success(orgId ? "Organização vinculada!" : "Organização desvinculada!");
      setOrgPopoverOpen(false);
      setOrgSearchTerm("");
      setConfirmSwitch(null);
    },
    onError: () => {
      toast.error("Erro ao atualizar organização.");
    },
  });

  const handleSelectOrg = (orgId: string, orgName: string) => {
    // If contact already has an org and selecting a different one, confirm switch
    if (contact.organization_id && orgId !== contact.organization_id) {
      setConfirmSwitch({ orgId, orgName });
      return;
    }
    linkOrgMutation.mutate(orgId);
  };

  const handleUnlinkOrg = () => {
    linkOrgMutation.mutate(null);
    setConfirmUnlink(false);
  };

  const maskCPF = (cpf: string) => {
    if (!cpf) return null;
    const numbers = cpf.replace(/\D/g, '');
    if (numbers.length === 11) {
      return `***.***.${numbers.substring(6, 9)}-**`;
    }
    return cpf;
  };

  const handleCall = () => {
    if (contact.phone) window.open(`tel:${contact.phone}`);
  };

  const handleWhatsApp = () => {
    if (contact.phone) {
      const cleanPhone = contact.phone.replace(/\D/g, '');
      window.open(`https://wa.me/${cleanPhone}`, '_blank');
    }
  };

  const handleEmail = () => {
    if (contact.email) window.open(`mailto:${contact.email}`);
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col items-center mb-6">
          <Avatar className="h-28 w-28 mb-3">
            <AvatarFallback className="bg-primary/10 text-primary text-4xl font-bold">
              {displayInitials(contact.first_name, contact.last_name)}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-xl font-bold text-center text-foreground">
            {displayName(contact.first_name, contact.last_name)}
          </h2>
          {contact.company && (
            <p className="text-sm text-muted-foreground mt-1">{contact.company}</p>
          )}
          <Badge className={`mt-2 border ${statusInfo.className}`} variant="outline">
            {statusInfo.label}
          </Badge>
        </div>

        {/* Quick Actions */}
        <div className="flex justify-center gap-2 mb-6">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleCall}
            disabled={!contact.phone}
            title="Ligar"
          >
            <Phone className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleWhatsApp}
            disabled={!contact.phone}
            className="text-green-500 hover:text-green-600"
            title="WhatsApp"
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleEmail}
            disabled={!contact.email}
            title="Email"
          >
            <Mail className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon"
            title="Agendar"
          >
            <Calendar className="h-4 w-4" />
          </Button>
        </div>

        {/* Basic Info */}
        <div className="space-y-3 mb-4">
          {contact.email && (
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground break-all">{contact.email}</span>
            </div>
          )}
          
          {contact.phone && (
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground">{contact.phone}</span>
            </div>
          )}

          {/* Organization - Editable */}
          <div className="flex items-center gap-3 text-sm">
            <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            {contact.organizations ? (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-foreground truncate">{contact.organizations.name}</span>
                <Popover open={orgPopoverOpen} onOpenChange={(open) => { setOrgPopoverOpen(open); if (!open) setOrgSearchTerm(""); }}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" title="Trocar organização">
                      <Link2 className="h-3 w-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3" align="start">
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                         placeholder="Digite ao menos 2 caracteres..."
                          value={orgSearchTerm}
                          onChange={(e) => setOrgSearchTerm(e.target.value)}
                          className="pl-8 h-8 text-sm"
                          autoFocus
                        />
                      </div>
                      {isSearchingOrgs && (
                        <div className="flex items-center justify-center py-3">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                       {debouncedOrgSearch.length >= 2 && !isSearchingOrgs && orgResults && orgResults.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-2">Nenhuma organização encontrada</p>
                      )}
                      {orgResults && orgResults.length > 0 && (
                        <div className="max-h-40 overflow-auto space-y-1">
                           {orgResults.map((org) => {
                             const isCurrent = org.id === contact.organization_id;
                             return (
                               <button
                                 key={org.id}
                                 onClick={() => handleSelectOrg(org.id, org.name)}
                                 className={`w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors flex items-center justify-between ${isCurrent ? 'opacity-50 cursor-not-allowed bg-muted' : 'hover:bg-accent text-foreground'}`}
                                 disabled={linkOrgMutation.isPending || isCurrent}
                               >
                                 <span>{org.name}</span>
                                 {isCurrent && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Atual</Badge>}
                               </button>
                             );
                           })}
                         </div>
                       )}
                      {orgSearchTerm.length < 2 && (
                        <p className="text-xs text-muted-foreground text-center py-1">Digite pelo menos 2 caracteres</p>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                  title="Desvincular organização"
                  onClick={() => setConfirmUnlink(true)}
                >
                  <Unlink className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Popover open={orgPopoverOpen} onOpenChange={(open) => { setOrgPopoverOpen(open); if (!open) setOrgSearchTerm(""); }}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1">
                    <Link2 className="h-3 w-3" />
                    Vincular organização
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" align="start">
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Digite ao menos 2 caracteres..."
                        value={orgSearchTerm}
                        onChange={(e) => setOrgSearchTerm(e.target.value)}
                        className="pl-8 h-8 text-sm"
                        autoFocus
                      />
                    </div>
                    {isSearchingOrgs && (
                      <div className="flex items-center justify-center py-3">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {debouncedOrgSearch.length >= 2 && !isSearchingOrgs && orgResults && orgResults.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">Nenhuma organização encontrada</p>
                    )}
                    {orgResults && orgResults.length > 0 && (
                      <div className="max-h-40 overflow-auto space-y-1">
                         {orgResults.map((org) => (
                           <button
                             key={org.id}
                             onClick={() => handleSelectOrg(org.id, org.name)}
                             className="w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent text-foreground transition-colors"
                             disabled={linkOrgMutation.isPending}
                           >
                             {org.name}
                           </button>
                         ))}
                       </div>
                    )}
                    {orgSearchTerm.length < 2 && (
                      <p className="text-xs text-muted-foreground text-center py-1">Digite pelo menos 2 caracteres</p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {contact.last_contact_date && isValid(new Date(contact.last_contact_date)) && (
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">
                Último contato: {format(new Date(contact.last_contact_date), "dd/MM/yyyy", { locale: ptBR })}
              </span>
            </div>
          )}
        </div>

        {/* Collapsible Full Data */}
        <Collapsible open={showFullData} onOpenChange={setShowFullData}>
          <div className="flex items-center justify-between mb-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="flex-1 justify-between">
                <span className="text-sm font-medium">Dados Completos</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showFullData ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <ContactDialog 
              contact={contact} 
              trigger={
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Pencil className="h-4 w-4" />
                </Button>
              }
            />
          </div>
          <CollapsibleContent className="space-y-3 pt-3">
            {contact.document && (
              <div className="flex items-center gap-3 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-foreground">
                    CPF/CNPJ: {showCPF ? contact.document : maskCPF(contact.document)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setShowCPF(!showCPF)}
                  >
                    {showCPF ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            )}
            
            {contact.birth_date && isValid(new Date(contact.birth_date)) && (
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground">
                  Nascimento: {format(new Date(contact.birth_date), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
            )}

            {(contact.address || contact.city || contact.state) && (
              <div className="flex items-start gap-3 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="text-foreground">
                  {contact.address && <div>{contact.address}, {contact.address_number}</div>}
                  {contact.neighborhood && <div>{contact.neighborhood}</div>}
                  {(contact.city || contact.state) && (
                    <div>{contact.city}{contact.city && contact.state && ' - '}{contact.state}</div>
                  )}
                  {contact.zip_code && <div>CEP: {contact.zip_code}</div>}
                </div>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>

      {/* Confirm Unlink Dialog */}
      <AlertDialog open={confirmUnlink} onOpenChange={setConfirmUnlink}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular organização?</AlertDialogTitle>
            <AlertDialogDescription>
              O contato <strong>{contact.first_name} {contact.last_name}</strong> será desvinculado da organização <strong>{contact.organizations?.name}</strong>. Isso pode ser revertido a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnlinkOrg}>Desvincular</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Switch Org Dialog */}
      <AlertDialog open={!!confirmSwitch} onOpenChange={(open) => { if (!open) setConfirmSwitch(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Trocar organização?</AlertDialogTitle>
            <AlertDialogDescription>
              O contato <strong>{contact.first_name} {contact.last_name}</strong> vai sair de <strong>{contact.organizations?.name}</strong> e entrar em <strong>{confirmSwitch?.orgName}</strong>. Deseja confirmar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmSwitch && linkOrgMutation.mutate(confirmSwitch.orgId)}>
              Confirmar troca
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
