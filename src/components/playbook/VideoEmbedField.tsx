import React from 'react';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle } from 'lucide-react';
import ReactPlayer from 'react-player';
import { Textarea } from '@/components/ui/textarea';
import DOMPurify from 'dompurify';

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
  const videoUrl = extractVideoUrl(url);

  // Normalize iframe HTML to force 100% dimensions and sanitize for XSS protection
  const normalizeIframe = (iframeHtml: string): string => {
    const normalized = iframeHtml
      .replace(/width=["']\d+["']/gi, 'width="100%"')
      .replace(/height=["']\d+["']/gi, 'height="100%"')
      .replace(/<iframe/gi, '<iframe style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"');
    
    // SECURITY: Sanitize HTML to prevent XSS attacks
    return DOMPurify.sanitize(normalized, {
      ALLOWED_TAGS: ['iframe'],
      ALLOWED_ATTR: ['src', 'width', 'height', 'style', 'allowfullscreen', 'frameborder', 'allow']
    });
  };

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2">
        🎬 Link do Vídeo ou Código Embed
      </Label>
      <Textarea
        value={url}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Cole a URL (youtube.com, vimeo.com) ou código <iframe>..."
        rows={3}
        className="font-mono text-sm"
      />

      {url && !videoUrl && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            ❌ Link inválido ou não suportado. Cole uma URL válida ou código de embed.
          </AlertDescription>
        </Alert>
      )}

      {url.includes('<iframe') && videoUrl && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            ✅ Iframe detectado! URL extraída: <code className="text-xs bg-muted px-1 rounded">{videoUrl}</code>
          </AlertDescription>
        </Alert>
      )}

      {url && videoUrl && (
        <div className="aspect-video rounded-lg overflow-hidden bg-black border">
          {url.includes('<iframe') ? (
            <div 
              className="relative w-full h-full"
              dangerouslySetInnerHTML={{ __html: normalizeIframe(url) }} 
            />
          ) : (
            React.createElement(ReactPlayer as any, {
              url: videoUrl,
              width: '100%',
              height: '100%',
              controls: true,
              light: true
            })
          )}
        </div>
      )}
    </div>
  );
}
