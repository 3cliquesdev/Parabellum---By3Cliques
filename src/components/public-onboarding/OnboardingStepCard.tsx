import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { QuizCard } from "./QuizCard";
import DOMPurify from "dompurify";
import { 
  CheckCircle2, 
  AlertTriangle, 
  Play, 
  MessageCircle,
  FileText,
  Loader2,
  Youtube
} from "lucide-react";

interface Step {
  id: string;
  step_name: string;
  position: number;
  completed: boolean;
  is_critical: boolean;
  video_url?: string;
  rich_content?: string;
  quiz_enabled?: boolean;
  quiz_question?: string;
  quiz_options?: any;
  quiz_correct_option?: string;
  quiz_passed?: boolean;
  attachments?: any;
}

interface OnboardingStepCardProps {
  step: Step;
  stepNumber: number;
  totalSteps: number;
  onComplete: (completed: boolean) => void;
  onQuizPass: () => void;
  supportPhone: string;
  customerName: string;
  saving: boolean;
}

export function OnboardingStepCard({
  step,
  stepNumber,
  totalSteps,
  onComplete,
  onQuizPass,
  supportPhone,
  customerName,
  saving,
}: OnboardingStepCardProps) {
  const [videoWatched, setVideoWatched] = useState(false);

  const whatsappUrl = `https://wa.me/${supportPhone}?text=${encodeURIComponent(
    `Olá! Sou ${customerName} e preciso de ajuda na etapa "${step.step_name}" do meu onboarding.`
  )}`;

  const sanitizedContent = step.rich_content 
    ? DOMPurify.sanitize(step.rich_content, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'a', 'img'],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'target', 'rel'],
      })
    : null;

  const attachments = step.attachments ? 
    (Array.isArray(step.attachments) ? step.attachments : []) : [];

  const canMarkComplete = !step.quiz_enabled || step.quiz_passed;

  // Helper to convert YouTube URL to embed URL
  const getEmbedUrl = (url: string) => {
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(youtubeRegex);
    if (match) {
      return `https://www.youtube.com/embed/${match[1]}?rel=0&modestbranding=1`;
    }
    // Vimeo
    const vimeoRegex = /vimeo\.com\/(\d+)/;
    const vimeoMatch = url.match(vimeoRegex);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }
    return url;
  };

  return (
    <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl shadow-xl border-white/20 overflow-hidden">
      {/* Header */}
      <CardHeader className="bg-gradient-to-r from-primary/5 to-emerald-500/5 border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`
              w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
              ${step.completed 
                ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600" 
                : "bg-primary/10 text-primary"
              }
            `}>
              {step.completed ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <span className="text-xl font-bold">{stepNumber}</span>
              )}
            </div>
            <div>
              <CardTitle className="text-xl mb-1">{step.step_name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Etapa {stepNumber} de {totalSteps}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {step.is_critical && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="w-3 h-3" />
                Obrigatória
              </Badge>
            )}
            {step.completed && (
              <Badge className="bg-emerald-500 gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Concluída
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Video Player */}
        {step.video_url && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl overflow-hidden bg-black aspect-video"
          >
            <iframe
              src={getEmbedUrl(step.video_url)}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Video"
            />
          </motion.div>
        )}

        {/* Rich Content */}
        {sanitizedContent && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
          />
        )}

        {/* Attachments */}
        {attachments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-2"
          >
            <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Materiais de Apoio
            </h4>
            <div className="grid gap-2">
              {attachments.map((attachment: any, i: number) => (
                <a
                  key={i}
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <FileText className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium">{attachment.name || `Arquivo ${i + 1}`}</span>
                </a>
              ))}
            </div>
          </motion.div>
        )}

        {/* Quiz */}
        {step.quiz_enabled && step.quiz_question && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <QuizCard
              question={step.quiz_question}
              options={step.quiz_options || []}
              correctOption={step.quiz_correct_option || ""}
              passed={step.quiz_passed || false}
              onPass={onQuizPass}
            />
          </motion.div>
        )}

        {/* Completion Checkbox */}
        {canMarkComplete && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="pt-4 border-t border-border"
          >
            <label className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-all group">
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              ) : (
                <Checkbox
                  checked={step.completed}
                  onCheckedChange={(checked) => onComplete(checked as boolean)}
                  className="w-5 h-5"
                />
              )}
              <span className="text-sm font-medium group-hover:text-primary transition-colors">
                {step.completed 
                  ? "Etapa concluída! ✅" 
                  : "Marcar esta etapa como concluída"
                }
              </span>
            </label>
          </motion.div>
        )}

        {/* WhatsApp Help */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors text-sm font-medium"
          >
            <MessageCircle className="w-4 h-4" />
            Precisa de ajuda? Fale conosco no WhatsApp
          </a>
        </motion.div>
      </CardContent>
    </Card>
  );
}
