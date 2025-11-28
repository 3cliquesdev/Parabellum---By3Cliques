import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, FileSpreadsheet, File as FileIcon, ImageIcon, Download, AlertCircle, Lock, CheckCircle } from 'lucide-react';
import ReactPlayer from 'react-player';
import confetti from 'canvas-confetti';
import { QuizComponent } from './QuizComponent';
import { useToast } from '@/hooks/use-toast';

/**
 * Extrai URL de vídeo de diferentes formatos
 * - URL direta: retorna como está
 * - Iframe embed: extrai src do <iframe>
 */
const extractVideoUrl = (input: string): string | null => {
  if (!input?.trim()) return null;
  
  const trimmed = input.trim();
  
  // Se for iframe, extrair src
  const iframeMatch = trimmed.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  if (iframeMatch) {
    return iframeMatch[1];
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
  quiz_enabled?: boolean;
  quiz_question?: string;
  quiz_options?: QuizOption[];
  quiz_correct_option?: string;
  quiz_passed?: boolean;
  alreadyCompleted?: boolean;
  onVideoEnded?: () => void;
  onQuizPassed?: () => void;
  onLockStateChange?: (isLocked: boolean) => void;
}

/**
 * PlaybookStepViewer
 *
 * Responsável por renderizar a "aula": vídeo, conteúdo rico, quiz e materiais.
 * Este componente **sempre** prioriza o vídeo real configurado pelo usuário.
 */
export function PlaybookStepViewer({
  label,
  video_url,
  rich_content,
  attachments,
  quiz_enabled,
  quiz_question,
  quiz_options,
  quiz_correct_option,
  quiz_passed,
  alreadyCompleted,
  onVideoEnded,
  onQuizPassed,
  onLockStateChange,
}: PlaybookStepViewerProps) {
  const [videoCompleted, setVideoCompleted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [quizPassedLocal, setQuizPassedLocal] = useState(quiz_passed || false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [errorTimeout, setErrorTimeout] = useState(false);
  const { toast } = useToast();

  // Smart Parser: extrai URL de iframe ou URL direta
  const extractedUrl = extractVideoUrl(video_url || '');
  const trimmedUrl = extractedUrl || '';
  const hasValidVideo = !!trimmedUrl;

  // Video Lock State
  const videoLocked = hasValidVideo && !videoCompleted && !errorTimeout && !alreadyCompleted;

  const [contentConsumed, setContentConsumed] = useState(
    alreadyCompleted || quiz_passed || !hasValidVideo
  );

  // Comunicar estado de trava ao parent
  useEffect(() => {
    onLockStateChange?.(videoLocked);
  }, [videoLocked, onLockStateChange]);

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
    if (type.includes('spreadsheet') || type.includes('excel')) return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
    if (type.includes('word')) return <FileText className="h-5 w-5 text-blue-500" />;
    if (type.startsWith('image/')) return <ImageIcon className="h-5 w-5 text-purple-500" />;
    return <FileIcon className="h-5 w-5 text-gray-500" />;
  };

  const handleVideoEnd = () => {
    setVideoCompleted(true);
    setContentConsumed(true);

    toast({
      title: '🎬 Vídeo Concluído!',
      description: quiz_enabled
        ? 'Responda a pergunta para avançar.'
        : 'Você pode marcar esta etapa como concluída.',
    });

    if (!quiz_enabled) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#2563EB', '#3B82F6', '#60A5FA'],
      });
    }

    onVideoEnded?.();
  };

  const handleQuizPassed = () => {
    setQuizPassedLocal(true);
    onQuizPassed?.();
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

      {/* Premium Cinema Video Player */}
      {videoError ? (
        <div className="aspect-video bg-destructive/10 rounded-xl flex flex-col items-center justify-center border border-destructive/20">
          <AlertCircle className="h-12 w-12 text-destructive mb-2" />
          <p className="text-sm text-destructive font-medium">{videoError}</p>
          {trimmedUrl && (
            <>
              <p className="text-xs text-muted-foreground mt-1 max-w-md truncate px-4">URL: {trimmedUrl}</p>
              <button
                className="mt-3 px-4 py-2 bg-background border border-border rounded-lg text-sm hover:bg-muted transition-colors"
                onClick={() => window.open(trimmedUrl, '_blank')}
              >
                Abrir vídeo em nova aba
              </button>
            </>
          )}
        </div>
      ) : hasValidVideo ? (
        <div className="relative rounded-xl overflow-hidden shadow-2xl border border-border/50 bg-gradient-to-b from-background/80 to-muted">
          {/* Player SEMPRE renderizado com o link real do usuário */}
          <div className="aspect-video relative bg-black">
          {React.createElement(ReactPlayer as any, {
            url: trimmedUrl,
            width: '100%',
            height: '100%',
            controls: true,
            playing: false,
            light: false,
              onReady: () => {
                console.log('✅ ReactPlayer pronto para:', trimmedUrl);
              },
              onError: (e: any) => {
                console.error('❌ Erro no ReactPlayer:', e);
                setVideoError('Não foi possível carregar o vídeo');
                
                // Safety Net: liberar após 5 segundos
                toast({
                  title: '⚠️ Problema com o vídeo',
                  description: 'Liberando avanço em 5 segundos...',
                  variant: 'destructive',
                });
                
                setTimeout(() => {
                  setErrorTimeout(true);
                  toast({
                    title: '🔓 Avanço Liberado',
                    description: 'Não foi possível rastrear o vídeo.',
                  });
                }, 5000);
              },
              onEnded: handleVideoEnd,
              onPlay: () => setIsPlaying(true),
              onPause: () => setIsPlaying(false),
              config: {
                youtube: {
                  playerVars: {
                    modestbranding: 1,
                    rel: 0,
                    origin: window.location.origin,
                  },
                },
                vimeo: {
                  playerOptions: {
                    byline: false,
                    portrait: false,
                  },
                },
              },
            })}
          </div>

          {/* Status Badge */}
          {isPlaying && (
            <div className="absolute top-4 right-4 z-10">
              <Badge className="bg-red-500 text-white animate-pulse shadow-lg">
                🔴 Assistindo...
              </Badge>
            </div>
          )}

          {videoCompleted && !quiz_enabled && (
            <div className="absolute top-4 left-4 z-10">
              <Badge className="bg-green-500 text-white shadow-lg">✅ Vídeo Concluído!</Badge>
            </div>
          )}
        </div>
      ) : video_url !== undefined ? (
        <div className="aspect-video bg-muted rounded-xl flex items-center justify-center border border-border">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">Nenhum vídeo configurado para esta etapa</p>
          </div>
        </div>
      ) : null}

      {/* Indicadores de Trava/Desbloqueio */}
      {videoLocked && (
        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200">
          <Lock className="h-4 w-4" />
          <span className="text-sm font-medium">
            🔒 Assista o vídeo completo para desbloquear o próximo passo
          </span>
        </div>
      )}

      {videoCompleted && (
        <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-950/30 p-3 rounded-lg border border-green-200 animate-fade-in">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm font-medium">
            ✅ Vídeo concluído! Você pode avançar.
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

      {/* Quiz Gatekeeper - Only show after video ends */}
      {contentConsumed && quiz_enabled && quiz_question && quiz_options && quiz_correct_option && (
        <div className="animate-fade-in">
          <QuizComponent
            question={quiz_question}
            options={quiz_options}
            correctOption={quiz_correct_option}
            onPass={handleQuizPassed}
            passed={quizPassedLocal}
          />
        </div>
      )}

      {/* Attachments - Only show after video ends */}
      {contentConsumed && attachments && attachments.length > 0 && (
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
