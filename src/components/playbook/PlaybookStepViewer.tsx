import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, FileSpreadsheet, File as FileIcon, ImageIcon, Download, Lock, CheckCircle } from 'lucide-react';
import ReactPlayer from 'react-player';
import confetti from 'canvas-confetti';
import { QuizComponent } from './QuizComponent';

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
  
  return trimmed; // Tentar usar como está
};

interface Attachment {
  name: string;
  url: string;
  type: string;
  size?: number;
}

interface QuizOption {
  id: string;
  text: string;
}

interface PlaybookStepViewerProps {
  label: string;
  video_url?: string;
  rich_content?: string;
  attachments?: Attachment[];
  min_view_seconds?: number;
  quiz_enabled?: boolean;
  quiz_question?: string;
  quiz_options?: QuizOption[];
  quiz_correct_option?: string;
  onLockStateChange?: (isLocked: boolean) => void;
  onQuizPassed?: () => void;
}

/**
 * PlaybookStepViewer - TIMER-BASED LOCK
 * 
 * Simplificado: ao invés de detectar fim do vídeo, usa contador regressivo
 * para desbloquear o botão "Próximo" após X segundos.
 */
export function PlaybookStepViewer({
  label,
  video_url,
  rich_content,
  attachments,
  min_view_seconds = 10,
  quiz_enabled,
  quiz_question,
  quiz_options,
  quiz_correct_option,
  onLockStateChange,
  onQuizPassed
}: PlaybookStepViewerProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(min_view_seconds);
  const [timerComplete, setTimerComplete] = useState(min_view_seconds === 0);
  const [quizPassed, setQuizPassed] = useState(false);

  const videoUrl = extractVideoUrl(video_url || "");

  // Normalize iframe HTML to force 100% dimensions
  const normalizeIframe = (iframeHtml: string): string => {
    return iframeHtml
      .replace(/width=["']\d+["']/gi, 'width="100%"')
      .replace(/height=["']\d+["']/gi, 'height="100%"')
      .replace(/<iframe/gi, '<iframe style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"');
  };

  // Timer countdown effect
  useEffect(() => {
    if (timerComplete || secondsRemaining <= 0) return;
    
    const interval = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          setTimerComplete(true);
          clearInterval(interval);
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [timerComplete, secondsRemaining]);

  // Determine lock state based on timer and quiz
  const isLocked = !timerComplete || (quiz_enabled && !quizPassed);

  useEffect(() => {
    onLockStateChange?.(isLocked);
  }, [isLocked, onLockStateChange]);

  const handleQuizPassed = () => {
    setQuizPassed(true);
    onQuizPassed?.();
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
    if (type.includes('spreadsheet') || type.includes('excel')) return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
    if (type.includes('word')) return <FileText className="h-5 w-5 text-blue-500" />;
    if (type.startsWith('image/')) return <ImageIcon className="h-5 w-5 text-purple-500" />;
    return <FileIcon className="h-5 w-5 text-gray-500" />;
  };

  return (
    <Card className="p-6 space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">{label}</h2>
        {timerComplete && (
          <Badge className="bg-green-500 text-white">
            ✅ Desbloqueado
          </Badge>
        )}
      </div>

      {/* Video Player - Universal Rendering */}
      {videoUrl && (
        <div className="aspect-video rounded-xl overflow-hidden bg-black border-2 border-border mb-6">
          {video_url?.includes('<iframe') ? (
            // Direct iframe embed with normalized dimensions
            <div 
              className="relative w-full h-full"
              dangerouslySetInnerHTML={{ __html: normalizeIframe(video_url) }} 
            />
          ) : (
            // URL-based player (no event listeners)
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

      {/* Timer Status */}
      {!timerComplete && secondsRemaining > 0 && (
        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 mb-4">
          <Lock className="h-4 w-4" />
          <span className="font-medium">
            🔒 Aguarde {secondsRemaining}s para avançar...
          </span>
        </div>
      )}

      {timerComplete && (
        <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-950/30 p-3 rounded-lg border border-green-200 mb-4 animate-pulse">
          <CheckCircle className="h-4 w-4" />
          <span className="font-medium">
            ✅ Tempo concluído! Você pode avançar.
          </span>
        </div>
      )}

      {/* Rich Content */}
      {rich_content && (
        <div
          className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-a:text-primary"
          dangerouslySetInnerHTML={{ __html: rich_content }}
        />
      )}

      {/* Quiz Gatekeeper - Only show after timer completes */}
      {timerComplete && quiz_enabled && quiz_question && quiz_options && quiz_correct_option && (
        <div className="animate-fade-in">
          <QuizComponent
            question={quiz_question}
            options={quiz_options}
            correctOption={quiz_correct_option}
            onPass={handleQuizPassed}
            passed={quizPassed}
          />
        </div>
      )}

      {/* Attachments - Only show after timer completes */}
      {timerComplete && attachments && attachments.length > 0 && (
        <div className="animate-fade-in">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">📎 Materiais Complementares</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {attachments.map((attachment, index) => (
                <Card
                  key={index}
                  className="p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors"
                >
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
        </div>
      )}
    </Card>
  );
}
