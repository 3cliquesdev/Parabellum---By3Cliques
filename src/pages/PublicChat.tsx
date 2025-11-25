import { useSearchParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDepartments } from "@/hooks/useDepartments";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUpsertContact } from "@/hooks/useUpsertContact";
import { PreChatForm } from "@/components/PreChatForm";
import { MessageSquare, Loader2 } from "lucide-react";

const IDENTITY_STORAGE_KEY = "public_chat_identity";
const IDENTITY_EXPIRES_DAYS = 30;

interface StoredIdentity {
  email: string;
  first_name: string;
  last_name: string;
  company?: string;
  phone?: string;
  identified_at: string;
  expires_at: string;
}

export default function PublicChat() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const deptParam = searchParams.get("dept");
  const sourceParam = searchParams.get("source");
  const [isCreating, setIsCreating] = useState(false);
  const { data: departments, isLoading } = useDepartments();
  const upsertContact = useUpsertContact();
  const [isIdentified, setIsIdentified] = useState(false);
  const [storedIdentity, setStoredIdentity] = useState<StoredIdentity | null>(null);

  const activeDepartments = departments?.filter((d) => d.is_active) || [];

  // Verificar identidade armazenada no localStorage
  useEffect(() => {
    const stored = localStorage.getItem(IDENTITY_STORAGE_KEY);
    if (stored) {
      try {
        const identity: StoredIdentity = JSON.parse(stored);
        const expiresAt = new Date(identity.expires_at);
        const now = new Date();

        if (expiresAt > now) {
          setStoredIdentity(identity);
          setIsIdentified(true);
        } else {
          // Identidade expirada, remover
          localStorage.removeItem(IDENTITY_STORAGE_KEY);
        }
      } catch (error) {
        console.error("Erro ao ler identidade:", error);
        localStorage.removeItem(IDENTITY_STORAGE_KEY);
      }
    }
  }, []);

  // Detectar parâmetro de departamento na URL e iniciar conversa automaticamente
  useEffect(() => {
    if (!isIdentified || !storedIdentity) return;
    
    if (deptParam && activeDepartments.length > 0 && !isCreating) {
      const dept = activeDepartments.find(
        (d) => d.name.toLowerCase() === deptParam.toLowerCase() || d.id === deptParam
      );
      if (dept) {
        handleCreateConversation(dept.id, dept.name);
      }
    }
  }, [deptParam, activeDepartments, isIdentified, storedIdentity]);

  const handlePreChatSubmit = async (formData: any) => {
    try {
      setIsCreating(true);

      // Salvar identidade no localStorage
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + IDENTITY_EXPIRES_DAYS);

      const identity: StoredIdentity = {
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        company: formData.company,
        phone: formData.phone,
        identified_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      };

      localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identity));
      setStoredIdentity(identity);
      setIsIdentified(true);

      toast({
        title: "Bem-vindo! 👋",
        description: `Olá, ${formData.first_name}! Suas informações foram salvas.`,
      });
    } catch (error: any) {
      console.error("Erro ao salvar identidade:", error);
      toast({
        title: "Erro ao processar identificação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateConversation = async (departmentId: string, departmentName: string) => {
    if (!storedIdentity) {
      toast({
        title: "Identificação necessária",
        description: "Por favor, preencha seus dados antes de iniciar o atendimento.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      // Primeiro, fazer upsert do contato
      const contactData = {
        email: storedIdentity.email,
        first_name: storedIdentity.first_name,
        last_name: storedIdentity.last_name,
        phone: storedIdentity.phone,
        company: storedIdentity.company,
        source: 'form' as const,
      };

      const contactResult = await upsertContact.mutateAsync(contactData);

      // Depois, criar conversa com o contact_id real
      const { data, error } = await supabase.functions.invoke("create-public-conversation", {
        body: { 
          department_id: departmentId,
          contact_id: contactResult.contact_id,
        },
      });

      if (error) throw error;

      if (data.success) {
        const toastMsg = sourceParam === "widget" 
          ? `Conectado com ${departmentName}` 
          : `Você está falando com o time de ${departmentName}`;
        
        toast({
          title: "Conversa iniciada",
          description: toastMsg,
        });
        navigate(`/public-chat/${data.conversation_id}`);
      }
    } catch (error: any) {
      console.error("Erro ao criar conversa:", error);
      toast({
        title: "Erro ao iniciar conversa",
        description: error.message,
        variant: "destructive",
      });
      setIsCreating(false);
    }
  };

  // Mostrar formulário de identificação se não estiver identificado
  if (!isIdentified) {
    return <PreChatForm onSubmit={handlePreChatSubmit} isLoading={isCreating} />;
  }

  if (isLoading || isCreating) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Menu Concierge (só aparece se não tem parâmetro dept)
  if (!deptParam) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-background to-accent/20 p-4">
        <Card className="max-w-2xl w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-primary/10 rounded-full">
                <MessageSquare className="h-12 w-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-3xl">
              Bem-vindo de volta, {storedIdentity?.first_name}! 👋
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Escolha o departamento para iniciar uma conversa
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {activeDepartments.map((dept) => (
                <Button
                  key={dept.id}
                  variant="outline"
                  size="lg"
                  className="h-auto py-6 flex-col gap-2 hover:border-primary hover:bg-primary/5"
                  onClick={() => handleCreateConversation(dept.id, dept.name)}
                  disabled={isCreating}
                  style={{
                    borderColor: dept.color || undefined,
                  }}
                >
                  <span className="text-4xl mb-2">
                    {dept.name.toLowerCase().includes("venda") || dept.name.toLowerCase().includes("comercial") ? "💰" :
                     dept.name.toLowerCase().includes("suporte") || dept.name.toLowerCase().includes("técnico") ? "🛠️" :
                     dept.name.toLowerCase().includes("financeiro") ? "📄" :
                     "📞"}
                  </span>
                  <span className="font-semibold text-lg">{dept.name}</span>
                </Button>
              ))}
            </div>
            {activeDepartments.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                Nenhum departamento disponível no momento
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tela de carregamento enquanto cria conversa automaticamente
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Iniciando conversa...</p>
      </div>
    </div>
  );
}
