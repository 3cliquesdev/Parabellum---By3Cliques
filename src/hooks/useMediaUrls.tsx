import { useState, useEffect, useRef } from "react";
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
}

/**
 * Hook para carregar signed URLs para múltiplos media attachments
 * Usa cache para evitar requisições repetidas
 */
export function useMediaUrls(attachments: MediaAttachment[]) {
  const [urls, setUrls] = useState<Map<string, MediaUrlResult>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const loadedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const loadUrls = async () => {
      // Filtrar attachments que ainda não foram carregados
      const missing = attachments.filter(a => 
        a.id && 
        a.storage_bucket && 
        a.storage_path && 
        !loadedIdsRef.current.has(a.id)
      );
      
      if (missing.length === 0) return;

      setIsLoading(true);
      console.log('[useMediaUrls] Loading signed URLs for:', missing.length, 'attachments');

      try {
        // Carregar todas URLs em paralelo
        const results = await Promise.all(
          missing.map(async (att) => {
            try {
              // Marcar como em processamento para evitar duplicatas
              loadedIdsRef.current.add(att.id);

              const { data, error } = await supabase.functions.invoke(
                `get-media-url?attachmentId=${att.id}&expiresIn=3600`,
                { method: 'GET' }
              );

              if (error) {
                console.error('[useMediaUrls] Error for', att.id, ':', error);
                loadedIdsRef.current.delete(att.id); // Permitir retry
                return null;
              }

              if (!data?.success || !data?.attachment?.url) {
                console.warn('[useMediaUrls] No URL for', att.id);
                loadedIdsRef.current.delete(att.id); // Permitir retry
                return null;
              }

              return {
                id: att.id,
                url: data.attachment.url,
                mimeType: data.attachment.mimeType || att.mime_type,
                filename: data.attachment.filename || att.original_filename,
                size: data.attachment.size || att.file_size,
                waveformData: data.attachment.waveformData || att.waveform_data,
                durationSeconds: data.attachment.durationSeconds || att.duration_seconds,
              } as MediaUrlResult;
            } catch (err) {
              console.error('[useMediaUrls] Exception for', att.id, ':', err);
              loadedIdsRef.current.delete(att.id); // Permitir retry
              return null;
            }
          })
        );

        // Atualizar cache com resultados válidos
        setUrls(prev => {
          const next = new Map(prev);
          results.forEach(r => {
            if (r) {
              next.set(r.id, r);
            }
          });
          return next;
        });

        console.log('[useMediaUrls] Loaded', results.filter(r => r).length, 'URLs successfully');
      } catch (err) {
        console.error('[useMediaUrls] Batch error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadUrls();
  }, [attachments]);

  // Função helper para obter URL por ID
  const getUrl = (attachmentId: string): MediaUrlResult | undefined => {
    return urls.get(attachmentId);
  };

  return { urls, isLoading, getUrl };
}

/**
 * Hook simples para obter signed URL de um único attachment
 */
export function useMediaUrl(attachmentId: string | null) {
  const [result, setResult] = useState<MediaUrlResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!attachmentId) {
      setResult(null);
      return;
    }

    const loadUrl = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          `get-media-url?attachmentId=${attachmentId}&expiresIn=3600`,
          { method: 'GET' }
        );

        if (fnError) {
          throw new Error(fnError.message);
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Failed to get URL');
        }

        setResult({
          id: attachmentId,
          url: data.attachment.url,
          mimeType: data.attachment.mimeType,
          filename: data.attachment.filename,
          size: data.attachment.size,
          waveformData: data.attachment.waveformData,
          durationSeconds: data.attachment.durationSeconds,
        });
      } catch (err) {
        console.error('[useMediaUrl] Error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setResult(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadUrl();
  }, [attachmentId]);

  return { result, isLoading, error };
}
