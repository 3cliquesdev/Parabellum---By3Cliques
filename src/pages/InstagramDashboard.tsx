import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Mail, Settings, TrendingUp, Users, CheckCircle } from "lucide-react";
import { useInstagramStats } from "@/hooks/instagram";
import { useNavigate, useSearchParams } from "react-router-dom";
import InstagramComments from "./InstagramComments";
import InstagramMessages from "./InstagramMessages";
import InstagramSettings from "./InstagramSettings";

const InstagramDashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "comments";
  const { data: stats, isLoading } = useInstagramStats();

  const handleTabChange = (value: string) => {
    navigate(`/instagram?tab=${value}`);
  };

  const statCards = [
    {
      title: "Comentários Novos",
      value: stats?.newComments || 0,
      icon: MessageCircle,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "DMs Não Lidas",
      value: stats?.unreadMessages || 0,
      icon: Mail,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Convertidos (Semana)",
      value: stats?.convertedThisWeek || 0,
      icon: TrendingUp,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Taxa de Resposta",
      value: `${stats?.responseRate || 0}%`,
      icon: CheckCircle,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
  ];

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Instagram</h1>
          <p className="text-muted-foreground">
            Gerencie comentários e mensagens do Instagram
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? "..." : stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList>
          <TabsTrigger value="comments" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            Comentários
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-2">
            <Mail className="h-4 w-4" />
            Mensagens
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comments" className="space-y-4">
          <InstagramComments />
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          <InstagramMessages />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <InstagramSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InstagramDashboard;
