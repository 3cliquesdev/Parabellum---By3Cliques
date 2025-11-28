import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Video, AlertCircle, CheckCircle } from 'lucide-react';
import ReactPlayer from 'react-player';
import { Textarea } from '@/components/ui/textarea';

/**
 * Extrai URL de vídeo de diferentes formatos
 * - URL direta: retorna como está
 * - Iframe embed: extrai src do <iframe>
 */
const extractVideoUrl = (input: string): string | null => {
  if (!input?.trim()) return null;
  
  let trimmed = input.trim();
  
  // Se for iframe, extrair src
  const iframeMatch = trimmed.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  if (iframeMatch) {
    trimmed = iframeMatch[1];
  }
  
  // Normalizar URLs do YouTube /embed/ para formato watch?v=
  if (trimmed.includes('youtube.com/embed/')) {
    const parts = trimmed.split('youtube.com/embed/')[1];
    const id = parts?.split(/[?"']/)[0];
    if (id) {
      trimmed = `https://www.youtube.com/watch?v=${id}`;
    }
  }
  
  // Se for URL direta, retornar
  if (trimmed.startsWith('http') || trimmed.startsWith('//')) {
    return trimmed;
  }
  
  return trimmed;
};

interface VideoEmbedFieldProps {
  url: string;
  onChange: (url: string) => void;
}

export function VideoEmbedField({ url, onChange }: VideoEmbedFieldProps) {
  const [isValid, setIsValid] = useState(false);
  const extractedUrl = extractVideoUrl(url);
  const displayUrl = extractedUrl || url;
  const isIframe = url.includes('<iframe');

  useEffect(() => {
    // react-player automatically detects if URL is valid (usando URL extraída)
    const canPlay = (ReactPlayer as any).canPlay;
    setIsValid(canPlay && canPlay(extractedUrl || url));
  }, [url, extractedUrl]);

  return (
    <div className="space-y-3">
      <div>
        <Label className="flex items-center gap-2">
          <Video className="h-4 w-4" />
          🎬 Vídeo da Aula (Cole URL ou Código Iframe)
        </Label>
        <Textarea
          value={url}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Cole aqui: https://youtube.com/watch?v=... OU código <iframe>..."
          className="mt-1.5 font-mono text-sm min-h-[80px]"
        />
        <p className="text-xs text-muted-foreground mt-1">
          ✅ Aceita: URL direta (YouTube, Vimeo, Loom) OU código iframe completo
        </p>
        
        {isIframe && extractedUrl && (
          <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-950/30 p-2 rounded border border-green-200 text-xs">
            <CheckCircle className="h-3 w-3" />
            <span>Iframe detectado! URL extraída: <code className="font-mono">{extractedUrl}</code></span>
          </div>
        )}
      </div>

      {/* Preview with react-player */}
      {isValid && (
        <div className="rounded-lg overflow-hidden bg-black shadow-lg">
          <div className="aspect-video">
            {React.createElement(ReactPlayer as any, {
              url: displayUrl,
              width: '100%',
              height: '100%',
              controls: true,
              light: true,
              onError: (e: any) => {
                console.error('❌ Erro no preview:', e);
                setIsValid(false);
              },
              onReady: () => console.log('✅ Preview pronto:', displayUrl)
            })}
          </div>
          <div className="bg-muted/50 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
            <CheckCircle className="h-3 w-3 text-green-500" />
            ✅ Vídeo compatível e pronto para uso
          </div>
        </div>
      )}
      
      {/* Error State */}
      {url && !isValid && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Link de vídeo inválido ou não suportado.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
