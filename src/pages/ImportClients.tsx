import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CSVUploader } from "@/components/CSVUploader";
import { ColumnMapper } from "@/components/ColumnMapper";
import { ImportProgress } from "@/components/ImportProgress";
import { useImportContacts } from "@/hooks/useImportContacts";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Download, AlertTriangle } from "lucide-react";

export default function ImportClients() {
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importResult, setImportResult] = useState<any>(null);
  const [detectedHeaderRow, setDetectedHeaderRow] = useState<number | null>(null);
  
  const importMutation = useImportContacts();

  // Normaliza string removendo acentos e caracteres especiais
  const normalize = (str: string): string =>
    str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_\s]+/g, " ").trim();

  // Verifica se maioria dos headers parece numérica (indicador de header incorreto)
  const headersLookNumeric = csvHeaders.length > 0 && csvHeaders.filter(h => /^\d+([.,]\d+)?$/.test(h.trim())).length > csvHeaders.length * 0.5;

  // Auto-mapear colunas quando CSV é carregado
  useEffect(() => {
    if (csvHeaders.length > 0) {
      const autoMapping: Record<string, string> = {};
      
      console.log('[ImportClients] CSV headers parseados:', csvHeaders);
      
      const mappings: Record<string, string[]> = {
        'email': ['email', 'e-mail', 'mail'],
        'first_name': ['nome', 'first_name', 'firstname', 'first name', 'primeironome'],
        'last_name': ['sobrenome', 'last_name', 'lastname', 'last name', 'ultimonome'],
        'phone': ['telefone', 'phone', 'tel', 'celular', 'fone'],
        'company': ['empresa', 'company', 'companhia'],
        'document': ['cpf', 'cnpj', 'documento', 'document', 'cpf/cnpj', 'cnpj ou cpf'],
        'state_registration': ['ie', 'inscricao estadual', 'state_registration', 'inscricao_estadual'],
        'address': ['endereco', 'address', 'rua', 'logradouro'],
        'address_number': ['numero', 'number', 'address_number', 'num'],
        'address_complement': ['complemento', 'complement', 'address_complement', 'compl'],
        'neighborhood': ['bairro', 'neighborhood', 'district'],
        'city': ['cidade', 'city', 'municipio'],
        'state': ['estado', 'state', 'uf'],
        'zip_code': ['cep', 'zip', 'zipcode', 'zip_code', 'postalcode'],
        'birth_date': ['nascimento', 'data_nascimento', 'birth_date', 'birthdate', 'data de nascimento'],
        'customer_type': ['tipo', 'customer_type', 'tipo_cliente', 'tipo de cliente'],
        'blocked': ['bloqueado', 'blocked', 'bloquear'],
        'subscription_plan': ['plano', 'subscription_plan', 'plano_assinatura', 'assinatura'],
        'registration_date': ['cadastro', 'registration_date', 'data_cadastro', 'data de cadastro', 'data cadastro', 'data de registro', 'data registro'],
        'last_payment_date': ['ultimo_pagamento', 'ultimo pagamento', 'last_payment_date', 'data_ultimo_pagamento'],
        'next_payment_date': ['proximo_pagamento', 'proximo pagamento', 'next_payment_date', 'data_proximo_pagamento'],
        'recent_orders_count': ['pedidos', 'recent_orders_count', 'qtd_pedidos', 'quantidade pedidos', 'pedidos recentes'],
        'account_balance': ['saldo', 'account_balance', 'saldo_conta', 'balance'],
        'assigned_to': ['consultor', 'consultant', 'responsavel', 'assigned_to'],
        'consultant_id': ['id_consultor', 'consultant_id', 'id consultor', 'uuid_consultor'],
      };

      // Priority: exact match > startsWith > includes
      csvHeaders.forEach((header) => {
        if (!header || !header.trim()) return;
        const normalizedHeader = normalize(header);
        
        for (const [dbField, possibleNames] of Object.entries(mappings)) {
          if (autoMapping[dbField]) continue;
          // Exact match first
          if (possibleNames.some(name => normalizedHeader === normalize(name))) {
            autoMapping[dbField] = header;
            break;
          }
        }
      });

      // Second pass: startsWith
      csvHeaders.forEach((header) => {
        if (!header || !header.trim()) return;
        const normalizedHeader = normalize(header);
        for (const [dbField, possibleNames] of Object.entries(mappings)) {
          if (autoMapping[dbField]) continue;
          if (possibleNames.some(name => normalizedHeader.startsWith(normalize(name)))) {
            autoMapping[dbField] = header;
            break;
          }
        }
      });

      // Third pass: includes (only for semantic-looking headers, not numeric)
      csvHeaders.forEach((header) => {
        if (!header || !header.trim()) return;
        if (/^\d+([.,]\d+)?$/.test(header.trim())) return; // skip numeric headers
        const normalizedHeader = normalize(header);
        for (const [dbField, possibleNames] of Object.entries(mappings)) {
          if (autoMapping[dbField]) continue;
          if (possibleNames.some(name => normalizedHeader.includes(normalize(name)))) {
            autoMapping[dbField] = header;
            break;
          }
        }
      });

      console.log('[ImportClients] Auto-mapping resultado:', autoMapping);
      setMapping(autoMapping);
    }
  }, [csvHeaders]);

  const handleDataParsed = (data: any[], headers: string[], headerRowIndex?: number) => {
    setCsvData(data);
    setCsvHeaders(headers);
    setDetectedHeaderRow(headerRowIndex ?? null);
    setImportResult(null);
  };

  const handleMappingChange = (field: string, csvColumn: string) => {
    setMapping((prev) => {
      const newMapping = { ...prev };
      if (csvColumn === '__none__' || csvColumn === '') {
        delete newMapping[field];
      } else {
        newMapping[field] = csvColumn;
      }
      return newMapping;
    });
  };

  // Calcular contagem de contatos válidos (com email)
  const validContactsCount = mapping.email 
    ? csvData.filter(row => row[mapping.email] && row[mapping.email].toString().trim() !== '').length
    : 0;

  // Debug: samples de email para diagnóstico
  const emailSamples = mapping.email 
    ? csvData.slice(0, 3).map(row => row[mapping.email]).filter(Boolean)
    : [];

  const handleImport = async () => {
    if (!mapping.email) {
      alert('O campo Email é obrigatório. Por favor, mapeie a coluna de email.');
      return;
    }

    // Mapear dados do CSV para formato do banco
    const mappedContacts = csvData.map((row) => {
      const contact: any = {};
      
      Object.entries(mapping).forEach(([dbField, csvColumn]) => {
        if (csvColumn && row[csvColumn]) {
          contact[dbField] = row[csvColumn];
        }
      });

      return contact;
    }).filter(contact => contact.email && contact.email.toString().trim() !== '');

    // Validar se há contatos para importar
    if (mappedContacts.length === 0) {
      const emailColumn = mapping.email;
      const rowsWithoutEmail = csvData.filter(row => 
        !row[emailColumn] || row[emailColumn].toString().trim() === ''
      ).length;
      
      alert(
        `Nenhum contato válido para importar.\n\n` +
        `Total de linhas no CSV: ${csvData.length}\n` +
        `Linhas sem email na coluna "${emailColumn}": ${rowsWithoutEmail}\n\n` +
        `Verifique se a coluna de email está mapeada corretamente e se os dados estão preenchidos.`
      );
      return;
    }

    // Log para debug
    console.log(`[Import] Total rows: ${csvData.length}`);
    console.log(`[Import] Valid contacts with email: ${mappedContacts.length}`);
    console.log(`[Import] Email column: ${mapping.email}`);

    try {
      const result = await importMutation.mutateAsync({ contacts: mappedContacts, mode: importMutation.importMode });
      setImportResult({
        total: mappedContacts.length,
        processed: mappedContacts.length,
        created: result.created,
        updated: result.updated,
        errors: result.errors,
      });
    } catch (error) {
      console.error('Erro na importação:', error);
    }
  };

  const downloadTemplate = () => {
    import('xlsx').then((XLSX) => {
      const headers = [
        'E-mail', 'Nome', 'Sobrenome', 'Telefone', 'Empresa', 'CPF/CNPJ',
        'Inscrição Estadual', 'Endereço', 'Número', 'Complemento', 'Bairro',
        'Cidade', 'Estado', 'CEP', 'Data de Nascimento', 'Tipo', 'Bloqueado',
        'Plano', 'Data de Cadastro', 'Último Pagamento', 'Próximo Pagamento',
        'Pedidos Recentes', 'Saldo', 'Consultor', 'ID Consultor'
      ];
      // Headers internos para o mapeamento automático (usados no upload)
      const internalHeaders = [
        'email', 'nome', 'sobrenome', 'telefone', 'empresa', 'cpf/cnpj', 'ie',
        'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'cep',
        'data_nascimento', 'tipo', 'bloqueado', 'plano', 'data_cadastro',
        'ultimo_pagamento', 'proximo_pagamento', 'pedidos_recentes', 'saldo',
        'consultor', 'id_consultor'
      ];
      const exampleRow = [
        'exemplo@email.com', 'João', 'Silva', '(11) 99999-9999', 'Empresa Exemplo',
        '123.456.789-00', '987654321', 'Rua Aldo Focosi', '111', 'Sala 10',
        'Centro', 'Ribeirão Preto', 'SP', '14091-310', '15/01/1990', 'Cliente',
        'Não', 'Premium', '15/01/2024', '01/12/2024', '01/01/2025', '5',
        '1500,00', 'Nome do Consultor', 'uuid-do-consultor-aqui'
      ];
      const ws = XLSX.utils.aoa_to_sheet([headers, internalHeaders, exampleRow]);
      // Auto-ajustar largura das colunas
      ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 16) }));
      // Estilizar: linha 1 = headers bonitos PT-BR, linha 2 = nomes internos (referência), linha 3 = exemplo
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template');
      XLSX.writeFile(wb, 'template_importacao_clientes.xlsx');
    });
  };


  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-foreground">Importação de Clientes</h1>
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="w-4 h-4 mr-2" />
            Baixar Template
          </Button>
        </div>
        <p className="text-muted-foreground">
          Importe sua base de clientes através de um arquivo CSV
        </p>
      </div>

      <div className="space-y-6">
        <CSVUploader onDataParsed={handleDataParsed} />

        {csvHeaders.length > 0 && (
          <>
            {/* Header detection info */}
            <div className="text-xs border rounded-md p-2 bg-muted/20 space-y-1">
              <p className="font-medium text-muted-foreground">
                📋 Headers detectados ({csvHeaders.length})
                {detectedHeaderRow !== null && (
                  <span className="ml-2 text-xs opacity-70">— linha {detectedHeaderRow + 1} da planilha</span>
                )}
              </p>
              <p className="text-muted-foreground break-all">{csvHeaders.join(' | ')}</p>
            </div>

            {/* Warning if headers look numeric */}
            {headersLookNumeric && (
              <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Cabeçalho possivelmente incorreto</p>
                  <p className="text-xs mt-1">Os headers detectados parecem ser valores numéricos, não nomes de colunas. Verifique se a planilha tem uma linha de cabeçalho com nomes como "Nome", "Email", "Telefone", etc.</p>
                </div>
              </div>
            )}

            <ColumnMapper
              csvHeaders={csvHeaders}
              mapping={mapping}
              onMappingChange={handleMappingChange}
            />

            <div className="border rounded-lg p-4 space-y-3 bg-card">
              <Label className="text-sm font-medium">Modo de Importação</Label>
              <RadioGroup 
                value={importMutation.importMode} 
                onValueChange={(value) => importMutation.setImportMode(value as 'replace' | 'merge' | 'update_mapped')}
                className="flex flex-col gap-3"
              >
                <div className="flex items-start space-x-3 p-3 border rounded-md hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="update_mapped" id="update_mapped" className="mt-0.5" />
                  <Label htmlFor="update_mapped" className="cursor-pointer">
                    <span className="font-medium">Atualizar Campos do CSV</span>
                    <p className="text-xs text-muted-foreground">Atualiza apenas os campos mapeados (ideal para adicionar endereços aos clientes Kiwify)</p>
                  </Label>
                </div>
                <div className="flex items-start space-x-3 p-3 border rounded-md hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="merge" id="merge" className="mt-0.5" />
                  <Label htmlFor="merge" className="cursor-pointer">
                    <span className="font-medium">Preencher Vazios</span>
                    <p className="text-xs text-muted-foreground">Só atualiza campos que estão vazios no banco</p>
                  </Label>
                </div>
                <div className="flex items-start space-x-3 p-3 border rounded-md hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="replace" id="replace" className="mt-0.5" />
                  <Label htmlFor="replace" className="cursor-pointer">
                    <span className="font-medium">Substituir Tudo</span>
                    <p className="text-xs text-muted-foreground">Sobrescreve todos os dados existentes (cuidado!)</p>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {csvData.length > 0 && (
              <div className="text-sm border rounded-md p-3 bg-muted/30 space-y-1">
                <p><strong>Coluna Email mapeada:</strong> {mapping.email || '⚠️ NÃO SELECIONADA'}</p>
                <p><strong>Total de linhas no CSV:</strong> {csvData.length}</p>
                <p><strong>Contatos com email válido:</strong> {validContactsCount}</p>
                {emailSamples.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Exemplos: {emailSamples.join(', ')}
                  </p>
                )}
              </div>
            )}

            {mapping.email && csvData.length > 0 && validContactsCount < csvData.length && (
              <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3">
                ⚠️ {csvData.length - validContactsCount} linha(s) serão ignoradas por não possuírem email válido
              </p>
            )}

            <div className="flex justify-end gap-4">
              <Button
                variant="outline"
                onClick={() => {
                  setCsvData([]);
                  setCsvHeaders([]);
                  setMapping({});
                  setImportResult(null);
                  setDetectedHeaderRow(null);
                }}
              >
                Limpar
              </Button>
              <Button
                onClick={handleImport}
                disabled={!mapping.email || validContactsCount === 0 || importMutation.isPending}
              >
                {importMutation.isPending 
                  ? importMutation.progress.total > 0 
                    ? `Importando ${importMutation.progress.current}/${importMutation.progress.total}...`
                    : 'Importando...' 
                  : `Importar ${validContactsCount} Contatos Válidos`}
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
