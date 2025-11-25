import { useSearchParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDepartments } from "@/hooks/useDepartments";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare } from "lucide-react";

export default function PublicChat() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const deptParam = searchParams.get("dept");
  const [isCreating, setIsCreating] = useState(false);
  const { data: departments, isLoading } = useDepartments();

  const activeDepartments = departments?.filter((d) => d.is_active) || [];

  // Se veio com parâmetro dept, criar conversa automaticamente
  useEffect(() => {
    if (deptParam && activeDepartments.length > 0 && !isCreating) {
      const dept = activeDepartments.find(
        (d) => d.name.toLowerCase() === deptParam.toLowerCase() || d.id === deptParam
      );
      if (dept) {
        handleCreateConversation(dept.id, dept.name);
      }
    }
  }, [deptParam, activeDepartments]);

  const handleCreateConversation = async (departmentId: string, departmentName: string) => {
    setIsCreating(true);
    try {
      // Chamar Edge Function para criar conversa pública
      const { data, error } = await supabase.functions.invoke("create-public-conversation", {
        body: { department_id: departmentId },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Conversa iniciada",
          description: `Você está falando com o time de ${departmentName}`,
        });
        // Redirecionar para interface de chat (pode ser desenvolvida depois)
        navigate(`/public-chat/${data.conversation_id}`);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao iniciar conversa",
        description: error.message,
        variant: "destructive",
      });
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
            <CardTitle className="text-3xl">Como podemos ajudar você hoje?</CardTitle>
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Iniciando conversa...</p>
      </div>
    </div>
  );
}
