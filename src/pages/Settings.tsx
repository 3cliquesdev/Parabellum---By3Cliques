import { useRolePermissions } from "@/hooks/useRolePermissions";
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
  Send,
  GitBranch,
  Store
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SettingsCategory } from "@/components/settings/SettingsCategory";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { SystemMaintenanceCard } from "@/components/settings/SystemMaintenanceCard";

export default function Settings() {
  const { hasPermission, loading } = useRolePermissions();
  const navigate = useNavigate();

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

  return (
    <div className="p-6 pb-20 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground mt-1">Gerencie todas as configurações da plataforma</p>
      </div>

      {/* Categories Grid */}
      <div className="space-y-8">
        {/* AI Section */}
        <div data-tour="settings-ai">
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
              onClick={() => navigate('/settings/ai')}
            />
            <SettingsCard
              icon={Brain}
              iconBgColor="bg-purple-600"
              title="Treinador AI"
              description="Estatísticas e treinamento"
              onClick={() => navigate('/settings/ai')}
            />
            <SettingsCard
              icon={BookOpen}
              iconBgColor="bg-purple-400"
              title="Conhecimento"
              description="Importe base de conhecimento"
              onClick={() => navigate('/settings/knowledge-import')}
            />
          </SettingsCategory>
        </div>

        {/* Communication Channels */}
        <div data-tour="settings-channels">
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
              icon={MessageCircle}
              iconBgColor="bg-green-600"
              title="WhatsApp Meta API"
              description="Cloud API e Templates HSM"
              onClick={() => navigate('/settings/whatsapp-meta')}
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
        </div>

        {/* E-commerce & Sales */}
        <div data-tour="settings-ecommerce">
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
              onClick={() => navigate('/settings/kiwify')}
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
            <SettingsCard
              icon={Store}
              iconBgColor="bg-emerald-500"
              title="Canais de Venda"
              description="FForder, PIX, Boleto..."
              onClick={() => navigate('/settings/sales-channels')}
            />
          </SettingsCategory>
        </div>

        {/* Customer Service */}
        <div data-tour="settings-support">
          <SettingsCategory
            title="Atendimento"
            icon={Headphones}
            iconColor="text-blue-500"
          >
            {hasPermission("settings.chat_flows") && (
              <SettingsCard
                icon={GitBranch}
                iconBgColor="bg-indigo-500"
                title="Fluxos de Chat"
                description="Automação visual"
                onClick={() => navigate('/settings/chat-flows')}
              />
            )}
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
              title="Depart. & Operações"
              description="Departamentos, operações e categorias"
              onClick={() => navigate('/settings/departments')}
            />
          </SettingsCategory>
        </div>

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
        <div data-tour="settings-integrations">
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
              onClick={() => navigate('/settings/integrations-central')}
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
              onClick={() => navigate('/settings/database')}
            />
          </SettingsCategory>
        </div>

        {/* Security & Admin */}
        <SettingsCategory
          title="Segurança & Admin"
          icon={Shield}
          iconColor="text-amber-500"
        >
          <SettingsCard
            icon={Key}
            iconBgColor="bg-amber-500"
            title="Segurança"
            description="Senhas e acessos"
            onClick={() => navigate('/settings/security')}
          />
          <SettingsCard
            icon={Shield}
            iconBgColor="bg-slate-600"
            title="Logs Auditoria"
            description="Histórico de mudanças"
            onClick={() => navigate('/settings/audit-logs')}
          />
          <SystemMaintenanceCard />
        </SettingsCategory>
      </div>

    </div>
  );
}
