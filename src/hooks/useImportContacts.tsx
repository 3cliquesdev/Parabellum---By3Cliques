import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface ContactRow {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  company?: string;
  document?: string;
  state_registration?: string;
  address?: string;
  address_number?: string;
  address_complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  birth_date?: string;
  customer_type?: string;
  blocked?: string | boolean;
  subscription_plan?: string;
  registration_date?: string;
  last_payment_date?: string;
  next_payment_date?: string;
  recent_orders_count?: string | number;
  account_balance?: string | number;
  assigned_to?: string;
  consultant_id?: string;
}

interface ImportResult {
  created: number;
  updated: number;
  errors: Array<{ row: number; email: string; error: string }>;
}

const CHUNK_SIZE = 100; // Processar 100 contatos por vez

type ImportMode = 'replace' | 'merge' | 'update_mapped';

async function processChunk(contacts: ContactRow[], mode: ImportMode = 'replace'): Promise<ImportResult> {
  const { data, error } = await supabase.functions.invoke('bulk-import-contacts', {
    body: { contacts, mode },
  });

  if (error) throw error;
  return data as ImportResult;
}

export function useImportContacts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [importMode, setImportMode] = useState<ImportMode>('update_mapped');

  const mutation = useMutation({
    mutationFn: async ({ contacts, mode }: { contacts: ContactRow[]; mode: ImportMode }): Promise<ImportResult> => {
      const totalContacts = contacts.length;
      setProgress({ current: 0, total: totalContacts });
      
      const result: ImportResult = {
        created: 0,
        updated: 0,
        errors: [],
      };

      // Processar em chunks para evitar timeout
      for (let i = 0; i < totalContacts; i += CHUNK_SIZE) {
        const chunk = contacts.slice(i, i + CHUNK_SIZE);
        
        try {
          const chunkResult = await processChunk(chunk, mode);
          result.created += chunkResult.created;
          result.updated += chunkResult.updated;
          result.errors.push(...chunkResult.errors);
        } catch (error: any) {
          console.error(`[Import] Chunk ${i / CHUNK_SIZE + 1} failed:`, error);
          // Adicionar todos os contatos do chunk como erro
          chunk.forEach((contact, index) => {
            result.errors.push({
              row: i + index + 1,
              email: contact.email || 'N/A',
              error: error.message || 'Erro no processamento do lote',
            });
          });
        }
        
        setProgress({ current: Math.min(i + CHUNK_SIZE, totalContacts), total: totalContacts });
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      
      toast({
        title: "Importação concluída",
        description: `${result.created} criados, ${result.updated} atualizados${
          result.errors.length > 0 ? `, ${result.errors.length} erros` : ''
        }`,
      });
      
      setProgress({ current: 0, total: 0 });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro na importação",
        description: error.message,
        variant: "destructive",
      });
      setProgress({ current: 0, total: 0 });
    },
  });

  return {
    ...mutation,
    progress,
    importMode,
    setImportMode,
  };
}
