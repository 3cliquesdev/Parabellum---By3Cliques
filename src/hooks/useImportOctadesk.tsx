import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { OctadeskConversation } from '@/utils/octadeskParser';
import { OctadeskImportOptions } from '@/components/octadesk/OctadeskImportConfig';

interface ImportProgress {
  total: number;
  processed: number;
  success: number;
  skipped: number;
  failed: number;
  currentItem?: string;
}

interface ImportResult {
  success: boolean;
  articlesCreated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export function useImportOctadesk() {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);

  const importConversations = useCallback(async (
    conversations: OctadeskConversation[],
    options: OctadeskImportOptions
  ): Promise<ImportResult> => {
    setIsImporting(true);
    setProgress({
      total: conversations.length,
      processed: 0,
      success: 0,
      skipped: 0,
      failed: 0,
    });

    const result: ImportResult = {
      success: true,
      articlesCreated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    const BATCH_SIZE = 5;
    const batches: OctadeskConversation[][] = [];
    
    for (let i = 0; i < conversations.length; i += BATCH_SIZE) {
      batches.push(conversations.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      // Filter out unsatisfied if option is enabled
      const filteredBatch = options.skipUnsatisfied
        ? batch.filter(c => c.satisfaction !== 'unsatisfied')
        : batch;

      if (filteredBatch.length === 0) {
        const skippedCount = batch.length;
        result.skipped += skippedCount;
        setProgress(p => p ? {
          ...p,
          processed: p.processed + skippedCount,
          skipped: p.skipped + skippedCount,
        } : null);
        continue;
      }

      try {
        const payload = {
          conversations: filteredBatch.map(c => ({
            roomKey: c.roomKey,
            department: c.department,
            publicTags: c.publicTags,
            clientName: c.clientName,
            satisfaction: c.satisfaction,
          })),
          config: {
            categorySource: options.categorySource,
            customCategory: options.customCategory,
          },
        };

        setProgress(p => p ? {
          ...p,
          currentItem: `Processando lote de ${filteredBatch.length} conversas...`,
        } : null);

        const { data, error } = await supabase.functions.invoke('import-octadesk', {
          body: payload,
        });

        if (error) {
          console.error('Edge function error:', error);
          result.failed += filteredBatch.length;
          result.errors.push(`Erro no lote: ${error.message}`);
          
          setProgress(p => p ? {
            ...p,
            processed: p.processed + filteredBatch.length,
            failed: p.failed + filteredBatch.length,
          } : null);
        } else if (data) {
          const { created = 0, skipped = 0, failed = 0, errors = [] } = data;
          
          result.articlesCreated += created;
          result.skipped += skipped;
          result.failed += failed;
          if (errors.length > 0) {
            result.errors.push(...errors);
          }

          setProgress(p => p ? {
            ...p,
            processed: p.processed + filteredBatch.length,
            success: p.success + created,
            skipped: p.skipped + skipped,
            failed: p.failed + failed,
          } : null);
        }

        // Delay between batches to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        console.error('Import batch error:', err);
        result.failed += filteredBatch.length;
        result.errors.push(err instanceof Error ? err.message : 'Erro desconhecido');
        
        setProgress(p => p ? {
          ...p,
          processed: p.processed + filteredBatch.length,
          failed: p.failed + filteredBatch.length,
        } : null);
      }
    }

    setIsImporting(false);
    setProgress(null);

    // Show result toast
    if (result.articlesCreated > 0) {
      toast.success(`${result.articlesCreated} artigo${result.articlesCreated !== 1 ? 's' : ''} criado${result.articlesCreated !== 1 ? 's' : ''} com sucesso!`);
    }
    if (result.skipped > 0) {
      toast.info(`${result.skipped} conversa${result.skipped !== 1 ? 's' : ''} pulada${result.skipped !== 1 ? 's' : ''}`);
    }
    if (result.failed > 0) {
      toast.error(`${result.failed} conversa${result.failed !== 1 ? 's' : ''} falhou(aram)`);
    }

    return result;
  }, []);

  return {
    importConversations,
    isImporting,
    progress,
  };
}
