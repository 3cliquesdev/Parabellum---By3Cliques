import { useCallback, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import Papa from "papaparse";
import readXlsxFile from "read-excel-file";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface CSVUploaderProps {
  onDataParsed: (data: any[], headers: string[], headerRowIndex?: number) => void;
}

/**
 * Sanitiza um header: trim, remove caracteres invisíveis (BOM, ZWNBSP, etc.)
 */
function sanitizeHeader(raw: string): string {
  return raw
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '') // zero-width chars, BOM, NBSP
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Garante unicidade dos headers (adiciona sufixo _2, _3 em duplicados)
 */
function ensureUniqueHeaders(headers: string[]): string[] {
  const seen: Record<string, number> = {};
  return headers.map((h) => {
    if (!h) return h;
    const lower = h.toLowerCase();
    if (seen[lower] !== undefined) {
      seen[lower]++;
      return `${h}_${seen[lower]}`;
    }
    seen[lower] = 1;
    return h;
  });
}

// Aliases conhecidos para scoring de header
const KNOWN_HEADER_ALIASES = new Set([
  'id', 'nome', 'name', 'first_name', 'last_name', 'sobrenome',
  'email', 'e-mail', 'mail',
  'telefone', 'phone', 'tel', 'celular', 'fone',
  'empresa', 'company', 'companhia',
  'cpf', 'cnpj', 'documento', 'document', 'cpf/cnpj', 'cnpj ou cpf',
  'ie', 'inscricao estadual', 'state_registration',
  'endereco', 'address', 'rua', 'logradouro', 'endereço',
  'numero', 'number', 'num', 'número',
  'complemento', 'complement',
  'bairro', 'neighborhood', 'district',
  'cidade', 'city', 'municipio', 'município',
  'estado', 'state', 'uf',
  'cep', 'zip', 'zipcode', 'zip_code',
  'nascimento', 'birth_date', 'data de nascimento', 'data_nascimento',
  'tipo', 'customer_type', 'tipo de cliente', 'tipo_cliente',
  'bloqueado', 'blocked', 'ativo', 'status',
  'plano', 'subscription_plan', 'assinatura', 'plano de assinatura',
  'cadastro', 'registration_date', 'data_cadastro', 'data de cadastro', 'data cadastro', 'data de registro', 'data registro',
  'ultimo pagamento', 'last_payment_date', 'último pagamento',
  'proximo pagamento', 'next_payment_date', 'próximo pagamento',
  'pedidos', 'orders', 'pedidos recentes',
  'saldo', 'balance', 'account_balance', 'saldo da conta',
  'consultor', 'consultant', 'responsavel', 'responsável', 'assigned_to',
  'id_consultor', 'consultant_id', 'id consultor', 'uuid_consultor',
]);

// Padrão UUID
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Calcula score de "cara de cabeçalho" para uma linha.
 * Quanto maior, mais provável ser header.
 */
function scoreHeaderRow(row: any[]): number {
  if (!row || row.length === 0) return -1;

  let score = 0;
  let filledCount = 0;

  for (const cell of row) {
    const val = String(cell ?? '').trim();
    if (!val) continue;
    filledCount++;

    // Texto curto (< 40 chars) = parece nome de coluna
    if (val.length <= 40) score += 1;
    // Texto muito curto (< 20 chars) = bonus
    if (val.length <= 20) score += 1;

    // Match com alias conhecido = forte indicador
    const normalized = val.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (KNOWN_HEADER_ALIASES.has(normalized)) {
      score += 5;
    }

    // Penalizar se parece dado numérico puro
    if (/^\d+([.,]\d+)?$/.test(val)) score -= 2;
    // Penalizar UUID
    if (UUID_RE.test(val)) score -= 3;
    // Penalizar datas (dd/mm/yy, mm/dd/yy, yyyy-mm-dd)
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(val) || /^\d{4}-\d{2}-\d{2}/.test(val)) score -= 2;
    // Penalizar telefones
    if (/^\(\d{2}\)\s?\d{4,5}-\d{4}$/.test(val)) score -= 2;
    // Penalizar CPF/CNPJ formatados (valores, não headers)
    if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(val) || /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(val)) score -= 2;
    // Penalizar emails (valores)
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) score -= 2;
    // Penalizar textos longos (> 50 chars) = parece dado
    if (val.length > 50) score -= 2;
  }

  // Penalizar linhas com poucas células preenchidas
  if (filledCount < 3) score -= 5;

  return score;
}

/**
 * Dado um array de linhas, encontra a melhor linha de cabeçalho
 * usando scoring semântico. Escaneia até 100 linhas.
 * Em empate, prefere a linha mais acima.
 */
function findBestHeaderRow(rows: any[][], maxScan = 100): number {
  let bestIdx = 0;
  let bestScore = -Infinity;
  const candidates: { idx: number; score: number; preview: string }[] = [];

  const limit = Math.min(rows.length, maxScan);
  for (let i = 0; i < limit; i++) {
    const row = rows[i];
    if (!row) continue;
    const score = scoreHeaderRow(row);
    candidates.push({
      idx: i,
      score,
      preview: row.slice(0, 5).map(c => String(c ?? '').substring(0, 20)).join(' | '),
    });
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  // Log top 3 candidatas
  candidates.sort((a, b) => b.score - a.score);
  console.log('[CSVUploader] Header detection — top 3 candidates:',
    candidates.slice(0, 3).map(c => `row ${c.idx} (score ${c.score}): "${c.preview}"`)
  );
  console.log('[CSVUploader] Header row chosen: index', bestIdx, '| score:', bestScore);

  return bestIdx;
}

/**
 * Processa headers brutos:
 * 1. Sanitiza
 * 2. Gera fallback para vazios (coluna_1, coluna_2…)
 * 3. Remove colunas totalmente vazias nos dados
 * 4. Garante unicidade
 */
function processHeaders(rawHeaders: string[], dataRows?: Record<string, string>[]): string[] {
  let headers = rawHeaders.map((h, i) => {
    const clean = sanitizeHeader(String(h ?? ''));
    return clean || `coluna_${i + 1}`;
  });

  // Remover colunas que são todas vazias nos dados (se temos dados)
  if (dataRows && dataRows.length > 0) {
    headers = headers.filter(h => {
      return dataRows.some(row => {
        const val = row[h];
        return val != null && String(val).trim() !== '';
      });
    });
  }

  return ensureUniqueHeaders(headers);
}

export function CSVUploader({ onDataParsed }: CSVUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const parseCSV = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      let content = e.target?.result as string;
      
      // Remover BOM se existir
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
      }

      // Primeiro parse sem header para detectar melhor linha
      Papa.parse(content, {
        header: false,
        skipEmptyLines: true,
        delimiter: '',
        complete: (rawResults) => {
          const allRows = rawResults.data as string[][];
          if (allRows.length < 2) {
            alert('Arquivo vazio ou formato inválido.');
            setFile(null);
            return;
          }

          const headerIdx = findBestHeaderRow(allRows);
          const rawHeaders = allRows[headerIdx].map(cell => String(cell ?? ''));
          const sanitizedHeaders = rawHeaders.map(h => sanitizeHeader(h));
          const headerKeys = sanitizedHeaders.map((h, i) => h || `coluna_${i + 1}`);

          // Data = tudo após header row
          const dataRows = allRows.slice(headerIdx + 1);
          const data = dataRows.map(row => {
            const obj: Record<string, string> = {};
            headerKeys.forEach((key, i) => {
              obj[key] = row[i] != null ? String(row[i]) : '';
            });
            return obj;
          });

          const finalHeaders = processHeaders(headerKeys, data);
          
          console.log('[CSVUploader] CSV parsed headers:', finalHeaders, '| header row:', headerIdx, '| total linhas:', data.length);
          
          if (finalHeaders.length === 0) {
            alert('Não encontramos cabeçalhos válidos no CSV. Verifique se há uma linha com nomes de colunas.');
            setFile(null);
            return;
          }

          onDataParsed(data, finalHeaders, headerIdx);
        },
        error: (error) => {
          console.error('Erro ao processar CSV:', error);
          alert('Erro ao processar arquivo CSV');
          setFile(null);
        },
      });
    };
    reader.onerror = () => {
      alert('Erro ao ler arquivo');
      setFile(null);
    };
    reader.readAsText(file, 'UTF-8');
  }, [onDataParsed]);

  const parseExcel = useCallback(async (file: File) => {
    try {
      const rows = await readXlsxFile(file);
      if (rows.length < 2) {
        alert('Planilha vazia ou sem dados.');
        setFile(null);
        return;
      }

      // Detectar melhor linha de header com scoring semântico
      const headerIdx = findBestHeaderRow(rows);

      const rawHeaders = rows[headerIdx].map(cell => String(cell ?? ''));
      const sanitizedHeaders = rawHeaders.map(h => sanitizeHeader(h));
      const headerKeys = sanitizedHeaders.map((h, i) => h || `coluna_${i + 1}`);

      // Dados = tudo após a linha de header
      const dataRows = rows.slice(headerIdx + 1);

      const data = dataRows.map(row => {
        const obj: Record<string, string> = {};
        headerKeys.forEach((key, index) => {
          obj[key] = row[index] != null ? String(row[index]) : '';
        });
        return obj;
      });

      const finalHeaders = processHeaders(headerKeys, data);

      console.log('[CSVUploader] Excel parsed headers:', finalHeaders, '| header row:', headerIdx, '| total linhas:', data.length);

      if (finalHeaders.length === 0) {
        alert('Não encontramos cabeçalhos válidos na planilha. Verifique se há uma linha com nomes de colunas.');
        setFile(null);
        return;
      }

      onDataParsed(data, finalHeaders, headerIdx);
    } catch (error: any) {
      console.error('Erro ao processar Excel:', error);
      
      if (error?.message?.includes('invalid zip') || error?.code === 13) {
        alert('Formato .xls (Excel 97-2003) não suportado.\n\nPor favor, abra o arquivo no Excel e salve como:\n• .xlsx (Excel moderno)\n• .csv (separado por ponto-e-vírgula)');
      } else {
        alert('Erro ao processar planilha Excel. Verifique se o arquivo não está corrompido.');
      }
      setFile(null);
    }
  }, [onDataParsed]);

  const handleFile = useCallback((selectedFile: File) => {
    const fileName = selectedFile.name.toLowerCase();
    const isCSV = fileName.endsWith('.csv') || fileName.endsWith('.txt');
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    if (!isCSV && !isExcel) {
      alert('Por favor, selecione um arquivo CSV ou Excel (.xlsx)');
      return;
    }

    if (fileName.endsWith('.xls') && !fileName.endsWith('.xlsx')) {
      alert('Formato .xls (Excel 97-2003) não suportado.\n\nPor favor, abra o arquivo no Excel e salve como:\n• .xlsx (Excel moderno)\n• .csv (separado por ponto-e-vírgula)');
      return;
    }

    setFile(selectedFile);

    if (isExcel) {
      parseExcel(selectedFile);
    } else {
      parseCSV(selectedFile);
    }
  }, [parseCSV, parseExcel]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
  }, [handleFile]);

  const clearFile = useCallback(() => {
    setFile(null);
    onDataParsed([], []);
  }, [onDataParsed]);

  return (
    <Card className="p-6">
      {!file ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50'
          }`}
        >
          <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Arraste sua planilha aqui</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Aceita arquivos Excel (.xlsx) ou CSV
          </p>
          <label htmlFor="file-upload">
            <Button variant="outline" className="cursor-pointer" asChild>
              <span>Selecionar Arquivo</span>
            </Button>
          </label>
          <input
            id="file-upload"
            type="file"
            accept=".csv,.xlsx,.txt"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      ) : (
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary" />
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {(file.size / 1024).toFixed(2)} KB
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={clearFile}
            className="text-destructive hover:text-destructive"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
    </Card>
  );
}
