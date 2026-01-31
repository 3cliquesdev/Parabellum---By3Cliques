import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UploadProgress {
  status: 'idle' | 'compressing' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

interface UploadResult {
  url: string;
  storagePath: string;
  attachmentId: string;
}

/**
 * Hook Enterprise para upload de mídia no chat
 * 
 * MELHORIAS V2:
 * - Upload DIRETO no Supabase Storage (não via edge function com FormData)
 * - Compressão client-side para imagens > 2MB
 * - Progresso granular (compressing → uploading → success)
 * - Rollback automático em caso de erro
 * 
 * @example
 * const { uploadMedia, retryUpload, progress } = useMediaUploadV2();
 * 
 * const result = await uploadMedia(file, conversationId, messageId);
 * if (result) {
 *   console.log('Uploaded:', result.url);
 * }
 */
export function useMediaUploadV2() {
  const [progress, setProgress] = useState<Record<string, UploadProgress>>({});
  const { toast } = useToast();

  const uploadMedia = useCallback(async (
    file: File,
    conversationId: string,
    messageId: string
  ): Promise<UploadResult | null> => {
    const uploadId = messageId;
    
    try {
      // 1. Iniciar compressão (se necessário)
      setProgress(prev => ({
        ...prev,
        [uploadId]: { status: 'compressing', progress: 10 }
      }));
      
      // Comprimir imagem se muito grande (>2MB) e for imagem
      const processedFile = file.size > 2 * 1024 * 1024 && file.type.startsWith('image/')
        ? await compressImage(file)
        : file;
      
      console.log('[useMediaUploadV2] 📦 File processed:', {
        original: file.size,
        processed: processedFile.size,
        compressed: file.size !== processedFile.size,
      });
      
      // 2. Upload direto no Supabase Storage
      setProgress(prev => ({
        ...prev,
        [uploadId]: { status: 'uploading', progress: 30 }
      }));
      
      const timestamp = Date.now();
      const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${conversationId}/${timestamp}_${sanitizedFilename}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(storagePath, processedFile, {
          cacheControl: '3600',
          upsert: false,
        });
      
      if (uploadError) {
        console.error('[useMediaUploadV2] ❌ Storage upload failed:', uploadError);
        throw uploadError;
      }
      
      console.log('[useMediaUploadV2] ✅ Storage upload success:', uploadData.path);
      
      setProgress(prev => ({
        ...prev,
        [uploadId]: { status: 'uploading', progress: 70 }
      }));
      
      // 3. Criar registro em media_attachments
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: attachment, error: attachmentError } = await supabase
        .from('media_attachments')
        .insert({
          message_id: messageId,
          conversation_id: conversationId,
          uploaded_by: user?.id || null,
          original_filename: file.name,
          mime_type: file.type,
          file_size: processedFile.size,
          storage_path: storagePath,
          storage_bucket: 'chat-attachments',
          status: 'ready',
        })
        .select()
        .single();
      
      if (attachmentError) {
        console.error('[useMediaUploadV2] ❌ Attachment record failed:', attachmentError);
        // Rollback: deletar arquivo do storage
        await supabase.storage.from('chat-attachments').remove([storagePath]);
        throw attachmentError;
      }
      
      console.log('[useMediaUploadV2] ✅ Attachment record created:', attachment.id);
      
      // 4. Gerar URL assinada
      const { data: signedUrl } = await supabase.storage
        .from('chat-attachments')
        .createSignedUrl(storagePath, 3600);
      
      setProgress(prev => ({
        ...prev,
        [uploadId]: { status: 'success', progress: 100 }
      }));
      
      // Limpar progresso após 2 segundos
      setTimeout(() => {
        setProgress(prev => {
          const { [uploadId]: _, ...rest } = prev;
          return rest;
        });
      }, 2000);
      
      return {
        url: signedUrl?.signedUrl || '',
        storagePath,
        attachmentId: attachment.id,
      };
      
    } catch (error) {
      console.error('[useMediaUploadV2] ❌ Error:', error);
      
      setProgress(prev => ({
        ...prev,
        [uploadId]: {
          status: 'error',
          progress: 0,
          error: error instanceof Error ? error.message : 'Upload failed'
        }
      }));
      
      toast({
        title: "Erro no upload",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive",
      });
      
      return null;
    }
  }, [toast]);

  const retryUpload = useCallback((uploadId: string) => {
    setProgress(prev => {
      const { [uploadId]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const getProgress = useCallback((uploadId: string): UploadProgress | undefined => {
    return progress[uploadId];
  }, [progress]);

  return { uploadMedia, retryUpload, progress, getProgress };
}

/**
 * Comprime imagem para max 1920px e 85% quality
 * Retorna File com tipo image/jpeg
 */
async function compressImage(file: File): Promise<File> {
  console.log('[compressImage] 🗜️ Starting compression for:', file.name, file.size);
  
  const img = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  
  const maxSize = 1920;
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');
  
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      b => b ? resolve(b) : reject(new Error('Failed to compress image')),
      'image/jpeg',
      0.85
    )
  );
  
  console.log('[compressImage] ✅ Compressed:', file.size, '→', blob.size, 'bytes');
  
  // Manter extensão original no nome, mas tipo é jpeg
  const newName = file.name.replace(/\.[^.]+$/, '.jpg');
  return new File([blob], newName, { type: 'image/jpeg' });
}
