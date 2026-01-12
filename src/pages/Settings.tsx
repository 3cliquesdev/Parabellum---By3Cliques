import { useRolePermissions } from "@/hooks/useRolePermissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Shield, 
  Database, 
  Mail, 
  Webhook, 
  Loader2, 
  FileText, 
  MessageCircle, 
  Brain, 
  Smartphone, 
  Package, 
  Key, 
  Zap, 
  Clock, 
  Target, 
  CircleDot,
  Sparkles,
  ShoppingCart,
  Headphones,
  Plug,
  Link,
  BookOpen,
  Instagram,
  Palette,
  Send
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SettingsCategory } from "@/components/settings/SettingsCategory";
import { SettingsCard } from "@/components/settings/SettingsCard";

export default function Settings() {
  const { hasPermission, loading } = useRolePermissions();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasPermission("settings.view")) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Acesso Negado</h1>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    );
  }

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({
        title: "Senha inválida",
        description: "A senha deve ter no mínimo 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Senhas não conferem",
        description: "A nova senha e a confirmação devem ser iguais",
        variant: "destructive",
      });
      return;
    }

    setChangingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast({
        title: "Senha alterada!",
        description: "Sua senha foi atualizada com sucesso",
      });

      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({
        title: "Erro ao alterar senha",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="p-6 pb-20 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground mt-1">Gerencie todas as configurações da plataforma</p>
      </div>

      {/* Password Change - Compact Card */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Key className="h-5 w-5 text-amber-600" />
            Alterar Minha Senha
          </CardTitle>
          <CardDescription>Defina uma nova senha para sua conta</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="new-password">Nova Senha</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="confirm-password">Confirmar Senha</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button 
              onClick={handleChangePassword} 
              disabled={changingPassword}
              className="shrink-0"
            >
              {changingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Alterar Senha
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Categories Grid */}
      <div className="space-y-8">
        {/* AI Section */}
        <SettingsCategory
          title="Inteligência Artificial"
          icon={Brain}
          iconColor="text-purple-500"
        >
          <SettingsCard
            icon={Sparkles}
            iconBgColor="bg-purple-500"
            title="Modelo AI"
            description="Escolha o modelo padrão"
            onClick={() => navigate('/settings/integrations')}
          />
          <SettingsCard
            icon={Brain}
            iconBgColor="bg-purple-600"
            title="Treinador AI"
            description="Estatísticas e treinamento"
            onClick={() => navigate('/settings/integrations')}
          />
          <SettingsCard
            icon={BookOpen}
            iconBgColor="bg-purple-400"
            title="Conhecimento"
            description="Importe base de conhecimento"
            onClick={() => navigate('/settings/knowledge-import')}
          />
        </SettingsCategory>

        {/* Communication Channels */}
        <SettingsCategory
          title="Canais de Comunicação"
          icon={MessageCircle}
          iconColor="text-green-500"
        >
          <SettingsCard
            icon={Smartphone}
            iconBgColor="bg-green-500"
            title="WhatsApp"
            description="Instâncias multi-agente"
            onClick={() => navigate('/settings/whatsapp')}
          />
          <SettingsCard
            icon={Instagram}
            iconBgColor="bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400"
            title="Instagram"
            description="DMs e comentários"
            onClick={() => navigate('/settings/instagram')}
          />
          <SettingsCard
            icon={MessageCircle}
            iconBgColor="bg-blue-500"
            title="Widget Chat"
            description="Chat para seu site"
            onClick={() => navigate('/settings/widget-builder')}
          />
          <SettingsCard
            icon={Link}
            iconBgColor="bg-cyan-500"
            title="Links Diretos"
            description="Links de chat público"
            onClick={() => navigate('/settings/chat-links')}
          />
        </SettingsCategory>

        {/* E-commerce & Sales */}
        <SettingsCategory
          title="E-commerce & Vendas"
          icon={ShoppingCart}
          iconColor="text-orange-500"
        >
          <SettingsCard
            icon={ShoppingCart}
            iconBgColor="bg-orange-500"
            title="Kiwify"
            description="Integração de pagamentos"
            onClick={() => navigate('/settings/integrations')}
          />
          <SettingsCard
            icon={Package}
            iconBgColor="bg-orange-600"
            title="Produtos"
            description="Gerencie produtos"
            onClick={() => navigate('/settings/products')}
          />
          <SettingsCard
            icon={Target}
            iconBgColor="bg-amber-500"
            title="Scoring"
            description="Qualificação de leads"
            onClick={() => navigate('/settings/scoring')}
          />
          <SettingsCard
            icon={Package}
            iconBgColor="bg-orange-400"
            title="Grupos Entrega"
            description="Pacotes de automação"
            onClick={() => navigate('/settings/delivery-groups')}
          />
        </SettingsCategory>

        {/* Customer Service */}
        <SettingsCategory
          title="Atendimento"
          icon={Headphones}
          iconColor="text-blue-500"
        >
          <SettingsCard
            icon={CircleDot}
            iconBgColor="bg-blue-500"
            title="Status Tickets"
            description="Status personalizados"
            onClick={() => navigate('/settings/ticket-statuses')}
          />
          <SettingsCard
            icon={Clock}
            iconBgColor="bg-blue-600"
            title="SLA e Prazos"
            description="Políticas de tempo"
            onClick={() => navigate('/settings/sla')}
          />
          <SettingsCard
            icon={Zap}
            iconBgColor="bg-yellow-500"
            title="Macros"
            description="Respostas rápidas"
            onClick={() => navigate('/settings/macros')}
          />
          <SettingsCard
            icon={Database}
            iconBgColor="bg-blue-400"
            title="Departamentos"
            description="Setores da empresa"
            onClick={() => navigate('/settings/departments')}
          />
        </SettingsCategory>

        {/* Email & Templates */}
        <SettingsCategory
          title="Email & Templates"
          icon={Mail}
          iconColor="text-pink-500"
        >
          <SettingsCard
            icon={Mail}
            iconBgColor="bg-pink-500"
            title="Configurar Email"
            description="Branding e domínio"
            onClick={() => navigate('/settings/email')}
          />
          <SettingsCard
            icon={Palette}
            iconBgColor="bg-pink-400"
            title="Branding"
            description="Logo e cores"
            onClick={() => navigate('/settings/email')}
          />
          <SettingsCard
            icon={Send}
            iconBgColor="bg-pink-600"
            title="Remetentes"
            description="Emails de envio"
            onClick={() => navigate('/settings/email')}
          />
          <SettingsCard
            icon={FileText}
            iconBgColor="bg-rose-500"
            title="Templates"
            description="Modelos de email"
            onClick={() => navigate('/email-templates')}
          />
        </SettingsCategory>

        {/* Integrations & APIs */}
        <SettingsCategory
          title="Integrações & APIs"
          icon={Plug}
          iconColor="text-cyan-500"
        >
          <SettingsCard
            icon={Plug}
            iconBgColor="bg-cyan-500"
            title="Central"
            description="Todas integrações"
            onClick={() => navigate('/settings/integrations')}
          />
          <SettingsCard
            icon={Webhook}
            iconBgColor="bg-cyan-600"
            title="Webhooks"
            description="Integrações externas"
            onClick={() => navigate('/settings/webhooks')}
          />
          <SettingsCard
            icon={Database}
            iconBgColor="bg-slate-500"
            title="Backend"
            description="Banco de dados"
            onClick={() => {}}
            disabled
          />
        </SettingsCategory>

        {/* Security & Admin */}
        <SettingsCategory
          title="Segurança & Admin"
          icon={Shield}
          iconColor="text-amber-500"
        >
          <SettingsCard
            icon={Shield}
            iconBgColor="bg-amber-500"
            title="Logs Auditoria"
            description="Histórico de mudanças"
            onClick={() => navigate('/settings/audit-logs')}
          />
          <SettingsCard
            icon={Shield}
            iconBgColor="bg-slate-600"
            title="Segurança"
            description="Políticas de acesso"
            onClick={() => {}}
            disabled
          />
        </SettingsCategory>
      </div>
    </div>
  );
}
