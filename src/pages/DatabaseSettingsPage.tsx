import { ArrowLeft, Database, Table, HardDrive, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DatabaseSettingsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b px-4 py-4 sticky top-0 z-10">
        <div className="container mx-auto flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/settings")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Database className="h-5 w-5 text-slate-500" />
              Backend & Banco de Dados
            </h1>
            <p className="text-sm text-muted-foreground">
              Visualize informações sobre o banco de dados e armazenamento
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Cloud Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-blue-500" />
              Lovable Cloud
            </CardTitle>
            <CardDescription>
              Este projeto está conectado ao Lovable Cloud
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-green-600 font-medium">Conectado</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              O Lovable Cloud fornece banco de dados, autenticação e funções de backend integradas.
            </p>
          </CardContent>
        </Card>

        {/* Database Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Table className="h-5 w-5 text-cyan-500" />
              Tabelas do Banco
            </CardTitle>
            <CardDescription>
              Informações sobre as tabelas do sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              O banco de dados contém todas as tabelas necessárias para o funcionamento do sistema,
              incluindo contatos, conversas, tickets, produtos e configurações.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="p-3 border rounded-lg text-center">
                <p className="text-2xl font-bold text-primary">50+</p>
                <p className="text-xs text-muted-foreground">Tabelas</p>
              </div>
              <div className="p-3 border rounded-lg text-center">
                <p className="text-2xl font-bold text-green-500">Ativo</p>
                <p className="text-xs text-muted-foreground">RLS Policies</p>
              </div>
              <div className="p-3 border rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-500">10+</p>
                <p className="text-xs text-muted-foreground">Edge Functions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Storage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-purple-500" />
              Armazenamento
            </CardTitle>
            <CardDescription>
              Arquivos e mídia armazenados no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              O armazenamento de arquivos é gerenciado automaticamente pelo Lovable Cloud,
              incluindo imagens, documentos e anexos de conversas.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
