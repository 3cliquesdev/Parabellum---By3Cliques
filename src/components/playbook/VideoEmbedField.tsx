import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Video, AlertCircle } from 'lucide-react';
import ReactPlayer from 'react-player';

interface VideoEmbedFieldProps {
  url: string;
  onChange: (url: string) => void;
}

export function VideoEmbedField({ url, onChange }: VideoEmbedFieldProps) {
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    // react-player automatically detects if URL is valid
    const canPlay = (ReactPlayer as any).canPlay;
    setIsValid(canPlay && canPlay(url));
  }, [url]);

  return (
    <div className="space-y-3">
      <div>
        <Label className="flex items-center gap-2">
          <Video className="h-4 w-4" />
          Vídeo da Aula
        </Label>
        <Input
          value={url}
          onChange={(e) => onChange(e.target.value)}
          placeholder="YouTube, Vimeo, Loom, ou link MP4 direto"
          className="mt-1.5"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Suportado: YouTube, Vimeo, Loom, Google Drive, MP4, HLS
        </p>
      </div>

      {/* Preview with react-player */}
      {isValid && (
        <div className="rounded-lg overflow-hidden bg-black shadow-lg">
          <div className="aspect-video">
            {React.createElement(ReactPlayer as any, {
              url: url,
              width: '100%',
              height: '100%',
              controls: true,
              light: true,
            })}
          </div>
          <div className="bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            ✅ Vídeo detectado e compatível
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
