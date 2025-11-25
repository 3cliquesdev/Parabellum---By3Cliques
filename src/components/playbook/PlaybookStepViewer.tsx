import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, FileSpreadsheet, File as FileIcon, ImageIcon, Download } from 'lucide-react';

interface Attachment {
  name: string;
  url: string;
  type: string;
  size?: number;
}

interface PlaybookStepViewerProps {
  label: string;
  video_url?: string;
  rich_content?: string;
  attachments?: Attachment[];
}

export function PlaybookStepViewer({ label, video_url, rich_content, attachments }: PlaybookStepViewerProps) {
  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
    if (type.includes('spreadsheet') || type.includes('excel')) return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
    if (type.includes('word')) return <FileText className="h-5 w-5 text-blue-500" />;
    if (type.startsWith('image/')) return <ImageIcon className="h-5 w-5 text-purple-500" />;
    return <FileIcon className="h-5 w-5 text-gray-500" />;
  };

  const detectVideoEmbed = (url: string) => {
    // YouTube
    const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (youtubeMatch) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    }

    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }

    // Loom
    const loomMatch = url.match(/loom\.com\/(?:share|embed)\/([a-f0-9]+)/);
    if (loomMatch) {
      return `https://www.loom.com/embed/${loomMatch[1]}`;
    }

    // Google Drive
    const gdriveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (gdriveMatch) {
      return `https://drive.google.com/file/d/${gdriveMatch[1]}/preview`;
    }

    return null;
  };

  const embedUrl = video_url ? detectVideoEmbed(video_url) : null;

  return (
    <Card className="p-6 space-y-6">
      {/* Title */}
      <h2 className="text-2xl font-bold text-foreground">{label}</h2>

      {/* Video */}
      {embedUrl && (
        <div className="border rounded-lg overflow-hidden bg-black">
          <div className="aspect-video">
            <iframe
              src={embedUrl}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {/* Rich Content */}
      {rich_content && (
        <div 
          className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-a:text-primary"
          dangerouslySetInnerHTML={{ __html: rich_content }}
        />
      )}

      {/* Attachments */}
      {attachments && attachments.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground">📎 Materiais Complementares</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {attachments.map((attachment, index) => (
              <Card key={index} className="p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors">
                {getFileIcon(attachment.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{attachment.name}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(attachment.url, '_blank')}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
