import { Mic, Square, X, Send, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";

interface AudioRecorderProps {
  onRecordingComplete: (audioFile: File) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export function AudioRecorder({ 
  onRecordingComplete, 
  onCancel,
  disabled 
}: AudioRecorderProps) {
  const {
    isRecording,
    duration,
    audioBlob,
    audioUrl,
    startRecording,
    stopRecording,
    cancelRecording,
    error,
  } = useAudioRecorder();

  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Auto-start recording when component mounts
  useEffect(() => {
    startRecording();
    return () => {
      cancelRecording();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleConfirm = () => {
    if (!audioBlob) {
      console.error("[AudioRecorder] no blob available");
      return;
    }

    // Log obrigatorio para diagnostico
    console.log("[AudioRecorder] blob", {
      type: audioBlob.type,
      size: audioBlob.size,
      sizeKB: Math.round(audioBlob.size / 1024),
      valid: audioBlob.size > 10000,
    });

    // Validar tamanho minimo (10KB = ~1 segundo de audio)
    // Se menor, a gravacao falhou - ABORTAR (nao seguir adiante)
    if (audioBlob.size < 10000) {
      console.error("[AudioRecorder] recording failed: blob too small", audioBlob.size);
      return;
    }

    const extension = audioBlob.type.includes('webm') ? 'webm' : 'ogg';
    const file = new File(
      [audioBlob], 
      `audio-${Date.now()}.${extension}`, 
      { type: audioBlob.type }
    );
    onRecordingComplete(file);
  };

  const handleCancel = () => {
    cancelRecording();
    onCancel();
  };

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Error state
  if (error) {
    return (
      <div className="flex items-center gap-2 p-2 bg-destructive/10 text-destructive rounded-lg text-sm">
        <span>{error}</span>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Fechar
        </Button>
      </div>
    );
  }

  // Preview state: audio recorded
  if (audioBlob && audioUrl && !isRecording) {
    return (
      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg flex-1">
        <audio 
          ref={audioRef} 
          src={audioUrl} 
          onEnded={() => setIsPlaying(false)}
        />
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 shrink-0"
          onClick={togglePlayback}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        
        <div className="flex-1 h-8 bg-primary/20 rounded-full relative overflow-hidden flex items-center px-3">
          <div className="flex items-center gap-1 flex-1">
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className="w-0.5 bg-primary/60 rounded-full"
                style={{ height: `${Math.random() * 16 + 4}px` }}
              />
            ))}
          </div>
          <span className="text-xs font-mono ml-2">{formatDuration(duration)}</span>
        </div>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 shrink-0"
          onClick={handleCancel}
        >
          <X className="h-4 w-4 text-destructive" />
        </Button>
        
        <Button 
          size="icon" 
          className="h-9 w-9 rounded-full shrink-0"
          onClick={handleConfirm}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Recording state
  if (isRecording) {
    return (
      <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/30 rounded-lg flex-1">
        <div className="relative shrink-0">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
        </div>
        
        <span className="text-sm font-mono text-red-600 dark:text-red-400 shrink-0">
          {formatDuration(duration)}
        </span>
        
        <div className="flex-1 flex items-center gap-0.5 overflow-hidden">
          {Array.from({ length: 25 }).map((_, i) => (
            <div
              key={i}
              className="w-1 bg-red-400 rounded-full animate-pulse"
              style={{
                height: `${Math.random() * 16 + 8}px`,
                animationDelay: `${i * 50}ms`,
              }}
            />
          ))}
        </div>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 shrink-0"
          onClick={handleCancel}
        >
          <X className="h-4 w-4" />
        </Button>
        
        <Button 
          variant="destructive" 
          size="icon" 
          className="h-9 w-9 rounded-full shrink-0"
          onClick={stopRecording}
        >
          <Square className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Idle state (should not normally show as we auto-start)
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={startRecording}
      disabled={disabled}
      className="h-10 w-10 shrink-0"
    >
      <Mic className="h-5 w-5 text-muted-foreground" />
    </Button>
  );
}
