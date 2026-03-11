import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CSVUploader } from "@/components/CSVUploader";
import { DealColumnMapper } from "@/components/DealColumnMapper";
import { ImportProgress } from "@/components/ImportProgress";
import { useImportDeals } from "@/hooks/useImportDeals";
import { usePipelines } from "@/hooks/usePipelines";
import { useStages } from "@/hooks/useStages";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, AlertTriangle } from "lucide-react";

export default function ImportDeals() {
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importResult, setImportResult] = useState<any>(null);
  const [selectedPipeline, setSelectedPipeline] = useState<string>("");
  const [selectedStage, setSelectedStage] = useState<string>("");

  const importMutation = useImportDeals();
  const { data: pipelines } = usePipelines();
  const { data: stages } = useStages(selectedPipeline || undefined);

  // Auto-select default pipeline
  useEffect(() => {
    if (pipelines?.length && !selectedPipeline) {
      const defaultPipeline = pipelines.find(p => p.is_default) || pipelines[0];
      setSelectedPipeline(defaultPipeline.id);
    }
  }, [pipelines, selectedPipeline]);

  // Auto-select first stage
  useEffect(() => {
    if (stages?.length && selectedPipeline) {
      setSelectedStage(stages[0].id);
    }
  }, [stages, selectedPipeline]);

  const normalize = (str: string): string =>
    str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_\s]+/g, " ").trim();

  // Auto-map columns
  useEffect(() => {
    if (csvHeaders.length === 0) return;
    const autoMapping: Record<string, string> = {};
    const mappings: Record<string, string[]> = {
      'title': ['titulo', 'title', 'nome do deal', 'deal', 'negocio', 'oportunidade'],
      'value': ['valor', 'value', 'preco', 'price', 'amount'],
      'email_contato': ['email', 'e-mail', 'email_contato', 'email contato', 'email do contato'],
      'telefone_contato': ['telefone', 'phone', 'tel', 'celular', 'telefone_contato'],
      'produto': ['produto', 'product', 'plano', 'plan'],
      'assigned_to': ['vendedor', 'seller', 'responsavel', 'assigned_to', 'consultor'],
      'expected_close_date': ['data_fechamento', 'close_date', 'expected_close_date', 'data prevista', 'previsao'],
      'external_order_id': ['pedido', 'order_id', 'external_order_id', 'id_pedido'],
      'lead_source': ['fonte', 'source', 'lead_source', 'origem'],
      'status': ['status', 'situacao'],
    };

    csvHeaders.forEach((header) => {
      if (!header?.trim()) return;
      const nh = normalize(header);
      for (const [dbField, names] of Object.entries(mappings)) {
        if (autoMapping[dbField]) continue;
        if (names.some(n => nh === normalize(n) || nh.startsWith(normalize(n)) || nh.includes(normalize(n)))) {
          autoMapping[dbField] = header;
          break;
        }
      }
    });

    setMapping(autoMapping);
  }, [csvHeaders]);

  const handleDataParsed = (data: any[], headers: string[]) => {
    setCsvData(data);
    setCsvHeaders(headers);
    setImportResult(null);
  };

  const handleMappingChange = (field: string, csvColumn: string) => {
    setMapping(prev => {
      const n = { ...prev };
      if (csvColumn === '__none__' || csvColumn === '') delete n[field];
      else n[field] = csvColumn;
      return n;
    });
  };

  const validDealsCount = mapping.title
    ? csvData.filter(row => row[mapping.title]?.toString().trim()).length
    : 0;

  const handleImport = async () => {
    if (!mapping.title) { alert('O campo Título é obrigatório.'); return; }
    if (!selectedPipeline || !selectedStage) { alert('Selecione Pipeline e Estágio.'); return; }

    const mappedDeals = csvData
      .map(row => {
        const deal: any = {};
        Object.entries(mapping).forEach(([dbField, csvCol]) => {
          if (csvCol && row[csvCol]) deal[dbField] = row[csvCol];
        });
        return deal;
      })
      .filter(d => d.title?.toString().trim());

    if (mappedDeals.length === 0) { alert('Nenhum deal válido para importar.'); return; }

    try {
      const result = await importMutation.mutateAsync({
        deals: mappedDeals,
        pipeline_id: selectedPipeline,
        stage_id: selectedStage,
      });
      setImportResult({
        total: mappedDeals.length,
        processed: mappedDeals.length,
        created: result.deals_created,
        updated: 0,
        errors: result.errors.map(e => ({ row: e.row, email: e.title, error: e.error })),
      });
    } catch (error) {
      console.error('Erro na importação de deals:', error);
    }
  };

  const downloadTemplate = () => {
    import('xlsx').then((XLSX) => {
      const headers = ['Título', 'Valor', 'Email Contato', 'Telefone Contato', 'Produto', 'Vendedor', 'Data Prevista Fechamento', 'ID Pedido', 'Fonte', 'Status'];
      const example = ['Deal Exemplo', '5000,00', 'cliente@email.com', '(11) 99999-9999', 'Premium', 'João Silva', '2026-06-30', 'PED-001', 'Indicação', 'open'];
      const ws = XLSX.utils.aoa_to_sheet([headers, example]);
      ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 16) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template Deals');
      XLSX.writeFile(wb, 'template_importacao_deals.xlsx');
    });
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-foreground">Importação de Deals</h1>
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="w-4 h-4 mr-2" />
            Baixar Template
          </Button>
        </div>
        <p className="text-muted-foreground">Importe negócios em massa através de um arquivo CSV ou Excel</p>
      </div>

      <div className="space-y-6">
        <CSVUploader onDataParsed={handleDataParsed} />

        {csvHeaders.length > 0 && (
          <>
            {/* Pipeline & Stage selectors */}
            <div className="grid grid-cols-2 gap-4 border rounded-lg p-4 bg-card">
              <div className="space-y-2">
                <Label className="font-medium">Pipeline *</Label>
                <Select value={selectedPipeline} onValueChange={(v) => { setSelectedPipeline(v); setSelectedStage(""); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione o pipeline" /></SelectTrigger>
                  <SelectContent>
                    {pipelines?.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-medium">Estágio *</Label>
                <Select value={selectedStage} onValueChange={setSelectedStage} disabled={!selectedPipeline}>
                  <SelectTrigger><SelectValue placeholder="Selecione o estágio" /></SelectTrigger>
                  <SelectContent>
                    {stages?.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DealColumnMapper
              csvHeaders={csvHeaders}
              mapping={mapping}
              onMappingChange={handleMappingChange}
            />

            {csvData.length > 0 && (
              <div className="text-sm border rounded-md p-3 bg-muted/30 space-y-1">
                <p><strong>Total de linhas:</strong> {csvData.length}</p>
                <p><strong>Deals com título válido:</strong> {validDealsCount}</p>
              </div>
            )}

            {mapping.title && validDealsCount < csvData.length && (
              <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                {csvData.length - validDealsCount} linha(s) serão ignoradas por não possuírem título
              </p>
            )}

            <div className="flex justify-end gap-4">
              <Button variant="outline" onClick={() => { setCsvData([]); setCsvHeaders([]); setMapping({}); setImportResult(null); }}>
                Limpar
              </Button>
              <Button
                onClick={handleImport}
                disabled={!mapping.title || !selectedPipeline || !selectedStage || validDealsCount === 0 || importMutation.isPending}
              >
                {importMutation.isPending
                  ? importMutation.progress.total > 0
                    ? `Importando ${importMutation.progress.current}/${importMutation.progress.total}...`
                    : 'Importando...'
                  : `Importar ${validDealsCount} Deals`}
              </Button>
            </div>
          </>
        )}

        {importResult && (
          <ImportProgress
            total={importResult.total}
            processed={importResult.processed}
            created={importResult.created}
            updated={importResult.updated}
            errors={importResult.errors}
          />
        )}
      </div>
    </div>
  );
}
