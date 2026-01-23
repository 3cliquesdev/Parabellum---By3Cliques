import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

interface UploadedMedia {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  status: string;
  url: string | null;
}

interface UseMediaUploadOptions {
  conversationId: string;
  messageId?: string;
  onSuccess?: (media: UploadedMedia) => void;
  onError?: (error: string, filename: string) => void;
}

export function useMediaUpload(options: UseMediaUploadOptions) {
  const { conversationId, messageId, onSuccess, onError } = options;
  const { toast } = useToast();
  
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia | null>(null);

  const upload = useCallback(async (file: File): Promise<UploadedMedia | null> => {
    if (!conversationId) {
      toast({
        title: "Erro",
        description: "Conversa não encontrada",
        variant: "destructive",
      });
      return null;
    }

    setIsUploading(true);
    setProgress({ loaded: 0, total: file.size, percentage: 0 });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('conversationId', conversationId);
      if (messageId) {
        formData.append('messageId', messageId);
      }

      // Simulate progress since fetch doesn't support upload progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (!prev) return null;
          const newPercentage = Math.min(prev.percentage + 10, 90);
          return {
            ...prev,
            loaded: Math.floor((newPercentage / 100) * file.size),
            percentage: newPercentage,
          };
        });
      }, 200);

      const { data, error } = await supabase.functions.invoke('upload-chat-media', {
        body: formData,
      });

      clearInterval(progressInterval);

      if (error) {
        throw new Error(error.message || 'Upload failed');
      }

      if (!data.success) {
        throw new Error(data.error || 'Upload failed');
      }

      setProgress({ loaded: file.size, total: file.size, percentage: 100 });
      setUploadedMedia(data.attachment);
      
      onSuccess?.(data.attachment);
      
      toast({
        title: "Arquivo enviado",
        description: `${file.name} foi enviado com sucesso`,
      });

      return data.attachment;
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao enviar arquivo';
      
      toast({
        title: "Erro no upload",
        description: errorMessage,
        variant: "destructive",
      });
      
      onError?.(errorMessage, file.name);
      return null;
    } finally {
      setIsUploading(false);
      // Reset progress after a delay
      setTimeout(() => setProgress(null), 1000);
    }
  }, [conversationId, messageId, onSuccess, onError, toast]);

  const reset = useCallback(() => {
    setIsUploading(false);
    setProgress(null);
    setUploadedMedia(null);
  }, []);

  return {
    upload,
    reset,
    isUploading,
    progress,
    uploadedMedia,
  };
}

// Hook to get presigned URL for a media attachment
export function useMediaUrl() {
  const [isLoading, setIsLoading] = useState(false);

  const getUrl = useCallback(async (attachmentId: string, expiresIn = 3600): Promise<string | null> => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('get-media-url', {
        body: { attachmentId, expiresIn },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to get URL');
      }

      return data.attachment.url;
    } catch (error) {
      console.error('Get media URL error:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { getUrl, isLoading };
}
