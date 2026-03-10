import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, Download, Trash2, RefreshCw, Upload, Loader2, Eraser } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { ContactNameCleanupDialog } from "./ContactNameCleanupDialog";

export function DataManagementCard() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [exportingContacts, setExportingContacts] = useState(false);
  const [cleanupOpen, setCleanupOpen] = useState(false);

  // Export contacts to CSV
  const handleExportContacts = async () => {
    setExportingContacts(true);
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("first_name, last_name, email, phone, company, status, created_at");

      if (error) throw error;

      // Convert to CSV
      const headers = ["Nome", "Sobrenome", "Email", "Telefone", "Empresa", "Status", "Data Criação"];
      const csvContent = [
        headers.join(","),
        ...(data || []).map(c => 
          [c.first_name, c.last_name, c.email, c.phone, c.company, c.status, c.created_at].join(",")
        )
      ].join("\n");

      // Download file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `contatos_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();

      toast({
        title: "Exportação concluída",
        description: `${data?.length || 0} contatos exportados com sucesso.`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Erro na exportação",
        description: "Não foi possível exportar os contatos.",
        variant: "destructive",
      });
    } finally {
      setExportingContacts(false);
    }
  };

  // Clear AI cache
  const clearCacheMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("ai_response_cache")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      toast({
        title: "Cache limpo",
        description: "O cache de respostas da IA foi limpo com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["super-admin-metrics"] });
    },
    onError: () => {
      toast({
        title: "Erro ao limpar cache",
        description: "Não foi possível limpar o cache.",
        variant: "destructive",
      });
    },
  });

  // Sync Kiwify products
  const syncKiwifyMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("kiwify-sync");
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      toast({
        title: "Sincronização iniciada",
        description: "Os produtos do Kiwify estão sendo sincronizados.",
      });
    },
    onError: () => {
      toast({
        title: "Erro na sincronização",
        description: "Não foi possível sincronizar com Kiwify. Verifique as configurações.",
        variant: "destructive",
      });
    },
  });

  const ActionButton = ({ 
    icon: Icon, 
    label, 
    onClick, 
    loading = false,
    variant = "outline" as const
  }: { 
    icon: any; 
    label: string; 
    onClick: () => void;
    loading?: boolean;
    variant?: "outline" | "destructive";
  }) => (
    <Button 
      variant={variant} 
      className="w-full justify-start" 
      onClick={onClick}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Icon className="h-4 w-4 mr-2" />
      )}
      {label}
    </Button>
  );

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Database className="h-5 w-5 text-primary" />
          Gestão de Dados
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ActionButton
          icon={Download}
          label="Exportar Contatos (CSV)"
          onClick={handleExportContacts}
          loading={exportingContacts}
        />
        
        <ActionButton
          icon={Trash2}
          label="Limpar Cache de IA"
          onClick={() => clearCacheMutation.mutate()}
          loading={clearCacheMutation.isPending}
          variant="outline"
        />

        <ActionButton
          icon={RefreshCw}
          label="Sincronizar Kiwify"
          onClick={() => syncKiwifyMutation.mutate()}
          loading={syncKiwifyMutation.isPending}
        />

        <ActionButton
          icon={Upload}
          label="Importar Clientes"
          onClick={() => navigate("/import-clients")}
        />

        <ActionButton
          icon={Eraser}
          label="Limpar Nomes de Contatos"
          onClick={() => setCleanupOpen(true)}
        />
      </CardContent>

      <ContactNameCleanupDialog open={cleanupOpen} onOpenChange={setCleanupOpen} />
    </Card>
  );
}
