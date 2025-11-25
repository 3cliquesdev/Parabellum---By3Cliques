import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Video, AlertCircle } from 'lucide-react';

interface VideoEmbedFieldProps {
  url: string;
  onChange: (url: string) => void;
}

interface VideoInfo {
  provider: 'youtube' | 'vimeo' | 'loom' | 'gdrive' | null;
  embedUrl: string | null;
  isValid: boolean;
}

export function VideoEmbedField({ url, onChange }: VideoEmbedFieldProps) {
  const [videoInfo, setVideoInfo] = useState<VideoInfo>({
    provider: null,
    embedUrl: null,
    isValid: false
  });

  const detectVideoProvider = (inputUrl: string): VideoInfo => {
    if (!inputUrl || inputUrl.trim() === '') {
      return { provider: null, embedUrl: null, isValid: false };
    }

    // YouTube patterns
    const youtubeRegex = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const youtubeMatch = inputUrl.match(youtubeRegex);
    if (youtubeMatch) {
      return {
        provider: 'youtube',
        embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}`,
        isValid: true
      };
    }

    // Vimeo patterns
    const vimeoRegex = /vimeo\.com\/(?:video\/)?(\d+)/;
    const vimeoMatch = inputUrl.match(vimeoRegex);
    if (vimeoMatch) {
      return {
        provider: 'vimeo',
        embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
        isValid: true
      };
    }

    // Loom patterns
    const loomRegex = /loom\.com\/(?:share|embed)\/([a-f0-9]+)/;
    const loomMatch = inputUrl.match(loomRegex);
    if (loomMatch) {
      return {
        provider: 'loom',
        embedUrl: `https://www.loom.com/embed/${loomMatch[1]}`,
        isValid: true
      };
    }

    // Google Drive patterns
    const gdriveRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
    const gdriveMatch = inputUrl.match(gdriveRegex);
    if (gdriveMatch) {
      return {
        provider: 'gdrive',
        embedUrl: `https://drive.google.com/file/d/${gdriveMatch[1]}/preview`,
        isValid: true
      };
    }

    return { provider: null, embedUrl: null, isValid: false };
  };

  useEffect(() => {
    const info = detectVideoProvider(url);
    setVideoInfo(info);
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
          placeholder="Cole o link do YouTube, Vimeo, Loom ou Google Drive"
          className="mt-1.5"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Suportado: YouTube, Vimeo, Loom, Google Drive
        </p>
      </div>

      {/* Video Preview */}
      {videoInfo.isValid && videoInfo.embedUrl && (
        <div className="border rounded-lg overflow-hidden bg-black">
          <div className="aspect-video">
            <iframe
              src={videoInfo.embedUrl}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <div className="bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            ✅ Vídeo detectado: {videoInfo.provider?.toUpperCase()}
          </div>
        </div>
      )}

      {/* Error State */}
      {url && !videoInfo.isValid && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Link de vídeo inválido. Certifique-se de usar um link do YouTube, Vimeo, Loom ou Google Drive.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
