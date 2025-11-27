import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, FileSpreadsheet, File as FileIcon, ImageIcon, Download } from 'lucide-react';
import ReactPlayer from 'react-player';
import confetti from 'canvas-confetti';

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
  onVideoEnded?: () => void;
}

export function PlaybookStepViewer({ label, video_url, rich_content, attachments, onVideoEnded }: PlaybookStepViewerProps) {
  const [videoCompleted, setVideoCompleted] = useState(false);

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
    if (type.includes('spreadsheet') || type.includes('excel')) return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
    if (type.includes('word')) return <FileText className="h-5 w-5 text-blue-500" />;
    if (type.startsWith('image/')) return <ImageIcon className="h-5 w-5 text-purple-500" />;
    return <FileIcon className="h-5 w-5 text-gray-500" />;
  };

  const handleVideoEnd = () => {
    setVideoCompleted(true);
    confetti({ 
      particleCount: 100, 
      spread: 70, 
      origin: { y: 0.6 },
      colors: ['#2563EB', '#3B82F6', '#60A5FA']
    });
    onVideoEnded?.();
  };

  return (
    <Card className="p-6 space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">{label}</h2>
        {videoCompleted && (
          <Badge className="bg-green-500 text-white animate-pulse">
            🎉 Vídeo Concluído!
          </Badge>
        )}
      </div>

      {/* Video Player */}
      {video_url && (ReactPlayer as any).canPlay && (ReactPlayer as any).canPlay(video_url) && (
        <div className="rounded-lg overflow-hidden bg-black shadow-lg">
          <div className="aspect-video">
            {React.createElement(ReactPlayer as any, {
              url: video_url,
              width: '100%',
              height: '100%',
              controls: true,
              onEnded: handleVideoEnd,
            })}
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
