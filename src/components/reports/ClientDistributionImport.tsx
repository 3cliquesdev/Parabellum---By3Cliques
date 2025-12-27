import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Upload, AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2 } from "lucide-react";
import Papa from "papaparse";
import readXlsxFile from "read-excel-file";
import type { ConsultantDistribution } from "@/hooks/useConsultantDistributionReport";

interface ClientDistributionImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultants: ConsultantDistribution[];
  onImport: (updates: { client_id: string; consultant_id: string }[]) => Promise<{
    success: boolean;
    successCount: number;
    totalProcessed: number;
    errors: string[];
  }>;
  isImporting: boolean;
}

interface ParsedRow {
  client_id: string;
  client_name: string;
  consultant_id: string;
  consultant_name: string;
  isValid: boolean;
  error?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ClientDistributionImport({
  open,
  onOpenChange,
  consultants,
  onImport,
  isImporting,
}: ClientDistributionImportProps) {
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    successCount: number;
    errors: string[];
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const consultantMap = new Map(consultants.map((c) => [c.consultant_id, c.consultant_name]));

  const validateRow = useCallback(
    (row: { client_id?: string; consultant_id?: string; client_name?: string }): ParsedRow => {
      const clientId = row.client_id?.trim() || "";
      const consultantId = row.consultant_id?.trim() || "";
      const clientName = row.client_name?.trim() || "Nome não informado";

      if (!clientId) {
        return {
          client_id: clientId,
          client_name: clientName,
          consultant_id: consultantId,
          consultant_name: consultantMap.get(consultantId) || "Desconhecido",
          isValid: false,
          error: "client_id é obrigatório",
        };
      }

      if (!UUID_REGEX.test(clientId)) {
        return {
          client_id: clientId,
          client_name: clientName,
          consultant_id: consultantId,
          consultant_name: consultantMap.get(consultantId) || "Desconhecido",
          isValid: false,
          error: "client_id não é um UUID válido",
        };
      }

      if (!consultantId) {
        return {
          client_id: clientId,
          client_name: clientName,
          consultant_id: consultantId,
          consultant_name: consultantMap.get(consultantId) || "Desconhecido",
          isValid: false,
          error: "consultant_id é obrigatório",
        };
      }

      if (!UUID_REGEX.test(consultantId)) {
        return {
          client_id: clientId,
          client_name: clientName,
          consultant_id: consultantId,
          consultant_name: consultantMap.get(consultantId) || "Desconhecido",
          isValid: false,
          error: "consultant_id não é um UUID válido",
        };
      }

      if (!consultantMap.has(consultantId)) {
        return {
          client_id: clientId,
          client_name: clientName,
          consultant_id: consultantId,
          consultant_name: "Consultor não encontrado",
          isValid: false,
          error: "Consultor não existe no sistema",
        };
      }

      return {
        client_id: clientId,
        client_name: clientName,
        consultant_id: consultantId,
        consultant_name: consultantMap.get(consultantId) || "Desconhecido",
        isValid: true,
      };
    },
    [consultantMap]
  );

  const parseCSV = (file: File) => {
    Papa.parse(file, {
      header: true,
      delimiter: ";",
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Record<string, string>[];
        const parsed = rows.map((row) => validateRow(row));
        setParsedData(parsed);
      },
    });
  };

  const parseExcel = async (file: File) => {
    const rows = await readXlsxFile(file);
    if (rows.length < 2) {
      setParsedData([]);
      return;
    }

    const headers = rows[0].map((h) => String(h).toLowerCase().trim());
    const clientIdIndex = headers.findIndex((h) => h === "client_id");
    const consultantIdIndex = headers.findIndex((h) => h === "consultant_id");
    const clientNameIndex = headers.findIndex((h) => h === "client_name");

    if (clientIdIndex === -1 || consultantIdIndex === -1) {
      setParsedData([]);
      return;
    }

    const parsed = rows.slice(1).map((row) =>
      validateRow({
        client_id: String(row[clientIdIndex] || ""),
        consultant_id: String(row[consultantIdIndex] || ""),
        client_name: clientNameIndex !== -1 ? String(row[clientNameIndex] || "") : undefined,
      })
    );
    setParsedData(parsed);
  };

  const handleFile = async (file: File) => {
    setImportResult(null);
    const extension = file.name.split(".").pop()?.toLowerCase();

    if (extension === "csv") {
      parseCSV(file);
    } else if (extension === "xlsx" || extension === "xls") {
      await parseExcel(file);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    []
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    const validUpdates = parsedData
      .filter((row) => row.isValid)
      .map((row) => ({
        client_id: row.client_id,
        consultant_id: row.consultant_id,
      }));

    if (validUpdates.length === 0) return;

    const result = await onImport(validUpdates);
    setImportResult(result);

    if (result.success && result.errors.length === 0) {
      setTimeout(() => {
        onOpenChange(false);
        setParsedData([]);
        setImportResult(null);
      }, 2000);
    }
  };

  const validCount = parsedData.filter((r) => r.isValid).length;
  const invalidCount = parsedData.filter((r) => !r.isValid).length;

  const handleClose = () => {
    onOpenChange(false);
    setParsedData([]);
    setImportResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Distribuição de Clientes
          </DialogTitle>
          <DialogDescription>
            Faça upload de um arquivo CSV ou Excel com as colunas <code>client_id</code> e{" "}
            <code>consultant_id</code> para atualizar os vínculos em massa.
          </DialogDescription>
        </DialogHeader>

        {parsedData.length === 0 ? (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
            }`}
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
          >
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Arraste seu arquivo aqui</p>
            <p className="text-sm text-muted-foreground mb-4">
              Suporta arquivos .csv, .xlsx e .xls
            </p>
            <label>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileInput}
              />
              <Button variant="outline" asChild>
                <span>Selecionar arquivo</span>
              </Button>
            </label>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <Badge variant="default" className="text-sm">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {validCount} válidos
              </Badge>
              {invalidCount > 0 && (
                <Badge variant="destructive" className="text-sm">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {invalidCount} com erro
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setParsedData([]);
                  setImportResult(null);
                }}
              >
                Limpar e reenviar
              </Button>
            </div>

            <ScrollArea className="flex-1 max-h-[400px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Consultor</TableHead>
                    <TableHead>Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.slice(0, 100).map((row, idx) => (
                    <TableRow key={idx} className={row.isValid ? "" : "bg-destructive/5"}>
                      <TableCell>
                        {row.isValid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="text-sm">{row.client_name}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {row.client_id}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{row.consultant_name}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {row.consultant_id}
                        </div>
                      </TableCell>
                      <TableCell className="text-destructive text-sm">{row.error || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {parsedData.length > 100 && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Exibindo 100 de {parsedData.length} linhas
                </div>
              )}
            </ScrollArea>

            {importResult && (
              <Alert variant={importResult.success ? "default" : "destructive"}>
                {importResult.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                <AlertTitle>
                  {importResult.success ? "Importação concluída" : "Erro na importação"}
                </AlertTitle>
                <AlertDescription>
                  {importResult.successCount} clientes atualizados com sucesso.
                  {importResult.errors.length > 0 && (
                    <div className="mt-2 text-sm">
                      <strong>Erros:</strong>
                      <ul className="list-disc list-inside max-h-20 overflow-auto">
                        {importResult.errors.slice(0, 5).map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                        {importResult.errors.length > 5 && (
                          <li>...e mais {importResult.errors.length - 5} erros</li>
                        )}
                      </ul>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={validCount === 0 || isImporting}>
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Importar {validCount} clientes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
