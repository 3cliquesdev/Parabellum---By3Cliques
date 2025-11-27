import { useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, Smartphone, Settings, Trash2, QrCode } from "lucide-react";
import { useWhatsAppInstances, useDeleteWhatsAppInstance, useConnectWhatsAppInstance } from "@/hooks/useWhatsAppInstances";
import { WhatsAppInstanceDialog } from "@/components/WhatsAppInstanceDialog";
import { QRCodeModal } from "@/components/QRCodeModal";

export default function WhatsAppSettings() {
  const { data: instances, isLoading } = useWhatsAppInstances();
  const deleteMutation = useDeleteWhatsAppInstance();
  const connectMutation = useConnectWhatsAppInstance();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<any>(null);

  const handleEdit = (instance: any) => {
    setSelectedInstance(instance);
    setDialogOpen(true);
  };

  const handleConnect = async (instance: any) => {
    try {
      await connectMutation.mutateAsync(instance.id);
      setSelectedInstance(instance);
      setQrModalOpen(true);
    } catch (error) {
      console.error('Error connecting:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja remover esta instância?")) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleNewInstance = () => {
    setSelectedInstance(null);
    setDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500">Conectado</Badge>;
      case 'qr_pending':
        return <Badge variant="secondary">Aguardando QR</Badge>;
      default:
        return <Badge variant="destructive">Desconectado</Badge>;
    }
  };

  const getAIModeBadge = (mode: string) => {
    switch (mode) {
      case 'autopilot':
        return <Badge className="bg-blue-500">🤖 Autopilot</Badge>;
      case 'copilot':
        return <Badge variant="secondary">🤝 Copilot</Badge>;
      default:
        return <Badge variant="outline">⛔ Desabilitado</Badge>;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Gestão de WhatsApp
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure instâncias WhatsApp com Evolution API
            </p>
          </div>
          <Button onClick={handleNewInstance}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Instância
          </Button>
        </div>

        {/* Instances Table */}
        <Card>
          {isLoading ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">Carregando instâncias...</p>
            </div>
          ) : instances && instances.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Modo IA</TableHead>
                  <TableHead>Vinculação</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instances.map((instance: any) => (
                  <TableRow key={instance.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{instance.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {instance.phone_number || (
                        <span className="text-muted-foreground text-sm">
                          Não conectado
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(instance.status)}</TableCell>
                    <TableCell>{getAIModeBadge(instance.ai_mode)}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {instance.department && (
                          <Badge variant="outline" className="text-xs">
                            📁 {instance.department.name}
                          </Badge>
                        )}
                        {instance.user && (
                          <Badge variant="outline" className="text-xs">
                            👤 {instance.user.full_name}
                          </Badge>
                        )}
                        {!instance.department && !instance.user && (
                          <span className="text-muted-foreground text-sm">
                            Geral
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {instance.status !== 'connected' && (
                            <DropdownMenuItem onClick={() => handleConnect(instance)}>
                              <QrCode className="w-4 h-4 mr-2" />
                              Conectar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleEdit(instance)}>
                            <Settings className="w-4 h-4 mr-2" />
                            Configurar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(instance.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center space-y-4">
              <Smartphone className="w-12 h-12 mx-auto text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">
                  Nenhuma instância configurada
                </p>
                <p className="text-sm text-muted-foreground">
                  Crie sua primeira instância WhatsApp para começar
                </p>
              </div>
              <Button onClick={handleNewInstance}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Instância
              </Button>
            </div>
          )}
        </Card>
      </div>

      <WhatsAppInstanceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        instance={selectedInstance}
      />

      {selectedInstance && (
        <QRCodeModal
          open={qrModalOpen}
          onOpenChange={setQrModalOpen}
          instance={selectedInstance}
        />
      )}
    </Layout>
  );
}
