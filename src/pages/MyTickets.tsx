import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, TicketIcon, LogOut, MessageCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PreChatForm } from "@/components/PreChatForm";
import MyTicketCard from "@/components/MyTicketCard";
import MyTicketDetail from "@/components/MyTicketDetail";
import { Link } from "react-router-dom";

const IDENTITY_STORAGE_KEY = "public_chat_identity";

interface StoredIdentity {
  email: string;
  first_name: string;
  last_name: string;
  contact_id?: string;
  expires_at: string;
}

interface CustomerTicket {
  id: string;
  ticket_number: string | null;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  first_response_at: string | null;
  department: { id: string; name: string } | null;
  comments: Array<{
    id: string;
    content: string;
    created_at: string;
    source: string | null;
    author_name: string;
    is_customer: boolean;
  }>;
  comment_count: number;
}

export default function MyTickets() {
  const [isIdentified, setIsIdentified] = useState(false);
  const [identity, setIdentity] = useState<StoredIdentity | null>(null);
  const [tickets, setTickets] = useState<CustomerTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<CustomerTicket | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const { toast } = useToast();

  // Enable body scroll for public pages
  useEffect(() => {
    document.documentElement.classList.add('allow-body-scroll');
    return () => {
      document.documentElement.classList.remove('allow-body-scroll');
    };
  }, []);

  // Check for stored identity on mount
  useEffect(() => {
    const stored = localStorage.getItem(IDENTITY_STORAGE_KEY);
    if (stored) {
      try {
        const parsed: StoredIdentity = JSON.parse(stored);
        const expiresAt = new Date(parsed.expires_at);
        if (expiresAt > new Date() && parsed.contact_id) {
          setIdentity(parsed);
          setIsIdentified(true);
        } else {
          localStorage.removeItem(IDENTITY_STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(IDENTITY_STORAGE_KEY);
      }
    }
  }, []);

  // Fetch tickets when identified
  useEffect(() => {
    if (isIdentified && identity?.contact_id) {
      fetchTickets();
    }
  }, [isIdentified, identity?.contact_id]);

  const fetchTickets = async () => {
    if (!identity?.contact_id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-customer-tickets', {
        body: { contact_id: identity.contact_id }
      });

      if (error) throw error;
      
      if (data.success) {
        setTickets(data.tickets || []);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar seus tickets.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExistingCustomerVerified = (
    contact: { id: string; first_name: string; last_name: string; email: string },
    _departmentId: string,
    _sessionVerified?: boolean
  ) => {
    const newIdentity: StoredIdentity = {
      email: contact.email,
      first_name: contact.first_name,
      last_name: contact.last_name,
      contact_id: contact.id,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };
    localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(newIdentity));
    setIdentity(newIdentity);
    setIsIdentified(true);
  };

  const handleLogout = () => {
    localStorage.removeItem(IDENTITY_STORAGE_KEY);
    setIdentity(null);
    setIsIdentified(false);
    setTickets([]);
    setSelectedTicket(null);
  };

  const handleCommentAdded = () => {
    fetchTickets();
    if (selectedTicket) {
      // Refresh selected ticket data
      const updated = tickets.find(t => t.id === selectedTicket.id);
      if (updated) setSelectedTicket(updated);
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    if (activeTab === "open") return ["open", "in_progress", "pending"].includes(ticket.status);
    if (activeTab === "resolved") return ["resolved", "closed"].includes(ticket.status);
    return true;
  });

  const openCount = tickets.filter(t => ["open", "in_progress", "pending"].includes(t.status)).length;
  const resolvedCount = tickets.filter(t => ["resolved", "closed"].includes(t.status)).length;

  // Not identified - show PreChatForm
  if (!isIdentified) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <TicketIcon className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>Meus Tickets</CardTitle>
            <CardDescription>
              Identifique-se para visualizar seus tickets de suporte
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PreChatForm
              onExistingCustomerVerified={handleExistingCustomerVerified}
              onNewLeadCreated={() => {
                toast({
                  title: "Sem tickets",
                  description: "Você ainda não tem tickets registrados. Crie um novo ticket para começar.",
                });
              }}
            />
            <div className="mt-6 pt-4 border-t">
              <p className="text-sm text-muted-foreground text-center mb-3">
                Precisa de ajuda?
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" asChild>
                  <Link to="/public-chat">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Chat
                  </Link>
                </Button>
                <Button variant="outline" className="flex-1" asChild>
                  <Link to="/open-ticket">
                    <TicketIcon className="w-4 h-4 mr-2" />
                    Abrir Ticket
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Selected ticket detail view
  if (selectedTicket) {
    return (
      <MyTicketDetail
        ticket={selectedTicket}
        contactId={identity?.contact_id || ""}
        onBack={() => {
          setSelectedTicket(null);
          fetchTickets(); // Refresh list
        }}
        onCommentAdded={handleCommentAdded}
        customerName={`${identity?.first_name} ${identity?.last_name}`}
      />
    );
  }

  // Tickets list view
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <TicketIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Meus Tickets</h1>
              <p className="text-sm text-muted-foreground">
                Olá, {identity?.first_name}!
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={fetchTickets} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 mb-6">
          <Button variant="outline" size="sm" asChild>
            <Link to="/open-ticket">
              <TicketIcon className="w-4 h-4 mr-2" />
              Novo Ticket
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/public-chat">
              <MessageCircle className="w-4 h-4 mr-2" />
              Chat
            </Link>
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start mb-4">
            <TabsTrigger value="all" className="flex gap-2">
              Todos
              <Badge variant="secondary" className="ml-1">{tickets.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="open" className="flex gap-2">
              Abertos
              <Badge variant="secondary" className="ml-1">{openCount}</Badge>
            </TabsTrigger>
            <TabsTrigger value="resolved" className="flex gap-2">
              Resolvidos
              <Badge variant="secondary" className="ml-1">{resolvedCount}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTickets.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <TicketIcon className="w-12 h-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground text-center">
                    {activeTab === "all" 
                      ? "Você ainda não tem tickets de suporte."
                      : activeTab === "open"
                      ? "Nenhum ticket aberto no momento."
                      : "Nenhum ticket resolvido ainda."}
                  </p>
                  {activeTab === "all" && (
                    <Button className="mt-4" asChild>
                      <Link to="/open-ticket">Abrir Primeiro Ticket</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredTickets.map(ticket => (
                  <MyTicketCard
                    key={ticket.id}
                    ticket={ticket}
                    onClick={() => setSelectedTicket(ticket)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
