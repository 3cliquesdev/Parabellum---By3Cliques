import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSubmitRating } from "@/hooks/useSubmitRating";
import confetti from "canvas-confetti";
import { cn } from "@/lib/utils";

interface RatingWidgetProps {
  conversationId: string;
  channel: "web_chat" | "whatsapp";
}

export function RatingWidget({ conversationId, channel }: RatingWidgetProps) {
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  
  const submitRatingMutation = useSubmitRating();

  const handleStarClick = (rating: number) => {
    setSelectedRating(rating);
    
    // Para ratings < 3: exigir comentário obrigatório
    if (rating < 3) {
      setShowFeedbackInput(true);
    } else {
      // Para ratings >= 3: pode enviar imediatamente ou adicionar comentário opcional
      if (rating === 5) {
        // Confetti para 5 estrelas!
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
      setShowFeedbackInput(true); // Opcional para ratings bons
    }
  };

  const handleSubmit = () => {
    if (!selectedRating) return;
    
    // Para ratings < 3: feedback é obrigatório
    if (selectedRating < 3 && !feedbackText.trim()) {
      return;
    }

    submitRatingMutation.mutate({
      conversationId,
      rating: selectedRating,
      feedbackText: feedbackText.trim() || null,
      channel,
    }, {
      onSuccess: () => {
        // Widget desaparece após envio bem-sucedido
      }
    });
  };

  // Se já enviou, não mostrar nada
  if (submitRatingMutation.isSuccess) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
        <p className="text-sm font-medium text-green-800 dark:text-green-200">
          ✅ Obrigado pelo seu feedback!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 shadow-sm">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
          Como foi seu atendimento?
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Sua avaliação nos ajuda a melhorar
        </p>
      </div>

      {/* Estrelas */}
      <div className="flex justify-center gap-2 mb-4">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => handleStarClick(star)}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(null)}
            className="transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary rounded"
            disabled={submitRatingMutation.isPending}
          >
            <Star
              className={cn(
                "h-10 w-10 transition-colors",
                (hoveredStar !== null && star <= hoveredStar) || (selectedRating !== null && star <= selectedRating)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-slate-300 dark:text-slate-600"
              )}
            />
          </button>
        ))}
      </div>

      {/* Campo de Feedback */}
      {showFeedbackInput && selectedRating !== null && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
          <Textarea
            placeholder={
              selectedRating < 3
                ? "Por favor, nos conte o que aconteceu... (obrigatório)"
                : "Quer adicionar algum comentário? (opcional)"
            }
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            rows={3}
            className="resize-none"
          />
          
          {selectedRating < 3 && !feedbackText.trim() && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⚠️ Para avaliações baixas, precisamos entender o que aconteceu
            </p>
          )}

          <Button
            onClick={handleSubmit}
            disabled={
              submitRatingMutation.isPending || 
              (selectedRating < 3 && !feedbackText.trim())
            }
            className="w-full"
          >
            {submitRatingMutation.isPending ? "Enviando..." : "Enviar Avaliação"}
          </Button>
        </div>
      )}
    </div>
  );
}
