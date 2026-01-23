import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MediaAttachment {
  id: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  original_filename?: string;
  file_size?: number;
  waveform_data?: any;
  duration_seconds?: number;
}

interface MediaUrlResult {
  id: string;
  url: string;
  mimeType: string;
  filename?: string;
  size?: number;
  waveformData?: any;
  durationSeconds?: number;
  error?: string;
  retryCount?: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1 second

/**
 * Helper: Fetch URL with exponential backoff retry
 */
async function fetchUrlWithRetry(
  attachmentId: string,
  attempt: number = 1
): Promise<MediaUrlResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke(
      `get-media-url?attachmentId=${attachmentId}&expiresIn=3600`,
      { method: 'GET' }
    );

    if (error) {
      throw new Error(error.message);
    }

    if (!data?.success || !data?.attachment?.url) {
      throw new Error(data?.error || 'No URL returned');
    }

    return {
      id: attachmentId,
      url: data.attachment.url,
      mimeType: data.attachment.mimeType,
      filename: data.attachment.filename,
      size: data.attachment.size,
      waveformData: data.attachment.waveformData,
      durationSeconds: data.attachment.durationSeconds,
    };
  } catch (err) {
    console.warn(`[useMediaUrls] Attempt ${attempt}/${MAX_RETRIES} failed for ${attachmentId}:`, err);
    
    if (attempt < MAX_RETRIES) {
      // Exponential backoff: 1s, 2s, 3s
      await new Promise(r => setTimeout(r, RETRY_DELAY_BASE * attempt));
      return fetchUrlWithRetry(attachmentId, attempt + 1);
    }
    
    // All retries exhausted - return error result
    return {
      id: attachmentId,
      url: '',
      mimeType: '',
      error: err instanceof Error ? err.message : 'Failed to load media',
      retryCount: attempt,
    };
  }
}

/**
 * Hook para carregar signed URLs para múltiplos media attachments
 * Com retry automático e tratamento de erros
 */
export function useMediaUrls(attachments: MediaAttachment[]) {
  const [urls, setUrls] = useState<Map<string, MediaUrlResult>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const loadedIdsRef = useRef<Set<string>>(new Set());
  const retryQueueRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const loadUrls = async () => {
      // Filtrar attachments que ainda não foram carregados
      const missing = attachments.filter(a => 
        a.id && 
        a.storage_bucket && 
        a.storage_path && 
        !loadedIdsRef.current.has(a.id) &&
        !retryQueueRef.current.has(a.id)
      );
      
      if (missing.length === 0) return;

      setIsLoading(true);
      console.log('[useMediaUrls] Loading signed URLs for:', missing.length, 'attachments');

      try {
        // Marcar como em processamento
        missing.forEach(a => loadedIdsRef.current.add(a.id));

        // Carregar todas URLs em paralelo com retry
        const results = await Promise.all(
          missing.map(att => fetchUrlWithRetry(att.id))
        );

        // Atualizar cache com resultados
        setUrls(prev => {
          const next = new Map(prev);
          results.forEach(r => {
            if (r) {
              next.set(r.id, r);
              
              // Se teve erro, remover de loaded para permitir retry manual
              if (r.error) {
                loadedIdsRef.current.delete(r.id);
              }
            }
          });
          return next;
        });

        const successCount = results.filter(r => r && !r.error).length;
        const errorCount = results.filter(r => r?.error).length;
        console.log(`[useMediaUrls] Loaded ${successCount} URLs, ${errorCount} errors`);
      } catch (err) {
        console.error('[useMediaUrls] Batch error:', err);
        // Reset loaded IDs on batch error
        missing.forEach(a => loadedIdsRef.current.delete(a.id));
      } finally {
        setIsLoading(false);
      }
    };

    loadUrls();
  }, [attachments]);

  // Função helper para obter URL por ID
  const getUrl = useCallback((attachmentId: string): MediaUrlResult | undefined => {
    return urls.get(attachmentId);
  }, [urls]);

  // Função para retry manual de um attachment específico
  const retryLoad = useCallback(async (attachmentId: string) => {
    console.log('[useMediaUrls] Manual retry for:', attachmentId);
    
    // Marcar como retrying
    retryQueueRef.current.add(attachmentId);
    
    // Atualizar para mostrar loading
    setUrls(prev => {
      const next = new Map(prev);
      const existing = next.get(attachmentId);
      if (existing) {
        next.set(attachmentId, { ...existing, error: undefined });
      }
      return next;
    });
    
    setIsLoading(true);
    
    try {
      const result = await fetchUrlWithRetry(attachmentId, 1);
      
      setUrls(prev => {
        const next = new Map(prev);
        if (result) {
          next.set(attachmentId, result);
          
          if (!result.error) {
            loadedIdsRef.current.add(attachmentId);
          }
        }
        return next;
      });
    } finally {
      retryQueueRef.current.delete(attachmentId);
      setIsLoading(false);
    }
  }, []);

  return { urls, isLoading, getUrl, retryLoad };
}

/**
 * Hook simples para obter signed URL de um único attachment
 * Com retry automático
 */
export function useMediaUrl(attachmentId: string | null) {
  const [result, setResult] = useState<MediaUrlResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUrl = useCallback(async () => {
    if (!attachmentId) {
      setResult(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const urlResult = await fetchUrlWithRetry(attachmentId);
    
    if (urlResult?.error) {
      setError(urlResult.error);
      setResult(null);
    } else if (urlResult) {
      setResult(urlResult);
    }
    
    setIsLoading(false);
  }, [attachmentId]);

  useEffect(() => {
    loadUrl();
  }, [loadUrl]);

  const retry = useCallback(() => {
    loadUrl();
  }, [loadUrl]);

  return { result, isLoading, error, retry };
}

/**
 * Helper para obter URL fresca para envio (não usar cache)
 */
export async function getFreshMediaUrl(attachmentId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke(
      `get-media-url?attachmentId=${attachmentId}&expiresIn=3600`,
      { method: 'GET' }
    );

    if (error || !data?.success) {
      console.error('[getFreshMediaUrl] Error:', error || data?.error);
      return null;
    }

    return data.attachment.url;
  } catch (err) {
    console.error('[getFreshMediaUrl] Exception:', err);
    return null;
  }
}
