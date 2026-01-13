import { Check, Copy, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DnsRecord {
  record: string;
  name: string;
  type: string;
  ttl: string;
  status: string;
  value: string;
  priority?: number;
}

interface DnsRecordsTableProps {
  records: DnsRecord[];
}

export function DnsRecordsTable({ records }: DnsRecordsTableProps) {
  const { toast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: `${label} copiado para a área de transferência`,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "verified":
        return <Check className="h-4 w-4 text-green-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "failed":
      case "not_started":
      default:
        return <X className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge variant="default" className="bg-green-500">Verificado</Badge>;
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-500 text-black">Pendente</Badge>;
      case "failed":
        return <Badge variant="destructive">Falhou</Badge>;
      case "not_started":
      default:
        return <Badge variant="outline">Não configurado</Badge>;
    }
  };

  if (!records || records.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        Nenhum registro DNS disponível
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Tipo</TableHead>
            <TableHead className="w-[150px]">Nome</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead className="w-[70px]">TTL</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record, index) => (
            <TableRow key={index}>
              <TableCell>
                <Badge variant="outline" className="font-mono">
                  {record.type}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-xs break-all">
                {record.name}
              </TableCell>
              <TableCell className="font-mono text-xs break-all max-w-[300px]">
                <div className="truncate" title={record.value}>
                  {record.priority !== undefined && `${record.priority} `}
                  {record.value}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {record.ttl || "Auto"}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {getStatusIcon(record.status)}
                  {getStatusBadge(record.status)}
                </div>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(record.value, record.type)}
                  title="Copiar valor"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
