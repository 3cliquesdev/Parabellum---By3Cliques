import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Download, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  url: string;
  waveformData?: number[];
  durationSeconds?: number;
  filename?: string;
  className?: string;
  compact?: boolean;
}

export function AudioPlayer({
  url,
  waveformData,
  durationSeconds,
  filename,
  className,
  compact = false,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds || 0);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const maxRetries = 3;
  const SPEED_OPTIONS = [1.0, 1.25, 1.5, 2.0];

  // Generate fake waveform if none provided
  const waveform = waveformData || Array.from({ length: 50 }, () => Math.random() * 0.8 + 0.2);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const barWidth = rect.width / waveform.length;
    const barGap = 2;
    const maxBarHeight = rect.height * 0.8;
    const progress = duration > 0 ? currentTime / duration : 0;

    ctx.clearRect(0, 0, rect.width, rect.height);

    waveform.forEach((amplitude, i) => {
      const x = i * barWidth;
      const barHeight = amplitude * maxBarHeight;
      const y = (rect.height - barHeight) / 2;
      const isPlayed = i / waveform.length <= progress;

      ctx.fillStyle = isPlayed 
        ? "hsl(var(--primary))" 
        : "hsl(var(--muted-foreground) / 0.3)";
      ctx.beginPath();
      ctx.roundRect(x + barGap / 2, y, barWidth - barGap, barHeight, 2);
      ctx.fill();
    });
  }, [waveform, currentTime, duration]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = (e: Event) => {
      console.error("[AudioPlayer] Error loading audio:", url, e);
      
      // Retry logic for transient errors
      if (retryCount < maxRetries) {
        console.log(`[AudioPlayer] Retrying... (${retryCount + 1}/${maxRetries})`);
        setRetryCount(prev => prev + 1);
        // Force reload by resetting src
        setTimeout(() => {
          if (audio) {
            audio.src = '';
            audio.src = url;
            audio.load();
          }
        }, 1000 * (retryCount + 1)); // Exponential backoff
      } else {
        setError("Erro ao carregar áudio");
        setIsLoading(false);
      }
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("canplay", handleCanPlay);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("canplay", handleCanPlay);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  const cycleSpeed = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const currentIndex = SPEED_OPTIONS.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length;
    const newRate = SPEED_OPTIONS[nextIndex];
    
    audio.playbackRate = newRate;
    setPlaybackRate(newRate);
  }, [playbackRate, SPEED_OPTIONS]);

  const handleSeek = useCallback((value: number[]) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const newTime = (value[0] / 100) * duration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration]);

  const handleDownload = useCallback(() => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || "audio";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [url, filename]);

  const handleManualRetry = useCallback(() => {
    setError(null);
    setIsLoading(true);
    setRetryCount(0);
    const audio = audioRef.current;
    if (audio) {
      audio.src = '';
      audio.src = url;
      audio.load();
    }
  }, [url]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (error) {
    return (
      <div className={cn("flex items-center gap-2 p-3 rounded-xl bg-background/50 border border-destructive/30", className)}>
        <span className="text-sm text-destructive">⚠️ {error}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleManualRetry}
          className="ml-auto text-xs text-muted-foreground hover:text-foreground"
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl bg-background/50 border border-border/50",
        compact && "p-2 gap-2",
        className
      )}
      role="region"
      aria-label="Audio player"
    >
      <audio ref={audioRef} src={url} preload="metadata" />

      {/* Play/Pause Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={togglePlay}
        disabled={isLoading}
        className={cn(
          "shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90",
          compact ? "h-8 w-8" : "h-10 w-10"
        )}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isLoading ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : isPlaying ? (
          <Pause className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
        ) : (
          <Play className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4", "ml-0.5")} />
        )}
      </Button>

      {/* Waveform + Progress */}
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <canvas
          ref={canvasRef}
          className={cn("w-full cursor-pointer", compact ? "h-6" : "h-8")}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const progress = (x / rect.width) * 100;
            handleSeek([progress]);
          }}
          role="slider"
          aria-label="Audio progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={(currentTime / duration) * 100}
        />
        
        {/* Time Display */}
        <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Speed Control */}
      <Button
        variant="ghost"
        size="sm"
        onClick={cycleSpeed}
        className={cn("shrink-0 px-2 font-mono text-xs", compact ? "h-7" : "h-8")}
        aria-label="Playback speed"
        title="Alterar velocidade de reprodução"
      >
        {playbackRate}x
      </Button>

      {/* Volume Toggle */}
      {!compact && (
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMute}
          className="shrink-0 h-8 w-8"
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Volume2 className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      )}

      {/* Download Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDownload}
        className={cn("shrink-0", compact ? "h-7 w-7" : "h-8 w-8")}
        aria-label="Download audio"
      >
        <Download className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4", "text-muted-foreground")} />
      </Button>
    </div>
  );
}
